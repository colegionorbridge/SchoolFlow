import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';
import type { InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare telefono: string;
  declare nombreCompleto: string | null;
  declare email: string | null;
  
  declare activo: CreationOptional<boolean>;
  declare esAdmin: CreationOptional<boolean>;
  declare registroCompleto: CreationOptional<boolean>;
  declare pasoRegistro: CreationOptional<number>;
  
  declare roleId: number | null;

  // Timestamps declarados
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
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
    unique: true, 
    validate: { isEmail: true }
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
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
  },
  // AGREGAMOS ESTO PARA QUE TS NO SE QUEJE:
  // No necesitan configuración porque timestamps: true los maneja,
  // pero deben estar presentes en el objeto para cumplir con el contrato de InferAttributes.
  createdAt: {
    type: DataTypes.DATE,
  },
  updatedAt: {
    type: DataTypes.DATE,
  }
}, { 
  sequelize, 
  modelName: 'user',
  tableName: 'usuarios',
  timestamps: true 
});