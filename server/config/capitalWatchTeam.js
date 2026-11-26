'use strict'

// Who receives Capital Watch emails (digests, deadline alerts, application drafts,
// and a blind copy of every email sent from the Outbox). The first address gets
// replies to Outbox emails. One list, so adding a teammate is a one-line change.
const RECIPIENTS = ['darrienccarter@gmail.com', 'Mercedes.anthony20@gmail.com', 'dsdavisjr3@gmail.com']

const hasSendGrid = () => {
  const key = process.env.SENDGRID_API_KEY
  return Boolean(key && key !== 'SG.placeholder')
}

module.exports = { RECIPIENTS, hasSendGrid }
