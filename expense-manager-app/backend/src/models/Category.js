import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Category = sequelize.define(
  'Category',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.ENUM(
        'travel',
        'meals_entertainment',
        'accommodation',
        'supplies_equipment',
        'contractor_payments',
        'utilities'
      ),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    defaultApprovalThreshold: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    },
    requiresReceipt: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  },
  {
    sequelize,
    modelName: 'Category',
    tableName: 'categories',
    timestamps: true
  }
);

export default Category;
