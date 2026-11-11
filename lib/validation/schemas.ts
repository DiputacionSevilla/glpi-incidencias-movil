import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(512),
});
export const followupSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Escribe una anotacion")
    .max(8000, "La anotacion supera 8000 caracteres"),
  isPrivate: z.literal(false).default(false),
});
export const closeSchema = z.object({
  solution: z
    .string()
    .trim()
    .min(1, "Escribe una anotacion de cierre")
    .max(8000, "La anotacion supera 8000 caracteres"),
});
export const ticketIdSchema = z.coerce.number().int().positive();
export const userSearchSchema = z.object({
  query: z.string().trim().min(2, "Escribe al menos dos caracteres").max(100),
});
export const createTicketSchema = z.object({
  title: z.string().trim().min(1, "Escribe un titulo").max(255, "El titulo supera 255 caracteres"),
  content: z
    .string()
    .trim()
    .min(1, "Describe la incidencia")
    .max(8000, "La descripcion supera 8000 caracteres"),
  requesterId: z.number().int().positive(),
  technicianIds: z.array(z.number().int().positive()).min(1, "Selecciona al menos un tecnico"),
  priority: z.coerce.number().int().min(1).max(6).default(3),
});
export const updateTicketSchema = createTicketSchema;
export const paginationSchema = z.object({
  start: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(50).default(20),
});
export const ticketFiltersSchema = z
  .object({
    status: z
      .enum(["open", "all", "new", "processing", "planned", "pending", "solved", "closed"])
      .default("open"),
    priority: z
      .enum(["all", "very-low", "low", "medium", "high", "very-high", "major"])
      .default("all"),
    openedFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    openedTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    query: z.string().trim().max(100).default(""),
  })
  .refine(({ openedFrom, openedTo }) => !openedFrom || !openedTo || openedFrom <= openedTo, {
    message: "La fecha inicial no puede ser posterior a la final",
    path: ["openedTo"],
  });
