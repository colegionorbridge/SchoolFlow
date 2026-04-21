import { type Request, type Response } from 'express';
import { Ticket, User, Role, Sector } from '../models/models.js';
import { io } from '../socket/server.js'
// Importamos la instancia de client desde tu archivo bot/whatsapp.js
import { client } from '../bot/whatsapp.js';
export const getTickets = async (_req: Request, res: Response) => {
  try {
    const tickets = await Ticket.findAll({
      include: [
        {
          model: User,
          as: 'autor',  
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

        // Guardamos el estado anterior para comparar cambios
        const estadoAnterior = ticket.estado;

        // 1. Actualizamos campos básicos
        if (estado) ticket.estado = estado;
        if (prioridad) ticket.prioridad = prioridad;

        // 2. Gestionamos la nota en el historial
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

        // 3. --- LÓGICA DE NOTIFICACIONES POR WHATSAPP ---
        const chatId = ticket.userTelefono.includes('@c.us') 
            ? ticket.userTelefono 
            : `${ticket.userTelefono}@c.us`;

        // Caso A: Pasa a En Proceso
        if (estado === 'en_proceso' && estadoAnterior !== 'en_proceso') {
            const msjProceso = `Hola! 👋 Te informamos que tu ticket *#${ticket.id}* ("${ticket.asunto}") ya está *en proceso de reparación*.`;
            client.sendMessage(chatId, msjProceso).catch(e => console.error("Error envío WS:", e));
        } 
        
        // Caso B: Se cierra el Ticket
        else if (estado === 'cerrado' && estadoAnterior !== 'cerrado') {
            const msjCierre = `✅ Tu ticket *#${ticket.id}* ("${ticket.asunto}") ha sido *finalizado*. \n\nSi el problema persiste, podés abrir uno nuevo. ¡Gracias!`;
            client.sendMessage(chatId, msjCierre).catch(e => console.error("Error envío WS:", e));
        }

        // 4. Buscamos el ticket completo para sincronizar el Dashboard
        const ticketActualizado = await Ticket.findByPk(ticket.id, {
            include: [{ model: User, as: 'autor', attributes: ['nombreCompleto'] }]
        });

        // Emitimos por Socket para que se vea el cambio en tiempo real en el front
        if (io && ticketActualizado) {
            io.emit('ticket-actualizado', ticketActualizado);
        }

        return res.json(ticketActualizado);

    } catch (error) {
        console.error('❌ Error en updateTicket:', error);
        return res.status(500).json({ message: 'Error interno del servidor' });
    }
};