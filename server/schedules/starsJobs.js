const cron = require('node-cron');
const User = require('../models/User');

const giveStars = async () => {
    try {
        const update = await User.updateMany({}, { $inc: { stars: 1}});
        if (!update) {
            throw new Error("Tried to give users daily star but an error occured");
        }
        if (update.acknowledged) {
            console.log(`Gave ${update.matchedCount} Users a daily star!`);
        } else {
            throw new Error("Daily Star Update Failed");
        }
    } catch (e) {
        console.error(e);
    }
}

// Run at midnight (00:00) every day
cron.schedule('0 0 * * *', giveStars);