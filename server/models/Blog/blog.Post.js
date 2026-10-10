const mongoose = require('mongoose')

// An article on the Aonverse blog (/aonverse/blog). Deleting from the admin view
// sets deletedAt instead of removing the document, so a post can be recovered.
const blogPostSchema = new mongoose.Schema({
  slug:     { type: String, required: true, unique: true },
  title:    { type: String, required: true },
  category: { type: String, default: '' },
  excerpt:  { type: String, default: '' },
  // Plain text. Blank lines separate paragraphs.
  body:     { type: String, default: '' },
  // Either the key of an image bundled with the frontend or an https URL.
  image:    { type: String, default: '' },
  publishedAt: { type: Date, default: Date.now },
  deletedAt:   { type: Date, default: null },
  updatedBy:   { type: String },
}, {
  collection: 'aonverse.blogposts',
  timestamps: true,
})

module.exports = mongoose.models['Blog.Post'] ||
  mongoose.model('Blog.Post', blogPostSchema)
