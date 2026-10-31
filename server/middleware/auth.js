import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Protect routes: verifies Bearer JWT token from Authorization header
 * and attaches authenticated user document to req.user.
 */
export const protect = async (req, res, next) => {
  let token;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      error: 'Not authorized, no token provided. Please log in.',
    });
  }

  try {
    // Verify token with secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user by ID, excluding password hash
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        error: 'Not authorized, user account no longer exists.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('JWT Verification error:', error.message);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Session expired. Please log in again.',
      });
    }

    return res.status(401).json({
      error: 'Not authorized, invalid token.',
    });
  }
};

