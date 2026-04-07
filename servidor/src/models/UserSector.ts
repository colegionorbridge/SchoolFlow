import { Model } from 'sequelize';
import { sequelize } from '../config/database.js';
// Agregamos el import de tipo aunque esté vacío, por consistencia con los otros modelos
import type { InferAttributes, InferCreationAttributes } from 'sequelize';

export class UserSector extends Model<InferAttributes<UserSector>, InferCreationAttributes<UserSector>> {}

UserSector.init({}, { 
  sequelize, 
  modelName: 'user_sector', 
  tableName: 'usuarios_sectores',
  timestamps: false 
});