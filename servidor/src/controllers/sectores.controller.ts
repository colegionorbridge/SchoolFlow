import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { Sector } from '../models/models.js';
import { getIO } from '../socket/server.js';
import { logger } from '../config/logger.js';

export async function getAll(_req: AuthRequest, res: Response) {
  try {
    const sectores = await Sector.findAll({ order: [['nombre', 'ASC']] });
    res.json(sectores);
  } catch (e) {
    logger.error({ err: e }, 'Error en getAll sectores');
    res.status(500).json({ error: 'Error al obtener sectores' });
  }
}

export async function getById(req: AuthRequest, res: Response) {
  try {
    const sector = await Sector.findByPk(req.params.id as string);
    if (!sector) return res.status(404).json({ error: 'No encontrado' });
    res.json(sector);
  } catch (e) {
    logger.error({ err: e }, 'Error en getById sector');
    res.status(500).json({ error: 'Error al obtener sector' });
  }
}

export async function create(req: AuthRequest, res: Response) {
  try {
    const { nombre, codigoAcceso } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    if (!codigoAcceso) return res.status(400).json({ error: 'Código de acceso requerido' });

    const sector = await Sector.create({ nombre, codigoAcceso });
    getIO()?.emit('datos-actualizados');
    res.status(201).json(sector);
  } catch (e: any) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Ya existe un sector con ese nombre' });
    }
    logger.error({ err: e }, 'Error en create sector');
    res.status(500).json({ error: 'Error al crear sector' });
  }
}

export async function update(req: AuthRequest, res: Response) {
  try {
    const sector = await Sector.findByPk(req.params.id as string);
    if (!sector) return res.status(404).json({ error: 'No encontrado' });

    const { nombre, codigoAcceso } = req.body;
    if (nombre !== undefined) sector.nombre = nombre;
    if (codigoAcceso !== undefined) sector.codigoAcceso = codigoAcceso;
    await sector.save();

    getIO()?.emit('datos-actualizados');
    res.json(sector);
  } catch (e: any) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Ya existe un sector con ese nombre' });
    }
    logger.error({ err: e }, 'Error en update sector');
    res.status(500).json({ error: 'Error al actualizar sector' });
  }
}

export async function remove(req: AuthRequest, res: Response) {
  try {
    const sector = await Sector.findByPk(req.params.id as string);
    if (!sector) return res.status(404).json({ error: 'No encontrado' });
    await sector.destroy();
    getIO()?.emit('datos-actualizados');
    res.json({ message: 'Eliminado' });
  } catch (e) {
    logger.error({ err: e }, 'Error en remove sector');
    res.status(500).json({ error: 'Error al eliminar sector' });
  }
}
