import express from 'express';
import { verifyFirebaseToken } from '../middleware/auth.middleware.js';
import User from '../models/User.model.js';

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
    const { id } = req.params;
    let tutor;

    // Try finding by MongoDB ID first if it's a valid ObjectId
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      tutor = await User.findById(id)
        .select('name email photoUrl qualifications experience bio subjects createdAt phone role')
        .populate('subjects');
    }

    // If not found by ID or not a valid ObjectId, try finding by uid
    if (!tutor) {
      tutor = await User.findOne({ uid: id })
        .select('name email photoUrl qualifications experience bio subjects createdAt phone role')
        .populate('subjects');
    }

    if (!tutor || tutor.role !== 'tutor') {
      console.log(`Tutor not found with ID/UID: ${id}`);
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

// Toggle bookmark for tutor or tuition
router.post('/bookmarks/toggle', verifyFirebaseToken, async (req, res) => {
  try {
    const { targetId, targetType } = req.body; // targetType: 'tutor' or 'tuition'
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (targetType === 'tutor') {
      const index = user.bookmarkedTutors.indexOf(targetId);
      if (index > -1) {
        user.bookmarkedTutors.splice(index, 1);
        await user.save();
        return res.json({ message: 'Tutor removed from bookmarks', isBookmarked: false });
      } else {
        user.bookmarkedTutors.push(targetId);
        await user.save();
        return res.json({ message: 'Tutor added to bookmarks', isBookmarked: true });
      }
    } else if (targetType === 'tuition') {
      const index = user.bookmarkedTuitions.indexOf(targetId);
      if (index > -1) {
        user.bookmarkedTuitions.splice(index, 1);
        await user.save();
        return res.json({ message: 'Tuition removed from bookmarks', isBookmarked: false });
      } else {
        user.bookmarkedTuitions.push(targetId);
        await user.save();
        return res.json({ message: 'Tuition added to bookmarks', isBookmarked: true });
      }
    } else {
      return res.status(400).json({ message: 'Invalid target type' });
    }
  } catch (error) {
    console.error('Toggle bookmark error:', error);
    res.status(500).json({ message: 'Failed to toggle bookmark', error: error.message });
  }
});

// Get all bookmarks for the current user
router.get('/bookmarks/all', verifyFirebaseToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('bookmarkedTutors', 'name email photoUrl qualifications subjects')
      .populate({
        path: 'bookmarkedTuitions',
        populate: { path: 'studentId', select: 'name' }
      });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      tutors: user.bookmarkedTutors,
      tuitions: user.bookmarkedTuitions
    });
  } catch (error) {
    console.error('Get bookmarks error:', error);
    res.status(500).json({ message: 'Failed to fetch bookmarks', error: error.message });
  }
});

export default router;

