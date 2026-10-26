import { z } from "zod";
export const uuid = z.string().uuid();
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z
    .email()
    .max(200)
    .transform((v) => v.toLowerCase()),
  phone: z
    .string()
    .regex(/^\+?[0-9 ()-]{8,20}$/)
    .nullable()
    .optional(),
});
export const userSchema = profileSchema.extend({
  password: z.string().min(10).max(128),
  role: z.enum(["ADMIN", "ALUNO", "BIBLIOTECARIO"]),
});
export const bookSchema = z.object({
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().min(2).max(150),
  isbn: z.string().trim().min(5).max(32),
  category: z.string().min(2).max(60),
  description: z.string().min(10).max(5000),
  publisher: z.string().min(2).max(120),
  year: z.coerce.number().int().min(1000).max(2100),
  pages: z.coerce.number().int().min(1).max(20000),
  available: z.boolean().optional(),
});
export const notificationSchema = z.object({
  eventKey: z.string().min(1).max(200),
  type: z.string().min(1).max(80),
  message: z.string().min(1).max(2000),
  channels: z
    .array(z.enum(["EMAIL", "SMS", "WHATSAPP"]))
    .min(1)
    .max(3),
  recipientIds: z.array(uuid).min(1).max(100),
});
