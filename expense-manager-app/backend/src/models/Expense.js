import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js';
import Project from './Project.js';
import Category from './Category.js';

const Expense = sequelize.define(
  'Expense',
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
    submitterId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: User, key: 'id' }
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: Category, key: 'id' }
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'ZWL'
    },
    vatAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    },
    expenseDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    submissionDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    merchantName: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    receiptId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    receiptPath: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    isRecurring: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    recurringPattern: {
      type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'quarterly', 'annual'),
      allowNull: true
    },
    nextOccurrence: {
      type: DataTypes.DATE,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('draft', 'submitted', 'approved', 'rejected', 'paid'),
      defaultValue: 'draft'
    }
  },
  {
    sequelize,
    modelName: 'Expense',
    tableName: 'expenses',
    timestamps: true
  }
);

export default Expense;
