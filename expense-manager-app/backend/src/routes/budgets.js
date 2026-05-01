import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getBudgetOverview, getBudgetAlerts, getBudgetByProject } from '../controllers/budgets.js';

const router = express.Router();

router.get('/overview', authenticate, requireRole('finance_admin', 'manager'), getBudgetOverview);
router.get('/alerts', authenticate, requireRole('finance_admin', 'manager'), getBudgetAlerts);
router.get('/:projectId', authenticate, getBudgetByProject);

export default router;
