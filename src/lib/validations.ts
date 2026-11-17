import { z } from "zod";

export const customerSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  mobile: z.string().min(7, "Mobile number is required"),
  altMobile: z.string().optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  trn: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});
export type CustomerInput = z.infer<typeof customerSchema>;

export const measurementSchema = z.object({
  garmentType: z.string().min(1, "Garment type is required"),
  label: z.string().optional().or(z.literal("")),
  values: z.record(z.string(), z.string()),
  notes: z.string().optional().or(z.literal("")),
});
export type MeasurementInput = z.infer<typeof measurementSchema>;

export const orderItemSchema = z.object({
  garmentCategory: z.string().min(1),
  garmentType: z.string().min(1, "Garment type is required"),
  quantity: z.coerce.number().int().min(1).default(1),
  fabricDetails: z.string().optional().or(z.literal("")),
  color: z.string().optional().or(z.literal("")),
  measurements: z.record(z.string(), z.string()).default({}),
  measurementId: z.string().uuid().optional().or(z.literal("")),
  unitPrice: z.coerce.number().min(0).default(0),
  notes: z.string().optional().or(z.literal("")),
  // Stage keys to skip for this item (e.g. ["embroidery","stone_crystals"])
  skippedStages: z.array(z.string()).default([]),
});

export const orderSchema = z.object({
  customerId: z.string().uuid("Select a customer"),
  priority: z.enum(["normal", "high", "urgent", "critical"]).default("normal"),
  orderDate: z.string().min(1),
  deliveryDate: z.string().min(1),
  deliveryTime: z.string().optional().or(z.literal("")),
  assignedEmployeeId: z.string().uuid().optional().or(z.literal("")),
  designInstructions: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  items: z.array(orderItemSchema).min(1, "Add at least one garment"),
  // Advance payment collected with the order (Module 10 — optional).
  advancePayment: z
    .object({
      amount: z.coerce.number().min(0),
      method: z
        .enum(["cash", "upi", "card", "bank_transfer", "cheque", "other"])
        .default("cash"),
      reference: z.string().optional().or(z.literal("")),
    })
    .optional(),
});
export type OrderInput = z.infer<typeof orderSchema>;

export const employeeSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  categories: z
    .array(
      z.enum([
        "cutting",
        "designing",
        "embroidery",
        "stone_crystals",
        "hand_work",
        "stitching",
      ]),
    )
    .default([]),
  isActive: z.boolean().default(true),
});
export type EmployeeInput = z.infer<typeof employeeSchema>;
