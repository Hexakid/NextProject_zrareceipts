import Category from '../models/Category.js';

export const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.findAll({ where: { isActive: true }, order: [['name', 'ASC']] });
    res.json(categories);
  } catch (error) {
    next(error);
  }
};
