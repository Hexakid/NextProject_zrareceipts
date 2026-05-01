import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import Project from './Project.js';
import Category from './Category.js';

const BudgetAllocation = sequelize.define(
  'BudgetAllocation',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: Project, key: 'id' }
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: Category, key: 'id' }
    },
    allocatedAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    spentAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    remainingAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    fiscalYear: {
      type: DataTypes.STRING(4),
      allowNull: false
    },
    alertThresholdPercent: {
      type: DataTypes.INTEGER,
      defaultValue: 80
    },
    alertSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  },
  {
    sequelize,
    modelName: 'BudgetAllocation',
    tableName: 'budget_allocations',
    timestamps: true
  }
);

export default BudgetAllocation;
