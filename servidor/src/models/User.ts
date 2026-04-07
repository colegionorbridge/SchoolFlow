import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';
import type { InferAttributes, InferCreationAttributes } from 'sequelize';

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare telefono: string;
  declare nombreCompleto: string | null;
  declare email: string | null;
  declare activo: boolean;
  declare esAdmin: boolean;
  declare registroCompleto: boolean;
  declare pasoRegistro: number;
  declare roleId: number | null;
}

User.init({
  telefono: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  nombreCompleto: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: { isEmail: true }
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true, // Al registrarse están activos por defecto
  },
  esAdmin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  registroCompleto: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  pasoRegistro: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  roleId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  }
}, { 
  sequelize, 
  modelName: 'user',
  tableName: 'usuarios'
});