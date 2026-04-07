import { sequelize } from '../config/database.js';
import { User } from './User.js';
import { Sector } from './Sector.js';
import { Role } from './Role.js';
import { UserSector } from './UserSector.js';

/**
 * CONFIGURACIÓN DE RELACIONES (Asociaciones)
 */

// 1. Relación Usuario - Rol (Muchos a Uno)
// Un usuario tiene UN rol. Un rol puede pertenecer a MUCHOS usuarios.
User.belongsTo(Role, { 
  foreignKey: 'roleId', 
  as: 'rol' 
});
Role.hasMany(User, { 
  foreignKey: 'roleId',
  as: 'usuarios'
});

// 2. Relación Usuario - Sector (Muchos a Muchos)
// Un usuario puede estar en varios sectores (ej: Primaria y Secundaria).
// Un sector tiene a muchos usuarios (el personal de ese nivel).
// Usamos la tabla intermedia UserSector que definimos antes.
User.belongsToMany(Sector, { 
  through: UserSector, 
  foreignKey: 'userTelefono', // FK hacia la PK de User
  otherKey: 'sectorId',       // FK hacia la PK de Sector
  as: 'sectores' 
});

Sector.belongsToMany(User, { 
  through: UserSector, 
  foreignKey: 'sectorId',
  otherKey: 'userTelefono',
  as: 'personal' 
});

/**
 * EXPORTACIÓN
 * Exportamos todo desde aquí para centralizar el acceso a la DB.
 */
export {
  sequelize,
  User,
  Sector,
  Role,
  UserSector
};