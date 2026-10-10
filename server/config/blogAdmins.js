// Accounts allowed to create, edit and delete Aonverse blog posts. They sign in
// with their normal Wanderwork login. Add more without a deploy by setting
// BLOG_ADMIN_EMAILS (comma-separated) on the server.
const BLOG_ADMIN_EMAILS = [
  'darrienccarter@gmail.com',
  'sephrim07@gmail.com',
  'darrien@aontechnology.io',
  'mercedes.anthony20@gmail.com',
  'dsdavisjr3@gmail.com',
]

function getBlogAdminEmails() {
  const configured = String(process.env.BLOG_ADMIN_EMAILS || '').split(',')
  return new Set([...BLOG_ADMIN_EMAILS, ...configured].map((e) => e.trim().toLowerCase()).filter(Boolean))
}

function isBlogAdmin(email) {
  const normalized = String(email || '').trim().toLowerCase()
  return !!normalized && getBlogAdminEmails().has(normalized)
}

module.exports = { isBlogAdmin }
