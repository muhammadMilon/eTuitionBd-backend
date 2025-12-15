import express from 'express';
import User from '../models/User.model.js';
import { verifyFirebaseToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Get all tutors (public)
router.get('/tutors', async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tutors = await User.find({ role: 'tutor', isActive: true })
      .select('name email photoUrl qualifications experience bio subjects')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments({ role: 'tutor', isActive: true });

    res.json({
      tutors,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get tutors error:', error);
    res.status(500).json({ message: 'Failed to fetch tutors', error: error.message });
  }
});

// Get tutor by ID (public)
router.get('/tutors/:id', async (req, res) => {
  try {
    const tutor = await User.findById(req.params.id)
      .select('name email photoUrl qualifications experience bio subjects createdAt')
      .populate('subjects');

    if (!tutor || tutor.role !== 'tutor') {
      return res.status(404).json({ message: 'Tutor not found' });
    }

    res.json({ tutor });
  } catch (error) {
    console.error('Get tutor error:', error);
    res.status(500).json({ message: 'Failed to fetch tutor', error: error.message });
  }
});

// Get user profile (authenticated)
router.get('/profile', verifyFirebaseToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-__v');
    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to fetch profile', error: error.message });
  }
});

// Update user profile (authenticated)
router.put('/profile', verifyFirebaseToken, async (req, res) => {
  try {
    const { name, phone, photoUrl, qualifications, experience, bio, subjects } = req.body;

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (photoUrl !== undefined) user.photoUrl = photoUrl;
    if (qualifications !== undefined) user.qualifications = qualifications;
    if (experience !== undefined) user.experience = experience;
    if (bio !== undefined) user.bio = bio;
    if (subjects !== undefined && Array.isArray(subjects)) user.subjects = subjects;

    await user.save();

    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Update failed', error: error.message });
  }
});

export default router;

