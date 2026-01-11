import express from 'express';
import { verifyFirebaseToken } from '../middleware/auth.middleware.js';
import Schedule from '../models/Schedule.model.js';
import { createNotification } from '../utils/notification.util.js';

const router = express.Router();

// Create a new schedule entry
router.post('/', verifyFirebaseToken, async (req, res) => {
  try {
    const { tuitionId, tutorId, studentId, startTime, endTime, title, description, meetingLink } = req.body;

    const schedule = new Schedule({
      tuitionId,
      tutorId,
      studentId,
      startTime,
      endTime,
      title,
      description,
      meetingLink
    });

    await schedule.save();

    // Notify the other participant
    const recipientId = req.userId === tutorId ? studentId : tutorId;
    await createNotification({
      recipient: recipientId,
      sender: req.userId,
      type: 'tuition_status',
      title: 'New Session Scheduled',
      message: `A new tuition session for "${title}" has been scheduled.`,
      relatedId: schedule._id
    });

    res.status(201).json({ message: 'Schedule created successfully', schedule });
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ message: 'Failed to create schedule', error: error.message });
  }
});

// Get all schedule entries for a user
router.get('/user/all', verifyFirebaseToken, async (req, res) => {
  try {
    const schedules = await Schedule.find({
      $or: [{ tutorId: req.userId }, { studentId: req.userId }]
    })
      .populate('tuitionId', 'title subject')
      .populate('tutorId', 'name photoUrl')
      .populate('studentId', 'name photoUrl')
      .sort({ startTime: 1 });

    res.json({ schedules });
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ message: 'Failed to fetch schedules', error: error.message });
  }
});

// Update schedule status
router.patch('/:id/status', verifyFirebaseToken, async (req, res) => {
  try {
    const { status } = req.body;
    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    if (schedule.tutorId.toString() !== req.userId && schedule.studentId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    schedule.status = status;
    await schedule.save();

    res.json({ message: 'Schedule updated successfully', schedule });
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ message: 'Failed to update schedule', error: error.message });
  }
});

export default router;
