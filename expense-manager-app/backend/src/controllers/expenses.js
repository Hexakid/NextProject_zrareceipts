import Expense from '../models/Expense.js';
import Project from '../models/Project.js';
import Category from '../models/Category.js';
import User from '../models/User.js';
import { Op } from 'sequelize';
import Approval from '../models/Approval.js';
import Notification from '../models/Notification.js';

function computeNextOccurrence(baseDate, pattern) {
  if (!baseDate || !pattern) return null;
  const next = new Date(baseDate);
  if (pattern === 'daily') next.setDate(next.getDate() + 1);
  if (pattern === 'weekly') next.setDate(next.getDate() + 7);
  if (pattern === 'monthly') next.setMonth(next.getMonth() + 1);
  if (pattern === 'quarterly') next.setMonth(next.getMonth() + 3);
  if (pattern === 'annual') next.setFullYear(next.getFullYear() + 1);
  return next;
}

export const createExpense = async (req, res, next) => {
  try {
    const {
      projectId,
      categoryId,
      amount,
      description,
      merchantName,
      expenseDate,
      receiptPath,
      receiptId,
      isRecurring,
      recurringPattern
    } = req.body;

    const nextOccurrence = isRecurring
      ? computeNextOccurrence(expenseDate || new Date(), recurringPattern)
      : null;

    const expense = await Expense.create({
      projectId,
      categoryId,
      amount,
      description,
      merchantName,
      expenseDate,
      receiptPath,
      receiptId,
      isRecurring: Boolean(isRecurring),
      recurringPattern: isRecurring ? recurringPattern : null,
      nextOccurrence,
      submitterId: req.user.id,
      status: 'draft'
    });

    res.status(201).json({
      message: 'Expense created successfully',
      expense
    });
  } catch (error) {
    next(error);
  }
};

export const getMyExpenses = async (req, res, next) => {
  try {
    const { status, categoryId, projectId } = req.query;
    const where = { submitterId: req.user.id };

    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (projectId) where.projectId = projectId;

    const expenses = await Expense.findAll({
      where,
      include: [
        { model: Category, attributes: ['name', 'description'] },
        { model: Project, attributes: ['name'] }
      ],
      order: [['expenseDate', 'DESC']]
    });

    res.json(expenses);
  } catch (error) {
    next(error);
  }
};

export const getExpenseById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findByPk(id, {
      include: [
        { model: Category, attributes: ['name', 'description'] },
        { model: Project, attributes: ['name', 'budgetTotal'] },
        { model: User, as: 'submitter', attributes: ['id', 'username', 'email'] }
      ]
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    next(error);
  }
};

export const updateExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      amount,
      description,
      merchantName,
      expenseDate,
      categoryId,
      receiptPath,
      receiptId,
      isRecurring,
      recurringPattern
    } = req.body;

    const expense = await Expense.findByPk(id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Only allow editing draft and rejected expenses
    if (!['draft', 'rejected'].includes(expense.status)) {
      return res.status(400).json({ error: 'Can only edit draft or rejected expenses' });
    }

    // Only owner can edit
    if (expense.submitterId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to edit this expense' });
    }

    const nextOccurrence = isRecurring
      ? computeNextOccurrence(expenseDate || new Date(), recurringPattern)
      : null;

    await expense.update({
      amount,
      description,
      merchantName,
      expenseDate,
      categoryId,
      receiptPath,
      receiptId,
      isRecurring: Boolean(isRecurring),
      recurringPattern: isRecurring ? recurringPattern : null,
      nextOccurrence
    });

    res.json({
      message: 'Expense updated successfully',
      expense
    });
  } catch (error) {
    next(error);
  }
};

export const submitExpense = async (req, res, next) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findByPk(id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    if (expense.submitterId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (expense.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft expenses can be submitted' });
    }

    await expense.update({ status: 'submitted' });

    const submitter = await User.findByPk(req.user.id);
    const autoApproveThreshold = parseFloat(process.env.AUTO_APPROVE_THRESHOLD || '0');

    if (autoApproveThreshold > 0 && parseFloat(expense.amount) <= autoApproveThreshold) {
      await expense.update({ status: 'approved' });
      await Notification.create({
        userId: expense.submitterId,
        type: 'approval_approved',
        title: 'Expense Auto-Approved',
        message: `Your expense of ${expense.amount} was auto-approved by policy threshold.`,
        relatedExpenseId: expense.id,
        channel: 'in_app'
      });
      return res.json({
        message: 'Expense auto-approved successfully',
        expense
      });
    }

    const approverId = submitter?.managerId;
    if (!approverId) {
      return res.status(400).json({ error: 'No manager assigned to this employee. Cannot route approval.' });
    }

    await Approval.create({
      expenseId: expense.id,
      requestedFromId: approverId,
      requestedById: expense.submitterId,
      status: 'pending',
      approvalLevel: 1
    });

    await Notification.create({
      userId: approverId,
      type: 'approval_request',
      title: 'New Expense Approval Required',
      message: `A new expense (${expense.amount}) is waiting for your review.`,
      relatedExpenseId: expense.id,
      channel: 'in_app'
    });

    res.json({
      message: 'Expense submitted successfully',
      expense
    });
  } catch (error) {
    next(error);
  }
};

export const deleteExpense = async (req, res, next) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findByPk(id);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    if (expense.submitterId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (expense.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft expenses can be deleted' });
    }

    await expense.destroy();

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getTeamExpenses = async (req, res, next) => {
  try {
    // Manager sees expenses from their team
    // Finance admin sees all expenses
    let where = {};

    if (req.user.role === 'manager') {
      const teamMembers = await User.findAll({
        where: { managerId: req.user.id },
        attributes: ['id']
      });

      const teamMemberIds = teamMembers.map(m => m.id);
      where.submitterId = { [Op.in]: teamMemberIds };
    }

    const expenses = await Expense.findAll({
      where,
      include: [
        { model: Category },
        { model: Project },
        { model: User, as: 'submitter', attributes: ['username', 'email'] }
      ],
      order: [['expenseDate', 'DESC']]
    });

    res.json(expenses);
  } catch (error) {
    next(error);
  }
};
