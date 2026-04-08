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
    unique: true, 
    // Quitamos el validate estricto aquí por si el registro es parcial, 
    // lo validaremos manualmente en el registro técnico.
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
  context: {
    // Al usar JSON, podés guardar { sectorId: 1, intento: 1, etc. }
    type: DataTypes.JSON, 
    allowNull: true,
  },
  // No es necesario definir createdAt/updatedAt en el Init si timestamps es true,
  // pero los dejamos si prefieres un control manual total.
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