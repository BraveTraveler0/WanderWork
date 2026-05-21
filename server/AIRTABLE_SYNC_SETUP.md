# Airtable Automatic Sync Setup

Your Airtable sync is now ready to run automatically! Here's what was created:

## Files Created

1. **airtable-sync.js** - The main sync script that fetches data from Airtable and stores it in MongoDB
2. **airtable-scheduler.js** - Scheduled job manager (runs syncs every hour automatically)
3. **routes/sync.js** - API endpoints for manual sync control

## Setup Instructions

### Option 1: Integrate into Existing Backend Server (Recommended)

Add these lines to your main `server.js` file:

```javascript
// Near the top with other imports
const { initScheduledSync } = require('./airtable-scheduler');
const syncRoutes = require('./routes/sync');

// In your Express app setup (after creating app)
// Initialize automatic hourly syncs
initScheduledSync();

// Add sync API routes
app.use('/api/sync', syncRoutes);
```

### Option 2: Run as Standalone Service

```bash
# Run once manually
node airtable-sync.js --all

# Run with automatic hourly syncing
# Create a simple wrapper script that runs the scheduler
```

## API Endpoints (After Integration)

Once integrated into your backend, you'll have these endpoints:

### Manual Sync
```bash
POST http://localhost:8000/api/sync/airtable
# Manually trigger a sync right now
```

### Check Sync Status
```bash
GET http://localhost:8000/api/sync/status
# Returns: { isRunning, lastSyncTime, lastSyncStatus, nextSync }
```

### Test Airtable Connection
```bash
GET http://localhost:8000/api/sync/airtable/test
# Verifies your Airtable token is valid
```

## Automatic Sync Schedule

- **Frequency**: Every hour (at :00 minutes)
- **Example**: 2:00 AM, 3:00 AM, 4:00 AM, etc.
- **Cost**: Negligible (24 syncs/day = ~720 API calls/month)
- **Rate Limits**: Uses ~16 API calls per sync (Limit is 5 req/sec, you're fine)

## Monitoring

The scheduler logs each sync with:
- Start time
- Tables synced with counts
- Sync duration
- Next scheduled sync time
- Any errors

Example log output:
```
============================================================
📅 Scheduled Airtable Sync - 2026-01-06T14:00:00.000Z
============================================================
📥 Syncing jobs from Airtable...
✓ Fetched 1524 records from Airtable table: FreshJobs
✓ Synced jobs: 0 created, 0 updated (Total: 1524)

✅ Sync completed in 3s
Next sync: 3:00:00 PM
```

## Cost Summary

**Hourly Syncing (Recommended)**
- Airtable API: FREE (included in your plan)
- MongoDB: FREE (well under free tier limits)
- Server: Minimal CPU/Memory impact
- **Total Cost: $0**

## Troubleshooting

If syncs fail:
1. Check that `AIRTABLE_TOKEN` and `AIRTABLE_BASE_ID` are in `.env`
2. Test with: `POST http://localhost:8000/api/sync/airtable/test`
3. Check MongoDB is running: `Get-Process mongod`
4. View logs in terminal where backend is running

## Next Steps

1. Add the initialization code to your `server.js`
2. Restart your backend server
3. Check the logs to see syncs running every hour
4. Test manual sync: `curl -X POST http://localhost:8000/api/sync/airtable`
