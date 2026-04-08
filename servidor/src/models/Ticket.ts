import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';
import type { InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';

export class Ticket extends Model<InferAttributes<Ticket>, InferCreationAttributes<Ticket>> {
  declare id: CreationOptional<number>;
  declare asunto: string;
  declare descripcion: string;
  declare ubicacion: string;
  declare estado: CreationOptional<'abierto' | 'en_proceso' | 'cerrado'>;
  declare prioridad: CreationOptional<'baja' | 'media' | 'alta'>;
  declare userTelefono: string;
  
  // Campo para guardar comentarios, notas de Alejandro o logs del bot
  // Se guarda como un array de objetos: [{ fecha: string, autor: string, nota: string }]
  declare historial: CreationOptional<any[]>; 

  // Timestamps automáticos de Sequelize
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Ticket.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  asunto: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  ubicacion: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  estado: {
    type: DataTypes.ENUM('abierto', 'en_proceso', 'cerrado'),
    defaultValue: 'abierto',
  },
  prioridad: {
    type: DataTypes.ENUM('baja', 'media', 'alta'),
    defaultValue: 'media',
  },
  userTelefono: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  historial: {
    type: DataTypes.JSON,
    defaultValue: [],
    allowNull: true,
    comment: 'Almacena un array de comentarios o seguimiento del ticket'
  },
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE,
}, { 
  sequelize, 
  modelName: 'ticket',
  tableName: 'tickets',
  timestamps: true // Esto crea automáticamente createdAt y updatedAt
});