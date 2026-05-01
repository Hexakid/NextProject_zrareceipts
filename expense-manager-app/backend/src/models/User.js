import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
import bcrypt from 'bcrypt';

class User extends Model {}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: { isEmail: true }
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('employee', 'manager', 'finance_admin'),
      defaultValue: 'employee',
      allowNull: false
    },
    department: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    managerId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: User, key: 'id' }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true
  }
);

// Hash password before saving
User.beforeCreate(async (user) => {
  user.passwordHash = await bcrypt.hash(user.passwordHash, 10);
});

User.beforeUpdate(async (user) => {
  if (user.changed('passwordHash')) {
    user.passwordHash = await bcrypt.hash(user.passwordHash, 10);
  }
});

// Add method to compare password
User.prototype.comparePassword = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

export default User;
