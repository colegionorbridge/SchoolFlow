import { z } from 'zod';

export const HistorialItemSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

export const PendienteConfirmacionSchema = z.object({
  accionOriginal: z.string(),
  datos: z.object({
    accion: z.string(),
    ticketData: z.object({
      id: z.number().optional(),
      asunto: z.string().optional(),
      descripcion: z.string().optional(),
      ubicacion: z.string().optional(),
      comentario: z.string().optional(),
      userTelefono: z.string().optional(),
    }).optional(),
  }),
  timestamp: z.number().optional(),
});

export const UserContextSchema = z.object({
  historialConversacion: z.array(HistorialItemSchema).optional(),
  pendienteConfirmacion: PendienteConfirmacionSchema.nullable().optional(),
  procesando: z.boolean().optional(),
  registro: z.object({
    sectorId: z.number().int().positive(),
    nombreSector: z.string(),
  }).nullable().optional(),
  rolPendienteId: z.number().int().positive().optional(),
  nombreRolPendiente: z.string().optional(),
  esperandoCierreConfirmacion: z.object({
    ticketId: z.number(),
    asunto: z.string(),
  }).nullable().optional(),
});

export type HistorialItem = z.infer<typeof HistorialItemSchema>;
export type PendienteConfirmacion = z.infer<typeof PendienteConfirmacionSchema>;
export type UserContext = z.infer<typeof UserContextSchema>;
