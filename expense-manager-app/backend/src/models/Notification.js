import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js';

const Notification = sequelize.define(
  'Notification',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: User, key: 'id' }
    },
    type: {
      type: DataTypes.ENUM('approval_request', 'approval_approved', 'approval_rejected', 'budget_alert', 'recurring_due'),
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    relatedExpenseId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    channel: {
      type: DataTypes.ENUM('in_app', 'email', 'push'),
      defaultValue: 'in_app'
    },
    sentAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
    timestamps: true
  }
);

export default Notification;
