import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import {
  getUpcomingRecurring,
  updateRecurringSettings,
  generateDueRecurring
} from '../controllers/recurring.js';

const router = express.Router();

router.get('/upcoming', authenticate, getUpcomingRecurring);
router.patch('/:id', authenticate, updateRecurringSettings);
router.post('/generate', authenticate, requireRole('finance_admin', 'manager'), generateDueRecurring);

export default router;
