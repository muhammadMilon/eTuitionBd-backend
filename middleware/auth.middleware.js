import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';

// Verify Firebase token and get user
export const verifyFirebaseToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // For now, we'll use JWT with uid. In production, verify with Firebase Admin SDK
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    
    const user = await User.findOne({ uid: decoded.uid });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    req.user = user;
    req.userId = user._id;
    req.userRole = user.role;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Verify role
export const verifyRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }

    next();
  };
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
      const user = await User.findOne({ uid: decoded.uid });
      
      if (user && user.isActive) {
        req.user = user;
        req.userId = user._id;
        req.userRole = user.role;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

