import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getDashboardAnalytics, exportCSV, exportPDF } from '../controllers/reports.js';

const router = express.Router();

router.get('/analytics', authenticate, requireRole('finance_admin', 'manager'), getDashboardAnalytics);
router.post('/export/csv', authenticate, requireRole('finance_admin', 'manager'), exportCSV);
router.post('/export/pdf', authenticate, requireRole('finance_admin', 'manager'), exportPDF);

export default router;
