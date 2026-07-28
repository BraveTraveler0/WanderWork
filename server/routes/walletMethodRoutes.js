const express = require('express')
const router = express.Router()
const walletMethodControlor = require('../controllers/walletMethodController')
const { requireAuth } = require('../middleware/requireAuth')

router.use(requireAuth)

router.route('/')
    .get(walletMethodControlor.getAllWalletMethod)
    .post(walletMethodControlor.createWalletMethod)
router.route('/:id')
    .put(walletMethodControlor.updateWalletMethod)
    .delete(walletMethodControlor.deleteWalletMethod)
    .get(walletMethodControlor.getWalletMethodbyUserId)

module.exports = router
