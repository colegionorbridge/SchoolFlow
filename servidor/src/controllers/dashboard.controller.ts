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