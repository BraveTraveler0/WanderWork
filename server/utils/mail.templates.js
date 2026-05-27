const APP_URL = process.env.APP_URL || 'https://wanderwork.io'
const FROM_EMAIL = process.env.EMAIL_FROM || 'support@wanderwork.io'

const base = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Wander/Work</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f7;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td align="center" style="padding-bottom:28px;">
            <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:4px;color:#306770;">
              WANDER<span style="opacity:0.45;">/</span>WORK
            </p>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background:#ffffff;border-radius:20px;padding:48px 48px 40px;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="padding:32px 0 0;">
            <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;letter-spacing:1.5px;">WANDER/WORK</p>
            <p style="margin:0;font-size:11px;color:#c0c8cc;">
              You're receiving this because you have an account at wanderwork.io.<br/>
              <a href="${APP_URL}" style="color:#306770;text-decoration:none;">Unsubscribe</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
`

const checkItem = (text) =>
  `<tr>
    <td width="24" valign="top" style="padding:5px 12px 5px 0;color:#36BF8F;font-size:16px;line-height:1;">&#10003;</td>
    <td style="padding:5px 0;font-size:14px;color:#4b6a73;line-height:1.5;">${text}</td>
  </tr>`

const ctaButton = (label, href) =>
  `<tr>
    <td align="center" style="padding-top:36px;">
      <a href="${href}" style="display:inline-block;background:#306770;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;letter-spacing:0.3px;">
        ${label}
      </a>
    </td>
  </tr>`

// ─── Pro Welcome ─────────────────────────────────────────────────────────────

function proWelcomeEmail(firstName) {
  const name = firstName || 'there'
  const content = `
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:2px;color:#306770;text-transform:uppercase;">You're now on</p>
    <h1 style="margin:0 0 6px;font-size:32px;font-weight:800;color:#1f2937;">Wander/Work Pro</h1>
    <p style="margin:0 0 32px;font-size:15px;color:#6b7280;line-height:1.6;">
      Hey ${name}, welcome to Pro. Your job search just got a serious upgrade — here's everything that's now unlocked for you.
    </p>

    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:32px;background:#f0f7f8;border-radius:14px;padding:20px 24px;">
      <tr><td>
        <p style="margin:0 0 14px;font-size:13px;font-weight:700;letter-spacing:1px;color:#306770;text-transform:uppercase;">What you get</p>
        <table cellpadding="0" cellspacing="0" width="100%">
          ${checkItem('100 tokens per month — fuel AI resume tailoring, cover letters & outreach')}
          ${checkItem('20 recruiter emails per day — AI drafts, you review and send')}
          ${checkItem('Unlimited daily job matches, curated to your profile')}
          ${checkItem('Priority AI resume optimization for every application')}
          ${checkItem('Cover letter generation — tailored per job')}
        </table>
      </td></tr>
    </table>

    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.7;">
      Your tokens refresh every month. Use them on resume rewrites, cover letters, and recruiter outreach — whatever moves you closer to your next role.<br/><br/>
      If you ever have questions, reply to this email and we'll get back to you within one business day.
    </p>

    <table cellpadding="0" cellspacing="0" width="100%">
      ${ctaButton('Go to Your Dashboard →', `${APP_URL}/dashboard`)}
    </table>

    <p style="margin:28px 0 0;font-size:13px;color:#9ca3af;">
      — The Wander/Work Team
    </p>
  `
  return {
    from: FROM_EMAIL,
    subject: 'Welcome to Wander/Work Pro ✦',
    html: base(content),
  }
}

// ─── Premium Welcome ──────────────────────────────────────────────────────────

function premiumWelcomeEmail(firstName) {
  const name = firstName || 'there'
  const content = `
    <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:2px;color:#36BF8F;text-transform:uppercase;">You're now on</p>
    <h1 style="margin:0 0 6px;font-size:32px;font-weight:800;color:#1f2937;">Wander/Work Premium</h1>
    <p style="margin:0 0 32px;font-size:15px;color:#6b7280;line-height:1.6;">
      Hey ${name}, welcome to Premium — our most powerful plan. You now have everything you need to land your next remote role, faster.
    </p>

    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:32px;background:#f0f7f8;border-radius:14px;padding:20px 24px;">
      <tr><td>
        <p style="margin:0 0 14px;font-size:13px;font-weight:700;letter-spacing:1px;color:#306770;text-transform:uppercase;">Everything you get</p>
        <table cellpadding="0" cellspacing="0" width="100%">
          ${checkItem('200 tokens per month — 2× the AI power of Pro')}
          ${checkItem('30 recruiter emails per day — maximum outreach, minimum effort')}
          ${checkItem('Unlimited daily job matches, handpicked for your profile')}
          ${checkItem('Career coach access — real guidance, not just algorithms')}
          ${checkItem('Custom cover letters, tailored to every job you apply for')}
          ${checkItem('Interview prep tools — practice answers, feedback, tips')}
          ${checkItem('Priority support — skip the queue')}
        </table>
      </td></tr>
    </table>

    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.7;">
      You're at the top. Your tokens refresh every month and your recruiter outreach limit resets daily. Get in front of the right people and let the AI handle the heavy lifting.<br/><br/>
      We're genuinely rooting for you. Reply to this email anytime — we read every one.
    </p>

    <table cellpadding="0" cellspacing="0" width="100%">
      ${ctaButton('Go to Your Dashboard →', `${APP_URL}/dashboard`)}
    </table>

    <p style="margin:28px 0 0;font-size:13px;color:#9ca3af;">
      — The Wander/Work Team
    </p>
  `
  return {
    from: FROM_EMAIL,
    subject: 'Welcome to Wander/Work Premium ✦',
    html: base(content),
  }
}

module.exports = { proWelcomeEmail, premiumWelcomeEmail }
