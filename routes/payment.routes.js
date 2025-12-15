import express from 'express';
import Stripe from 'stripe';
import Payment from '../models/Payment.model.js';
import Application from '../models/Application.model.js';
import Tuition from '../models/Tuition.model.js';
import { verifyFirebaseToken, verifyRole } from '../middleware/auth.middleware.js';

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_key');

// Create payment intent (student only)
router.post('/create-payment-intent', verifyFirebaseToken, verifyRole('student'), async (req, res) => {
  try {
    const { applicationId } = req.body;

    if (!applicationId) {
      return res.status(400).json({ message: 'Application ID is required' });
    }

    const application = await Application.findById(applicationId)
      .populate('tuitionId')
      .populate('tutorId');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    const tuition = application.tuitionId;

    if (!tuition) {
      return res.status(404).json({ message: 'Tuition not found' });
    }

    if (tuition.studentId.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: 'You can only pay for your own tuitions' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ message: 'Application is not pending' });
    }

    const amount = application.expectedSalary * 100; // Convert to cents/paisa (BDT)

    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'bdt',
      metadata: {
        applicationId: applicationId.toString(),
        tuitionId: tuition._id.toString(),
        tutorId: application.tutorId._id.toString(),
        studentId: req.userId.toString(),
      },
      description: `Payment for ${tuition.title} - Tutor: ${application.tutorId.name}`,
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: application.expectedSalary,
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ message: 'Failed to create payment intent', error: error.message });
  }
});

// Confirm payment (webhook or manual confirmation)
router.post('/confirm-payment', verifyFirebaseToken, verifyRole('student'), async (req, res) => {
  try {
    const { paymentIntentId, applicationId } = req.body;

    if (!paymentIntentId || !applicationId) {
      return res.status(400).json({ message: 'Payment Intent ID and Application ID are required' });
    }

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ message: 'Payment not completed' });
    }

    const application = await Application.findById(applicationId)
      .populate('tuitionId')
      .populate('tutorId');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ message: 'Application is not pending' });
    }

    // Check if payment already exists
    let payment = await Payment.findOne({ stripePaymentIntentId: paymentIntentId });

    if (!payment) {
      // Create payment record
      payment = new Payment({
        studentId: paymentIntent.metadata.studentId,
        tutorId: paymentIntent.metadata.tutorId,
        tuitionId: paymentIntent.metadata.tuitionId,
        applicationId: applicationId,
        amount: application.expectedSalary,
        currency: 'BDT',
        stripePaymentIntentId: paymentIntentId,
        stripeChargeId: paymentIntent.latest_charge || '',
        status: 'completed',
        paymentMethod: 'stripe',
        transactionDate: new Date(),
      });

      await payment.save();
    }

    // Approve application
    application.status = 'approved';
    application.approvedAt = new Date();
    application.paymentId = payment._id;
    await application.save();

    // Update tuition
    const tuition = application.tuitionId;
    tuition.status = 'active';
    tuition.approvedTutorId = application.tutorId._id;
    await tuition.save();

    // Reject other pending applications for this tuition
    await Application.updateMany(
      {
        tuitionId: tuition._id,
        _id: { $ne: applicationId },
        status: 'pending',
      },
      {
        status: 'closed',
      }
    );

    res.json({
      message: 'Payment confirmed and application approved',
      payment,
      application,
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ message: 'Failed to confirm payment', error: error.message });
  }
});

// Note: Webhook handler is in payment.webhook.js to handle raw body separately

// Get payment history (student)
router.get('/history', verifyFirebaseToken, verifyRole('student'), async (req, res) => {
  try {
    const payments = await Payment.find({ studentId: req.userId })
      .populate('tutorId', 'name email photoUrl')
      .populate('tuitionId', 'title subject class')
      .populate('applicationId')
      .sort({ transactionDate: -1 });

    res.json({ payments });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ message: 'Failed to fetch payment history', error: error.message });
  }
});

// Get tutor revenue history
router.get('/tutor/revenue', verifyFirebaseToken, verifyRole('tutor'), async (req, res) => {
  try {
    const payments = await Payment.find({
      tutorId: req.userId,
      status: 'completed',
    })
      .populate('studentId', 'name email photoUrl')
      .populate('tuitionId', 'title subject class')
      .populate('applicationId')
      .sort({ transactionDate: -1 });

    const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);

    res.json({
      payments,
      totalRevenue,
      totalPayments: payments.length,
    });
  } catch (error) {
    console.error('Get revenue history error:', error);
    res.status(500).json({ message: 'Failed to fetch revenue history', error: error.message });
  }
});

export default router;

