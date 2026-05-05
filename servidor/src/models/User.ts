import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';
import type { InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare telefono: string;
  declare nombreCompleto: string | null;
  declare email: string | null;
  declare roleId: number | null;
  
  declare activo: CreationOptional<boolean>;
  declare esAdmin: CreationOptional<boolean>;
  declare registroCompleto: CreationOptional<boolean>;
  declare pasoRegistro: CreationOptional<number>;
  
  // Cambiamos el tipo a 'any' o un objeto específico para que sea compatible con JSON
  declare context: any | null; 

  // Timestamps
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
    unique: true 
  },
  roleId: {
    type: DataTypes.INTEGER,
    allowNull: true,
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
    defaultValue:0,
  },
  context: {
    type: DataTypes.JSON, 
    allowNull: true,
  },
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