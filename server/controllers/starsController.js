const User = require('../models/User')
const asyncHandler = require('express-async-handler');

const getAllStars = asyncHandler(async (req, res) => {
    try {
        const users = await User.find();

        if (!users?.length) {
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

// These functions are called fire-and-forget (no await/catch) from postsController.js
// on ordinary like/star/post/remix actions, so none of them may ever reject — an
// uncaught rejection here crashes the whole process (Node's default unhandled-rejection
// behavior is to exit), the same failure mode the achievements system hit.

const updateUserStars = async (stars, userId) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            return;
        }

        if (!user.stars) {
            user.stars = stars;
        } else {
            user.stars += stars;
        }
        await user.save();
    } catch (error) {
        console.error('[stars] updateUserStars failed (non-fatal):', error);
    }
};

const reShareStarUpdate = async (userId) => {
    try {
        const user = await User.findById(userId);

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
        }
        await user.save();
    } catch (error) {
        console.error('[stars] reShareStarUpdate failed (non-fatal):', error);
    }
};

const likeGiveStarUpdate = async (likes, userId) => {
    try {
        const user = await User.findById(userId);

        if (!user) {
            return;
        }

        if (!user.starsProgress.likeGiveCount) {
            user.starsProgress.likeGiveCount = likes;
        } else {
            user.starsProgress.likeGiveCount += likes;
        }

        if (user.starsProgress.likeGiveCount >= 10) {
            user.starsProgress.likeGiveCount -= 10;
            user.stars++;
        }
        await user.save();
    } catch (error) {
        console.error('[stars] likeGiveStarUpdate failed (non-fatal):', error);
    }
};

const likeReceiveStarUpdate = async (likes, userId) => {
    try {
        const user = await User.findById(userId);

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
        }
        await user.save();
    } catch (error) {
        console.error('[stars] likeReceiveStarUpdate failed (non-fatal):', error);
    }
};

const postStarUpdate = async (userId) => {
    try {
        const user = await User.findById(userId);

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
        }
        await user.save();
    } catch (error) {
        console.error('[stars] postStarUpdate failed (non-fatal):', error);
    }
};

const remixStarUpdate = async (userId) => {
    try {
        const user = await User.findById(userId);

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
        }
        await user.save();
    } catch (error) {
        console.error('[stars] remixStarUpdate failed (non-fatal):', error);
    }
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