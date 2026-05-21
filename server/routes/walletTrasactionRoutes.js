const express = require('express')
const router = express.Router()
const walletTransactionControlor = require('../controllers/walletTransactionController')

router.route('/')
    .get(walletTransactionControlor.getAllWalletTransactions)
    .post(walletTransactionControlor.createWalletTransaction)
router.route('/:id')
    .put(walletTransactionControlor.updateWalletTransaction)
    .delete(walletTransactionControlor.deleteWalletTransaction)
    .get(walletTransactionControlor.getWalletTransactionbyUserId)

module.exports = router
