import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const isSqlite = sequelize.getDialect() === 'sqlite';

const Receipt = sequelize.define(
  'Receipt',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    vatCollectorReceiptId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    merchantName: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    tpin: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    invoiceNumber: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    invoiceDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    extractedVia: {
      type: DataTypes.ENUM('gemini_ai', 'ocr_tesseract', 'manual'),
      defaultValue: 'manual'
    },
    extractedFields: {
      type: isSqlite ? DataTypes.JSON : DataTypes.JSONB,
      allowNull: true
    },
    imagePath: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    imageThumbPath: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    associatedExpenses: {
      type: isSqlite ? DataTypes.JSON : DataTypes.ARRAY(DataTypes.UUID),
      defaultValue: [],
      allowNull: false
    }
  },
  {
    sequelize,
    modelName: 'Receipt',
    tableName: 'receipts',
    timestamps: true
  }
);

export default Receipt;
