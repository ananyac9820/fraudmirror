import { Router } from 'express';
import Transaction from '../models/Transaction.js';
import Alert from '../models/Alert.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/stats - KPIs and chart series for the dashboard
router.get('/', requireAuth, async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const windowStart = new Date(Date.now() - 30 * 60000);
  const today = { timestamp: { $gte: startOfDay } };

  const [totals] = await Transaction.aggregate([
    { $match: today },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        flagged: { $sum: { $cond: ['$flagged', 1, 0] } },
        fraud: { $sum: { $cond: ['$isFraud', 1, 0] } },
        caught: { $sum: { $cond: [{ $and: ['$isFraud', '$flagged'] }, 1, 0] } },
        amountProtected: { $sum: { $cond: [{ $and: ['$isFraud', '$flagged'] }, '$amount', 0] } },
        amountSlipped: { $sum: { $cond: [{ $and: ['$isFraud', { $not: ['$flagged'] }] }, '$amount', 0] } },
        volume: { $sum: '$amount' },
      },
    },
  ]);
  const t = totals || { total: 0, flagged: 0, fraud: 0, caught: 0, amountProtected: 0, amountSlipped: 0, volume: 0 };

  const [openAlerts, perMinuteRaw, alertsByPattern, riskRaw, missedByType, caughtByType] = await Promise.all([
    Alert.countDocuments({ status: 'open' }),
    Transaction.aggregate([
      { $match: { timestamp: { $gte: windowStart } } },
      {
        $group: {
          _id: { $dateTrunc: { date: '$timestamp', unit: 'minute' } },
          total: { $sum: 1 },
          flagged: { $sum: { $cond: ['$flagged', 1, 0] } },
          slipped: { $sum: { $cond: [{ $and: ['$isFraud', { $not: ['$flagged'] }] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Alert.aggregate([{ $match: { createdAt: { $gte: startOfDay } } }, { $group: { _id: '$suspectedPattern', count: { $sum: 1 } } }]),
    Transaction.aggregate([
      { $match: today },
      { $bucket: { groupBy: '$riskScore', boundaries: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 101], default: 'other', output: { count: { $sum: 1 } } } },
    ]),
    Transaction.aggregate([{ $match: { ...today, isFraud: true, flagged: false } }, { $group: { _id: '$attackType', count: { $sum: 1 } } }]),
    Transaction.aggregate([{ $match: { ...today, isFraud: true, flagged: true } }, { $group: { _id: '$attackType', count: { $sum: 1 } } }]),
  ]);

  const riskDistribution = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map((b) => ({
    bucket: b === 90 ? '90–100' : `${b}–${b + 9}`,
    count: riskRaw.find((r) => r._id === b)?.count || 0,
  }));

  res.json({
    kpis: {
      transactionsToday: t.total,
      flaggedToday: t.flagged,
      openAlerts,
      fraudToday: t.fraud,
      caughtToday: t.caught,
      slippedToday: t.fraud - t.caught,
      detectionRate: t.fraud ? t.caught / t.fraud : 0,
      amountProtected: t.amountProtected,
      amountSlipped: t.amountSlipped,
      volumeToday: t.volume,
    },
    perMinute: perMinuteRaw.map((m) => ({
      minute: m._id,
      total: m.total,
      flagged: m.flagged,
      slipped: m.slipped,
    })),
    alertsByPattern: alertsByPattern.map((a) => ({ pattern: a._id || 'unknown', count: a.count })),
    riskDistribution,
    byAttackType: [...new Set([...missedByType, ...caughtByType].map((x) => x._id))].map((type) => ({
      type,
      caught: caughtByType.find((x) => x._id === type)?.count || 0,
      missed: missedByType.find((x) => x._id === type)?.count || 0,
    })),
  });
});

export default router;
