import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import 'express-async-errors';
import sequelize from './config/database.js';
import errorHandler from './middleware/errorHandler.js';

// Routes
import authRoutes from './routes/auth.js';
import expensesRoutes from './routes/expenses.js';
import approvalsRoutes from './routes/approvals.js';
import projectsRoutes from './routes/projects.js';
import budgetsRoutes from './routes/budgets.js';
import reportsRoutes from './routes/reports.js';
import receiptsRoutes from './routes/receipts.js';
import notificationsRoutes from './routes/notifications.js';
import categoriesRoutes from './routes/categories.js';
import recurringRoutes from './routes/recurring.js';

// Models
import User from './models/User.js';
import Project from './models/Project.js';
import Expense from './models/Expense.js';
import Category from './models/Category.js';
import Approval from './models/Approval.js';
import Receipt from './models/Receipt.js';
import BudgetAllocation from './models/BudgetAllocation.js';
import Notification from './models/Notification.js';

dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/approvals', approvalsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/budgets', budgetsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/receipts', receiptsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/recurring', recurringRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Expense Manager API is running' });
});

// Error handler
app.use(errorHandler);

// Establish associations
User.hasMany(Expense, { foreignKey: 'submitterId', as: 'expenses' });
Expense.belongsTo(User, { foreignKey: 'submitterId', as: 'submitter' });

Project.hasMany(Expense, { foreignKey: 'projectId' });
Expense.belongsTo(Project, { foreignKey: 'projectId' });

Category.hasMany(Expense, { foreignKey: 'categoryId' });
Expense.belongsTo(Category, { foreignKey: 'categoryId' });

User.hasMany(Approval, { foreignKey: 'requestedFromId', as: 'approvalsRequested' });
Approval.belongsTo(User, { foreignKey: 'requestedFromId', as: 'requestedFrom' });

Approval.belongsTo(User, { foreignKey: 'requestedById', as: 'requestedBy' });
Approval.belongsTo(Expense, { foreignKey: 'expenseId' });
Expense.hasMany(Approval, { foreignKey: 'expenseId' });

User.hasMany(Notification, { foreignKey: 'userId' });
Notification.belongsTo(User, { foreignKey: 'userId' });

Project.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });
User.hasMany(Project, { foreignKey: 'ownerId' });

// Database sync
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connection established');

    const useAlter = process.env.NODE_ENV === 'development' && sequelize.getDialect() !== 'sqlite';
    await sequelize.sync({ alter: useAlter });
    console.log('✓ Database tables synchronized');

    app.listen(PORT, () => {
      console.log(`✓ Expense Manager API running on port ${PORT}`);
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
