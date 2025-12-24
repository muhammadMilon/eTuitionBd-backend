import express from 'express';
import Stripe from 'stripe';
import { verifyFirebaseToken, verifyRole } from '../middleware/auth.middleware.js';
import Application from '../models/Application.model.js';
import Payment from '../models/Payment.model.js';
import { createNotification } from '../utils/notification.util.js';

const router = express.Router();

// Initialize Stripe lazily to ensure env vars are loaded
let stripe;

const getStripe = () => {
  if (!stripe) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      console.warn('⚠️  STRIPE_SECRET_KEY not found in environment variables');
    }
    stripe = new Stripe(stripeKey || 'sk_test_placeholder');
  }
  return stripe;
};

// Create payment intent (student only)
router.post('/create-payment-intent', verifyFirebaseToken, verifyRole('student'), async (req, res) => {
  const stripeInstance = getStripe();
  
  if (!stripeInstance) {
    return res.status(500).json({ message: 'Stripe is not configured. Please check STRIPE_SECRET_KEY in environment variables.' });
  }

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

    // Stripe doesn't support BDT, so we'll use USD
    // Convert BDT to USD (approximate rate: 1 USD = 110 BDT)
    // You can update this rate or fetch it from an API
    const USD_TO_BDT_RATE = 110;
    const amountInUSD = application.expectedSalary / USD_TO_BDT_RATE;
    const amount = Math.round(amountInUSD * 100); // Convert to cents

    // Create payment intent with Stripe
    const paymentIntent = await stripeInstance.paymentIntents.create({
      amount: amount,
      currency: 'usd', // Stripe doesn't support BDT, using USD
      payment_method_types: ['card'],
      metadata: {
        applicationId: applicationId.toString(),
        tuitionId: tuition._id.toString(),
        tutorId: application.tutorId._id.toString(),
        studentId: req.userId.toString(),
        amountInBDT: application.expectedSalary.toString(), // Store original BDT amount
      },
      description: `Payment for ${tuition.title} - Tutor: ${application.tutorId.name}`,
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: application.expectedSalary, // BDT amount for display
      amountInUSD: amountInUSD, // USD amount for reference
      currency: 'BDT', // Display currency
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ message: 'Failed to create payment intent', error: error.message });
  }
});

// Confirm payment (webhook or manual confirmation)
router.post('/confirm-payment', verifyFirebaseToken, verifyRole('student'), async (req, res) => {
  const stripeInstance = getStripe();

  if (!stripeInstance) {
    return res.status(500).json({ message: 'Stripe is not configured. Please check STRIPE_SECRET_KEY in environment variables.' });
  }

  try {
    const { paymentIntentId, applicationId } = req.body;

    if (!paymentIntentId || !applicationId) {
      return res.status(400).json({ message: 'Payment Intent ID and Application ID are required' });
    }

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripeInstance.paymentIntents.retrieve(paymentIntentId);

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
      // Get the original BDT amount from metadata (if available) or use application amount
      const amountInBDT = paymentIntent.metadata?.amountInBDT 
        ? parseFloat(paymentIntent.metadata.amountInBDT) 
        : application.expectedSalary;

      // Create payment record (store in BDT)
      payment = new Payment({
        studentId: paymentIntent.metadata.studentId,
        tutorId: paymentIntent.metadata.tutorId,
        tuitionId: paymentIntent.metadata.tuitionId,
        applicationId: applicationId,
        amount: amountInBDT, // Store in BDT
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
    tuition.status = 'closed';
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

    // Notify both parties
    await createNotification({
      recipient: payment.studentId,
      type: 'payment',
      title: 'Payment Successful',
      message: `Your payment of ৳${payment.amount} for ${tuition.subject} tuition was successful.`,
      relatedId: payment._id
    });

    await createNotification({
      recipient: payment.tutorId,
      type: 'payment',
      title: 'New Tuition Hiring',
      message: `Congratulations! A student has paid for your services for the ${tuition.subject} tuition.`,
      relatedId: payment._id
    });

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

// Get all payments (admin)
router.get('/admin/all', verifyFirebaseToken, verifyRole('admin'), async (req, res) => {
  try {
    const payments = await Payment.find({})
      .populate('studentId', 'name email photoUrl')
      .populate('tutorId', 'name email photoUrl')
      .populate('tuitionId', 'title subject class')
      .populate('applicationId')
      .sort({ transactionDate: -1 });

    res.json({ payments });
  } catch (error) {
    console.error('Get all payments error:', error);
    res.status(500).json({ message: 'Failed to fetch all payments', error: error.message });
  }
});

export default router;

