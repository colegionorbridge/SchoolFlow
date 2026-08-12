import { type Request, type Response } from 'express';
import { Ticket, User, Role, Sector, sequelize } from '../models/models.js';
import { io } from '../socket/server.js'
// Importamos la instancia de client desde tu archivo bot/whatsapp.js
import { client } from '../bot/whatsapp.js';

// ==================== GESTIÓN DE USUARIOS ====================

export const updateUsuario = async (req: Request, res: Response) => {
  try {
    const telefono = req.params.telefono as string;
    const { nombreCompleto, email, roleId, sectores } = req.body;

    const usuario = await (User as any).findByPk(telefono);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Actualizar campos básicos
    if (nombreCompleto !== undefined) usuario.nombreCompleto = nombreCompleto;
    if (email !== undefined) usuario.email = email;

    // Actualizar rol si se proporciona
    if (roleId !== undefined) {
      const rol = await (Role as any).findByPk(roleId);
      if (!rol) {
        return res.status(404).json({ error: 'Rol no encontrado' });
      }
      usuario.roleId = roleId;
    }

    await usuario.save();

    // Actualizar sectores si se proporciona
    if (sectores !== undefined && Array.isArray(sectores)) {
      await (usuario as any).setSectores(sectores);
    }

    // Obtener usuario actualizado con relaciones
    const usuarioActualizado = await User.findByPk(telefono, {
      include: [
        { model: Role, as: 'rol', attributes: ['id', 'nombre'] },
        { model: Sector, as: 'sectores', through: { attributes: [] } }
      ]
    });

    if (io) io.emit('usuario-actualizado', usuarioActualizado);

    res.json(usuarioActualizado);
  } catch (error) {
    console.error('❌ Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
};

// ==================== GESTIÓN DE ROLES ====================

export const getRoles = async (_req: Request, res: Response) => {
  try {
    const roles = await Role.findAll({
      order: [['nombre', 'ASC']]
    });
    res.json(roles);
  } catch (error) {
    console.error('❌ Error al obtener roles:', error);
    res.status(500).json({ error: 'Error al obtener roles' });
  }
};

export const createRole = async (req: Request, res: Response) => {
  try {
    const { nombre, codigoAcceso } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'Nombre requerido' });
    }

    const rol = await Role.create({
      nombre,
      codigoAcceso: codigoAcceso || null
    });

    res.status(201).json(rol);
  } catch (error: any) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Ya existe un rol con ese nombre' });
    }
    console.error('❌ Error al crear rol:', error);
    res.status(500).json({ error: 'Error al crear rol' });
  }
};

export const updateRole = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { nombre, codigoAcceso } = req.body;

    const rol = await (Role as any).findByPk(id);
    if (!rol) {
      return res.status(404).json({ error: 'Rol no encontrado' });
    }

    if (nombre !== undefined) rol.nombre = nombre;
    if (codigoAcceso !== undefined) rol.codigoAcceso = codigoAcceso || null;

    await rol.save();
    res.json(rol);
  } catch (error: any) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Ya existe un rol con ese nombre' });
    }
    console.error('❌ Error al actualizar rol:', error);
    res.status(500).json({ error: 'Error al actualizar rol' });
  }
};

export const deleteRole = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const rol = await (Role as any).findByPk(id);
    if (!rol) {
      return res.status(404).json({ error: 'Rol no encontrado' });
    }

    await rol.destroy();
    res.json({ message: 'Rol eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar rol:', error);
    res.status(500).json({ error: 'Error al eliminar rol' });
  }
};

// ==================== GESTIÓN DE SECTORES ====================

export const getSectores = async (_req: Request, res: Response) => {
  try {
    const sectores = await Sector.findAll({
      order: [['nombre', 'ASC']]
    });
    res.json(sectores);
  } catch (error) {
    console.error('❌ Error al obtener sectores:', error);
    res.status(500).json({ error: 'Error al obtener sectores' });
  }
};

export const createSector = async (req: Request, res: Response) => {
  try {
    const { nombre, codigoAcceso } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'Nombre requerido' });
    }

    const sector = await Sector.create({
      nombre,
      codigoAcceso: codigoAcceso || null
    });

    res.status(201).json(sector);
  } catch (error: any) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Ya existe un sector con ese nombre' });
    }
    console.error('❌ Error al crear sector:', error);
    res.status(500).json({ error: 'Error al crear sector' });
  }
};

export const updateSector = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { nombre, codigoAcceso } = req.body;

    const sector = await (Sector as any).findByPk(id);
    if (!sector) {
      return res.status(404).json({ error: 'Sector no encontrado' });
    }

    if (nombre !== undefined) sector.nombre = nombre;
    if (codigoAcceso !== undefined) sector.codigoAcceso = codigoAcceso || null;

    await sector.save();
    res.json(sector);
  } catch (error: any) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Ya existe un sector con ese nombre' });
    }
    console.error('❌ Error al actualizar sector:', error);
    res.status(500).json({ error: 'Error al actualizar sector' });
  }
};

export const deleteSector = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    const sector = await (Sector as any).findByPk(id);
    if (!sector) {
      return res.status(404).json({ error: 'Sector no encontrado' });
    }

    await sector.destroy();
    res.json({ message: 'Sector eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar sector:', error);
    res.status(500).json({ error: 'Error al eliminar sector' });
  }
};
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

export const createTicket = async (req: Request, res: Response) => {
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
      userTelefono: undefined as any,
      historial: [{
        fecha: new Date().toLocaleString('es-AR'),
        autor: 'Alejandro (Soporte IT)',
        nota: 'Ticket creado manualmente desde el panel'
      }]
    });

    const ticketCreado = await Ticket.findByPk(ticket.id, {
      include: [{ model: User, as: 'autor', attributes: ['nombreCompleto', 'telefono'] }]
    });

    if (io && ticketCreado) {
      io.emit('nuevo-ticket', ticketCreado);
    }

    res.status(201).json(ticketCreado);
  } catch (error) {
    console.error('❌ Error al crear ticket manual:', error);
    res.status(500).json({ error: 'Error al crear ticket' });
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
        const id = req.params.id as string;
        const { estado, prioridad, nuevaNota } = req.body;
        const ticketId = parseInt(id, 10);

        const ticket = await (Ticket as any).findByPk(ticketId);
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

            // Parseamos historial por si viene como string JSON
            let historialActual: any[] = [];
            if (Array.isArray(ticket.historial)) {
                historialActual = ticket.historial;
            } else if (typeof ticket.historial === 'string') {
                try { historialActual = JSON.parse(ticket.historial); } catch { historialActual = []; }
            }

            ticket.historial = [...historialActual, notaObjeto];
            ticket.changed('historial', true);
        }

        await ticket.save();

        // 3. --- LÓGICA DE NOTIFICACIONES POR WHATSAPP ---
        // Los tickets manuales no tienen userTelefono (null), no se envía notificación
        if (ticket.userTelefono) {
          const chatId = ticket.userTelefono.includes('@c.us') 
              ? ticket.userTelefono 
              : `${ticket.userTelefono}@c.us`;

          console.log('📱 [Notificacion] chatId:', chatId, '| nuevaNota:', nuevaNota, '| estado:', estado, '| estadoAnterior:', estadoAnterior);

          // Caso A: Se agrego una nota/comentario (independientemente del cambio de estado)
          if (nuevaNota && nuevaNota.trim() !== '') {
              const msjNota = `📋 El tecnico *Alejandro* agrego un comentario a tu ticket *#${ticket.id}*: "${ticket.asunto}"\n\n💬 _"${nuevaNota.trim()}"_`;
              console.log('📨 [Notificacion] Enviando mensaje de nota:', msjNota);
              try {
                  await client.sendMessage(chatId, msjNota);
                  console.log('✅ [Notificacion] Mensaje de nota enviado correctamente');
              } catch (e) {
                  console.error('❌ [Notificacion] Error enviando nota:', e);
              }
          }

          // Caso B: Pasa a En Proceso
          if (estado === 'en_proceso' && estadoAnterior !== 'en_proceso') {
              const msjProceso = `Hola! Te informamos que tu ticket *#${ticket.id}* ("${ticket.asunto}") ya esta *en proceso de reparacion*.`;
              try {
                  await client.sendMessage(chatId, msjProceso);
                  console.log('✅ [Notificacion] Mensaje de en_proceso enviado correctamente');
              } catch (e) {
                  console.error('❌ [Notificacion] Error enviando en_proceso:', e);
              }
          } 
          
          // Caso C: Se cierra el Ticket
          if (estado === 'cerrado' && estadoAnterior !== 'cerrado') {
              const msjCierre = `✅ Tu ticket *#${ticket.id}* ("${ticket.asunto}") ha sido *finalizado*. \n\nSi el problema persiste, podes abrir uno nuevo. Gracias!`;
              try {
                  await client.sendMessage(chatId, msjCierre);
                  console.log('✅ [Notificacion] Mensaje de cierre enviado correctamente');
              } catch (e) {
                  console.error('❌ [Notificacion] Error enviando cierre:', e);
              }
          }
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