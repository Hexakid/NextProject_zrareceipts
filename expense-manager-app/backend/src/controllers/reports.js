import Expense from '../models/Expense.js';
import Project from '../models/Project.js';
import Category from '../models/Category.js';
import User from '../models/User.js';
import sequelize from '../config/database.js';
import { Op } from 'sequelize';
import { stringify } from 'csv-stringify/sync';
import PDFDocument from 'pdfkit';

export const getDashboardAnalytics = async (req, res, next) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    // Total expenses by status
    const byStatus = await Expense.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total']
      ],
      group: ['status']
    });

    // Monthly spending trend
    const monthly = await Expense.findAll({
      where: {
        status: { [Op.in]: ['approved', 'paid'] },
        expenseDate: {
          [Op.between]: [`${year}-01-01`, `${year}-12-31`]
        }
      },
      attributes: [
        [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('expenseDate')), 'month'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total']
      ],
      group: [sequelize.fn('DATE_TRUNC', 'month', sequelize.col('expenseDate'))],
      order: [[sequelize.fn('DATE_TRUNC', 'month', sequelize.col('expenseDate')), 'ASC']]
    });

    // Category breakdown
    const byCategory = await Expense.findAll({
      where: { status: { [Op.in]: ['approved', 'paid'] } },
      attributes: [
        'categoryId',
        [sequelize.fn('SUM', sequelize.col('Expense.amount')), 'total']
      ],
      include: [{ model: Category, attributes: ['name'] }],
      group: ['categoryId', 'Category.id']
    });

    // Top projects by spend
    const byProject = await Expense.findAll({
      where: { status: { [Op.in]: ['approved', 'paid'] } },
      attributes: [
        'projectId',
        [sequelize.fn('SUM', sequelize.col('Expense.amount')), 'total']
      ],
      include: [{ model: Project, attributes: ['name', 'budgetTotal'] }],
      group: ['projectId', 'Project.id'],
      order: [[sequelize.fn('SUM', sequelize.col('Expense.amount')), 'DESC']],
      limit: 5
    });

    // Pending approvals count
    const pendingCount = await Expense.count({ where: { status: 'submitted' } });

    res.json({
      byStatus: byStatus.map(s => ({
        status: s.status,
        count: parseInt(s.dataValues.count),
        total: parseFloat(s.dataValues.total || 0)
      })),
      monthlyTrend: monthly.map(m => ({
        month: m.dataValues.month,
        total: parseFloat(m.dataValues.total || 0)
      })),
      byCategory: byCategory.map(c => ({
        categoryId: c.categoryId,
        categoryName: c.Category?.name,
        total: parseFloat(c.dataValues.total || 0)
      })),
      topProjects: byProject.map(p => ({
        projectId: p.projectId,
        projectName: p.Project?.name,
        budget: parseFloat(p.Project?.budgetTotal || 0),
        spent: parseFloat(p.dataValues.total || 0)
      })),
      pendingApprovals: pendingCount
    });
  } catch (error) {
    next(error);
  }
};

export const exportCSV = async (req, res, next) => {
  try {
    const { projectId, startDate, endDate, status } = req.body;
    const where = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (startDate && endDate) {
      where.expenseDate = { [Op.between]: [startDate, endDate] };
    }

    const expenses = await Expense.findAll({
      where,
      include: [
        { model: Category, attributes: ['name'] },
        { model: Project, attributes: ['name'] },
        { model: User, as: 'submitter', attributes: ['username', 'email'] }
      ],
      order: [['expenseDate', 'DESC']]
    });

    const rows = expenses.map(e => ({
      ID: e.id,
      Date: e.expenseDate,
      Employee: e.submitter?.username,
      Email: e.submitter?.email,
      Project: e.Project?.name,
      Category: e.Category?.name,
      Merchant: e.merchantName || '',
      Amount: e.amount,
      Currency: e.currency,
      VAT: e.vatAmount || '',
      Description: e.description,
      Status: e.status,
      Submitted: e.submissionDate
    }));

    const csv = stringify(rows, { header: true });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="expenses.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

export const exportPDF = async (req, res, next) => {
  try {
    const { projectId, startDate, endDate } = req.body;
    const where = { status: { [Op.in]: ['approved', 'paid'] } };
    if (projectId) where.projectId = projectId;
    if (startDate && endDate) {
      where.expenseDate = { [Op.between]: [startDate, endDate] };
    }

    const expenses = await Expense.findAll({
      where,
      include: [
        { model: Category, attributes: ['name'] },
        { model: Project, attributes: ['name', 'budgetTotal'] },
        { model: User, as: 'submitter', attributes: ['username'] }
      ],
      order: [['expenseDate', 'DESC']]
    });

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="expense_report.pdf"');

    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('Expense Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(1);

    // Summary
    const totalAmount = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    doc.fontSize(12).font('Helvetica-Bold').text(`Total Expenses: ${expenses.length}`);
    doc.text(`Total Amount: ${totalAmount.toFixed(2)}`);
    doc.moveDown(1);

    // Table header
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Date', 50, doc.y, { width: 70, continued: true });
    doc.text('Employee', { width: 100, continued: true });
    doc.text('Category', { width: 100, continued: true });
    doc.text('Merchant', { width: 110, continued: true });
    doc.text('Amount', { width: 80 });
    doc.moveTo(50, doc.y).lineTo(560, doc.y).stroke();
    doc.moveDown(0.3);

    // Table rows
    doc.font('Helvetica').fontSize(9);
    for (const e of expenses) {
      if (doc.y > 700) { doc.addPage(); }
      doc.text(new Date(e.expenseDate).toLocaleDateString(), 50, doc.y, { width: 70, continued: true });
      doc.text(e.submitter?.username || '-', { width: 100, continued: true });
      doc.text(e.Category?.name || '-', { width: 100, continued: true });
      doc.text(e.merchantName || '-', { width: 110, continued: true });
      doc.text(`${parseFloat(e.amount).toFixed(2)} ${e.currency}`, { width: 80 });
    }

    doc.end();
  } catch (error) {
    next(error);
  }
};
