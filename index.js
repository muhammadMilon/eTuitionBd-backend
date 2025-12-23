import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';

// Import routes
import adminRoutes from './routes/admin.routes.js';
import applicationRoutes from './routes/application.routes.js';
import authRoutes from './routes/auth.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import paymentWebhook from './routes/payment.webhook.js';
import tuitionRoutes from './routes/tuition.routes.js';
import userRoutes from './routes/user.routes.js';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());

// Stripe webhook needs raw body for signature verification - mount before JSON parser
app.use('/api/payments', paymentWebhook);

// Regular JSON middleware for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/etuitionbd';

console.log('🔄 Attempting to connect to MongoDB...');
console.log('📍 Connection URI:', MONGODB_URI.replace(/\/\/.*@/, '//***:***@')); // Hide credentials if any

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully!');
    console.log('📊 Database:', mongoose.connection.db.databaseName);
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('💡 Troubleshooting tips:');
    console.error('   1. Make sure MongoDB service is running');
    console.error('   2. Check MONGODB_URI in .env file');
    console.error('   3. For local MongoDB: mongodb://localhost:27017/etuitionbd');
    console.error('   4. For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/etuitionbd');
    process.exit(1); // Exit if DB connection fails
  });

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'eTuitionBd API Server is running!' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tuitions', tuitionRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});

