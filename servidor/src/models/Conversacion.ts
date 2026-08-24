import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

export class Conversacion extends Model {
  declare id: number;
  declare userTelefono: string;
  declare ticketId: number | null;
  declare mensaje: string;
  declare direccion: 'inbound' | 'outbound';
  declare metadata: object | null;
}

Conversacion.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userTelefono: {
    type: DataTypes.STRING,
    allowNull: false,
    references: { model: 'usuarios', key: 'telefono' },
  },
  ticketId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'tickets', key: 'id' },
  },
  mensaje: { type: DataTypes.TEXT, allowNull: false },
  direccion: {
    type: DataTypes.ENUM('inbound', 'outbound'),
    allowNull: false,
    defaultValue: 'inbound',
  },
  metadata: { type: DataTypes.JSONB, allowNull: true },
}, {
  sequelize,
  tableName: 'conversaciones',
  timestamps: true,
});
