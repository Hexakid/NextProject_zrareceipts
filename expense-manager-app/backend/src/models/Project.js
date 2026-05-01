import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js';

const Project = sequelize.define(
  'Project',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    budgetTotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    budgetCurrency: {
      type: DataTypes.STRING(3),
      defaultValue: 'ZWL'
    },
    status: {
      type: DataTypes.ENUM('planning', 'active', 'completed', 'archived'),
      defaultValue: 'active'
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: User, key: 'id' }
    },
    fiscalYear: {
      type: DataTypes.STRING(4),
      allowNull: false
    }
  },
  {
    sequelize,
    modelName: 'Project',
    tableName: 'projects',
    timestamps: true
  }
);

export default Project;
