const express = require('express')
const router = express.Router()
const {
  getPairedRecruiters,
  getAllRecruiters,
  recordContact,
  getContactHistory,
  sendEmail,
  pairRecruiterCompanies,
} = require('../../controllers/JobSeeker/recruiterController')
const { requireAuth } = require('../../middleware/requireAuth')

function requireRecruiterAdmin(req, res, next) {
  const adminEmail = String(process.env.ADMIN_EMAIL || '').toLowerCase()
  if (req.user?.isAdmin || (adminEmail && String(req.user?.email || '').toLowerCase() === adminEmail)) {
    return next()
  }
  return res.status(403).json({ message: 'Admin access required' })
}

router.get('/paired',        requireAuth, getPairedRecruiters)
router.get('/all',           requireAuth, getAllRecruiters)
router.get('/contacts',      requireAuth, getContactHistory)
router.post('/contact',      requireAuth, recordContact)
router.post('/send-email',   requireAuth, sendEmail)
router.post('/pair-companies', requireAuth, requireRecruiterAdmin, pairRecruiterCompanies)

module.exports = router
