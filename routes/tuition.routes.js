import express from 'express';
import { optionalAuth, verifyFirebaseToken, verifyRole } from '../middleware/auth.middleware.js';
import Tuition from '../models/Tuition.model.js';

const router = express.Router();

// Get all tuitions with search, filter, and pagination (public)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      search = '',
      subject = '',
      class: classFilter = '',
      location = '',
      minBudget = '',
      maxBudget = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status = 'approved', // Only show approved tuitions publicly
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filter
    const filter = {};

    // Status filter - students can see their own tuitions regardless of status
    if (req.userRole === 'student') {
      // Students can see all approved tuitions plus their own
      filter.$or = [
        { status: 'approved' },
        { studentId: req.userId },
      ];
    } else if (req.userRole === 'admin') {
      // Admins can see all tuitions
      if (status) filter.status = status;
    } else {
      // Public users and tutors see only approved
      filter.status = 'approved';
    }

    // Search filter
    if (search) {
      filter.$or = [
        ...(filter.$or || []),
        { title: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Subject filter
    if (subject) {
      filter.subject = { $regex: subject, $options: 'i' };
    }

    // Class filter
    if (classFilter) {
      filter.class = { $regex: classFilter, $options: 'i' };
    }

    // Location filter
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    // Budget filter
    if (minBudget || maxBudget) {
      filter.budgetMin = {};
      if (minBudget) filter.budgetMin.$gte = parseInt(minBudget);
      if (maxBudget) filter.budgetMin.$lte = parseInt(maxBudget);
    }

    // Build sort
    const sort = {};
    if (sortBy === 'budget') {
      sort.budgetMin = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'date') {
      sort.createdAt = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    }

    const tuitions = await Tuition.find(filter)
      .populate('studentId', 'name email photoUrl phone')
      .sort(sort)
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

// Get latest tuitions for home page
router.get('/latest', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;

    const tuitions = await Tuition.find({ status: 'approved' })
      .populate('studentId', 'name email photoUrl')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({ tuitions });
  } catch (error) {
    console.error('Get latest tuitions error:', error);
    res.status(500).json({ message: 'Failed to fetch latest tuitions', error: error.message });
  }
});

// Get tuition by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const tuition = await Tuition.findById(req.params.id)
      .populate('studentId', 'name email photoUrl phone')
      .populate('approvedTutorId', 'name email photoUrl');

    if (!tuition) {
      return res.status(404).json({ message: 'Tuition not found' });
    }

    // Check if user can view this tuition
    const isOwner = req.userId && tuition.studentId._id.toString() === req.userId.toString();
    const isHiredTutor = req.userId && tuition.approvedTutorId && tuition.approvedTutorId._id.toString() === req.userId.toString();
    const isAdmin = req.userRole === 'admin';

    if (
      tuition.status !== 'approved' &&
      !isAdmin &&
      !isOwner &&
      !isHiredTutor
    ) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ tuition });
  } catch (error) {
    console.error('Get tuition error:', error);
    res.status(500).json({ message: 'Failed to fetch tuition', error: error.message });
  }
});

// Create tuition (student only)
router.post('/', verifyFirebaseToken, verifyRole('student'), async (req, res) => {
  try {
    const {
      title,
      subject,
      class: classLevel,
      location,
      budget,
      schedule,
      description,
      requirements,
    } = req.body;

    if (!title || !subject || !classLevel || !location || !budget || !schedule || !description) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    // Parse budget range
    const budgetParts = budget.toString().split('-');
    let budgetMin = parseInt(budgetParts[0].replace(/\D/g, ''));
    let budgetMax = budgetMin;

    if (budgetParts.length > 1) {
      budgetMax = parseInt(budgetParts[1].replace(/\D/g, ''));
    }

    const tuition = new Tuition({
      title,
      subject,
      class: classLevel,
      location,
      budget,
      budgetMin,
      budgetMax,
      schedule,
      description,
      requirements: requirements || [],
      studentId: req.userId,
      status: 'pending', // Requires admin approval
    });

    await tuition.save();
    await tuition.populate('studentId', 'name email photoUrl phone');

    res.status(201).json({
      message: 'Tuition post created successfully. Waiting for admin approval.',
      tuition,
    });
  } catch (error) {
    console.error('Create tuition error:', error);
    res.status(500).json({ message: 'Failed to create tuition', error: error.message });
  }
});

// Update tuition (student only, own tuitions)
router.put('/:id', verifyFirebaseToken, verifyRole('student'), async (req, res) => {
  try {
    const tuition = await Tuition.findById(req.params.id);

    if (!tuition) {
      return res.status(404).json({ message: 'Tuition not found' });
    }

    if (tuition.studentId.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'You can only edit your own tuitions' });
    }

    const {
      title,
      subject,
      class: classLevel,
      location,
      budget,
      schedule,
      description,
      requirements,
    } = req.body;

    if (title) tuition.title = title;
    if (subject) tuition.subject = subject;
    if (classLevel) tuition.class = classLevel;
    if (location) tuition.location = location;
    if (budget) {
      tuition.budget = budget;
      const budgetParts = budget.toString().split('-');
      let budgetMin = parseInt(budgetParts[0].replace(/\D/g, ''));
      let budgetMax = budgetMin;
      if (budgetParts.length > 1) {
        budgetMax = parseInt(budgetParts[1].replace(/\D/g, ''));
      }
      tuition.budgetMin = budgetMin;
      tuition.budgetMax = budgetMax;
    }
    if (schedule) tuition.schedule = schedule;
    if (description) tuition.description = description;
    if (requirements && Array.isArray(requirements)) tuition.requirements = requirements;

    // Reset status to pending if admin approved/rejected
    if (tuition.status === 'approved' || tuition.status === 'rejected') {
      tuition.status = 'pending';
    }

    await tuition.save();
    await tuition.populate('studentId', 'name email photoUrl phone');

    res.json({ message: 'Tuition updated successfully', tuition });
  } catch (error) {
    console.error('Update tuition error:', error);
    res.status(500).json({ message: 'Failed to update tuition', error: error.message });
  }
});

// Delete tuition (student only, own tuitions)
router.delete('/:id', verifyFirebaseToken, verifyRole('student'), async (req, res) => {
  try {
    const tuition = await Tuition.findById(req.params.id);

    if (!tuition) {
      return res.status(404).json({ message: 'Tuition not found' });
    }

    if (tuition.studentId.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'You can only delete your own tuitions' });
    }

    await Tuition.findByIdAndDelete(req.params.id);

    res.json({ message: 'Tuition deleted successfully' });
  } catch (error) {
    console.error('Delete tuition error:', error);
    res.status(500).json({ message: 'Failed to delete tuition', error: error.message });
  }
});

// Get student's tuitions
router.get('/student/my-tuitions', verifyFirebaseToken, verifyRole('student'), async (req, res) => {
  try {
    const tuitions = await Tuition.find({ studentId: req.userId })
      .populate('approvedTutorId', 'name email photoUrl')
      .sort({ createdAt: -1 });

    res.json({ tuitions });
  } catch (error) {
    console.error('Get my tuitions error:', error);
    res.status(500).json({ message: 'Failed to fetch tuitions', error: error.message });
  }
});

export default router;

