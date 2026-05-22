const sgMail = require('@sendgrid/mail');

const FROM_EMAIL = process.env.EMAIL_FROM || 'support@wanderwork.ai';
const APP_URL = process.env.APP_URL || 'https://wanderwork.ai';

async function sendWelcomeEmail({ email, firstName }) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey || !email) return { sent: false, reason: apiKey ? 'missing_email' : 'missing_key' };

  sgMail.setApiKey(apiKey);

  const greeting = firstName || email.split('@')[0];

  const msg = {
    to: email,
    from: FROM_EMAIL,
    subject: 'Welcome to Wander/Work',
    html: `<!DOCTYPE html>
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
          <p style="color:#1a1a1a;font-size:18px;font-weight:600;margin:0 0 12px">Welcome, ${greeting}.</p>
          <p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 20px">Your account is ready. Here is what you can do right now:</p>
          <ul style="color:#555;font-size:15px;line-height:1.9;margin:0 0 28px;padding-left:20px">
            <li>Upload your resume and let AI fill in your profile</li>
            <li>Browse curated job matches tailored to your skills</li>
            <li>Generate tailored resumes and cover letters in seconds</li>
            <li>Connect with recruiters who are hiring now</li>
          </ul>
          <div style="text-align:center;margin:0 0 28px">
            <a href="${APP_URL}" style="display:inline-block;background:#306770;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px">Go to My Dashboard</a>
          </div>
          <p style="color:#9CA3AF;font-size:13px;line-height:1.6;margin:0">You start with 30 free tokens. Use them to generate resumes, cover letters, and more.</p>
        </td></tr>
        <tr><td style="background:#F9FAFB;padding:20px 40px;text-align:center">
          <p style="margin:0;color:#9CA3AF;font-size:12px">2026 Wander/Work, Inc. <a href="${APP_URL}/privacy" style="color:#9CA3AF">Privacy</a> <a href="${APP_URL}/terms" style="color:#9CA3AF">Terms</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };

  try {
    await sgMail.send(msg);
    return { sent: true };
  } catch (err) {
    console.warn('[sendWelcomeEmail] Failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendWelcomeEmail };
