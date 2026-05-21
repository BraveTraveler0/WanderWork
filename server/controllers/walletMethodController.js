const WalletMethod = require('../models/wallet/WalletMethod.js');
const asyncHandler = require('express-async-handler');

const getAllWalletMethod = asyncHandler(async (req, res) => {
    try {
        const walletMethod = await WalletMethod.find();
        res.json(walletMethod);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while fetching walletMethod' });
    }
});

const createWalletMethod = asyncHandler(async (req, res) => {
    try {
        const { name, methodName, isActive, userId } = req.body;
        if (!name || !methodName || !isActive || !userId) {
            return res.status(400).json({ message: 'name, methodName, and isActive are required' });
        }
        const walletMethodObject = { name, methodName, isActive, userId };
        const walletMethod = await WalletMethod.create(walletMethodObject);
        res.status(201).json({ message: walletMethod });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while creating walletMethod' });
    }
});

const updateWalletMethod = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'WalletMethod ID is required' });
    }
    try {
        const { name, methodName, isActive, userId } = req.body;
        if (!name || !methodName || isActive || userId === undefined) {
            return res.status(400).json({ message: 'name, methodName, and isActive are required' });
        }
        const walletMethod = await WalletMethod.findByIdAndUpdate(id, { name, methodName, isActive, userId });
        if (!walletMethod) {
            return res.status(404).json({ message: 'WalletMethod not found' });
        }
        res.json({ updatedWalletMethod: walletMethod });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while updating walletMethod' });
    }
});

const deleteWalletMethod = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'WalletMethod ID is required' });
    }
    try {
        const deletedWalletMethod = await WalletMethod.findByIdAndRemove(id);
        if (!deletedWalletMethod) {
            return res.status(404).json({ message: 'WalletMethod not found' });
        }
        res.json({ message: 'WalletMethod deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while deleting WalletMethod' });
    }
});
const getWalletMethodbyUserId = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'WalletID is required' });
    }
    try {
        const walletmethod = await WalletMethod.find({ userId: id });
        res.json(walletmethod);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while fetching wallet transactions' });
    }
});

module.exports = {
    getAllWalletMethod,
    createWalletMethod,
    updateWalletMethod,
    deleteWalletMethod,
    getWalletMethodbyUserId
};