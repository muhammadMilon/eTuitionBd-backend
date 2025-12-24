import express from 'express';
import Stripe from 'stripe';
import Application from '../models/Application.model.js';
import Payment from '../models/Payment.model.js';
import Tuition from '../models/Tuition.model.js';

const router = express.Router();

// Initialize Stripe lazily
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

// Stripe webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripeInstance = getStripe();
  if (!stripeInstance) {
    console.error('❌ Stripe is not configured');
    return res.status(500).json({ error: 'Stripe is not configured' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (!webhookSecret) {
      console.warn('⚠️  STRIPE_WEBHOOK_SECRET not found. Webhook signature verification skipped.');
      // In development, you might want to parse the event without verification
      event = JSON.parse(req.body.toString());
    } else {
      event = stripeInstance.webhooks.constructEvent(req.body, sig, webhookSecret);
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;

    try {
      const applicationId = paymentIntent.metadata.applicationId;

      if (applicationId) {
        const application = await Application.findById(applicationId);

        if (application && application.status === 'pending') {
          // Create payment record
          const payment = new Payment({
            studentId: paymentIntent.metadata.studentId,
            tutorId: paymentIntent.metadata.tutorId,
            tuitionId: paymentIntent.metadata.tuitionId,
            applicationId: applicationId,
            amount: application.expectedSalary,
            currency: 'BDT',
            stripePaymentIntentId: paymentIntent.id,
            stripeChargeId: paymentIntent.latest_charge || '',
            status: 'completed',
            paymentMethod: 'stripe',
            transactionDate: new Date(),
          });

          await payment.save();

          // Approve application
          application.status = 'approved';
          application.approvedAt = new Date();
          application.paymentId = payment._id;
          await application.save();

          // Update tuition
          const tuition = await Tuition.findById(application.tuitionId);
          if (tuition) {
            tuition.status = 'closed';
            tuition.approvedTutorId = application.tutorId;
            await tuition.save();

            // Reject other pending applications
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
          }
        }
      }
    } catch (error) {
      console.error('Webhook processing error:', error);
    }
  }

  res.json({ received: true });
});

export default router;

