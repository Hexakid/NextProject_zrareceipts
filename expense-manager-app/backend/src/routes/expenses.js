import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createExpense,
  getMyExpenses,
  getExpenseById,
  updateExpense,
  submitExpense,
  deleteExpense,
  getTeamExpenses
} from '../controllers/expenses.js';

const router = express.Router();

// Employee routes
router.post('/', authenticate, createExpense);
router.get('/', authenticate, getMyExpenses);
router.get('/:id', authenticate, getExpenseById);
router.put('/:id', authenticate, updateExpense);
router.post('/:id/submit', authenticate, submitExpense);
router.delete('/:id', authenticate, deleteExpense);

// Manager/Finance routes
router.get('/team/list', authenticate, getTeamExpenses);

export default router;
