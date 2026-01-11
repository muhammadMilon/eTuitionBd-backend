import express from 'express';
import { verifyFirebaseToken } from '../middleware/auth.middleware.js';
import Notification from '../models/Notification.model.js';

const router = express.Router();

// Get all notifications for the current user
router.get('/', verifyFirebaseToken, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.userId })
      .populate('sender', 'name photoUrl')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Failed to fetch notifications', error: error.message });
  }
});

// Mark a notification as read
router.patch('/:id/read', verifyFirebaseToken, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.userId
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notification.isRead = true;
    await notification.save();

    res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ message: 'Failed to update notification', error: error.message });
  }
});

// Mark all notifications as read
router.patch('/read-all', verifyFirebaseToken, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.userId, isRead: false },
      { $set: { isRead: true } }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ message: 'Failed to update notifications', error: error.message });
  }
});

export default router;
