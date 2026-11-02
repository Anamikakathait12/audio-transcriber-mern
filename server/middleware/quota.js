import Usage from '../models/Usage.js';
import GlobalUsage from '../models/GlobalUsage.js';

/**
 * Read configured limits from process.env with safe integer fallbacks
 */
export const getLimits = () => ({
  transcriptions: parseInt(process.env.USER_DAILY_TRANSCRIPTIONS, 10) || 20,
  diarizations: parseInt(process.env.USER_DAILY_DIARIZATIONS, 10) || 5,
  translations: parseInt(process.env.USER_DAILY_TRANSLATIONS, 10) || 30,
  globalDiarizations: parseInt(process.env.GLOBAL_DAILY_DIARIZATIONS, 10) || 50,
});

/**
 * Returns current UTC date string in YYYY-MM-DD format
 */
export const getTodayUtc = () => new Date().toISOString().slice(0, 10);

/**
 * Returns ISO timestamp for next 00:00 UTC reset
 */
export const getResetsAtUtc = () => {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
};

/**
 * Human-readable quota label formatting
 */
const getQuotaLabel = (type) => {
  switch (type) {
    case 'transcriptions':
      return 'transcriptions';
    case 'diarizations':
      return 'speaker detections';
    case 'translations':
      return 'translations';
    default:
      return type;
  }
};

/**
 * Atomically reserve one quota unit for a given user and quota type.
 * Prevents race conditions using MongoDB atomic conditional update ($lt: limit).
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {'transcriptions'|'diarizations'|'translations'} type
 * @returns {Promise<{ success: boolean, limit: number, used: number, remaining: number, resetsAt: string }>}
 */
export const reserveQuota = async (userId, type) => {
  const date = getTodayUtc();
  const limits = getLimits();
  const limit = limits[type];

  if (limit === undefined) {
    throw new Error(`Invalid quota type: ${type}`);
  }

  // 1. Ensure record exists for (user, date)
  await Usage.updateOne(
    { user: userId, date },
    {
      $setOnInsert: {
        transcriptions: 0,
        diarizations: 0,
        translations: 0,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    },
    { upsert: true }
  );

  // 2. Atomically increment ONLY if current counter is less than limit
  const updated = await Usage.findOneAndUpdate(
    { user: userId, date, [type]: { $lt: limit } },
    { $inc: { [type]: 1 } },
    { new: true }
  );

  if (!updated) {
    const current = await Usage.findOne({ user: userId, date });
    const used = current ? current[type] : limit;
    return {
      success: false,
      limit,
      used,
      remaining: 0,
      resetsAt: getResetsAtUtc(),
    };
  }

  return {
    success: true,
    limit,
    used: updated[type],
    remaining: Math.max(0, limit - updated[type]),
    resetsAt: getResetsAtUtc(),
  };
};

/**
 * Atomically reserve global diarization quota across all users.
 */
export const reserveGlobalQuota = async (type = 'diarizations') => {
  const date = getTodayUtc();
  const limits = getLimits();
  const limit = limits.globalDiarizations;

  // 1. Ensure global usage doc exists for today
  await GlobalUsage.updateOne(
    { date },
    {
      $setOnInsert: {
        diarizations: 0,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    },
    { upsert: true }
  );

  // 2. Atomically increment if below global cap
  const updated = await GlobalUsage.findOneAndUpdate(
    { date, [type]: { $lt: limit } },
    { $inc: { [type]: 1 } },
    { new: true }
  );

  if (!updated) {
    const current = await GlobalUsage.findOne({ date });
    const used = current ? current[type] : limit;
    return {
      success: false,
      limit,
      used,
      remaining: 0,
      resetsAt: getResetsAtUtc(),
    };
  }

  return {
    success: true,
    limit,
    used: updated[type],
    remaining: Math.max(0, limit - updated[type]),
    resetsAt: getResetsAtUtc(),
  };
};

/**
 * Refund a reserved quota unit when an operation fails downstream.
 */
export const refundQuota = async (userId, type, date = getTodayUtc()) => {
  try {
    await Usage.updateOne(
      { user: userId, date, [type]: { $gt: 0 } },
      { $inc: { [type]: -1 } }
    );
  } catch (err) {
    console.error(`Failed to refund ${type} quota for user ${userId}:`, err.message);
  }
};

/**
 * Refund a reserved global quota unit when diarization fails downstream.
 */
export const refundGlobalQuota = async (type = 'diarizations', date = getTodayUtc()) => {
  try {
    await GlobalUsage.updateOne(
      { date, [type]: { $gt: 0 } },
      { $inc: { [type]: -1 } }
    );
  } catch (err) {
    console.error(`Failed to refund global ${type} quota:`, err.message);
  }
};

/**
 * Express middleware to enforce atomic quota reservation before costly routes.
 * Returns 429 with clear JSON details if the limit is reached.
 */
export const quota = (type) => {
  return async (req, res, next) => {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const result = await reserveQuota(req.user._id, type);

      if (!result.success) {
        const label = getQuotaLabel(type);
        return res.status(429).json({
          error: `Daily limit reached (${result.limit} ${label}). Resets at 00:00 UTC.`,
          limit: result.limit,
          used: result.used,
          remaining: result.remaining,
          resetsAt: result.resetsAt,
        });
      }

      if (!req.quotaReserved) req.quotaReserved = [];
      req.quotaReserved.push(type);
      next();
    } catch (err) {
      console.error(`Quota reservation error for ${type}:`, err);
      next(err);
    }
  };
};

/**
 * Get comprehensive usage summary for logged-in user.
 */
export const getUserUsageSummary = async (userId) => {
  const date = getTodayUtc();
  const limits = getLimits();
  const doc = await Usage.findOne({ user: userId, date });

  const used = {
    transcriptions: doc?.transcriptions || 0,
    diarizations: doc?.diarizations || 0,
    translations: doc?.translations || 0,
  };

  const remaining = {
    transcriptions: Math.max(0, limits.transcriptions - used.transcriptions),
    diarizations: Math.max(0, limits.diarizations - used.diarizations),
    translations: Math.max(0, limits.translations - used.translations),
  };

  return {
    date,
    resetsAt: getResetsAtUtc(),
    limits: {
      transcriptions: limits.transcriptions,
      diarizations: limits.diarizations,
      translations: limits.translations,
    },
    used,
    remaining,
  };
};

export default quota;

