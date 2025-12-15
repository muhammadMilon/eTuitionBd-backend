import express from 'express';
import User from '../models/User.model.js';
import { generateToken } from '../utils/jwt.util.js';

const router = express.Router();

// Register/Create user profile (after Firebase auth)
router.post('/register', async (req, res) => {
  try {
    const { uid, email, name, role, photoUrl, phone } = req.body;

    if (!uid || !email) {
      return res.status(400).json({ message: 'UID and email are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ uid }, { email }] });

    if (existingUser) {
      // Update existing user
      existingUser.name = name || existingUser.name;
      existingUser.photoUrl = photoUrl || existingUser.photoUrl;
      existingUser.phone = phone || existingUser.phone;
      if (role && !existingUser.role) {
        existingUser.role = role;
      }
      await existingUser.save();

      const token = generateToken(existingUser.uid, existingUser.role);
      return res.status(200).json({
        message: 'User profile updated',
        user: existingUser,
        token,
      });
    }

    // Create new user
    const user = new User({
      uid,
      email,
      name: name || email.split('@')[0],
      role: role || 'student',
      photoUrl: photoUrl || '',
      phone: phone || '',
    });

    await user.save();

    const token = generateToken(user.uid, user.role);

    res.status(201).json({
      message: 'User registered successfully',
      user,
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const jwt = await import('jsonwebtoken');
    const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'default_secret');
    
    const user = await User.findOne({ uid: decoded.uid }).select('-__v');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Update user profile
router.put('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const jwt = await import('jsonwebtoken');
    const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'default_secret');
    
    const user = await User.findOne({ uid: decoded.uid });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, phone, photoUrl, qualifications, experience, bio, subjects } = req.body;

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (photoUrl !== undefined) user.photoUrl = photoUrl;
    if (qualifications !== undefined) user.qualifications = qualifications;
    if (experience !== undefined) user.experience = experience;
    if (bio !== undefined) user.bio = bio;
    if (subjects !== undefined) user.subjects = subjects;

    await user.save();

    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Update failed', error: error.message });
  }
});

export default router;

