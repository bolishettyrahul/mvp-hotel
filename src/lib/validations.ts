import { z } from 'zod';

// ─── Auth Schemas ────────────────────────────────────────────────────────────

export const adminLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const kitchenLoginSchema = z.object({
  pin: z.string().min(4, 'PIN must be 4–6 digits').max(6, 'PIN must be 4–6 digits').regex(/^\d{4,6}$/, 'PIN must be 4–6 digits'),
});

// ─── Table Schemas ───────────────────────────────────────────────────────────

export const createTableSchema = z.object({
  number: z.number().int().positive('Table number must be positive'),
  label: z.string().optional(),
  capacity: z.number().int().min(1).max(20).default(4),
});

export const updateTableSchema = z.object({
  label: z.string().optional(),
  capacity: z.number().int().min(1).max(20).optional(),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'DISABLED']).optional(),
});

// ─── Session Schemas ─────────────────────────────────────────────────────────

export const createSessionSchema = z.object({
  tableId: z.string().cuid('Invalid table ID'),
  guestCount: z.number().int().min(1).max(20).optional(),
});

export const updateSessionSchema = z.object({
  status: z.enum(['COMPLETED', 'EXPIRED', 'CANCELLED']),
});

// ─── Category Schemas ────────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(50),
  sortOrder: z.number().int().default(0),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// ─── Menu Item Schemas ───────────────────────────────────────────────────────

export const createMenuItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(100),
  description: z.string().max(500).optional(),
  price: z.number().positive('Price must be positive'),
  categoryId: z.string().cuid('Invalid category ID'),
  imageUrl: z.string().url().optional(),
  isVeg: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const updateMenuItemSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  price: z.number().positive().optional(),
  categoryId: z.string().cuid().optional(),
  imageUrl: z.string().url().nullable().optional(),
  isVeg: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const toggleAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});

// ─── Order Schemas ───────────────────────────────────────────────────────────

export const orderItemSchema = z.object({
  menuItemId: z.string().cuid('Invalid menu item ID'),
  quantity: z.number().int().min(1).max(50),
  notes: z.string().max(200).optional(),
});

export const createOrderSchema = z.object({
  sessionId: z.string().cuid('Invalid session ID'),
  tableId: z.string().cuid('Invalid table ID'),
  items: z.array(orderItemSchema).min(1, 'Order must have at least one item'),
  specialNotes: z.string().max(500).optional(),
  idempotencyKey: z.string().min(1, 'Idempotency key is required'),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']),
  note: z.string().max(200).optional(),
});

// ─── Payment Schemas ─────────────────────────────────────────────────────────

export const initiatePaymentSchema = z.object({
  orderId: z.string().cuid('Invalid order ID'),
  sessionId: z.string().cuid('Invalid session ID'),
  method: z.enum(['UPI', 'CASH', 'PAY_AT_COUNTER']),
});

export const verifyPaymentSchema = z.object({
  paymentId: z.string().cuid('Invalid payment ID'),
  transactionId: z.string().optional(),
});

// ─── Kitchen Staff Schema ────────────────────────────────────────────────────

export const createKitchenStaffSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  pin: z.string().length(6, 'PIN must be exactly 6 digits').regex(/^\d{6}$/, 'PIN must be 6 digits'),
});

// ─── Restaurant Settings Schema ──────────────────────────────────────────────

export const updateRestaurantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  taxPercent: z.number().min(0).max(100).optional(),
  currency: z.string().length(3).optional(),
});
