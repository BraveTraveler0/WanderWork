const User = require('../models/User')
const asyncHandler = require('express-async-handler');

const getAllStars = asyncHandler(async (req, res) => {
    try {
        const users = await User.find();

        if (!votes?.length) {
            return res.status(400).json({ message: 'No users found' });
        }

        const stars = users.map((user)=> { return {id: user.id, stars: user.stars}});

        res.json(stars);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while fetching voiting' });
    }
});

const getUserStars = asyncHandler(async (req, res) => {
    const { id } = req.params; // Assuming id is passed in the request parameters

    try {
        // Assuming your model has a voting_id field
        const user = await User.findById(id);

        if (!user) {
            return res.status(400).json({ message: 'User Not Found' });
        }

        res.json({data: { stars: user.stars }});
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while fetching votes' });
    }
});

const updateUserStars = async (stars, userId) => {
    const user = await User.findById(userId);
    console.log("updateuserstars")

    if (!user) {
        return;
    }

    if (!user.stars) {
        user.stars = stars;
        console.log("update star stay the same")
    } else {
        user.stars += stars;
        console.log("update star fire")
    }
    await user.save();
};

const reShareStarUpdate = async (userId) => {
    const user = await User.findById(userId);
    console.log("resharestarupdate")

    if (!user) {
        return;
    }

    if (!user.starsProgress.reShareCount) {
        user.starsProgress.reShareCount = 1;
    } else {
        user.starsProgress.reShareCount += 1;
    }

    if (user.starsProgress.reShareCount >= 5) {
        user.starsProgress.reShareCount -= 5;
        user.stars++;
        console.log("reshare fire")
    }
    await user.save();
};

const likeGiveStarUpdate = async (likes, userId) => {
    const user = await User.findById(userId);
    console.log("likegivestarupdate")

    if (!user) {
        return;
    }

    if (!user.starsProgress.likeGiveCount) {
        user.starsProgress.likeGiveCount = likes;
    } else {
        user.starsProgress.likeGiveCount += likes;
    }

    if (user.starsProgress.likeGiveCount >= 10) {
        user.starsProgress.reShareCount -= 10;
        user.stars++;
        console.log("likegive fire")
    }
    await user.save();
};

const likeReceiveStarUpdate = async (likes, userId) => {
    const user = await User.findById(userId);
    console.log("likereceivestarupdate")

    if (!user) {
        return;
    }

    if (!user.starsProgress.likeReceiveCount) {
        user.starsProgress.likeReceiveCount = likes;
    } else {
        user.starsProgress.likeReceiveCount += likes;
    }

    if (user.starsProgress.likeReceiveCount >= 5) {
        user.starsProgress.likeReceiveCount -= 5;
        user.stars++;
        console.log("likereceive fire")
    }
    await user.save();
};

const postStarUpdate = async (userId) => {
    const user = await User.findById(userId);
    console.log("poststarupdate")

    if (!user) {
        return;
    }

    if (!user.starsProgress.postCount) {
        user.starsProgress.postCount = 1;
    } else {
        user.starsProgress.postCount += 1;
    }

    if (user.starsProgress.postCount >= 3) {
        user.starsProgress.postCount -= 3;
        user.stars++;
        console.log("post fire")
    }
    await user.save();
};

const remixStarUpdate = async (userId) => {
    const user = await User.findById(userId);
    console.log("remixstarupdate")

    if (!user) {
        return;
    }

    if (!user.starsProgress.remixCount) {
        user.starsProgress.remixCount = 1;
    } else {
        user.starsProgress.remixCount += 1;
    }

    if (user.starsProgress.remixCount >= 3) {
        user.starsProgress.remixCount -= 3;
        user.stars++;
        console.log("remix fire")
    }
    await user.save();
};

module.exports = {
    getAllStars,
    getUserStars,
    updateUserStars,
    reShareStarUpdate,
    likeGiveStarUpdate,
    likeReceiveStarUpdate,
    postStarUpdate,
    remixStarUpdate,
}