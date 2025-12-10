# eTuitionBd Server

The backend server for the eTuitionBd Tuition Management System, a platform connecting students with qualified tutors.

## Purpose

The eTuitionBd server handles data management, user authentication, and transaction processing for the eTuitionBd platform. It ensures secure communication between the client database, facilitates tuition posting and applications, and manages payments.

## Live URL

[Insert Live URL Here]

## Features

-   **Authentication**:
    -   Secure user registration and login.
    -   JWT (JSON Web Token) generation and verification.
    -   Role-based access control (Student, Tutor, Admin).
-   **Tuition Management**:
    -   Create, read, update, and delete (CRUD) tuition posts.
    -   Filter and sort tuition listings.
-   **Application System**:
    -   Tutors can apply to tuition posts.
    -   Students can approve or reject applications.
-   **Payments**:
    -   Stripe integration for secure payment processing (Tuition fees/Salaries).
    -   Payment history tracking.
-   **Admin Dashboard**:
    -   User management (promote/demote/ban).
    -   Tuition post moderation (approve/reject).
    -   Platform statistics.

## Packages Used

-   **express**: Fast, unopinionated, minimalist web framework for Node.js.
-   **cors**: Middleware to enable Cross-Origin Resource Sharing.
-   **dotenv**: Module to load environment variables from a `.env` file.
-   **jsonwebtoken**: Implementation of JSON Web Tokens for authentication.
-   **mongoose**: Elegant MongoDB object modeling for Node.js.
-   **stripe**: Library for interacting with the Stripe API.

## Environment Variables

Ensure the following environment variables are set in your `.env` file:

```env
PORT=5000
DB_USER=your_db_user
DB_PASS=your_db_pass
ACCESS_TOKEN_SECRET=your_jwt_secret
STRIPE_SECRET_KEY=your_stripe_secret_key
# FIREBASE_ADMIN_KEY=... (if used)
```

## Installation & Running

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the server:
    ```bash
    npm start
    ```
    or for development:
    ```bash
    nodemon index.js
    ```
