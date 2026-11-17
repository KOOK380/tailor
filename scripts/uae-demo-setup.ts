/**
 * One-off demo restyle → UAE/GCC: set AED currency, VAT 5%, TRN, generate a
 * placeholder business logo PNG, and align the demo invoice amounts.
 * Run with the dev/prod server STOPPED: npx tsx scripts/uae-demo-setup.ts
 */
import { dbReady, getDb } from "../src/db/client";
import { businesses, businessSettings, invoices, customers } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

/* ---------- tiny PNG encoder (128x128 RGBA, blue tile with white "T") ---------- */
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function makeLogoPng(): Buffer {
  const W = 128;
  const H = 128;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    const row = y * (W * 4 + 1);
    raw[row] = 0; // filter none
    for (let x = 0; x < W; x++) {
      const o = row + 1 + x * 4;
      // blue background with slight vertical gradient
      let r = 37, g = 99, b = 235;
      if (y < 6) {
        r = 29; g = 78; b = 216;
      }
      // white "T" glyph (rounded-ish bars)
      const inTopBar = x >= 28 && x <= 99 && y >= 26 && y <= 48;
      const inStem = x >= 54 && x <= 73 && y >= 48 && y <= 102;
      if (inTopBar || inStem) {
        r = 255; g = 255; b = 255;
      }
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function main() {
  await dbReady();
  const db = getDb();

  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.slug, "royal-tailors"))
    .limit(1);
  if (!biz) throw new Error("demo business not found — run npm run db:seed first");

  // 1. Business → UAE identity
  const logoName = `logo-${biz.id}.png`;
  mkdirSync(path.join(process.cwd(), "uploads"), { recursive: true });
  writeFileSync(path.join(process.cwd(), "uploads", logoName), makeLogoPng());

  await db
    .update(businesses)
    .set({
      currency: "AED",
      timezone: "Asia/Dubai",
      trn: "100329045700003",
      phone: "+971 4 555 0123",
      email: "owner@royaltailors.ae",
      address: "Al Barsha 1, Dubai, United Arab Emirates",
      logoPath: logoName,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, biz.id));

  // 2. Billing → VAT 5%
  await db
    .update(businessSettings)
    .set({ taxLabel: "VAT", taxRate: "5", updatedAt: new Date() })
    .where(eq(businessSettings.businessId, biz.id));

  // 3. Customer TRNs
  await db
    .update(customers)
    .set({ trn: "100456789000003" })
    .where(eq(customers.businessId, biz.id));

  // 4. Demo invoice → consistent VAT amounts (4200 + 5% = 4410)
  await db
    .update(invoices)
    .set({
      taxLabel: "VAT",
      taxRate: "5",
      taxAmount: "210",
      total: "4410",
      balanceDue: "4410",
      updatedAt: new Date(),
    })
    .where(eq(invoices.invoiceNumber, "INV-9999"));

  console.log("UAE demo setup complete:");
  console.log("  business: AED / VAT 5% / TRN 100329045700003");
  console.log(`  logo: uploads/${logoName}`);
  console.log("  customer TRNs set");
  console.log("  INV-9999 updated to VAT totals (AED 4,410.00)");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
