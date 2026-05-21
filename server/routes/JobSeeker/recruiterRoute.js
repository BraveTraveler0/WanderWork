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
const { optionalAuth, requireAuth } = require('../../middleware/requireAuth')

router.get('/paired',        optionalAuth, getPairedRecruiters)
router.get('/all',           getAllRecruiters)
router.get('/contacts',      optionalAuth, getContactHistory)
router.post('/contact',      optionalAuth, recordContact)
router.post('/send-email',   optionalAuth, sendEmail)
router.post('/pair-companies', optionalAuth, pairRecruiterCompanies)

module.exports = router
