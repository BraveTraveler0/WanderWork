'use strict'

// The Capital Watch team. These addresses become admins when they sign in (more AI
// allowance, can send Outbox emails from our domain, see sign-up numbers).
const ADMIN_EMAILS = ['darrienccarter@gmail.com', 'mercedes.anthony20@gmail.com', 'dsdavisjr3@gmail.com']

const hasSendGrid = () => {
  const key = process.env.SENDGRID_API_KEY
  return Boolean(key && key !== 'SG.placeholder')
}

module.exports = { ADMIN_EMAILS, hasSendGrid }
