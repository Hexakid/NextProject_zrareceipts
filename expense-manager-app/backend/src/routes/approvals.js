import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  getApprovalQueue,
  approveExpense,
  rejectExpense,
  getApprovalHistory
} from '../controllers/approvals.js';

const router = express.Router();

router.get('/queue', authenticate, requireRole('manager', 'finance_admin'), getApprovalQueue);
router.post('/:expenseId/approve', authenticate, requireRole('manager', 'finance_admin'), approveExpense);
router.post('/:expenseId/reject', authenticate, requireRole('manager', 'finance_admin'), rejectExpense);
router.get('/history', authenticate, requireRole('manager', 'finance_admin'), getApprovalHistory);

export default router;
