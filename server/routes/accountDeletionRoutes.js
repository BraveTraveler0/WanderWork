const express = require('express');
const router = express.Router();
const sgMail = require('@sendgrid/mail');
const User = require('../models/User');
const Candidates = require('../models/JobSeeker/jobSeeker.Candidate');
const jwtUtils = require('../utils/jwtUtils');
const { getPublicServerUrl } = require('../utils/publicUrls');

const SERVER_URL = getPublicServerUrl();
const DELETION_PURPOSE = 'account-deletion';

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

// Public-facing pages match the visual style of the existing /privacy,
// /terms, /support pages in server.js (that helper isn't exported, so this
// is a small self-contained copy rather than a shared import).
const page = (title, bodyHtml) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} — Wander/Work</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#f9fafb;color:#333;padding:40px 20px;line-height:1.7}
.wrap{max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:40px 48px;box-shadow:0 4px 24px rgba(0,0,0,.07)}
h1{font-size:24px;font-weight:800;color:#306770;margin-bottom:16px}
p{margin-bottom:16px;font-size:14px;color:#555}
.brand{font-size:13px;color:#306770;letter-spacing:3px;font-weight:700;margin-bottom:24px;display:block}
label{display:block;font-size:13px;font-weight:600;color:#333;margin-bottom:6px}
input[type=email]{width:100%;padding:12px 14px;border:1px solid #DCDCDC;border-radius:10px;font-size:14px;margin-bottom:20px}
button{background:#306770;color:#fff;border:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer}
button.danger{background:#c0392b}
button:hover{opacity:0.92}
.notice{background:#FEF3F2;border:1px solid #FCA5A5;color:#991B1B;border-radius:10px;padding:14px 16px;font-size:13px;margin-bottom:20px}
footer{margin-top:32px;padding-top:20px;border-top:1px solid #eee;font-size:12px;color:#aaa}
a{color:#306770}
</style>
</head>
<body>
<div class="wrap">
<span class="brand">WANDER/WORK</span>
${bodyHtml}
<footer>&copy; 2026 Wander/Work. All rights reserved.</footer>
</div>
</body>
</html>`;

// GET /account-deletion — public request form, no login required.
router.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(page('Delete Your Account', `
<h1>Delete Your Account</h1>
<p>Enter the email address on your Wander/Work account. We'll send a confirmation link — clicking it permanently deletes your profile, resume data, saved jobs, and messages. This can't be undone.</p>
<p>If you'd rather delete your account from the app directly, you can also do this from Settings while logged in.</p>
<form onsubmit="return submitRequest(event)">
  <label for="email">Email address</label>
  <input type="email" id="email" name="email" required placeholder="you@example.com"/>
  <button type="submit">Send Confirmation Link</button>
</form>
<script>
async function submitRequest(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Sending...';
  try {
    await fetch('/account-deletion/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  } catch {}
  document.querySelector('.wrap').innerHTML = '<span class="brand">WANDER/WORK</span><h1>Check Your Email</h1><p>If an account exists for that address, we just sent a confirmation link to delete it. The link expires in 1 hour.</p>';
  return false;
}
</script>
`));
});

// POST /account-deletion/request — { email } -> sends confirmation email.
// Always returns a generic response so this can't be used to enumerate accounts.
router.post('/request', express.json(), async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (email) {
    try {
      const user = await User.findOne({ email });
      const apiKey = process.env.SENDGRID_API_KEY;
      if (user && apiKey) {
        sgMail.setApiKey(apiKey);
        const token = jwtUtils.generateToken(user, '1h', true, { purpose: DELETION_PURPOSE });
        const confirmLink = `${SERVER_URL}/account-deletion/confirm?token=${encodeURIComponent(token)}`;
        const displayName = user.displayName || user.email.split('@')[0];

        await sgMail.send({
          to: user.email,
          from: { name: 'Wander/Work', email: process.env.EMAIL_FROM || 'support@wanderwork.io' },
          subject: 'Confirm account deletion — Wander/Work',
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F4F4;font-family:Manrope,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F4;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
        <tr><td style="background:#306770;padding:32px 40px;text-align:center">
          <p style="margin:0;color:#FFFFFF;font-size:22px;font-weight:700;letter-spacing:4px">WANDER<span style="opacity:0.6">/</span>WORK</p>
        </td></tr>
        <tr><td style="padding:40px">
          <p style="color:#1a1a1a;font-size:18px;font-weight:600;margin:0 0 12px">Hi ${displayName},</p>
          <p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 28px">We received a request to permanently delete your Wander/Work account. If this was you, click below to confirm. This link expires in 1 hour and deletes your profile, resume data, saved jobs, and messages.</p>
          <div style="text-align:center;margin:0 0 28px">
            <a href="${confirmLink}" style="display:inline-block;background:#c0392b;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px">Confirm Account Deletion</a>
          </div>
          <p style="color:#9CA3AF;font-size:13px;line-height:1.6;margin:0">If you didn't request this, ignore this email — your account is safe and nothing will happen.<br><br>If the button above doesn't work, copy this link into your browser:<br><a href="${confirmLink}" style="color:#306770;word-break:break-all">${confirmLink}</a></p>
        </td></tr>
        <tr><td style="background:#F9FAFB;padding:20px 40px;text-align:center">
          <p style="margin:0;color:#9CA3AF;font-size:12px">© 2026 Wander/Work, Inc. · <a href="https://wanderwork.io/privacy" style="color:#9CA3AF">Privacy</a> · <a href="https://wanderwork.io/terms" style="color:#9CA3AF">Terms</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        });
      }
    } catch (err) {
      console.error('Account deletion request error:', err.message);
      // Fall through to the generic response either way.
    }
  }

  res.status(202).json({ message: "If that account exists, we've sent a confirmation link." });
});

// GET /account-deletion/confirm?token=... — shows a confirmation page (does
// NOT delete yet, so email link-scanners/prefetchers can't trigger deletion).
router.get('/confirm', (req, res) => {
  const decoded = jwtUtils.verifyToken(String(req.query.token || ''));
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!decoded || decoded.purpose !== DELETION_PURPOSE) {
    return res.send(page('Link Expired', `
<h1>This link has expired</h1>
<p>Account deletion confirmation links are valid for 1 hour. <a href="/account-deletion">Request a new one</a>.</p>
`));
  }

  res.send(page('Confirm Account Deletion', `
<h1>Confirm Account Deletion</h1>
<div class="notice">This permanently deletes your profile, resume data, saved jobs, and messages. This cannot be undone.</div>
<p>Deleting account for <strong>${decoded.email}</strong>.</p>
<form method="POST" action="/account-deletion/confirm">
  <input type="hidden" name="token" value="${String(req.query.token || '')}"/>
  <button type="submit" class="danger">Yes, Delete My Account</button>
</form>
`));
});

// POST /account-deletion/confirm — actually performs the deletion.
router.post('/confirm', express.urlencoded({ extended: false }), express.json(), async (req, res) => {
  const token = req.body?.token || req.query.token;
  const decoded = jwtUtils.verifyToken(String(token || ''));
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!decoded || decoded.purpose !== DELETION_PURPOSE) {
    return res.status(400).send(page('Link Expired', `
<h1>This link has expired</h1>
<p>Account deletion confirmation links are valid for 1 hour. <a href="/account-deletion">Request a new one</a>.</p>
`));
  }

  try {
    const deletedUser = await User.findOneAndDelete({ _id: decoded.id, email: decoded.email });
    if (deletedUser) {
      await Candidates.deleteMany({ email: decoded.email }).catch(() => {});
    }
    return res.send(page('Account Deleted', `
<h1>Your account has been deleted</h1>
<p>Everything associated with <strong>${decoded.email}</strong> has been permanently removed from Wander/Work. Sorry to see you go.</p>
`));
  } catch (err) {
    console.error('Account deletion confirm error:', err.message);
    return res.status(500).send(page('Something Went Wrong', `
<h1>Something went wrong</h1>
<p>We couldn't complete the deletion. Please email <a href="mailto:support@wanderwork.io">support@wanderwork.io</a> and we'll take care of it manually.</p>
`));
  }
});

module.exports = router;
