import { sequelize } from '../config/database.js';
import { User } from './User.js';
import { Sector } from './Sector.js';
import { Role } from './Role.js';
import { UserSector } from './UserSector.js';
import { Ticket } from './Ticket.js'; // <--- Importamos el nuevo modelo
import { Conversacion } from './Conversacion.js';

/**
 * CONFIGURACIÓN DE RELACIONES
 */

// 1. Relación Usuario - Rol (Muchos a Uno)
User.belongsTo(Role, { foreignKey: 'roleId', as: 'rol' });
Role.hasMany(User, { foreignKey: 'roleId', as: 'usuarios' });

// 2. Relación Usuario - Sector (Muchos a Muchos)
User.belongsToMany(Sector, { 
  through: UserSector, 
  foreignKey: 'userTelefono', 
  otherKey: 'sectorId',
  as: 'sectores' 
});
Sector.belongsToMany(User, { 
  through: UserSector, 
  foreignKey: 'sectorId',
  otherKey: 'userTelefono',
  as: 'personal' 
});

// 3. NUEVA: Relación Usuario - Ticket (Uno a Muchos)
// Un usuario crea muchos tickets. Un ticket es de UN usuario.
User.hasMany(Ticket, {
  foreignKey: 'userTelefono',
  as: 'misTickets'
});
Ticket.belongsTo(User, {
  foreignKey: 'userTelefono',
  as: 'autor'
});

// 4. Relación Usuario - Conversacion (Uno a Muchos)
User.hasMany(Conversacion, { foreignKey: 'userTelefono', as: 'conversaciones' });
Conversacion.belongsTo(User, { foreignKey: 'userTelefono', as: 'usuario' });

// 5. Relación Ticket - Conversacion (Uno a Muchos)
Ticket.hasMany(Conversacion, { foreignKey: 'ticketId', as: 'conversaciones' });
Conversacion.belongsTo(Ticket, { foreignKey: 'ticketId', as: 'ticket' });

export {
  sequelize,
  User,
  Sector,
  Role,
  UserSector,
  Ticket, // <--- Exportamos Ticket para usarlo en el Bot
  Conversacion
};