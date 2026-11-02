import express from 'express';
import { protect } from '../middleware/auth.js';
import { getUserUsageSummary } from '../middleware/quota.js';

const router = express.Router();

// Require JWT authentication for usage endpoint
router.use(protect);

/**
 * GET /api/usage
 * Returns today's quota consumption, limits, and remaining balance for the logged-in user.
 * Shape: { date, resetsAt, limits: {...}, used: {...}, remaining: {...} }
 */
router.get('/', async (req, res, next) => {
  try {
    const summary = await getUserUsageSummary(req.user._id);
    return res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
});

export default router;

