import Notification from '../models/Notification.js';

export const getMyNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.json(notifications);
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notif = await Notification.findOne({ where: { id, userId: req.user.id } });
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    await notif.update({ isRead: true });
    res.json({ message: 'Marked as read' });
  } catch (error) {
    next(error);
  }
};

export const markAllRead = async (req, res, next) => {
  try {
    await Notification.update({ isRead: true }, { where: { userId: req.user.id } });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.count({ where: { userId: req.user.id, isRead: false } });
    res.json({ count });
  } catch (error) {
    next(error);
  }
};
