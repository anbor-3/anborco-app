import { z } from "zod";

export const projectSchema = z.object({
  id: z.number().optional(),
  company: z.string().min(1),
  manager: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  name: z.string().min(1),
  contractStart: z.string().nullable().optional(),
  contractEnd: z.string().nullable().optional(),
  unitPrice: z.number().int().nonnegative().default(0),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  paymentDate: z.string().optional().default(""),
  transferDate: z.string().optional().default(""),
  requiredPeople: z.string().optional().default("0"),
  requiredUnit: z.string().optional().default("名"),
  customFields: z.record(z.string()).optional().default({})
});

export type ProjectInput = z.infer<typeof projectSchema>;
