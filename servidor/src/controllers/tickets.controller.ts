import type { Response } from 'express';
import { Op } from 'sequelize';
import type { AuthRequest } from '../middleware/auth.js';
import { Ticket, User, Role } from '../models/models.js';
import { getIO } from '../socket/server.js';
import { logger } from '../config/logger.js';

async function notificarAgente(telefono: string, mensaje: string) {
  try {
    const { enviarTexto } = await import('../bot/enviar.js');
    await enviarTexto(telefono, mensaje);
  } catch {}
}

const autorInclude = {
  model: User,
  as: 'autor',
  attributes: ['nombreCompleto', 'telefono'],
  include: [{ model: Role, as: 'rol', attributes: ['nombre'] }],
};

export async function getAll(req: AuthRequest, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string || '').trim();

    const where: any = {};
    if (req.query.estado) where.estado = req.query.estado;
    if (req.query.prioridad) where.prioridad = req.query.prioridad;
    if (req.query.origen) where.origen = req.query.origen;
    if (req.query.tecnicoAsignado) where.tecnicoAsignado = req.query.tecnicoAsignado;
    if (req.query.sinAsignar === 'true') where.tecnicoAsignado = null;

    if (search) {
      where[Op.or] = [
        { asunto: { [Op.iLike]: `%${search}%` } },
        { descripcion: { [Op.iLike]: `%${search}%` } },
        { ubicacion: { [Op.iLike]: `%${search}%` } },
        { tecnicoAsignado: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortDir = (req.query.sortDir as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const SORT_MAP: Record<string, any[]> = {
      id: ['id'],
      asunto: ['asunto'],
      estado: ['estado'],
      prioridad: ['prioridad'],
      tecnicoAsignado: ['tecnicoAsignado'],
      createdAt: ['createdAt'],
    };
    const orderCol = (SORT_MAP[sortBy] ?? SORT_MAP.createdAt)!;
    const order = [[...orderCol, sortDir]] as any;

    const { count: total, rows: tickets } = await Ticket.findAndCountAll({
      where,
      include: [autorInclude],
      order,
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });

    res.json({
      data: tickets,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    logger.error({ err: e }, 'Error en getAll tickets');
    res.status(500).json({ error: 'Error al obtener tickets' });
  }
}

export async function getById(req: AuthRequest, res: Response) {
  try {
    const ticket = await Ticket.findByPk(req.params.id as string, { include: [autorInclude] });
    if (!ticket) return res.status(404).json({ error: 'No encontrado' });
    res.json(ticket);
  } catch (e) {
    logger.error({ err: e }, 'Error en getById ticket');
    res.status(500).json({ error: 'Error al obtener ticket' });
  }
}

export async function create(req: AuthRequest, res: Response) {
  try {
    const { asunto, descripcion, ubicacion, prioridad } = req.body;
    if (!asunto || !descripcion || !ubicacion) {
      return res.status(400).json({ error: 'asunto, descripcion y ubicacion son requeridos' });
    }

    const ticket = await Ticket.create({
      asunto,
      descripcion,
      ubicacion,
      prioridad: prioridad || 'media',
      origen: 'manual',
      userTelefono: null as any,
      historial: [{
        fecha: new Date().toLocaleString('es-AR'),
        autor: 'Soporte IT',
        nota: 'Ticket creado manualmente desde el panel',
      }],
    });

    const created = await Ticket.findByPk(ticket.id, { include: [autorInclude] });

    getIO()?.emit('nuevo-ticket', created);
    res.status(201).json(created);
  } catch (e) {
    logger.error({ err: e }, 'Error en create ticket');
    res.status(500).json({ error: 'Error al crear ticket' });
  }
}

export async function update(req: AuthRequest, res: Response) {
  try {
    const ticket = await Ticket.findByPk(req.params.id as string);
    if (!ticket) return res.status(404).json({ error: 'No encontrado' });

    const { estado, prioridad, tecnicoAsignado, solucion, nuevaNota } = req.body;
    const autor = req.user?.nombre || req.user?.telefono || 'Soporte IT';
    const isSuperAdmin = req.user?.superAdmin || false;
    const historial: any[] = Array.isArray(ticket.historial) ? ticket.historial : [];
    const oldEstado = ticket.estado;
    const oldTecnico = ticket.tecnicoAsignado;

    const pushNota = (nota: string) => {
      historial.push({ fecha: new Date().toLocaleString('es-AR'), autor, nota });
    };

    // Solo superAdmin puede cambiar prioridad y reasignar técnico
    if (prioridad && prioridad !== ticket.prioridad) {
      if (!isSuperAdmin) return res.status(403).json({ error: 'Solo el administrador puede cambiar la prioridad' });
      pushNota(`${autor} cambió la prioridad a ${prioridad}`);
      ticket.prioridad = prioridad;
    }

    if (tecnicoAsignado !== undefined && tecnicoAsignado !== ticket.tecnicoAsignado) {
      const esAutoAsignacion = tecnicoAsignado === autor;
      const esDesasignarse = !tecnicoAsignado && autor === ticket.tecnicoAsignado;
      if (!isSuperAdmin && !esAutoAsignacion && !esDesasignarse) {
        return res.status(403).json({ error: 'Solo el administrador puede reasignar el técnico' });
      }
      pushNota(tecnicoAsignado ? `${autor} se asignó como técnico` : `${autor} se desvinculó del ticket`);
      ticket.tecnicoAsignado = tecnicoAsignado || null;
    }

    if (estado && estado !== ticket.estado) {
      const esDesasignarYReabrir = estado === 'abierto' && tecnicoAsignado !== undefined && !tecnicoAsignado;
      if (estado === 'abierto' && ticket.estado !== 'abierto' && !esDesasignarYReabrir) {
        if (!isSuperAdmin) return res.status(403).json({ error: 'Solo el administrador puede reabrir un ticket' });
      }
      const estadoLabel = estado === 'cerrado' ? 'cerró' : estado === 'en_proceso' ? 'puso en proceso' : 'reabrió';
      pushNota(`${autor} ${estadoLabel} el ticket`);
      ticket.estado = estado;
    }

    if (solucion !== undefined && solucion !== ticket.solucion) {
      pushNota(`${autor} registró la solución`);
      ticket.solucion = solucion || null;
    }

    if (nuevaNota && nuevaNota.trim() !== '') {
      pushNota(nuevaNota.trim());
    }

    ticket.historial = historial;
    ticket.changed('historial', true);
    await ticket.save();

    // Notificaciones por WhatsApp (solo si el ticket tiene usuario)
    if (ticket.userTelefono) {
      if (nuevaNota && nuevaNota.trim() !== '') {
        notificarAgente(ticket.userTelefono, `📋 El técnico *${autor}* agregó un comentario a tu ticket *#${ticket.id}*: "${ticket.asunto}"\n\n💬 _"${nuevaNota.trim()}"_`);
      }
      if (estado && estado !== oldEstado) {
        let msg = '';
        if (estado === 'en_proceso') {
          msg = `📋 *Ticket #${ticket.id}*\n🔧 ${autor} ya está trabajando en tu caso.`;
        } else if (estado === 'cerrado') {
          msg = `📋 *Ticket #${ticket.id}*\n✅ ${autor} lo marcó como *resuelto*.`;
          if (solucion) msg += `\n🔧 Solución: ${(solucion as string).substring(0, 200)}`;
        } else if (estado === 'abierto') {
          msg = `📋 *Ticket #${ticket.id}*\n🔄 ${autor} reabrió el ticket.\nUn técnico va a revisarlo nuevamente.`;
        }
        if (msg) notificarAgente(ticket.userTelefono, msg);
      }
    }

    const updated = await Ticket.findByPk(ticket.id, { include: [autorInclude] });

    const io = getIO();
    if (io) {
      io.emit('ticket-actualizado', updated);
      if (tecnicoAsignado && tecnicoAsignado !== oldTecnico) {
        io.emit('ticket-asignado', { ...(updated as any).toJSON(), tecnicoAsignado });
      }
    }

    res.json(updated);
  } catch (e) {
    logger.error({ err: e }, 'Error en update ticket');
    res.status(500).json({ error: 'Error al actualizar ticket' });
  }
}
