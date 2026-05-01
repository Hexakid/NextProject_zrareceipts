import sequelize from '../config/database.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Project from '../models/Project.js';
import Expense from '../models/Expense.js';

// Associations
User.hasMany(Expense, { foreignKey: 'submitterId', as: 'expenses' });
Expense.belongsTo(User, { foreignKey: 'submitterId', as: 'submitter' });
Project.hasMany(Expense, { foreignKey: 'projectId' });
Expense.belongsTo(Project, { foreignKey: 'projectId' });
Category.hasMany(Expense, { foreignKey: 'categoryId' });
Expense.belongsTo(Category, { foreignKey: 'categoryId' });
Project.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });
User.hasMany(Project, { foreignKey: 'ownerId' });

const seed = async () => {
  try {
    if (sequelize.getDialect() === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = OFF');
    }

    await sequelize.sync({ force: true });

    if (sequelize.getDialect() === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = ON');
    }

    console.log('✓ Database synced');

    const categories = await Category.bulkCreate([
      { name: 'travel', description: 'Business travel expenses', requiresReceipt: true },
      { name: 'meals_entertainment', description: 'Meals and business entertainment', requiresReceipt: true },
      { name: 'accommodation', description: 'Hotel and lodging', requiresReceipt: true },
      { name: 'supplies_equipment', description: 'Office supplies and equipment', requiresReceipt: true },
      { name: 'contractor_payments', description: 'Freelancer and contractor fees', requiresReceipt: false },
      { name: 'utilities', description: 'Utilities and subscriptions', requiresReceipt: false }
    ]);
    console.log('✓ Categories seeded:', categories.length);

    const finance = await User.create({
      username: 'finance_admin', email: 'finance@company.com',
      passwordHash: 'Finance@123', role: 'finance_admin', department: 'Finance'
    });
    const manager = await User.create({
      username: 'john_manager', email: 'john@company.com',
      passwordHash: 'Manager@123', role: 'manager', department: 'Operations'
    });
    const employee1 = await User.create({
      username: 'alice_emp', email: 'alice@company.com',
      passwordHash: 'Employee@123', role: 'employee', department: 'Operations',
      managerId: manager.id
    });
    const employee2 = await User.create({
      username: 'bob_emp', email: 'bob@company.com',
      passwordHash: 'Employee@123', role: 'employee', department: 'Sales',
      managerId: manager.id
    });
    console.log('✓ Users seeded: 4');

    const project1 = await Project.create({
      name: 'Q2 Operations', description: 'Q2 2026 Operations Budget',
      budgetTotal: 50000, ownerId: manager.id, fiscalYear: '2026'
    });
    const project2 = await Project.create({
      name: 'Marketing Campaign', description: 'Digital marketing campaign',
      budgetTotal: 20000, ownerId: finance.id, fiscalYear: '2026'
    });
    console.log('✓ Projects seeded: 2');

    const travelCat = categories.find(c => c.name === 'travel');
    const mealsCat = categories.find(c => c.name === 'meals_entertainment');
    const suppliesCat = categories.find(c => c.name === 'supplies_equipment');

    await Expense.bulkCreate([
      {
        projectId: project1.id, submitterId: employee1.id, categoryId: travelCat.id,
        amount: 350.00, description: 'Flight to Lusaka for client meeting',
        merchantName: 'Zambia Airways', expenseDate: new Date('2026-04-15'), status: 'submitted'
      },
      {
        projectId: project1.id, submitterId: employee2.id, categoryId: mealsCat.id,
        amount: 120.00, description: 'Team lunch with client',
        merchantName: 'Rhapsody Restaurant', expenseDate: new Date('2026-04-20'), status: 'draft'
      },
      {
        projectId: project2.id, submitterId: employee1.id, categoryId: suppliesCat.id,
        amount: 890.00, description: 'Marketing materials and printing',
        merchantName: 'Shoprite', expenseDate: new Date('2026-04-25'), status: 'approved'
      }
    ]);
    console.log('✓ Sample expenses seeded');

    console.log('\n✅ Seed complete! Login credentials:');
    console.log('  Finance Admin : finance@company.com / Finance@123');
    console.log('  Manager       : john@company.com    / Manager@123');
    console.log('  Employee      : alice@company.com   / Employee@123');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
};

seed();
