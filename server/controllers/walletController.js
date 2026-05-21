const Wallet = require('../models/wallet/wallet');
const CreditCard = require('../models/wallet/creditCardWallet.js');
const ElectronicPayment = require('../models/wallet/electronicPaymentWallet.js');
const Stars = require('../models/wallet/starsWallet.js');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


const getAllWallet = asyncHandler(async (req, res) => {
    try {
        const wallet = await Wallet.find();

        if (!wallet?.length) {
            return res.status(400).json({ message: 'No wallet found' });
        }

        res.json(wallet);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while fetching wallet' });
    }
});

const getWalletByUserId = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'User ID is required to fetch Wallet by ID' });
    }
    try {
        const user = await User.findById(id);
        if (!user) {
            return res.status(400).json({message: 'User not found matching requested ID'});
        }
        if (!user.stripeId) {
            return res.json([]);
        }
        const {data: wallet} = await stripe.customers.listPaymentMethods(user.stripeId, { limit: 10 })
        // Jerry Rig in Stars
        if (wallet) {
            wallet.unshift({userId: id, quantity: user.stars, type: 'stars'});
        }
        res.json(wallet);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while fetching wallet transactions' });
    }
});

const parseWallet = (req) => {
    const wallet = req.body;
    wallet.__t = wallet.type;
    delete wallet.type;
    return wallet;
}

const createWallet = asyncHandler(async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).json({ message: "userId required for creating wallet"});
        }

        const setupIntent = await stripe.setupIntents.create({
            customer: user.stripeId,
            usage: 'on_session',
        });

        res.status(201).json({client_secret: setupIntent.client_secret, status: setupIntent.status});

    } catch (error) {
        if (error?.cause === "badRequest") {
            return res.status(400).json({ message: error.message});
        } else {
            console.error(error);
            res.status(500).json({ message: 'An error occurred while creating wallet' });
        }
    }
});

// Out of date
const updateWallet = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'Wallet ID is required' });
    }
    const wallet = await Wallet.findById(id);
    if (!wallet) {
        return res.status(404).json({ message: 'wallet not found' });
    }

    if (wallet.__t !== req.body.type) {
        return res.status(404).json({message: 'Cannot change wallet type'});
    }
    try {
        const parsedWallet = parseWallet(req);
        for (key in parsedWallet) {
            wallet[key] = parsedWallet[key];
        }
        const updatedWallet = await wallet.save();
        res.json({ message: updatedWallet});
    } catch (error) {
        if (error?.cause === "badRequest") {
            return res.status(400).json({ message: error.message});
        } else {
            console.error(error);
            return res.status(500).json({ message: 'An error occurred while updating wallet' });
        }
    }
});

const deleteWallet = asyncHandler(async (req, res) => {
    const { id: walletId } = req.params;
    const { userId } = req.body;
    if (!walletId) {
        return res.status(400).json({ message: 'wallet ID is required' });
    }
    if (!userId) {
        return res.status(400).json({ message: 'user ID is required'});
    }
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'user not found'});
        }
        console.log("User Affirmed");
        const paymentMethod = await stripe.customers.retrievePaymentMethod(user.stripeId, walletId);
        if (!paymentMethod) {
            return res.status(404).json({ message: 'wallet not found'});
        }
        console.log("Wallet Affirmed");
        await stripe.paymentMethods.detach(walletId);
        res.json({ message: 'wallet deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while deleting wallet' });
    }
});

module.exports = {
    getAllWallet,
    getWalletByUserId,
    createWallet,
    deleteWallet,
    updateWallet
}
