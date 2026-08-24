import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { Role } from '../models/models.js';
import { getIO } from '../socket/server.js';
import { logger } from '../config/logger.js';

export async function getAll(_req: AuthRequest, res: Response) {
  try {
    const roles = await Role.findAll({ order: [['nombre', 'ASC']] });
    res.json(roles);
  } catch (e) {
    logger.error({ err: e }, 'Error en getAll roles');
    res.status(500).json({ error: 'Error al obtener roles' });
  }
}

export async function create(req: AuthRequest, res: Response) {
  try {
    const { nombre, codigoAcceso } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });

    const rol = await Role.create({ nombre, codigoAcceso: codigoAcceso || null });
    getIO()?.emit('datos-actualizados');
    res.status(201).json(rol);
  } catch (e: any) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Ya existe un rol con ese nombre' });
    }
    logger.error({ err: e }, 'Error en create rol');
    res.status(500).json({ error: 'Error al crear rol' });
  }
}

export async function update(req: AuthRequest, res: Response) {
  try {
    const rol = await Role.findByPk(req.params.id as string);
    if (!rol) return res.status(404).json({ error: 'No encontrado' });

    const { nombre, codigoAcceso } = req.body;
    if (nombre !== undefined) rol.nombre = nombre;
    if (codigoAcceso !== undefined) rol.codigoAcceso = codigoAcceso || null;
    await rol.save();

    getIO()?.emit('datos-actualizados');
    res.json(rol);
  } catch (e: any) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Ya existe un rol con ese nombre' });
    }
    logger.error({ err: e }, 'Error en update rol');
    res.status(500).json({ error: 'Error al actualizar rol' });
  }
}

export async function remove(req: AuthRequest, res: Response) {
  try {
    const rol = await Role.findByPk(req.params.id as string);
    if (!rol) return res.status(404).json({ error: 'No encontrado' });
    await rol.destroy();
    getIO()?.emit('datos-actualizados');
    res.json({ message: 'Eliminado' });
  } catch (e) {
    logger.error({ err: e }, 'Error en remove rol');
    res.status(500).json({ error: 'Error al eliminar rol' });
  }
}
