import express from 'express';
import { verifyFirebaseToken, verifyRole } from '../middleware/auth.middleware.js';
import Application from '../models/Application.model.js';
import Tuition from '../models/Tuition.model.js';
import { createNotification } from '../utils/notification.util.js';

const router = express.Router();

// Apply to tuition (tutor only)
router.post('/apply/:tuitionId', verifyFirebaseToken, verifyRole('tutor'), async (req, res) => {
  try {
    const { tuitionId } = req.params;
    const { qualifications, experience, expectedSalary, availability, message } = req.body;

    if (!qualifications || !experience || !expectedSalary || !availability) {
      return res.status(400).json({
        message: 'Qualifications, experience, expected salary, and availability are required',
      });
    }

    // Check if tuition exists and is approved
    const tuition = await Tuition.findById(tuitionId);

    if (!tuition) {
      return res.status(404).json({ message: 'Tuition not found' });
    }

    if (tuition.status !== 'approved') {
      return res.status(400).json({ message: 'Cannot apply to a tuition that is not approved' });
    }

    // Check if already applied
    const existingApplication = await Application.findOne({
      tuitionId,
      tutorId: req.userId,
    });

    if (existingApplication) {
      return res.status(400).json({ message: 'You have already applied to this tuition' });
    }

    // Create application
    const application = new Application({
      tuitionId,
      tutorId: req.userId,
      qualifications,
      experience,
      expectedSalary: parseFloat(expectedSalary),
      availability,
      message: message || '',
      status: 'pending',
    });

    await application.save();

    // Update tuition applications count
    tuition.applicationsCount = (tuition.applicationsCount || 0) + 1;
    await tuition.save();

    await application.populate('tutorId', 'name email photoUrl qualifications experience');
    await application.populate('tuitionId', 'title subject class location');

    // Notify student about new application
    await createNotification({
      recipient: tuition.studentId,
      sender: req.userId,
      type: 'application',
      title: 'New Application Received',
      message: `${application.tutorId.name} has applied for your ${tuition.subject} tuition.`,
      relatedId: application._id
    });

    res.status(201).json({
      message: 'Application submitted successfully',
      application,
    });
  } catch (error) {
    console.error('Apply error:', error);
    res.status(500).json({ message: 'Failed to submit application', error: error.message });
  }
});

// Get applications for a tuition (student only, own tuitions)
router.get('/tuition/:tuitionId', verifyFirebaseToken, verifyRole('student'), async (req, res) => {
  try {
    const { tuitionId } = req.params;

    // Verify tuition belongs to student
    const tuition = await Tuition.findById(tuitionId);

    if (!tuition) {
      return res.status(404).json({ message: 'Tuition not found' });
    }

    if (tuition.studentId.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'You can only view applications for your own tuitions' });
    }

    const applications = await Application.find({ tuitionId })
      .populate('tutorId', 'name email photoUrl qualifications experience bio')
      .sort({ createdAt: -1 });

    res.json({ applications });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ message: 'Failed to fetch applications', error: error.message });
  }
});

// Get tutor's applications (tutor only)
router.get('/tutor/my-applications', verifyFirebaseToken, verifyRole('tutor'), async (req, res) => {
  try {
    const applications = await Application.find({ tutorId: req.userId })
      .populate('tuitionId', 'title subject class location budget schedule status studentId')
      .populate('tuitionId.studentId', 'name email photoUrl')
      .sort({ createdAt: -1 });

    res.json({ applications });
  } catch (error) {
    console.error('Get my applications error:', error);
    res.status(500).json({ message: 'Failed to fetch applications', error: error.message });
  }
});

// Update application (tutor only, before approval)
router.put('/:id', verifyFirebaseToken, verifyRole('tutor'), async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.tutorId.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'You can only update your own applications' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ message: 'Cannot update application that is not pending' });
    }

    const { qualifications, experience, expectedSalary, availability, message } = req.body;

    if (qualifications) application.qualifications = qualifications;
    if (experience) application.experience = experience;
    if (expectedSalary) application.expectedSalary = parseFloat(expectedSalary);
    if (availability) application.availability = availability;
    if (message !== undefined) application.message = message;

    await application.save();

    await application.populate('tutorId', 'name email photoUrl');
    await application.populate('tuitionId', 'title subject class location');

    res.json({ message: 'Application updated successfully', application });
  } catch (error) {
    console.error('Update application error:', error);
    res.status(500).json({ message: 'Failed to update application', error: error.message });
  }
});

// Delete application (tutor only, before approval)
router.delete('/:id', verifyFirebaseToken, verifyRole('tutor'), async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.tutorId.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'You can only delete your own applications' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ message: 'Cannot delete application that is not pending' });
    }

    // Update tuition applications count
    const tuition = await Tuition.findById(application.tuitionId);
    if (tuition && tuition.applicationsCount > 0) {
      tuition.applicationsCount -= 1;
      await tuition.save();
    }

    await Application.findByIdAndDelete(req.params.id);

    res.json({ message: 'Application deleted successfully' });
  } catch (error) {
    console.error('Delete application error:', error);
    res.status(500).json({ message: 'Failed to delete application', error: error.message });
  }
});

// Approve application (student only, redirects to payment)
// The actual approval happens after successful payment
router.post('/:id/approve', verifyFirebaseToken, verifyRole('student'), async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('tuitionId');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const tuition = application.tuitionId;

    if (!tuition) {
      return res.status(404).json({ message: 'Tuition not found' });
    }

    if (tuition.studentId.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'You can only approve applications for your own tuitions' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ message: 'Application is not pending' });
    }

    // Return application details for payment
    res.json({
      message: 'Application ready for payment',
      application: {
        ...application.toObject(),
        amount: application.expectedSalary,
      },
    });
  } catch (error) {
    console.error('Approve application error:', error);
    res.status(500).json({ message: 'Failed to approve application', error: error.message });
  }
});

// Reject application (student only)
router.post('/:id/reject', verifyFirebaseToken, verifyRole('student'), async (req, res) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('tuitionId');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const tuition = application.tuitionId;

    if (!tuition) {
      return res.status(404).json({ message: 'Tuition not found' });
    }

    if (tuition.studentId.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'You can only reject applications for your own tuitions' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ message: 'Application is not pending' });
    }

    application.status = 'rejected';
    await application.save();

    // Notify tutor about rejection
    await createNotification({
      recipient: application.tutorId,
      sender: req.userId,
      type: 'application',
      title: 'Application Update',
      message: `Your application for the ${tuition.subject} tuition has been declined.`,
      relatedId: application._id
    });

    res.json({ message: 'Application rejected', application });
  } catch (error) {
    console.error('Reject application error:', error);
    res.status(500).json({ message: 'Failed to reject application', error: error.message });
  }
});

// Get tutor's ongoing tuitions (approved applications)
router.get('/tutor/ongoing-tuitions', verifyFirebaseToken, verifyRole('tutor'), async (req, res) => {
  try {
    const applications = await Application.find({
      tutorId: req.userId,
      status: 'approved',
    })
      .populate('tuitionId', 'title subject class location budget schedule studentId')
      .populate('tuitionId.studentId', 'name email photoUrl phone')
      .sort({ approvedAt: -1 });

    res.json({ tuitions: applications });
  } catch (error) {
    console.error('Get ongoing tuitions error:', error);
    res.status(500).json({ message: 'Failed to fetch ongoing tuitions', error: error.message });
  }
});

export default router;

