import Expense from '../models/Expense.js';

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

export const getUpcomingRecurring = async (req, res, next) => {
  try {
    const now = new Date();
    const items = await Expense.findAll({
      where: {
        submitterId: req.user.id,
        isRecurring: true
      },
      order: [['nextOccurrence', 'ASC']]
    });

    res.json(items.filter((i) => i.nextOccurrence && new Date(i.nextOccurrence) >= now));
  } catch (error) {
    next(error);
  }
};

export const updateRecurringSettings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isRecurring, recurringPattern } = req.body;

    const expense = await Expense.findByPk(id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    if (expense.submitterId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    const nextOccurrence = isRecurring
      ? computeNextOccurrence(expense.expenseDate || new Date(), recurringPattern)
      : null;

    await expense.update({
      isRecurring: Boolean(isRecurring),
      recurringPattern: isRecurring ? recurringPattern : null,
      nextOccurrence
    });

    res.json({ message: 'Recurring settings updated', expense });
  } catch (error) {
    next(error);
  }
};

export const generateDueRecurring = async (req, res, next) => {
  try {
    const now = new Date();
    const dueItems = await Expense.findAll({
      where: {
        isRecurring: true
      }
    });

    let createdCount = 0;
    for (const item of dueItems) {
      if (!item.nextOccurrence || new Date(item.nextOccurrence) > now) continue;

      const clone = await Expense.create({
        projectId: item.projectId,
        submitterId: item.submitterId,
        categoryId: item.categoryId,
        amount: item.amount,
        currency: item.currency,
        vatAmount: item.vatAmount,
        expenseDate: item.nextOccurrence,
        description: item.description,
        merchantName: item.merchantName,
        receiptId: item.receiptId,
        receiptPath: item.receiptPath,
        isRecurring: false,
        status: 'draft'
      });
      createdCount += 1;

      const next = computeNextOccurrence(item.nextOccurrence, item.recurringPattern);
      await item.update({ nextOccurrence: next });
    }

    res.json({ message: 'Recurring generation complete', createdCount });
  } catch (error) {
    next(error);
  }
};
