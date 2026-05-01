import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { getMyNotifications, markAsRead, markAllRead, getUnreadCount } from '../controllers/notifications.js';

const router = express.Router();

router.get('/', authenticate, getMyNotifications);
router.get('/unread-count', authenticate, getUnreadCount);
router.post('/:id/read', authenticate, markAsRead);
router.post('/read-all', authenticate, markAllRead);

export default router;
