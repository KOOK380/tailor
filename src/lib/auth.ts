/**
 * Authentication: email/password with scrypt hashing and HMAC-signed session
 * cookies. Works identically in PGlite and Supabase modes (Supabase Auth swap
 * documented in README).
 */
import { scrypt, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  userProfiles,
  businessMemberships,
  businesses,
  type UserProfile,
  type UserRole,
} from "@/db/schema";

const scryptAsync = promisify(scrypt);

const SESSION_COOKIE = "tailor_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function getAuthSecret(): string {
  return process.env.AUTH_SECRET ?? "dev-only-secret-change-in-production";
}

/* ------------------------------------------------------------------ */
/* Password hashing (scrypt, no native deps)                           */
/* ------------------------------------------------------------------ */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/* ------------------------------------------------------------------ */
/* Session tokens                                                      */
/* ------------------------------------------------------------------ */

interface SessionPayload {
  userId: string;
  businessId: string;
  exp: number;
}

function sign(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", getAuthSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verify(token: string): SessionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", getAuthSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string, businessId: string): Promise<void> {
  const token = sign({ userId, businessId, exp: Date.now() + SESSION_TTL_MS });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/* ------------------------------------------------------------------ */
/* Session resolution                                                  */
/* ------------------------------------------------------------------ */

export interface SessionUser {
  userId: string;
  businessId: string;
  email: string;
  fullName: string;
  role: UserRole;
  permissions: RolePermissions;
}

/**
 * Permission matrix. Every server action / API route checks these instead of
 * raw role strings, so policy lives in one place.
 */
export interface RolePermissions {
  manageOrders: boolean;
  manageCustomers: boolean;
  manageEmployees: boolean;
  manageBilling: boolean;
  manageSettings: boolean;
  manageNotifications: boolean;
  viewReports: boolean;
  updateStages: boolean; // production staff can update their assigned stages
  skipStages: boolean; // only admins/managers may skip mandatory stages
}

const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  super_admin: {
    manageOrders: true,
    manageCustomers: true,
    manageEmployees: true,
    manageBilling: true,
    manageSettings: true,
    manageNotifications: true,
    viewReports: true,
    updateStages: true,
    skipStages: true,
  },
  manager: {
    manageOrders: true,
    manageCustomers: true,
    manageEmployees: true,
    manageBilling: true,
    manageSettings: false,
    manageNotifications: true,
    viewReports: true,
    updateStages: true,
    skipStages: true,
  },
  production_staff: {
    manageOrders: false,
    manageCustomers: false,
    manageEmployees: false,
    manageBilling: false,
    manageSettings: false,
    manageNotifications: false,
    viewReports: false,
    updateStages: true,
    skipStages: false,
  },
  billing_staff: {
    manageOrders: false,
    manageCustomers: true,
    manageEmployees: false,
    manageBilling: true,
    manageSettings: false,
    manageNotifications: false,
    viewReports: true,
    updateStages: false,
    skipStages: false,
  },
};

export function permissionsFor(role: UserRole): RolePermissions {
  return ROLE_PERMISSIONS[role];
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verify(token);
  if (!payload) return null;

  const db = getDb();
  const [user] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, payload.userId))
    .limit(1);
  if (!user) return null;

  const [membership] = await db
    .select()
    .from(businessMemberships)
    .where(
      and(
        eq(businessMemberships.userId, payload.userId),
        eq(businessMemberships.businessId, payload.businessId),
        eq(businessMemberships.isActive, true),
      ),
    )
    .limit(1);
  if (!membership) return null;

  return {
    userId: user.id,
    businessId: payload.businessId,
    email: user.email,
    fullName: user.fullName,
    role: membership.role,
    permissions: permissionsFor(membership.role),
  };
}

/** Require a session or throw a redirect-friendly error. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new AuthError("Not authenticated", 401);
  }
  return session;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

/** Require a specific permission. */
export async function requirePermission<K extends keyof RolePermissions>(
  key: K,
): Promise<SessionUser> {
  const session = await requireSession();
  if (!session.permissions[key]) {
    throw new AuthError(`Missing permission: ${key}`, 403);
  }
  return session;
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

export interface RegisterInput {
  businessName: string;
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}

export async function registerBusiness(input: RegisterInput) {
  const db = getDb();
  const passwordHash = await hashPassword(input.password);
  const slug =
    input.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") + "-" + randomBytes(2).toString("hex");

  return db.transaction(async (tx) => {
    const [business] = await tx
      .insert(businesses)
      .values({ name: input.businessName, slug, phone: input.phone ?? null })
      .returning();
    const [user] = await tx
      .insert(userProfiles)
      .values({
        fullName: input.fullName,
        email: input.email.toLowerCase(),
        passwordHash,
        phone: input.phone ?? null,
      })
      .returning();
    await tx.insert(businessMemberships).values({
      businessId: business.id,
      userId: user.id,
      role: "super_admin",
    });
    return { businessId: business.id, userId: user.id };
  });
}

export async function authenticate(email: string, password: string) {
  const db = getDb();
  const [user] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.email, email.toLowerCase()))
    .limit(1);
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  const [membership] = await db
    .select()
    .from(businessMemberships)
    .where(
      and(eq(businessMemberships.userId, user.id), eq(businessMemberships.isActive, true)),
    )
    .limit(1);
  if (!membership) return null;

  return { userId: user.id, businessId: membership.businessId };
}
