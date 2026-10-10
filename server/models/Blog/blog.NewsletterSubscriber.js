const mongoose = require('mongoose')

// An email collected by the newsletter form on the blog. This collection is the
// source of truth; sendgridSynced records whether the address was also accepted
// into SendGrid Marketing contacts.
const newsletterSubscriberSchema = new mongoose.Schema({
  email:          { type: String, required: true, unique: true },
  source:         { type: String, default: 'blog' },
  sendgridSynced: { type: Boolean, default: false },
}, {
  collection: 'blog.newslettersubscribers',
  timestamps: true,
})

module.exports = mongoose.models['Blog.NewsletterSubscriber'] ||
  mongoose.model('Blog.NewsletterSubscriber', newsletterSubscriberSchema)
