'use strict'

// The marketing list: our own collection is the source of truth, and each address is
// also added to SendGrid Marketing contacts (best effort). Used by the blog's
// newsletter form and by Capital Watch sign-ups.
const NewsletterSubscriber = require('../models/Blog/blog.NewsletterSubscriber')

async function addToSendGridContacts(email) {
  if (!process.env.SENDGRID_API_KEY) return false
  const listId = process.env.SENDGRID_NEWSLETTER_LIST_ID
  const response = await fetch('https://api.sendgrid.com/v3/marketing/contacts', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(listId ? { list_ids: [listId] } : {}), contacts: [{ email }] }),
  })
  if (!response.ok) throw new Error(`SendGrid responded ${response.status}`)
  return true
}

async function subscribe(email, source) {
  const subscriber = await NewsletterSubscriber.findOneAndUpdate(
    { email },
    { $setOnInsert: { email, source } },
    { upsert: true, new: true },
  )
  if (!subscriber.sendgridSynced) {
    try {
      if (await addToSendGridContacts(email)) {
        await NewsletterSubscriber.updateOne({ _id: subscriber._id }, { sendgridSynced: true })
      }
    } catch (err) {
      console.error('[Newsletter] SendGrid contact sync failed:', err.message)
    }
  }
  return subscriber
}

module.exports = { subscribe, addToSendGridContacts }
