# eTuitionBd Backend Server

Backend API server for the eTuitionBd Tuition Management System.

## Features

- 🔐 Authentication with Firebase and JWT
- 👥 User Management (Student, Tutor, Admin roles)
- 📚 Tuition Post Management (CRUD operations)
- 📝 Tutor Application System
- 💳 Stripe Payment Integration
- 🔍 Search, Filter, and Pagination for Tuitions
- 👨‍💼 Admin Dashboard (User Management, Tuition Approval, Analytics)
- 📊 Reports & Analytics

## Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Token-based authentication
- **Stripe** - Payment processing
- **Firebase Admin** - Firebase integration

## Installation

1. **Clone the repository**

```bash
cd server
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

Create a `.env` file in the `server` directory:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/etuitionbd

# JWT Secret
JWT_SECRET=your_jwt_secret_key_here

# Stripe Keys
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Server Port
PORT=5000

# Node Environment
NODE_ENV=development
```

4. **Start the server**

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register user (after Firebase auth)
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/me` - Update current user profile

### Users

- `GET /api/users/tutors` - Get all tutors (public)
- `GET /api/users/tutors/:id` - Get tutor by ID (public)
- `GET /api/users/profile` - Get authenticated user profile
- `PUT /api/users/profile` - Update authenticated user profile

### Tuitions

- `GET /api/tuitions` - Get all tuitions (with search, filter, pagination)
- `GET /api/tuitions/latest` - Get latest tuitions
- `GET /api/tuitions/:id` - Get tuition by ID
- `POST /api/tuitions` - Create tuition (Student only)
- `PUT /api/tuitions/:id` - Update tuition (Student only, own tuitions)
- `DELETE /api/tuitions/:id` - Delete tuition (Student only, own tuitions)
- `GET /api/tuitions/student/my-tuitions` - Get student's tuitions

### Applications

- `POST /api/applications/apply/:tuitionId` - Apply to tuition (Tutor only)
- `GET /api/applications/tuition/:tuitionId` - Get applications for tuition (Student only)
- `GET /api/applications/tutor/my-applications` - Get tutor's applications
- `PUT /api/applications/:id` - Update application (Tutor only, before approval)
- `DELETE /api/applications/:id` - Delete application (Tutor only, before approval)
- `POST /api/applications/:id/approve` - Approve application (Student only, redirects to payment)
- `POST /api/applications/:id/reject` - Reject application (Student only)
- `GET /api/applications/tutor/ongoing-tuitions` - Get tutor's ongoing tuitions

### Payments

- `POST /api/payments/create-payment-intent` - Create Stripe payment intent (Student only)
- `POST /api/payments/confirm-payment` - Confirm payment (Student only)
- `POST /api/payments/webhook` - Stripe webhook endpoint
- `GET /api/payments/history` - Get payment history (Student only)
- `GET /api/payments/tutor/revenue` - Get tutor revenue history (Tutor only)

### Admin

- `GET /api/admin/stats` - Get dashboard stats
- `GET /api/admin/users` - Get all users
- `GET /api/admin/users/:id` - Get user by ID
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/tuitions` - Get all tuitions for review
- `POST /api/admin/tuitions/:id/approve` - Approve tuition
- `POST /api/admin/tuitions/:id/reject` - Reject tuition
- `GET /api/admin/payments` - Get all payments/transactions
- `GET /api/admin/analytics/revenue` - Get revenue analytics

## Authentication

All protected routes require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## Database Models

### User
- Basic user information
- Role-based access (student, tutor, admin)
- Tutor-specific fields (qualifications, experience, subjects)

### Tuition
- Tuition post details
- Status: pending, approved, rejected, closed
- Linked to student and approved tutor

### Application
- Tutor applications to tuitions
- Status: pending, approved, rejected, closed
- Links to payment on approval

### Payment
- Payment records
- Stripe integration
- Status: pending, completed, failed, refunded

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| MONGODB_URI | MongoDB connection string | Yes |
| JWT_SECRET | Secret key for JWT tokens | Yes |
| STRIPE_SECRET_KEY | Stripe secret key | Yes |
| STRIPE_WEBHOOK_SECRET | Stripe webhook secret | Optional |
| PORT | Server port | No (default: 5000) |
| NODE_ENV | Environment (development/production) | No |

## License

ISC

