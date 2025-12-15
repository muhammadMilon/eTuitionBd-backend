import express from 'express';
import User from '../models/User.model.js';
import Tuition from '../models/Tuition.model.js';
import Application from '../models/Application.model.js';
import Payment from '../models/Payment.model.js';
import { verifyFirebaseToken, verifyRole } from '../middleware/auth.middleware.js';

const router = express.Router();

// All admin routes require admin role
router.use(verifyFirebaseToken);
router.use(verifyRole('admin'));

// Get dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalTutors = await User.countDocuments({ role: 'tutor' });
    const pendingTuitions = await Tuition.countDocuments({ status: 'pending' });
    const activeTuitions = await Tuition.countDocuments({ status: 'approved' });
    
    // Calculate total revenue
    const payments = await Payment.find({ status: 'completed' });
    const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);

    res.json({
      totalUsers,
      totalStudents,
      totalTutors,
      pendingTuitions,
      activeTuitions,
      totalRevenue,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Failed to fetch stats', error: error.message });
  }
});

// User Management

// Get all users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, role = '', search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};

    if (role) {
      filter.role = role;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(filter)
      .select('-__v')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
});

// Get user by ID
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-__v');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to fetch user', error: error.message });
  }
});

// Update user
router.put('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, email, phone, photoUrl, role, isVerified, isActive, qualifications, experience, bio, subjects } = req.body;

    if (name) user.name = name;
    if (email) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (photoUrl !== undefined) user.photoUrl = photoUrl;
    if (role) user.role = role;
    if (isVerified !== undefined) user.isVerified = isVerified;
    if (isActive !== undefined) user.isActive = isActive;
    if (qualifications !== undefined) user.qualifications = qualifications;
    if (experience !== undefined) user.experience = experience;
    if (bio !== undefined) user.bio = bio;
    if (subjects !== undefined && Array.isArray(subjects)) user.subjects = subjects;

    await user.save();

    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Failed to update user', error: error.message });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Don't allow deleting admin accounts
    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot delete admin accounts' });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Failed to delete user', error: error.message });
  }
});

// Tuition Management

// Get all tuitions for admin review
router.get('/tuitions', async (req, res) => {
  try {
    const { page = 1, limit = 20, status = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (status) {
      filter.status = status;
    }

    const tuitions = await Tuition.find(filter)
      .populate('studentId', 'name email photoUrl')
      .populate('approvedTutorId', 'name email photoUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Tuition.countDocuments(filter);

    res.json({
      tuitions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get tuitions error:', error);
    res.status(500).json({ message: 'Failed to fetch tuitions', error: error.message });
  }
});

// Approve tuition
router.post('/tuitions/:id/approve', async (req, res) => {
  try {
    const tuition = await Tuition.findById(req.params.id);

    if (!tuition) {
      return res.status(404).json({ message: 'Tuition not found' });
    }

    tuition.status = 'approved';
    await tuition.save();
    await tuition.populate('studentId', 'name email photoUrl');

    res.json({ message: 'Tuition approved successfully', tuition });
  } catch (error) {
    console.error('Approve tuition error:', error);
    res.status(500).json({ message: 'Failed to approve tuition', error: error.message });
  }
});

// Reject tuition
router.post('/tuitions/:id/reject', async (req, res) => {
  try {
    const tuition = await Tuition.findById(req.params.id);

    if (!tuition) {
      return res.status(404).json({ message: 'Tuition not found' });
    }

    tuition.status = 'rejected';
    await tuition.save();
    await tuition.populate('studentId', 'name email photoUrl');

    res.json({ message: 'Tuition rejected successfully', tuition });
  } catch (error) {
    console.error('Reject tuition error:', error);
    res.status(500).json({ message: 'Failed to reject tuition', error: error.message });
  }
});

// Reports & Analytics

// Get all payments/transactions
router.get('/payments', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const payments = await Payment.find({ status: 'completed' })
      .populate('studentId', 'name email')
      .populate('tutorId', 'name email')
      .populate('tuitionId', 'title subject')
      .sort({ transactionDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Payment.countDocuments({ status: 'completed' });
    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    res.json({
      payments,
      totalRevenue: totalRevenue[0]?.total || 0,
      totalTransactions: total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ message: 'Failed to fetch payments', error: error.message });
  }
});

// Get revenue analytics
router.get('/analytics/revenue', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const matchFilter = { status: 'completed' };
    
    if (startDate || endDate) {
      matchFilter.transactionDate = {};
      if (startDate) matchFilter.transactionDate.$gte = new Date(startDate);
      if (endDate) matchFilter.transactionDate.$lte = new Date(endDate);
    }

    const revenueStats = await Payment.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalTransactions: { $sum: 1 },
          averageTransaction: { $avg: '$amount' },
        },
      },
    ]);

    // Monthly revenue breakdown
    const monthlyRevenue = await Payment.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: {
            year: { $year: '$transactionDate' },
            month: { $month: '$transactionDate' },
          },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 },
    ]);

    res.json({
      overview: revenueStats[0] || {
        totalRevenue: 0,
        totalTransactions: 0,
        averageTransaction: 0,
      },
      monthlyRevenue,
    });
  } catch (error) {
    console.error('Get revenue analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch revenue analytics', error: error.message });
  }
});

export default router;

