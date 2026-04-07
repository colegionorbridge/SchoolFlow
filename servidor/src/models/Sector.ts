import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';
import type { InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';

export class Sector extends Model<InferAttributes<Sector>, InferCreationAttributes<Sector>> {
  declare id: CreationOptional<number>;
  declare nombre: string; // Ejemplo: 'Primaria', 'Secundaria', 'Inicial'
  declare codigoAcceso: string; // Ejemplo: 'PRI2026', lo cambias cuando quieras
}

Sector.init({
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
    allowNull: false,
  }
}, { 
  sequelize, 
  modelName: 'sector',
  tableName: 'sectores',
  timestamps: false // No solemos necesitar saber cuándo se creó un sector
});