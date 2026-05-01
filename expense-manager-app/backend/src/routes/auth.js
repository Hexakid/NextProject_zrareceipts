import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { register, login, refreshAccessToken, getCurrentUser, logout } from '../controllers/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshAccessToken);
router.get('/me', authenticate, getCurrentUser);
router.post('/logout', logout);

export default router;
