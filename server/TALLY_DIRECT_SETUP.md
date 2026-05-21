# Tally → MongoDB Direct Integration

## Overview
This setup allows Tally form submissions to write **directly to MongoDB**, bypassing Airtable and n8n entirely.

```
Before:  Tally → n8n → Airtable → MongoDB (hourly sync)
Now:     Tally → MongoDB (instant)
```

## Setup Complete ✅

### Files Created
1. **`routes/tallyWebhook.js`** - Webhook endpoint route
2. **`controllers/tallyWebhookController.js`** - Processes Tally submissions
3. **`server.js`** - Updated to register `/tally` route

### Webhook Endpoint
```
POST http://localhost:8000/tally/webhook
```

**In production**, this will be:
```
POST https://your-domain.com/tally/webhook
```

## How to Configure Tally

### Step 1: Get Your Webhook URL
- **Development**: `http://localhost:8000/tally/webhook`
- **Production**: `https://your-production-domain.com/tally/webhook`

### Step 2: Add Webhook in Tally
1. Go to your Tally form settings
2. Navigate to **Integrations** → **Webhooks**
3. Click **Add webhook**
4. Enter your webhook URL
5. Select trigger: **On form submission**
6. Save

### Step 3: Test the Webhook
```bash
# Test the endpoint is active
curl http://localhost:8000/tally/test

# Submit a test form in Tally
# Watch your server logs for: "📥 Tally webhook received"
```

## Field Mapping

The webhook automatically maps Tally form fields to MongoDB candidate schema:

| Tally Field Label | MongoDB Field | Type |
|------------------|---------------|------|
| First Name | first_name | string |
| Last Name | last_name | string |
| Email / Email Address | email | string (required) |
| Phone / Phone Number | phone | string |
| Location | location | string |
| Target Role / Desired Role | target_role | string |
| Seniority / Experience Level | seniority | string |
| Skills | skills | array (comma-separated) |
| LinkedIn / LinkedIn URL | linkedin_url | string |
| Portfolio / Portfolio URL | portfolio_url | string |
| Calendly / Calendly URL | calendly_url | string |
| Resume Link / Resume | resume_link | string |
| Resume Text / Resume Content | resume_text | string |

**Custom fields** not in this list will be saved with the label converted to lowercase with underscores (e.g., "Date of Birth" → "date_of_birth").

## Features

✅ **Instant Sync** - No delay, writes directly to MongoDB
✅ **Duplicate Prevention** - Updates existing candidate if email matches
✅ **Flexible Mapping** - Handles various field label variations
✅ **Error Handling** - Always responds 200 to prevent Tally retries
✅ **Logging** - Full console logs for debugging
✅ **No Airtable Required** - Completely independent of Airtable

## Verify Data

After submitting a Tally form, verify the data reached MongoDB:

```bash
# Check candidates in MongoDB
curl http://localhost:8000/jobseeker/candidate

# Or using MongoDB directly
mongosh
> use aon
> db["jobseeker.candidates"].find({source: "tally"}).pretty()
```

## Keep or Remove Airtable?

**Option 1: Keep Both (Recommended)**
- Tally → MongoDB (instant via webhook)
- Airtable → MongoDB (hourly sync as backup/bulk import)
- Benefits: Redundancy, can manage data in Airtable UI

**Option 2: Remove Airtable**
- Only use Tally → MongoDB
- Disable hourly sync: Comment out `initScheduledSync()` in server.js
- Remove Airtable API calls

**Option 3: Airtable as Archive**
- Tally → MongoDB (primary)
- Keep Airtable for historical records only
- Don't sync from Airtable anymore

## Troubleshooting

### Webhook not receiving data
- Check Tally webhook URL is correct
- Verify backend server is running on port 8000
- Check firewall allows incoming connections
- Look for errors in terminal where server is running

### Data not appearing in MongoDB
- Check MongoDB is running: `Get-Process mongod`
- Verify connection string in `.env`: `DATABASE_URI=mongodb://localhost:27017/aon`
- Check server logs for error messages

### Field not mapping correctly
- Add custom mapping in `tallyWebhookController.js`:
  ```javascript
  const FIELD_MAPPING = {
    'Your Custom Field': 'custom_field_name',
    // ... existing mappings
  };
  ```

## Production Deployment

### Expose Webhook Publicly
You'll need a public URL for Tally to reach:

**Option 1: Deploy to Render/Heroku/Railway**
- Your app gets a public URL automatically
- Use that URL in Tally: `https://your-app.onrender.com/tally/webhook`

**Option 2: Use ngrok (Development)**
```bash
ngrok http 8000
# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Use: https://abc123.ngrok.io/tally/webhook
```

**Option 3: Use Cloudflare Tunnel**
```bash
cloudflared tunnel --url http://localhost:8000
```

### Security Considerations
- [ ] Add webhook signature verification (Tally provides this)
- [ ] Rate limit the webhook endpoint
- [ ] Validate email format before saving
- [ ] Add honeypot fields for spam protection

## Next Steps

1. **Submit a test form** in Tally with your email
2. **Watch server logs** for confirmation
3. **Verify data** via `GET http://localhost:8000/jobseeker/candidate`
4. **Let me know your email** and I'll confirm the candidate record exists

---

**Your webhook is now live and ready to receive submissions!** 🚀
