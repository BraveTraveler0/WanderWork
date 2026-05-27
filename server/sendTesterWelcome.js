/**
 * One-time script: send tester welcome email to all existing candidates.
 * Run with: node sendTesterWelcome.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const sgMail = require('@sendgrid/mail');

const Candidate = require('./models/JobSeeker/jobSeeker.Candidate');

const FROM_EMAIL = process.env.EMAIL_FROM || 'support@wanderwork.io';
const APP_URL = 'https://wanderwork.io';

function buildTesterEmail(rawName, email) {
  const name = rawName && rawName !== 'there' ? rawName : null;
  const greeting = name ? `Welcome, ${name}. You're one of our first.` : `Hey there. You're one of our first.`;
  const subject = name
    ? `Welcome, ${name}. You Have 100 Tokens Waiting On Wander/Work.`
    : `You Have 100 Tokens Waiting On Wander/Work.`;
  const dashboardLink = APP_URL;
  const coverLetterLink = `${APP_URL}/?upgrade=1`;
  const preferencesLink = `${APP_URL}/settings`;
  const preheader = `You have 100 tester tokens waiting. Fresh remote roles matched to you, every week.`;

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
    @media screen and (max-width:600px) {
      .container { width:100% !important; }
      .px-24 { padding-left:16px !important; padding-right:16px !important; }
      .btn { width:100% !important; }
      .btnwrap td { display:block !important; width:100% !important; padding:0 0 8px 0 !important; }
    }
  </style>
</head>
<body style="background-color:#EEF4F5; margin:0; padding:0;">

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
                <a href="${dashboardLink}" target="_blank" style="color:#306770; font-family:Manrope,Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:18px; font-weight:800; letter-spacing:2px;">WANDER<span style="opacity:0.5;">/</span>WORK</a>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="padding:16px 24px 0 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF; border-radius:12px; box-shadow:0 1px 2px rgba(16,24,40,.06);">

                  <tr>
                    <td class="px-24" style="padding:28px 24px 8px 24px; font-family:Manrope,Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#111827;">
                      <h1 style="margin:0 0 8px 0; font-size:22px; line-height:1.3; font-weight:800;">
                        ${greeting}
                      </h1>
                      <p style="margin:0; font-size:15px; line-height:1.6; color:#374151;">
                        Thanks for being an early tester on Wander/Work. We've loaded your account with
                        <strong style="color:#306770;">100 tokens</strong> to use on cover letters, resume tailoring, and recruiter outreach.
                        Fresh remote roles will land in your inbox every week and appear on your dashboard as they post.
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
                              <li><strong>100 tester tokens:</strong> Already in your account. Use them on cover letters, resume rewrites, and recruiter outreach.</li>
                              <li><strong>Weekly job drops:</strong> Fresh roles matched to your skills, every week. New jobs also appear on your dashboard as they post.</li>
                              <li><strong>One-click apply:</strong> Jump straight to the posting from each email.</li>
                              <li><strong>We'll write it for you:</strong> Cover letters and resume refreshes, emailed to you and saved to your Messages tab.</li>
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
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#DDE9EB; border-radius:10px;">
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
                You're receiving this as an early tester on Wander/Work.<br>
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

  return {
    to: email,
    from: FROM_EMAIL,
    subject,
    html,
  };
}

async function main() {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey || apiKey === 'SG.placeholder') {
    console.error('SENDGRID_API_KEY is not set. Aborting.');
    process.exit(1);
  }
  sgMail.setApiKey(apiKey);

  await mongoose.connect(process.env.DATABASE_URI);
  console.log('Connected to MongoDB.');

  const TEST_EMAIL = 'darrienccarter@gmail.com'; // set to null to send to all
  const query = TEST_EMAIL
    ? { email: TEST_EMAIL }
    : { email: { $exists: true, $ne: '' } };
  const candidates = await Candidate.find(query, 'firstName email').lean();
  console.log(`Found ${candidates.length} candidates.`);

  let sent = 0;
  let failed = 0;

  for (const c of candidates) {
    if (!c.email) continue;
    const name = c.firstName || 'there';
    try {
      await sgMail.send(buildTesterEmail(name, c.email));
      console.log(`  Sent to ${c.email}`);
      sent++;
    } catch (err) {
      console.warn(`  Failed for ${c.email}: ${err.message}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nDone. Sent: ${sent}, Failed: ${failed}`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
