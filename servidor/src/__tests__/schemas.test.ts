import { describe, it, expect } from 'vitest';
import {
  HistorialItemSchema,
  PendienteConfirmacionSchema,
  UserContextSchema,
} from '../bot/schemas.js';

describe('HistorialItemSchema', () => {
  it('acepta un ítem válido', () => {
    const r = HistorialItemSchema.safeParse({ role: 'user', content: 'hola' });
    expect(r.success).toBe(true);
  });

  it('rechaza un role inválido', () => {
    const r = HistorialItemSchema.safeParse({ role: 'system', content: 'x' });
    expect(r.success).toBe(false);
  });
});

describe('PendienteConfirmacionSchema', () => {
  it('acepta un pendiente de crear ticket', () => {
    const r = PendienteConfirmacionSchema.safeParse({
      accionOriginal: 'CREAR_TICKET',
      datos: {
        accion: 'CREAR_TICKET',
        ticketData: { asunto: 'Proyector', descripcion: 'no anda', ubicacion: 'Aula 3' },
      },
      timestamp: Date.now(),
    });
    expect(r.success).toBe(true);
  });

  it('rechaza datos sin accion', () => {
    const r = PendienteConfirmacionSchema.safeParse({
      accionOriginal: 'CREAR_TICKET',
      datos: {},
    });
    expect(r.success).toBe(false);
  });
});

describe('UserContextSchema', () => {
  it('acepta un context completo de norbridge', () => {
    const r = UserContextSchema.safeParse({
      historialConversacion: [{ role: 'assistant', content: '¿En qué sector?' }],
      pendienteConfirmacion: null,
      procesando: false,
      registro: { sectorId: 2, nombreSector: 'Primaria' },
      esperandoCierreConfirmacion: null,
    });
    expect(r.success).toBe(true);
  });

  it('rechaza historialConversacion con role inválido', () => {
    const r = UserContextSchema.safeParse({
      historialConversacion: [{ role: 'bot', content: 'x' }],
    });
    expect(r.success).toBe(false);
  });

  it('acepta un context vacío', () => {
    const r = UserContextSchema.safeParse({});
    expect(r.success).toBe(true);
  });
});
