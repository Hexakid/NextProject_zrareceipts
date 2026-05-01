import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  createProject,
  getMyProjects,
  getProjectById,
  updateProject,
  getAllProjects
} from '../controllers/projects.js';

const router = express.Router();

router.post('/', authenticate, createProject);
router.get('/', authenticate, getMyProjects);
router.get('/:id', authenticate, getProjectById);
router.put('/:id', authenticate, updateProject);
router.get('/all/list', authenticate, requireRole('finance_admin'), getAllProjects);

export default router;
