const express = require('express')
const router = express.Router()
const walletController = require('../controllers/walletController')
const { requireAuth } = require('../middleware/requireAuth')

router.use(requireAuth)

router.route('/')
    .get(walletController.getAllWallet)
    .post(walletController.createWallet)
router.route('/:id')
    .get(walletController.getWalletByUserId)
    .put(walletController.updateWallet)
    .delete(walletController.deleteWallet)

module.exports = router
