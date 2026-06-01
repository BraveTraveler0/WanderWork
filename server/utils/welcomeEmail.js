const sgMail = require('@sendgrid/mail');

const FROM_EMAIL = { name: 'Wander/Work', email: process.env.EMAIL_FROM || 'support@wanderwork.io' };
const APP_URL = 'https://wanderwork.io';

async function sendWelcomeEmail({ email, firstName, plan = 'Free' }) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey || !email) return { sent: false, reason: apiKey ? 'missing_email' : 'missing_key' };

  sgMail.setApiKey(apiKey);

  const name = firstName || null;
  const greeting = name ? `Welcome, ${name}. Let's find your next role.` : `Hey there. Let's find your next role.`;
  const emailSubject = name ? `Welcome To Wander/Work, ${name}. Your Next Role Starts Here.` : `Welcome To Wander/Work. Your Next Role Starts Here.`;
  const planLabel = plan || 'Free';
  const dashboardLink = APP_URL;
  const coverLetterLink = `${APP_URL}/?upgrade=1`;
  const preferencesLink = `${APP_URL}/settings`;
  const preheader = `Fresh remote roles matched to your skills, every week. Plus AI cover letters and resume tailoring.`;

  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Welcome to Wander/Work</title>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap" rel="stylesheet">
  <!--[if mso]>
    <xml>
      <o:OfficeDocumentSettings xmlns:o="urn:schemas-microsoft-com:office:office">
        <o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  <![endif]-->
  <style>
    html, body { margin:0 !important; padding:0 !important; height:100% !important; width:100% !important; }
    * { -ms-text-size-adjust:100%; -webkit-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt !important; mso-table-rspace:0pt !important; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    a { text-decoration:none; }
    :root {
      --accent:#306770;
      --gray-900:#111827;
      --gray-700:#374151;
      --gray-500:#6B7280;
      --card:#FFFFFF;
      --soft-bg:#EEF4F5;
    }
    @media screen and (max-width:600px) {
      .container { width:100% !important; }
      .px-24 { padding-left:16px !important; padding-right:16px !important; }
      .btn { width:100% !important; }
      .btnwrap td { display:block !important; width:100% !important; padding:0 0 8px 0 !important; }
    }
  </style>
</head>
<body style="background-color:#f6f7fb; margin:0; padding:0;">

  <!-- Hidden Preheader -->
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; opacity:0;">
    ${preheader}
  </div>

  <center role="article" aria-roledescription="email" lang="en">
    <!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="padding:24px;">
          <table role="presentation" width="600" class="container" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">

            <!-- Header -->
            <tr>
              <td style="padding:24px 24px 0 24px; text-align:left;">
                <a href="${dashboardLink}" target="_blank" style="color:#111827; font-family:Manrope,Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:18px; font-weight:800; letter-spacing:2px;">WANDER<span style="opacity:0.5;">/</span>WORK</a>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="padding:16px 24px 0 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF; border-radius:12px; box-shadow:0 1px 2px rgba(16,24,40,.06);">

                  <!-- Greeting + intro -->
                  <tr>
                    <td class="px-24" style="padding:28px 24px 8px 24px; font-family:Manrope,Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#111827;">
                      <h1 style="margin:0 0 8px 0; font-size:22px; line-height:1.3; font-weight:800;">
                        ${greeting}
                      </h1>
                      <p style="margin:0; font-size:15px; line-height:1.6; color:#374151;">
                        We'll keep a steady stream of fresh roles coming right to your inbox and your dashboard. Apply in one click, or tap
                        <strong>Get My Cover Letter</strong> and we'll tailor a note, refresh your resume if you'd like, and
                        <strong>email it straight to you</strong>, ready to copy, forward, or download.
                      </p>
                    </td>
                  </tr>

                  <!-- Features -->
                  <tr>
                    <td class="px-24" style="padding:16px 24px 8px 24px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="font-family:Manrope,Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:14px; color:#374151;">
                            <ul style="padding-left:18px; margin:0; line-height:1.7;">
                              <li><strong>Weekly job drops:</strong> Fresh roles matched to your skills land in your inbox every week. New jobs also appear on your dashboard as they post. Daily remote jobs available for premium members.</li>
                              <li><strong>One-click apply:</strong> Jump straight to the posting from each email.</li>
                              <li><strong>We'll write it for you:</strong> Cover letters and resume refreshes, emailed to you and saved to your Messages tab.</li>
                              <li><strong>30 free tokens to start:</strong> Use them on cover letters, resume tailoring, and recruiter outreach.</li>
                              <li><strong>Tune your feed:</strong> Update titles, locations, and preferences anytime from your profile.</li>
                            </ul>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- CTAs -->
                  <tr>
                    <td align="center" class="px-24" style="padding:18px 24px 28px 24px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" class="btnwrap">
                        <tr>
                          <!-- Primary -->
                          <td align="center" style="padding:0 8px 8px 0;">
                            <!--[if mso]>
                            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                              href="${dashboardLink}"
                              style="height:44px;v-text-anchor:middle;width:220px;" arcsize="12%"
                              strokecolor="#306770" fillcolor="#306770">
                              <w:anchorlock/>
                              <center style="color:#ffffff;font-family:Manrope,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:800;">Open My Dashboard</center>
                            </v:roundrect>
                            <![endif]-->
                            <!--[if !mso]><!-->
                            <a href="${dashboardLink}" target="_blank"
                               style="display:inline-block; background-color:#306770; color:#ffffff; font-family:Manrope,Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:15px; font-weight:800; line-height:44px; text-align:center; border-radius:8px; padding:0 20px; border:1px solid #306770;"
                               class="btn">Open My Dashboard</a>
                            <!--<![endif]-->
                          </td>

                          <!-- Secondary -->
                          <td align="center" style="padding:0 0 8px 8px;">
                            <!--[if mso]>
                            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                              href="${coverLetterLink}"
                              style="height:44px;v-text-anchor:middle;width:250px;" arcsize="12%"
                              strokecolor="#306770" fillcolor="#FFFFFF">
                              <w:anchorlock/>
                              <center style="color:#306770;font-family:Manrope,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:800;">Upgrade For Even More Perks</center>
                            </v:roundrect>
                            <![endif]-->
                            <!--[if !mso]><!-->
                            <a href="${coverLetterLink}" target="_blank"
                               style="display:inline-block; background-color:#FFFFFF; color:#306770; font-family:Manrope,Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:15px; font-weight:800; line-height:44px; text-align:center; border-radius:8px; padding:0 20px; border:1px solid #306770;"
                               class="btn">Upgrade For Even More Perks</a>
                            <!--<![endif]-->
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>

            <!-- Quick tip -->
            <tr>
              <td style="padding:16px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF4F5; border-radius:10px;">
                  <tr>
                    <td class="px-24" style="padding:14px 16px; font-family:Manrope,Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:13px; color:#374151;">
                      <strong>Quick tip:</strong> Mirror 2 to 3 keywords from each job post in your resume or cover letter for stronger screening matches.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:0 24px 32px 24px; font-family:Manrope,Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#6B7280; font-size:12px; line-height:1.6; text-align:left;">
                You're receiving weekly updates via your <strong>${planLabel}</strong> plan.<br>
                <a href="${preferencesLink}" target="_blank" style="color:#306770; font-weight:700;">Manage preferences or unsubscribe</a>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
    <!--[if mso]></td></tr></table><![endif]-->
  </center>
</body>
</html>`;

  const msg = {
    to: email,
    from: FROM_EMAIL,
    subject: emailSubject,
    html,
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
