import express from 'express';
import Stripe from 'stripe';
import Payment from '../models/Payment.model.js';
import Application from '../models/Application.model.js';
import Tuition from '../models/Tuition.model.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_key');

// Stripe webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
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
            tuition.status = 'active';
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

