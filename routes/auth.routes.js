import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import express from 'express';
import User from '../models/User.model.js';
import { generateToken, verifyToken } from '../utils/jwt.util.js';

const router = express.Router();

// Register/Create user profile (after Firebase auth or fallback)
router.post('/register', async (req, res) => {
  try {
    const { uid, email, name, role, photoUrl, phone, password, address } = req.body;
    console.log('Registering user with photoUrl:', photoUrl);

    // uid is optional for fallback registration; generate one if missing
    const finalUid = uid || randomUUID();
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ uid: finalUid }, { email }] });

    if (existingUser) {
      // Update existing user
      existingUser.name = name || existingUser.name;
      existingUser.photoUrl = photoUrl || existingUser.photoUrl;
      existingUser.phone = phone || existingUser.phone;
      existingUser.address = address || existingUser.address;
      if (role && !existingUser.role) {
        existingUser.role = role;
      }
      // If password provided and user has no password (e.g. was Firebase only), set it
      if (password && !existingUser.password) {
        const salt = await bcrypt.genSalt(10);
        existingUser.password = await bcrypt.hash(password, salt);
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
    let hashedPassword = '';
    if (password) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(password, salt);
    }

    const user = new User({
      uid: finalUid,
      email,
      name: name || email.split('@')[0],
      role: role || 'student',
      photoUrl: photoUrl || '',
      phone: phone || '',
      address: address || '',
      password: hashedPassword,
    });

    await user.save();

    const token = generateToken(user.uid, user.role);

    // Don't return password
    user.password = undefined;

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

// Login (Fallback for email/password)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user by email, explicitly selecting password
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has a password (might be Firebase-only user)
    if (!user.password) {
      return res.status(400).json({ message: 'Please login with Google or reset your password' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user.uid, user.role);
    
    // Remove password from response
    user.password = undefined;

    res.json({
      message: 'Login successful',
      user,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = verifyToken(token);
    
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

    const decoded = verifyToken(token);
    
    const user = await User.findOne({ uid: decoded.uid });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, phone, photoUrl, qualifications, experience, bio, subjects, address } = req.body;

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
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

