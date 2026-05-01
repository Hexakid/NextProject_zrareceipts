import Approval from '../models/Approval.js';
import Expense from '../models/Expense.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import Project from '../models/Project.js';
import Category from '../models/Category.js';
import { sendEmail } from '../services/emailService.js';
import { Op } from 'sequelize';

export const getApprovalQueue = async (req, res, next) => {
  try {
    // Get all expenses pending approval for this manager
    const approvals = await Approval.findAll({
      where: { requestedFromId: req.user.id, status: 'pending' },
      include: [
        {
          model: Expense,
          include: [
            { model: User, as: 'submitter', attributes: ['username', 'email'] },
            { model: Project, attributes: ['id', 'name'] },
            { model: Category, attributes: ['id', 'name'] }
          ]
        },
        { model: User, as: 'requestedBy', attributes: ['username'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(approvals);
  } catch (error) {
    next(error);
  }
};

export const approveExpense = async (req, res, next) => {
  try {
    const { expenseId } = req.params;
    const { comments } = req.body;

    const expense = await Expense.findByPk(expenseId);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const approval = await Approval.findOne({
      where: { expenseId, status: 'pending' }
    });

    if (!approval) {
      return res.status(404).json({ error: 'No pending approval found' });
    }

    // Check if user is authorized to approve
    if (approval.requestedFromId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to approve this expense' });
    }

    await approval.update({
      status: 'approved',
      comments,
      approvalDate: new Date(),
      approvedByUserId: req.user.id
    });

    // Check if this is the final approval
    const remainingApprovals = await Approval.findOne({
      where: { expenseId, status: 'pending' }
    });

    if (!remainingApprovals) {
      await expense.update({ status: 'approved' });

      const project = await Project.findByPk(expense.projectId);
      if (project) {
        const approvedSpent = await Expense.sum('amount', {
          where: {
            projectId: project.id,
            status: { [Op.in]: ['approved', 'paid'] }
          }
        });

        const spent = Number(approvedSpent || 0);
        const budget = Number(project.budgetTotal || 0);
        const threshold = Number(process.env.BUDGET_ALERT_THRESHOLD_PERCENT || 80);
        const usedPct = budget > 0 ? (spent / budget) * 100 : 0;

        if (usedPct >= threshold) {
          const financeUsers = await User.findAll({ where: { role: 'finance_admin', isActive: true } });
          await Promise.all(financeUsers.map((u) => Notification.create({
            userId: u.id,
            type: 'budget_alert',
            title: 'Project Budget Alert',
            message: `${project.name} is at ${Math.round(usedPct)}% of budget (${spent.toFixed(2)} / ${budget.toFixed(2)}).`,
            relatedExpenseId: expenseId,
            channel: 'in_app'
          })));
        }
      }
    }

    // Send notification to employee
    await Notification.create({
      userId: expense.submitterId,
      type: 'approval_approved',
      title: 'Expense Approved',
      message: `Your expense of ${expense.amount} has been approved.`,
      relatedExpenseId: expenseId,
      channel: 'in_app'
    });

    const submitter = await User.findByPk(expense.submitterId);
    if (submitter?.email) {
      await sendEmail({
        to: submitter.email,
        subject: 'Expense Approved',
        text: `Your expense of ${expense.amount} has been approved.`
      }).catch(() => {});
    }

    res.json({
      message: 'Expense approved successfully',
      approval,
      expense
    });
  } catch (error) {
    next(error);
  }
};

export const rejectExpense = async (req, res, next) => {
  try {
    const { expenseId } = req.params;
    const { comments } = req.body;

    const expense = await Expense.findByPk(expenseId);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const approval = await Approval.findOne({
      where: { expenseId, status: 'pending' }
    });

    if (!approval) {
      return res.status(404).json({ error: 'No pending approval found' });
    }

    if (approval.requestedFromId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to reject this expense' });
    }

    await approval.update({
      status: 'rejected',
      comments,
      approvalDate: new Date(),
      approvedByUserId: req.user.id
    });

    await expense.update({ status: 'rejected' });

    // Send notification to employee
    await Notification.create({
      userId: expense.submitterId,
      type: 'approval_rejected',
      title: 'Expense Rejected',
      message: `Your expense of ${expense.amount} has been rejected. Reason: ${comments}`,
      relatedExpenseId: expenseId,
      channel: 'in_app'
    });

    const submitter = await User.findByPk(expense.submitterId);
    if (submitter?.email) {
      await sendEmail({
        to: submitter.email,
        subject: 'Expense Rejected',
        text: `Your expense of ${expense.amount} was rejected. Reason: ${comments || 'No reason provided.'}`
      }).catch(() => {});
    }

    res.json({
      message: 'Expense rejected successfully',
      approval,
      expense
    });
  } catch (error) {
    next(error);
  }
};

export const getApprovalHistory = async (req, res, next) => {
  try {
    const approvals = await Approval.findAll({
      where: { requestedFromId: req.user.id },
      include: [
        { model: Expense },
        { model: User, as: 'requestedBy', attributes: ['username'] }
      ],
      order: [['approvalDate', 'DESC']]
    });

    res.json(approvals);
  } catch (error) {
    next(error);
  }
};
