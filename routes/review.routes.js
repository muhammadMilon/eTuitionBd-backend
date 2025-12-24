import express from 'express';
import { verifyFirebaseToken } from '../middleware/auth.middleware.js';
import Review from '../models/Review.model.js';
import User from '../models/User.model.js';
import { createNotification } from '../utils/notification.util.js';

const router = express.Router();

// Submit a review (authenticated student)
router.post('/', verifyFirebaseToken, async (req, res) => {
  try {
    const { tutorId, rating, comment, tuitionId } = req.body;
    const studentId = req.userId;

    // Check if tutor exists
    const tutor = await User.findById(tutorId);
    if (!tutor || tutor.role !== 'tutor') {
      return res.status(404).json({ message: 'Tutor not found' });
    }

    // Optional: check if student has actually worked with this tutor (via Tuition model)
    // For now, let's keep it open for public feedback or rely on future tuition status check

    const review = new Review({
      studentId,
      tutorId,
      rating,
      comment,
      tuitionId
    });

    await review.save();
    
    // Populate student info for the response
    await review.populate('studentId', 'name photoUrl');

    // Notify tutor about new review
    const student = await User.findById(studentId);
    await createNotification({
      recipient: tutorId,
      sender: studentId,
      type: 'review',
      title: 'New Review Received',
      message: `${student.name} left you a ${rating}-star review.`,
      relatedId: review._id
    });

    res.status(201).json({ message: 'Review submitted successfully', review });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ message: 'Failed to submit review', error: error.message });
  }
});

// Get reviews for a specific tutor
router.get('/tutor/:tutorId', async (req, res) => {
  try {
    const { tutorId } = req.params;
    const reviews = await Review.find({ tutorId })
      .populate('studentId', 'name photoUrl')
      .sort({ createdAt: -1 });

    res.json({ reviews });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ message: 'Failed to fetch reviews', error: error.message });
  }
});

export default router;
