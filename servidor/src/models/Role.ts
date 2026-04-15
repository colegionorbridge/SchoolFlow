import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';
import type { InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';

export class Role extends Model<InferAttributes<Role>, InferCreationAttributes<Role>> {
  declare id: CreationOptional<number>;
  declare nombre: string; // Ejemplo: 'Docente', 'Mantenimiento', 'Directivo'
  declare codigoAcceso: string | null; // Si es null, cualquiera puede unirse
}

Role.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  codigoAcceso: { 
    type: DataTypes.STRING, 
    allowNull: true // <-- NULL significa que cualquiera puede unirse
  }
}, { 
  sequelize, 
  modelName: 'role',
  tableName: 'roles',
  timestamps: false 
});