import { type Request, type Response } from 'express';
import { Ticket, User, Role, Sector } from '../models/models.js';
import { io } from '../socket/server.js'

export const getTickets = async (_req: Request, res: Response) => {
  try {
    const tickets = await Ticket.findAll({
      include: [
        {
          model: User,
          as: 'autor',
          // CORRECCIÓN: Usamos 'nombreCompleto' y también 'telefono' 
          // (necesario si tu relación se basa en userTelefono -> telefono)
          attributes: ['nombreCompleto', 'telefono'], 
          include: [{ model: Role, as: 'rol', attributes: ['nombre'] }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(tickets);
  } catch (error) {
    console.error(' Error al obtener tickets:', error);
    res.status(500).json({ error: 'Error al obtener tickets' });
  }
};

export const getUsuarios = async (_req: Request, res: Response) => {
  try {
    const usuarios = await User.findAll({
      include: [
        { model: Role, as: 'rol', attributes: ['nombre'] },
        { model: Sector, as: 'sectores', through: { attributes: [] } }
      ]
    });
    res.json(usuarios);
  } catch (error) {
    console.error(' Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

export const updateTicket = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { estado, prioridad, nuevaNota } = req.body;
        const ticketId = parseInt(id as string, 10);

        const ticket = await Ticket.findByPk(ticketId);
        if (!ticket) return res.status(404).json({ message: 'Ticket no encontrado' });

        // Actualizamos campos
        if (estado) ticket.estado = estado;
        if (prioridad) ticket.prioridad = prioridad;

        // Si hay una nota desde el Dashboard
        if (nuevaNota && nuevaNota.trim() !== '') {
            const notaObjeto = {
                fecha: new Date().toLocaleString('es-AR'),
                autor: 'Alejandro (Soporte IT)', 
                nota: nuevaNota.trim()
            };

            const historialActual = Array.isArray(ticket.historial) ? ticket.historial : [];
            ticket.historial = [...historialActual, notaObjeto];
            ticket.changed('historial', true);
        }

        await ticket.save();

        // Buscamos el ticket completo con el autor para que el front tenga todo
        const ticketActualizado = await Ticket.findByPk(ticket.id, {
            include: [{ model: User, as: 'autor', attributes: ['nombreCompleto'] }]
        });

        // --- EL PASO CLAVE ---
        // Emitimos el mismo evento que usa el Bot de WhatsApp
        if (io && ticketActualizado) {
            io.emit('ticket-actualizado', ticketActualizado);
        }

        return res.json(ticketActualizado);

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ message: 'Error interno' });
    }
};