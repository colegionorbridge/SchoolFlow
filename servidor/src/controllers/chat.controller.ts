import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { Ticket, User, Conversacion } from '../models/models.js';
import { getIO } from '../socket/server.js';
import { logger } from '../config/logger.js';
import { enviarTexto } from '../bot/enviar.js';

const CHAT_TIMEOUT = 5 * 60 * 1000;

export async function iniciarChat(req: AuthRequest, res: Response) {
  try {
    const ticketId = parseInt(req.params.id as string);
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    if (!ticket.userTelefono) return res.status(404).json({ error: 'El ticket no tiene usuario asociado' });

    const adminNombre = req.user?.nombre || 'Técnico';
    const user = await User.findByPk(ticket.userTelefono);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    user.context = {
      ...(user.context || {}),
      chatConAdmin: {
        adminId: req.user?.telefono || req.user?.role || 'admin',
        adminNombre,
        startedAt: Date.now(),
        lastActivity: Date.now(),
      },
    };
    user.changed('context', true);
    await user.save();

    // Timeout: si no hay actividad del admin en 5 min, devolver al bot
    setTimeout(async () => {
      try {
        const u = await User.findByPk(ticket.userTelefono as string);
        if (!u) return;
        const chat = (u.context as any)?.chatConAdmin;
        if (chat && chat.adminId && Date.now() - chat.lastActivity > CHAT_TIMEOUT) {
          u.context = { ...(u.context || {}), chatConAdmin: null };
          u.changed('context', true);
          await u.save();

          await enviarTexto(
            ticket.userTelefono as string,
            `📢 *Ticket #${ticket.id}*\n\nEl técnico finalizó la charla por inactividad. Si necesitás algo más, escribí *ayuda*.`,
            ticket.id,
          );

          getIO()?.emit('chat-estado', { ticketId: ticket.id, estado: 'inactivo', admin: null });
        }
      } catch {}
    }, CHAT_TIMEOUT + 5000);

    await enviarTexto(
      ticket.userTelefono as string,
      `📢 *Ticket #${ticket.id}*\n\nUn técnico se pondrá en contacto con vos a la brevedad.`,
      ticket.id,
    );

    getIO()?.emit('chat-estado', { ticketId, estado: 'activo', admin: adminNombre });
    res.json({ ok: true, estado: 'activo' });
  } catch (e) {
    logger.error({ err: e }, 'Error en iniciarChat');
    res.status(500).json({ error: 'Error interno' });
  }
}

export async function enviarMensaje(req: AuthRequest, res: Response) {
  try {
    const ticketId = parseInt(req.params.id as string);
    const { mensaje } = req.body;
    if (!mensaje) return res.status(400).json({ error: 'Mensaje requerido' });

    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    if (!ticket.userTelefono) return res.status(404).json({ error: 'El ticket no tiene usuario asociado' });

    const adminNombre = req.user?.nombre || 'Técnico';
    const texto = `💬 *Técnico ${adminNombre}:* ${mensaje}`;

    const user = await User.findByPk(ticket.userTelefono);
    if (user) {
      const chat = (user.context as any)?.chatConAdmin;
      if (chat) {
        chat.lastActivity = Date.now();
        user.context = { ...(user.context || {}), chatConAdmin: chat };
        user.changed('context', true);
        await user.save();
      }
    }

    await enviarTexto(ticket.userTelefono, texto, ticket.id);

    res.json({ ok: true, mensaje, autor: adminNombre, timestamp: new Date().toISOString() });
  } catch (e) {
    logger.error({ err: e }, 'Error en enviarMensaje');
    res.status(500).json({ error: 'Error interno' });
  }
}

export async function finalizarChat(req: AuthRequest, res: Response) {
  try {
    const ticketId = parseInt(req.params.id as string);
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    if (!ticket.userTelefono) return res.status(404).json({ error: 'El ticket no tiene usuario asociado' });

    const user = await User.findByPk(ticket.userTelefono);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    user.context = {
      ...(user.context || {}),
      chatConAdmin: null,
    };
    user.changed('context', true);
    await user.save();

    await enviarTexto(
      ticket.userTelefono,
      `📢 *Ticket #${ticket.id}*\n\nEl técnico finalizó la charla. Si necesitás algo más, escribí *ayuda*.`,
      ticket.id,
    );

    getIO()?.emit('chat-estado', { ticketId, estado: 'inactivo', admin: null });

    res.json({ ok: true, estado: 'inactivo' });
  } catch (e) {
    logger.error({ err: e }, 'Error en finalizarChat');
    res.status(500).json({ error: 'Error interno' });
  }
}

export async function estadoChat(req: AuthRequest, res: Response) {
  try {
    const ticketId = parseInt(req.params.id as string);
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

    const user = ticket.userTelefono ? await User.findByPk(ticket.userTelefono) : null;
    const chatData = (user?.context as any)?.chatConAdmin;

    if (chatData && chatData.adminId) {
      res.json({ activo: true, admin: chatData.adminNombre, startedAt: chatData.startedAt });
    } else {
      res.json({ activo: false, admin: null });
    }
  } catch (e) {
    logger.error({ err: e }, 'Error en estadoChat');
    res.status(500).json({ error: 'Error interno' });
  }
}

export async function getConversacion(req: AuthRequest, res: Response) {
  try {
    const ticketId = parseInt(req.params.id as string);
    if (isNaN(ticketId)) return res.status(400).json({ error: 'ID inválido' });

    const mensajes = await Conversacion.findAll({
      where: { ticketId },
      order: [['createdAt', 'ASC']],
      attributes: ['id', 'mensaje', 'direccion', 'createdAt'],
    });

    res.json(mensajes);
  } catch (e) {
    logger.error({ err: e }, 'Error en getConversacion');
    res.status(500).json({ error: 'Error al obtener conversación' });
  }
}
