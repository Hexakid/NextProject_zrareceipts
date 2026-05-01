import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { getCategories } from '../controllers/categories.js';

const router = express.Router();

router.get('/', authenticate, getCategories);

export default router;
