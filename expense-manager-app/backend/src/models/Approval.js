import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import Expense from './Expense.js';
import User from './User.js';

const Approval = sequelize.define(
  'Approval',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    expenseId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: Expense, key: 'id' }
    },
    requestedFromId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: User, key: 'id' }
    },
    requestedById: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: User, key: 'id' }
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending'
    },
    approvalLevel: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    comments: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    approvalDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    approvedByUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: User, key: 'id' }
    }
  },
  {
    sequelize,
    modelName: 'Approval',
    tableName: 'approvals',
    timestamps: true
  }
);

export default Approval;
