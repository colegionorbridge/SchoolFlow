import type { Response } from 'express';
import { Op } from 'sequelize';
import type { AuthRequest } from '../middleware/auth.js';
import { banearUsuario } from '../middleware/auth.js';
import { User, Role, Sector } from '../models/models.js';
import { getIO } from '../socket/server.js';
import { logger } from '../config/logger.js';

export async function getAll(req: AuthRequest, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string || '').trim();

    const where: any = {};
    if (req.query.esAdmin === 'true') where.esAdmin = true;
    if (req.query.registroIncompleto === 'true') where.registroCompleto = false;
    if (req.query.inactivo === 'true') where.activo = false;

    if (search) {
      where[Op.or] = [
        { nombreCompleto: { [Op.iLike]: `%${search}%` } },
        { telefono: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const sortBy = (req.query.sortBy as string) || 'nombreCompleto';
    const sortDir = (req.query.sortDir as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const SORT_MAP: Record<string, any[]> = {
      telefono: ['telefono'],
      nombreCompleto: ['nombreCompleto'],
      rol: [{ model: Role, as: 'rol' }, 'nombre'],
      registroCompleto: ['registroCompleto'],
      esAdmin: ['esAdmin'],
    };
    const orderCol = (SORT_MAP[sortBy] ?? SORT_MAP.nombreCompleto)!;
    const order = [[...orderCol, sortDir]] as any;

    const { count: total, rows: usuarios } = await User.findAndCountAll({
      where,
      include: [
        { model: Role, as: 'rol', attributes: ['id', 'nombre'] },
        { model: Sector, as: 'sectores', through: { attributes: [] } },
      ],
      order,
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });

    res.json({
      data: usuarios,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    logger.error({ err: e }, 'Error en getAll usuarios');
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
}

export async function getByTelefono(req: AuthRequest, res: Response) {
  try {
    const user = await User.findByPk(req.params.telefono as string, {
      include: [
        { model: Role, as: 'rol', attributes: ['id', 'nombre'] },
        { model: Sector, as: 'sectores', through: { attributes: [] } },
      ],
    });
    if (!user) return res.status(404).json({ error: 'No encontrado' });
    res.json(user);
  } catch (e) {
    logger.error({ err: e }, 'Error en getByTelefono');
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
}

export async function update(req: AuthRequest, res: Response) {
  try {
    const user = await User.findByPk(req.params.telefono as string);
    if (!user) return res.status(404).json({ error: 'No encontrado' });

    const { nombreCompleto, email, roleId, sectores, activo } = req.body;
    const payload: Record<string, unknown> = { nombreCompleto, email, roleId, activo };

    if (req.body.esAdmin !== undefined) {
      if (!req.user?.esAdmin) {
        return res.status(403).json({ error: 'Solo un administrador puede cambiar permisos de admin' });
      }
      payload.esAdmin = req.body.esAdmin;
    }

    await user.update(payload);

    if (sectores !== undefined && Array.isArray(sectores)) {
      await (user as any).setSectores(sectores);
    }

    getIO()?.emit('datos-actualizados');

    const updated = await User.findByPk(req.params.telefono as string, {
      include: [
        { model: Role, as: 'rol', attributes: ['id', 'nombre'] },
        { model: Sector, as: 'sectores', through: { attributes: [] } },
      ],
    });
    res.json(updated);
  } catch (e) {
    logger.error({ err: e }, 'Error en update usuario');
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
}

export async function remove(req: AuthRequest, res: Response) {
  try {
    const user = await User.findByPk(req.params.telefono as string);
    if (!user) return res.status(404).json({ error: 'No encontrado' });
    const telefono = user.telefono;
    await user.destroy();
    banearUsuario(telefono);
    getIO()?.emit('datos-actualizados');
    res.json({ message: 'Usuario eliminado' });
  } catch (e) {
    logger.error({ err: e }, 'Error en remove usuario');
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
}
