const FROM_EMAIL = { name: 'Wander/Work', email: process.env.EMAIL_FROM || 'support@wanderwork.io' }
const APP_URL = 'https://wanderwork.io'

function jobDigestEmail({ firstName, jobs = [] }) {
  const name = firstName || null
  const greeting = name ? `Hi ${name}, here are new remote roles for you.` : `Hey there, here are new remote roles for you.`
  const subject = name
    ? `${name}, ${jobs.length} New Remote Roles Are Waiting For You`
    : `${jobs.length} New Remote Roles Are Waiting For You`

  const jobCards = jobs.map(job => {
    const location = Array.isArray(job.location)
      ? job.location.map(l => typeof l === 'string' ? l : [l.city, l.state].filter(Boolean).join(', ')).filter(Boolean).join(' / ') || 'Remote'
      : (job.location || 'Remote')

    const posted = (job.datePosted || job.date_posted)
      ? new Date(job.datePosted || job.date_posted).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : null

    const desc = job.description_short || job.shortDescription || ''
    const applyUrl = job.url || job.url_normalized || APP_URL
    const jobMongoId = job._id ? job._id.toString() : ''
    const coverLetterUrl = jobMongoId
      ? `${APP_URL}/?coverletter=1&jobId=${jobMongoId}`
      : `${APP_URL}/?coverletter=1`

    return `
      <tr>
        <td style="padding:0 0 14px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF; border-radius:12px; padding:20px 24px; border:1px solid #e2eaeb; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <tr>
              <td style="font-family:Manrope,Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                <p style="margin:0 0 2px; font-size:16px; font-weight:800; color:#1a1a2e;">${job.title || 'Remote Role'}</p>
                <p style="margin:0 0 8px; font-size:13px; color:#306770; font-weight:600;">${job.company || ''} &middot; ${location}${posted ? ` &middot; Posted ${posted}` : ''}</p>
                ${desc ? `<p style="margin:0 0 14px; font-size:13px; color:#4b5563; line-height:1.6;">${desc.length > 140 ? desc.slice(0, 140).trim() + '...' : desc}</p>` : '<p style="margin:0 0 14px;"></p>'}
                <table cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td class="stack-column-mobile" style="padding:0 10px 0 0;">
                      <a href="${applyUrl}" target="_blank" class="btn-mobile-full" style="display:inline-block; background-color:#306770; color:#ffffff; font-family:Manrope,Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:13px; font-weight:800; line-height:38px; text-align:center; border-radius:8px; padding:0 20px; border:1px solid #306770; text-decoration:none;">Apply Now</a>
                    </td>
                    <td class="stack-column-mobile">
                      <a href="${coverLetterUrl}" target="_blank" class="btn-mobile-full" style="display:inline-block; background-color:#FFFFFF; color:#306770; font-family:Manrope,Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:13px; font-weight:800; line-height:38px; text-align:center; border-radius:8px; padding:0 20px; border:1.5px solid #306770; text-decoration:none;">Send My Cover Letter</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
  }).join('')

  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>New Remote Roles For You</title>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    html, body { margin:0 !important; padding:0 !important; height:100% !important; width:100% !important; }
    * { -ms-text-size-adjust:100%; -webkit-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt !important; mso-table-rspace:0pt !important; }
    a { text-decoration:none; }
    @media screen and (max-width:600px) {
      .container { width:100% !important; }
      .px-24 { padding-left:16px !important; padding-right:16px !important; }
      .stack-column-mobile { display:block !important; width:100% !important; padding:0 0 10px 0 !important; }
      .btn-mobile-full { display:block !important; width:100% !important; box-sizing:border-box !important; }
    }
  </style>
</head>
<body style="background-color:#EEF4F5; margin:0; padding:0;">

  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; opacity:0;">
    ${jobs.length} fresh remote roles matched to your profile this week.
  </div>

  <center role="article" aria-roledescription="email" lang="en">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="padding:24px;">
          <table role="presentation" width="600" class="container" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px;">

            <!-- Header -->
            <tr>
              <td style="padding:24px 24px 0 24px; text-align:left;">
                <a href="${APP_URL}" target="_blank" style="color:#306770; font-family:Manrope,Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:18px; font-weight:800; letter-spacing:2px; text-decoration:none;">WANDER<span style="opacity:0.5;">/</span>WORK</a>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="padding:16px 24px 0 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF; border-radius:12px; box-shadow:0 1px 2px rgba(16,24,40,.06);">
                  <tr>
                    <td class="px-24" style="padding:28px 24px 8px 24px; font-family:Manrope,Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                      <h1 style="margin:0 0 6px 0; font-size:22px; line-height:1.3; font-weight:800; color:#111827;">${greeting}</h1>
                      <p style="margin:0 0 24px; font-size:14px; color:#4b5563; line-height:1.6;">Click to apply, or tap <strong style="color:#306770;">Send My Cover Letter</strong> and we'll tailor one and deliver it to your inbox.</p>

                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        ${jobCards}
                      </table>
                    </td>
                  </tr>

                  <!-- CTA -->
                  <tr>
                    <td align="center" class="px-24" style="padding:8px 24px 28px 24px;">
                      <a href="${APP_URL}" target="_blank" style="display:inline-block; background-color:#306770; color:#ffffff; font-family:Manrope,Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:15px; font-weight:800; line-height:44px; text-align:center; border-radius:8px; padding:0 32px; border:1px solid #306770; text-decoration:none;">See All New Jobs</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Tip -->
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
                You're receiving this because you have an account at wanderwork.io.<br>
                <a href="${APP_URL}/settings" target="_blank" style="color:#306770; font-weight:700;">Manage Preferences Or Unsubscribe</a>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`

  return { from: FROM_EMAIL, subject, html }
}

module.exports = { jobDigestEmail }
