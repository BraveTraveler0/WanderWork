const WalletTransaction = require('../models/wallet/walletTransaction.js');
const asyncHandler = require('express-async-handler');

const getAllWalletTransactions = asyncHandler(async (req, res) => {
    try {
        const walletTransactions = await WalletTransaction.find();
        if (!walletTransactions?.length) {
            return res.status(404).json({ message: 'No wallet transactions found' });
        }
        res.json(walletTransactions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while fetching wallet transactions' });
    }
});


const createWalletTransaction = asyncHandler(async (req, res) => {
    try {
        const { userId, amount, method, currency, date, type, coPartyId, coPartyName } = req.body;
        if (!userId || !amount || !method || !currency || !date || !type || !coPartyName) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        const walletTransactionObject = { userId, amount, method, currency, date, type, coPartyId, coPartyName };
        const walletTransaction = await WalletTransaction.create(walletTransactionObject);
        res.status(201).json({ message: walletTransaction });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while creating wallet transaction' });
    }
});


const updateWalletTransaction = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'WalletTransaction ID is required' });
    }
    try {
        const { userId, amount, method, currency, date, type, coPartyId, coPartyName } = req.body;
        if (!userId || !amount || !method || !currency || !date || !type || !coPartyName) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        const walletTransaction = await WalletTransaction.findByIdAndUpdate(id,
            { userId, amount, method, currency, date, type, coPartyId, coPartyName });
        if (!walletTransaction) {
            return res.status(404).json({ message: 'WalletTransaction not found' });
        }
        res.json({ updatedWalletTransaction: walletTransaction });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while updating wallet transaction' });
    }
});

const deleteWalletTransaction = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'WalletTransaction ID is required' });
    }
    try {
        const deletedWalletTransaction = await WalletTransaction.findByIdAndRemove(id);
        if (!deletedWalletTransaction) {
            return res.status(404).json({ message: 'WalletTransaction not found' });
        }
        res.json({ message: 'WalletTransaction deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while deleting WalletTransaction' });
    }
});
const getWalletTransactionbyUserId = asyncHandler(async (req, res) => {
    
    const { id } = req.params;
    // console.log("Trying to get wallet transactions for: " + id);
    if (!id) {
        return res.status(400).json({ message: 'WalletTransaction ID is required' });
    }
    try {
        const walletTransaction = await WalletTransaction.find({ userId: id });
        if (!walletTransaction?.length) {
            return res.status(404).json({ message: 'No wallet transactions found' });
        }
        res.json(walletTransaction);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while fetching wallet transactions' });
    }
});

module.exports = {
    getAllWalletTransactions,
    createWalletTransaction,
    updateWalletTransaction,
    deleteWalletTransaction,
    getWalletTransactionbyUserId
};