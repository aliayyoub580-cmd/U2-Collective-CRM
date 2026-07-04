const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { getTodayAyats, refreshDailyAyats } = require('../services/quranService');

router.get('/today', asyncHandler(async (req, res) => {
  const result = await getTodayAyats();
  res.status(result.success ? 200 : 503).json(result);
}));

router.get('/daily-refresh', asyncHandler(async (req, res) => {
  if (!process.env.QURAN_REFRESH_TOKEN || req.query.token !== process.env.QURAN_REFRESH_TOKEN) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized refresh request'
    });
  }

  try {
    const result = await refreshDailyAyats();
    res.json(result);
  } catch (err) {
    res.status(503).json({
      success: false,
      message: 'Daily Quran Ayats refresh failed.',
      error: err.message
    });
  }
}));

module.exports = router;
