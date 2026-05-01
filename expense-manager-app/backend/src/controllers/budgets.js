import Expense from '../models/Expense.js';
import BudgetAllocation from '../models/BudgetAllocation.js';
import Project from '../models/Project.js';
import Category from '../models/Category.js';
import Notification from '../models/Notification.js';
import sequelize from '../config/database.js';
import { Op } from 'sequelize';

export const getBudgetOverview = async (req, res, next) => {
  try {
    const projects = await Project.findAll({
      attributes: [
        'id', 'name', 'budgetTotal', 'budgetCurrency', 'status', 'fiscalYear',
        [
          sequelize.literal(`(
            SELECT COALESCE(SUM(amount), 0)
            FROM expenses
            WHERE expenses."projectId" = "Project".id
            AND expenses.status IN ('approved', 'paid')
          )`),
          'spentAmount'
        ]
      ]
    });

    const overview = projects.map(p => {
      const spent = parseFloat(p.dataValues.spentAmount || 0);
      const budget = parseFloat(p.budgetTotal);
      const remaining = budget - spent;
      const burnPct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
      return {
        ...p.toJSON(),
        spentAmount: spent,
        remaining,
        burnRatePct: burnPct,
        alertLevel: burnPct >= 90 ? 'critical' : burnPct >= 80 ? 'warning' : 'ok'
      };
    });

    res.json(overview);
  } catch (error) {
    next(error);
  }
};

export const getBudgetAlerts = async (req, res, next) => {
  try {
    const projects = await Project.findAll({ where: { status: 'active' } });

    const alerts = [];

    for (const project of projects) {
      const spentResult = await Expense.findOne({
        where: { projectId: project.id, status: { [Op.in]: ['approved', 'paid'] } },
        attributes: [[sequelize.fn('SUM', sequelize.col('amount')), 'total']]
      });

      const spent = parseFloat(spentResult?.dataValues?.total || 0);
      const budget = parseFloat(project.budgetTotal);
      const burnPct = budget > 0 ? Math.round((spent / budget) * 100) : 0;

      const threshold = parseInt(process.env.BUDGET_ALERT_THRESHOLD_PERCENT || 80);

      if (burnPct >= threshold) {
        alerts.push({
          projectId: project.id,
          projectName: project.name,
          budget,
          spent,
          remaining: budget - spent,
          burnRatePct: burnPct,
          level: burnPct >= 100 ? 'exceeded' : burnPct >= 90 ? 'critical' : 'warning'
        });
      }
    }

    res.json(alerts);
  } catch (error) {
    next(error);
  }
};

export const getBudgetByProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findByPk(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const categoryBreakdown = await Expense.findAll({
      where: { projectId, status: { [Op.in]: ['approved', 'paid'] } },
      attributes: [
        'categoryId',
        [sequelize.fn('SUM', sequelize.col('Expense.amount')), 'totalSpent']
      ],
      include: [{ model: Category, attributes: ['name'] }],
      group: ['categoryId', 'Category.id']
    });

    const totalSpent = categoryBreakdown.reduce(
      (sum, c) => sum + parseFloat(c.dataValues.totalSpent || 0), 0
    );

    res.json({
      project: {
        id: project.id,
        name: project.name,
        budgetTotal: parseFloat(project.budgetTotal),
        spentAmount: totalSpent,
        remaining: parseFloat(project.budgetTotal) - totalSpent
      },
      categoryBreakdown: categoryBreakdown.map(c => ({
        categoryId: c.categoryId,
        categoryName: c.Category?.name,
        totalSpent: parseFloat(c.dataValues.totalSpent || 0)
      }))
    });
  } catch (error) {
    next(error);
  }
};
