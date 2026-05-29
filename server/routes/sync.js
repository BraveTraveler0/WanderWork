/**
 * Airtable Sync API Routes
 * Endpoints to manage and trigger Airtable syncing
 */

const express = require('express');
const { triggerSync, getSyncStatus } = require('../airtable-scheduler');
const { syncRecruiters } = require('../services/recruiterSyncService');

const router = express.Router();

/**
 * POST /api/sync/airtable
 * Manually trigger an Airtable sync
 */
router.post('/airtable', async (req, res) => {
  try {
    console.log('📥 Manual Airtable sync requested...');
    const [, recruiterResult] = await Promise.all([
      triggerSync(),
      syncRecruiters().catch((e) => ({ error: e.message })),
    ]);

    res.json({
      success: true,
      message: 'Airtable sync completed',
      recruiters: recruiterResult,
      timestamp: new Date().toISOString(),
      status: getSyncStatus(),
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/sync/status
 * Get the current sync status
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    status: getSyncStatus(),
  });
});

/**
 * GET /api/sync/airtable/test
 * Test Airtable connection
 */
router.get('/airtable/test', async (req, res) => {
  try {
    const token = process.env.AIRTABLE_TOKEN;
    const baseId = process.env.AIRTABLE_BASE_ID;

    if (!token || !baseId) {
      return res.status(400).json({
        success: false,
        error: 'Airtable credentials not configured',
      });
    }

    const jobsTable = process.env.AIRTABLE_JOBS_TABLE_ID || process.env.AIRTABLE_JOBS_TABLE || 'FreshJobs';
    const jobsView = process.env.AIRTABLE_JOBS_VIEW_ID || process.env.AIRTABLE_JOBS_VIEW || '';
    const params = new URLSearchParams({ maxRecords: '1' });
    if (jobsView) params.append('view', jobsView);
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(jobsTable)}?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      res.json({
        success: true,
        message: 'Airtable connection successful',
        recordCount: data.records?.length || 0,
      });
    } else {
      res.status(response.status).json({
        success: false,
        error: `Airtable API error: ${response.status} ${response.statusText}`,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
