import jwt from 'jsonwebtoken';

export const generateToken = (uid, role) => {
  const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';
  const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
  
  return jwt.sign(
    { uid, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

export const verifyToken = (token) => {
  const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';
  
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

