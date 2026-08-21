import type { Request, Response } from 'express';
import { getSetting, setSetting } from '../config/settings.js';
import { sequelize } from '../config/database.js';
import { logger } from '../config/logger.js';

export function getMasterCode(_req: Request, res: Response) {
  res.json({ masterCode: getSetting('masterCode') });
}

export function setMasterCode(req: Request, res: Response) {
  const { masterCode } = req.body;
  if (typeof masterCode !== 'string' || masterCode.length === 0) {
    return res.status(400).json({ error: 'masterCode requerido' });
  }
  setSetting('masterCode', masterCode);
  logger.info('Código maestro actualizado');
  res.json({ ok: true });
}

export async function limpiarDB(_req: Request, res: Response) {
  try {
    await sequelize.query(
      'TRUNCATE TABLE tickets, usuarios, usuarios_sectores, roles, sectores RESTART IDENTITY CASCADE',
    );
    logger.warn('Base de datos limpiada completamente');
    res.json({ ok: true, mensaje: 'Base de datos limpiada. IDs reiniciados. Código maestro conservado.' });
  } catch (e: any) {
    logger.error({ err: e.message }, 'Error al limpiar DB');
    res.status(500).json({ error: 'Error al limpiar la base de datos' });
  }
}
