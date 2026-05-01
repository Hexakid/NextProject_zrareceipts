import Project from '../models/Project.js';
import User from '../models/User.js';

export const createProject = async (req, res, next) => {
  try {
    const { name, description, budgetTotal, fiscalYear } = req.body;

    const project = await Project.create({
      name,
      description,
      budgetTotal,
      fiscalYear: fiscalYear || new Date().getFullYear().toString(),
      ownerId: req.user.id
    });

    res.status(201).json({
      message: 'Project created successfully',
      project
    });
  } catch (error) {
    next(error);
  }
};

export const getMyProjects = async (req, res, next) => {
  try {
    const projects = await Project.findAll({
      where: { ownerId: req.user.id },
      include: [{ model: User, as: 'owner', attributes: ['username', 'email'] }]
    });

    res.json(projects);
  } catch (error) {
    next(error);
  }
};

export const getProjectById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const project = await Project.findByPk(id, {
      include: [{ model: User, as: 'owner', attributes: ['username', 'email'] }]
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    next(error);
  }
};

export const updateProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, budgetTotal, status } = req.body;

    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this project' });
    }

    await project.update({ name, description, budgetTotal, status });

    res.json({
      message: 'Project updated successfully',
      project
    });
  } catch (error) {
    next(error);
  }
};

export const getAllProjects = async (req, res, next) => {
  try {
    // Finance admin sees all projects
    const projects = await Project.findAll({
      include: [{ model: User, as: 'owner', attributes: ['username', 'email'] }]
    });

    res.json(projects);
  } catch (error) {
    next(error);
  }
};
