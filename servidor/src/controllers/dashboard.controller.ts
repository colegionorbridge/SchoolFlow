import { type Request, type Response } from 'express';
import { Ticket, User, Role, Sector } from '../models/models.js';

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
    // 1. Convertimos el ID de la URL a número de forma segura
    const { id } = req.params;
    const ticketId = parseInt(id as string, 10);

    if (isNaN(ticketId)) {
      return res.status(400).json({ message: 'El ID proporcionado no es un número válido.' });
    }

    const { estado, prioridad, nuevaNota } = req.body;

    // 2. Buscamos el ticket en Neon
    const ticket = await Ticket.findByPk(ticketId);

    if (!ticket) {
      return res.status(404).json({ message: 'No se encontró el ticket en el sistema.' });
    }

    // 3. Actualizamos estado y prioridad si vienen en el body
    if (estado) ticket.estado = estado;
    if (prioridad) ticket.prioridad = prioridad;

    // 4. Procesamos la nueva nota si Alejandro escribió algo en el modal
    if (nuevaNota && nuevaNota.trim() !== '') {
      const notaObjeto = {
        fecha: new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }),
        autor: 'Alejandro (Soporte IT)',
        nota: nuevaNota.trim()
      };

      // Clonamos el historial actual o inicializamos array vacío
      const historialActual = Array.isArray(ticket.historial) ? [...ticket.historial] : [];
      
      // Agregamos la nota y reasignamos para que Sequelize detecte el cambio
      ticket.historial = [...historialActual, notaObjeto];
      
      // Obligatorio para campos JSON en Sequelize
      ticket.changed('historial', true);
    }

    // 5. Guardamos cambios
    await ticket.save();

    // 6. Recargamos con el autor para que el frontend reciba el objeto completo
    const ticketFull = await Ticket.findByPk(ticket.id, {
      include: [{ model: User, as: 'autor', attributes: ['nombreCompleto'] }]
    });

    // 7. Emitimos por Socket.io (si está configurado)
    const io = req.app.get('io');
    if (io) {
      io.emit('ticket-actualizado', ticketFull);
    }

    return res.json(ticketFull);

  } catch (error) {
    console.error('Error al actualizar ticket:', error);
    return res.status(500).json({ 
      message: 'Error interno del servidor al procesar la actualización.' 
    });
  }
};