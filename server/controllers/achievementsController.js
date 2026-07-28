const asyncHandler = require("express-async-handler");
const Crowns = require("../models/achievements.js");
const User = require("../models/User");
const PostRank = require("../models/postranks.js");
const Post = require("../models/posts");
const Achievements = require("../models/achievements");
const { initRanking } = require("../controllers/util/rankingFunction.js");
const mongoose = require("mongoose");
const { updateUserLevel } = require("./xpController.js");
const { updateUserStars} = require("./starsController.js");
const Notifications = require('../models/notifications'); // For notifications

// Function to award a trophy and notify the user
const awardTrophyToUser = async (userId, trophyId) => {
  try {
    // Fetch trophy details by _id
    const trophy = await Crowns.findById(trophyId).lean();
    if (!trophy) throw new Error(`Trophy with ID ${trophyId} not found`);

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // Check if the user already has this trophy
    const alreadyHasTrophy = user.achievements.some(ach => ach.id.toString() === trophyId.toString());
    if (!alreadyHasTrophy) {
      user.achievements.push({ id: trophyId, complete: true });
      await user.save();
    }

    // Create a notification for the awarded trophy
    await Notifications.create({
      senderSlug: 'system',
      recipSlug: userId,
      action: 'Trophy Awarded',
      trophyId: trophyId,
      message: `Congratulations! You’ve earned the trophy: ${trophy.title}.`,
      image: trophy.image
    });

    console.log(`Trophy ${trophyId} awarded to user ${userId} and notification sent.`);
  } catch (error) {
    console.error('Error awarding trophy:', error);
  }
};

const getAllCrowns = asyncHandler(async (req, res) => {
  // Get all users from MongoDB
  const crowns = await Crowns.find().lean()

  // If no users 
  if (!crowns?.length) {
    return res.status(400).json({ message: 'No crowns found' })
  }

  res.json(crowns)
})

const getTrophyById = asyncHandler(async (req, res) => {
  const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'Voiting ID is required' });
    }
    try {
    
  const crowns = await Crowns.findById(id);

  // If no users 
  if (!crowns?.length) {
    return res.status(400).json({ message: 'No crowns found' })
  }
  res.json(crowns)

} catch (error) {
  console.error(error);
  res.status(500).json({ message: 'An error occurred while loading trophy' });
}
})

const getRankedPosts = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page || 0, 10);
    const limit = parseInt(req.query.pageSize || 10, 10);

    const { timeScale } = req.params;
    const { tagId } = req.query;

    if (!timeScale) {
      return res.status(400).json({
        err: "Timescale is required",
      });
    }
    if (!tagId) {
      return res.status(400).json({
        err: "TagId is required",
      });
    }

    if (timeScale !== "all time") {
      const rankedPostData = [];
      const filter = { time_scale: timeScale };
      if (tagId !== "All") {
        filter["category"] = tagId;
      }
      const timeNow = new Date();
      if (timeScale === "today") {
        filter.createdAt = {
          $gte: new Date(timeNow.getFullYear(), timeNow.getMonth(), timeNow.getDate(), 0, 0, 0),
          $lt: new Date(timeNow.getFullYear(), timeNow.getMonth(), timeNow.getDate() + 1, 0, 0, 0),
        };
      } else if (timeScale === "weekly") {
        const startOfWeek = new Date(timeNow);
        startOfWeek.setDate(timeNow.getDate() - timeNow.getDay() + 1);
        const endOfWeek = new Date(timeNow);
        endOfWeek.setDate(timeNow.getDate() - timeNow.getDay() + 8);
        filter.createdAt = {
          $gte: startOfWeek,
          $lt: endOfWeek,
        };
      } else if (timeScale === "monthly") {
        filter.createdAt = {
          $gte: new Date(timeNow.getFullYear(), timeNow.getMonth(), 1, 0, 0, 0),
          $lt: new Date(timeNow.getFullYear(), timeNow.getMonth() + 1, 1, 0, 0, 0),
        };
      } else if (timeScale === "yearly") {
        filter.createdAt = {
          $gte: new Date(timeNow.getFullYear(), 0, 1, 0, 0, 0),
          $lt: new Date(timeNow.getFullYear() + 1, 0, 1, 0, 0, 0),
        };
      }
      const aggregationPipeline = [
        {
          $match: filter,
        },
        {
          $lookup: {
            from: "posts",
            localField: "post",
            foreignField: "_id",
            as: "post",
          },
        },
        { $sort: { point: -1 } },
        { $skip: page * limit },
        { $limit: limit },
      ];

      const ranked = await PostRank.aggregate(aggregationPipeline);

      for (let index = 0; index < ranked.length; index++) {
        const item = ranked[index];
        rankedPostData.push({
          ...item.post[0],
          time_scale: ranked[index].time_scale,
          rank: page * limit + index + 1,
        });
      }

      res.status(200).json(rankedPostData);
    } else {
      if (tagId === "All") {
        let rankedPost = await Post.find()
          .select()
          .sort({ point: -1 })
          .skip(page * limit)
          .limit(limit)
          .lean();
        rankedPost.forEach((post, idx) => (post.rank = page * limit + idx + 1));
        res.status(200).json(rankedPost);
      } else {
        const aggregationPipeline = [
          {
            $match: {
              category: tagId,
            },
          },
          { $sort: { point: -1 } },
          { $skip: page * limit },
          { $limit: limit },
        ];
        let rankedPost = await Post.aggregate(aggregationPipeline);
        rankedPost.forEach((post, idx) => (post.rank = page * limit + idx + 1));
        res.status(200).json(rankedPost);
      }
    }
  } catch (error) {
    return res.status(500).json({ message: "No ranked posts found", error: error });
  }
});

const getAonconRankedPosts = asyncHandler(async (req, res) => {
  console.log("firing")
  try {
    const { tagId } = req.query;
    
    // Debug log the incoming tagId
    console.log('Received tagId:', tagId);

    if (!tagId) {
      return res.status(400).json({
        err: "tagId is required",
      });
    }

    const categoryMap = [
      {code: "All", title: "All"},
      {code: "aoncon2024", title: "AonCon2024"},
      {code: "aoncon2024plushie", title: "Plushie"},
      {code: "aoncon2024sneakers", title: "Sneakers"},
      {code: "aoncon2024artconnoisseur", title: "Art Connoisseur"},
      {code: "aoncon2024fashionicon", title: "Fashion Icon"},
      {code: "aoncon2024love", title: "Share Love"},
      {code: "aoncon2024crackcode", title: "Crack Code"},
      {code: "aoncon2024capturemoment", title: "Capture The Moment"},
      {code: "aoncon2024noncosplay", title: "NonCosplay"}
    ];

    const validCategories = categoryMap.map(category => category.code);

    // Find the corresponding category code for the given title or use the code directly
    let categoryCode;
    if (tagId === "All") {
      categoryCode = "All";
    } else {
      // Try to find matching category by title or code
      const categoryEntry = categoryMap.find(
        cat => cat.title === tagId || cat.code === tagId
      );

      if (!categoryEntry) {
        return res.status(400).json({
          err: "Invalid tagId provided",
          validOptions: categoryMap.map(cat => ({title: cat.title, code: cat.code}))
        });
      }
      categoryCode = categoryEntry.code;
    }

    // Construct a simpler filter first
    let filter = {};
    
    if (categoryCode === "All") {
      filter = { category: { $in: validCategories.filter(code => code !== "All") } };
      console.log('Using $in filter for All:', filter);
    } else {
      filter = { category: categoryCode };
      console.log('Using exact match filter:', filter);
    }

    // Try a simple find() first to debug
    const simpleFind = await Post.find(filter).lean();
    console.log('Simple find results count:', simpleFind.length);
    console.log('First result if any:', simpleFind[0]);

    // If we're getting results with find(), then try the aggregation
    const aggregationPipeline = [
      {
        $match: filter
      },
      {
        $sort: { point: -1 }
      }
    ];

    let rankedPosts = await Post.aggregate(aggregationPipeline);
    rankedPosts.forEach((post, idx)=> post.rank = idx + 1)
    console.log('Aggregation results count:', rankedPosts.length);

    // If we get here with no results, something's wrong
    if (rankedPosts.length === 0) {
      // Let's do one more check - what categories actually exist in the database?
      const existingCategories = await Post.distinct('category');
      console.log('Existing categories in database:', existingCategories);
      
      return res.status(404).json({ 
        message: "No posts found",
        debug: {
          usedFilter: filter,
          existingCategories,
          requestedTagId: tagId,
          resolvedCategoryCode: categoryCode
        }
      });
    }

    res.status(200).json(rankedPosts);

  } catch (error) {
    console.error('Error in getAonconRankedPosts:', error);
    return res.status(500).json({ 
      message: "Error fetching posts",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

const updateLoginAchiev = asyncHandler(async (req, res) => {
  const { progress, slug } = req.body;

  if (!slug || !progress) {
    return res.status(400).json({ message: "Progess value, and user slug fields are required" });
  }

  const user = await User.findOne({ slug }).exec();

  if (!user) {
    return res.status(400).json({ message: "User not found" });
  }

  console.log(user.achievements[1].progress)
  if (progress === 1) {
    user.achievements[1].progress += 1
  } else if (progress === 2) {
    user.achievements[1].progress = 0
  };

  const updatedUser = await user.save();

  res.status(200).json(updatedUser);
});

/* const pipeline = [{ $match: { operationType: { $in: ['insert', 'update', 'delete'] } } }];

const changeStream = Post.watch(pipeline);
changeStream.on("change", async () => {
  await updateAllPostPoints();
  await initRanking("daily");
  await initRanking("weekly");
  //await updateQuantumShiftAchievements();
  await initRanking("monthly");
  await initRanking("yearly");
}); */

/*const updateAllPostPoints = async () => {
  try {
    const posts = await Post.find();

    const bulkOps = [];
    
    for (let post of posts) {
      let point = 0;

      // Check if post.likes is a valid number
      if (typeof post.likes === 'number' && !isNaN(post.likes)) {
        point += post.likes * 1;
      }

      // Check if post.shares is a valid number
      if (typeof post.shares === 'number' && !isNaN(post.shares)) {
        point += post.shares * 4;
      }

      // Check if post.stars is a valid number
      if (typeof post.stars === 'number' && !isNaN(post.stars)) {
        point += post.stars * 10;
      }

      // Delete post.comments if it's not an object or is null
      if (typeof post.comments !== 'object' || post.comments === null) {
        delete post.comments;
        console.log("delete");
      } else {
        // Count the number of objects in post.comments if it's an object
        point += Object.keys(post.comments).length * 3;
      }

      // Update the point value for the current post
      bulkOps.push({
        updateOne: {
          filter: { _id: post._id },
          update: { point: point }
        }
      });
    } 

    // Execute the bulk update operation
    await Post.bulkWrite(bulkOps);
  } catch (error) {
    console.error("Error updating points:", error);
  }
}; */

const updateWeeklyRankAchievements = async () => {
  try {
    const users = await User.find().exec();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const user of users) {
      if (user.slug) {
        const postRanks = await PostRank.find({
          slug: user.slug,
          time_scale: "weekly",
          rank: { $lte: 10 },
          createdAt: { $gte: today },
        }).exec();

        user.achievements[2].complete += postRanks.length;

        const postRankProgress = await PostRank.findOne({
          slug: user.slug,
          time_scale: "weekly",
          rank: { $gt: 10 },
          createdAt: { $gte: today },
        }).sort({ rank: 1 });

        if (postRankProgress) {
          user.achievements[2].progress = calculateProgress(postRankProgress.rank);
        }

        await user.save();
      }
    }

  } catch (err) {
    console.error(err);
  }
};

const updateTenStarPostAchievements = async (id) => {
  console.log("Running Update Ten Star Post Achievements", id);
  try {
    const user = await User.findOne({ slug: id }).exec();
    if (user.slug) {
      const topStarredPost =await Post.find({ slug: user.slug, stars: { $lt: 10 } }).sort({ stars: -1 }).limit(1);

      user.achievements[0].progress = topStarredPost[0].stars;

      await user.save();
    }

    console.log("Achievements updated successfully.");
  } catch (err) {
    console.error(err);
  }
};


const updateDisplayCase = asyncHandler(async (req, res) => {
  const { id, displayCase } = req.body

  // Confirm data 
  if (!id) {
    return res.status(400).json({ message: 'id required' })
  }

  // Does the user exist to update?
  const user = await User.findOne({ _id: id }).exec()

  if (!user) {
    return res.status(400).json({ message: 'User not found' })
  }

  user.displayCase = displayCase

  const updatedUser = await user.save();

  res.status(200).json(updatedUser);

});

// Generic function to abstract commonn work
const updateUserAchievementProgress = async (achievementId, userId, updateProgress, res = null) => {
  try {
    // Unpack and check ID
    if (!userId) {
      if (res) {
        return res.status(400).json({ message: 'id required' });
      } else {
        console.error("Tried to update User Achievement Progress without valid achievementId");
        return;
      }
    }

    // Prepare the update operation
    const updateOperation = async (session) => {
      const user = await User.findOne({ _id: userId }).session(session);

      if (!user) {
        throw new Error('User not found');
      }

      let achievement = user.achievements.find((a) => a.id === achievementId);

      if (!achievement) {
        const fullAchievement = await Achievements.findById(achievementId).session(session);
        if (!fullAchievement) {
          throw new Error('Achievement was not found matching requested ID');
        }
        achievement = {
          id: fullAchievement._id,
          crown: fullAchievement.crown,
          goal: fullAchievement.goal,
          progress: 0,
        };
        user.achievements.push(achievement);
      }

      // Apply the custom update logic
      await updateProgress(user, achievement);

      // Prepare the update object
      const updateObj = {
        $set: {
          achievements: user.achievements,
        }
      };

      // Perform the update
      const updatedUser = await User.findOneAndUpdate(
        { _id: userId },
        updateObj,
        { new: true, runValidators: true, session }
      );

      if (!updatedUser) {
        throw new Error('Failed to update user');
      }

      return updatedUser;
    };

    // Execute the update operation in a transaction
    const updatedUser = await mongoose.connection.transaction(updateOperation);

    if (res) {
      return res.status(200).json(updatedUser);
    }

    return updatedUser;

  } catch (err) {
    console.error(err);
    if (res) {
      return res.status(500).json({ message: err.message });
    }
    // Achievement tracking is a best-effort side effect of the calling action
    // (login, posting, liking, etc.) and must never fail or crash that action.
    return null;
  }
};

/*const updateStardustAchievement = async (userId) => {
  const updateProgress = async (user, achievement) => {
    const topStarredPost = await Post.find({ slug: user._id }).sort({ stars: -1 }).limit(1);
    const newProgress = Math.max(achievement.progress ?? 0, Math.min(topStarredPost[0].stars * 10, 100));
    if (achievement.progress < 100 && newProgress >= 100) {
      // Achieved!
      updateUserLevel(1000, user.id);
      updateUserStars(3, user.id);
    }
    achievement.progress = newProgress;
  }

  return await updateUserAchievementProgress('6420c3bdb69e5e9fe4e90600', userId, updateProgress);
};*/

const updateLightSeekerAchievement = async (userId) => {
  console.log("LightSeeker")
  const updateProgress = (user, achievement) => {
    if (achievement.progress < 100) { // If haven't achieved yet
      const newProgress = Math.min(user.consecutivelogins * (100 / 15), 100);
      if (achievement.progress < 100 && newProgress >= 100) {
        awardTrophyToUser(userId, '6420c3f8b69e5e9fe4e90601'); // Stellar Wind trophy ID
        // Achieved!
        updateUserLevel(15000, user.id, achievement);
        updateUserStars(10, user.id, achievement);
      }
      achievement.progress = newProgress;
    }
  };
  return await updateUserAchievementProgress('6420c3f8b69e5e9fe4e90601', userId, updateProgress);
};

const updateStellarWindAchievement = async (userId) => {
  const updateProgress = (user, achievement) => {
    if (achievement.progress < 100) {
      let newProgress = Math.min(achievement.progress + 20, 100);
      
      if (newProgress >= 100) {
        awardTrophyToUser(userId, '6420c410b69e5e9fe4e90602'); 
        // Achieved!
        updateUserLevel(5000, user.id, achievement);
        updateUserStars(10, user.id, achievement);
      }
      
      achievement.progress = newProgress;
    }
  }
  return await updateUserAchievementProgress('6420c410b69e5e9fe4e90602', userId, updateProgress);
};

const updateCosmicTrekkerAchievement = async (userId) => {
  console.log("Cosmic Trekker")
  const updateProgress = (user, achievement) => {
    if (achievement.progress < 100) {
      let newProgress = Math.min(achievement.progress + 20, 100);
      
      if (newProgress >= 100) {
        awardTrophyToUser(userId, '656e840a822995ca3fc2cff7');
        // Achieved!
        updateUserLevel(5000, user.id, achievement);
        updateUserStars(10, user.id, achievement);
      }
      
      achievement.progress = newProgress;
    }
  }
  return await updateUserAchievementProgress('656e840a822995ca3fc2cff7', userId, updateProgress);
};

const updateExpanseExplorerAchievement = async (userId) => {
  console.log("ExpanseExplorer")
  const updateProgress = (user, achievement) => {
    if (achievement.progress < 100) {
      let newProgress = Math.min(achievement.progress + 20, 100);
      
      if (newProgress >= 100) {
        awardTrophyToUser(userId, '6420c3bdb69e5e9fe4e90600');
        // Achieved!
        updateUserLevel(5000, user.id, achievement);
        updateUserStars(10, user.id, achievement);
      }
      
      achievement.progress = newProgress;
    }
  }
  return await updateUserAchievementProgress('6420c3bdb69e5e9fe4e90600', userId, updateProgress);
};

const updateMeteorShowerAchievement = async (userId) => {
  console.log("MeteorShower")
  const updateProgress = (user, achievement) => {
    if (achievement.progress < 100) {
      let newProgress = 100;
      awardTrophyToUser(userId, '656e872a822995ca3fc2cffa');
      
      // Achieved!
      updateUserLevel(5000, user.id, achievement);
      updateUserStars(10, user.id, achievement);
      
      achievement.progress = newProgress;
    }
  }
  return await updateUserAchievementProgress('656e872a822995ca3fc2cffa', userId, updateProgress);
};

const updateOrbitTrackerAchievement = async (userId) => {
  console.log("Orbit Tracker")
  const updateProgress = (user, achievement) => {
    if (achievement.progress < 100) {
      let newProgress = 100;
      awardTrophyToUser(userId, '656e86bf822995ca3fc2cff9');
      
      // Achieved!
      updateUserLevel(5000, user.id, achievement);
      updateUserStars(10, user.id, achievement);
      
      achievement.progress = newProgress;
    }
  }
  return await updateUserAchievementProgress('656e86bf822995ca3fc2cff9', userId, updateProgress);
};

function calculateProgress(rank) {
  if (rank <= 20) {
    return 75
  } else if (rank <= 30) {
    return 50
  } else if (rank <= 40) {
    return 25
  } else {
    return 0
  }
}

const updateSatelliteAchievement = async (userId) => {
  console.log("Satellite");
  const updateProgress = (user, achievement) => {
    if (achievement.progress < 100) {
      let newProgress = Math.min(achievement.progress + 20, 100);
      
      if (newProgress >= 100) {
        awardTrophyToUser(userId, '656e942e822995ca3fc2cffb');
        // Achieved!
        updateUserLevel(5000, user.id, achievement);
        updateUserStars(10, user.id, achievement);
      }
      
      achievement.progress = newProgress;
    }
  }
    await updateUserAchievementProgress('656e942e822995ca3fc2cffb', userId, updateProgress);
  };

  /*const updateQuantumShiftAchievements = async () => {
    const updateProgress = async (user, achievement) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (user && achievement.progress < 100) {
        const postRanks = await PostRank.count({
          slug: user._id.toString(),
          time_scale: "weekly",
          rank: { $lte: 10 },
        });
        if (postRanks) {
          achievement.complete = 1;
          const newProgress = 100;
          if (achievement.progress < 100 && newProgress >= 100) {
            // Achieved!
            updateUserLevel(5000, user.id);
            updateUserStars(10, user.id);
          }
          achievement.progress = newProgress;
        } else {
          const postRankProgress = await PostRank.findOne({
            slug: user._id.toString(),
            time_scale: "weekly",
            rank: { $gt: 10 },
          }).sort({ rank: 1 });
  
          if (postRankProgress) {
            achievement.progress = Math.max(achievement.progress, calculateProgress(postRankProgress.rank));
          } else {
            achievement.progress = 0;
          }
        }
      }
    };
  };*/

const updateBrightStarAchievement = async (userId) => {
  console.log("brightstar")
  const updateProgress = (user, achievement) => {
    if (achievement.progress < 100) {
      let newProgress = Math.min(achievement.progress + 20, 100);
      
      if (newProgress >= 100) {
        awardTrophyToUser(userId, '656e944c822995ca3fc2cffc');
        // Achieved!
        updateUserLevel(5000, user.id, achievement);
        updateUserStars(10, user.id, achievement);
      }
      
      achievement.progress = newProgress;
    }
  }
  return updateUserAchievementProgress('656e944c822995ca3fc2cffc', userId, updateProgress);
};

const updateStarTrooperAchievement = async (userId) => {
  console.log("StarTrooper")
  const updateProgress = (user, achievement) => {
    if (achievement.progress < 100) {
      let newProgress = Math.min(achievement.progress + 20, 100);
      
      if (newProgress >= 100) {
        awardTrophyToUser(userId, '656e946e822995ca3fc2cffd');
        // Achieved!
        updateUserLevel(5000, user.id, achievement);
        updateUserStars(10, user.id, achievement);
      }
      
      achievement.progress = newProgress;
    }
  }
  return updateUserAchievementProgress('656e946e822995ca3fc2cffd', userId, updateProgress);
};

const updateSingularityAchievement = async (userId) => {
  console.log("Singularity")
  const updateProgress = (user, achievement) => {
    if (achievement.progress < 100) {
      let newProgress = Math.min(achievement.progress + 20, 100);
      
      if (newProgress >= 100) {
        awardTrophyToUser(userId, '656e95e3822995ca3fc2cffe');
        // Achieved!
        updateUserLevel(5000, user.id, achievement);
        updateUserStars(10, user.id, achievement);
      }
      
      achievement.progress = newProgress;
    }
  }
  return updateUserAchievementProgress('656e95e3822995ca3fc2cffe', userId, updateProgress);
};


const updatestartAchievement = asyncHandler(async (req, res) => {
  const { id } = req.body;

  // Confirm data
  if (!id) {
    return res.status(400).json({ message: "id required" });
  }

  // Does the user exist to update?
  const user = await User.findOne({ slug: id }).exec();

  if (!user) {
    return res.status(400).json({ message: "User not found" });
  }

  user.achievements[0].complete += 1;

  const updatedUser = await user.save();
  res.status(200).json(updatedUser);
});

module.exports = {
  getAllCrowns,
  getRankedPosts,
  updateLoginAchiev,
  updateDisplayCase,
  //updateStardustAchievement,
  awardTrophyToUser,
  updateLightSeekerAchievement,
  updateStellarWindAchievement,
  updateCosmicTrekkerAchievement,
  updateExpanseExplorerAchievement,
  updateMeteorShowerAchievement,
  updateSatelliteAchievement,
  updateBrightStarAchievement,
  updateStarTrooperAchievement,
  updateSingularityAchievement,
  getTrophyById,
  updateTenStarPostAchievements,
  updatestartAchievement,
  updateWeeklyRankAchievements,
  updateOrbitTrackerAchievement,
  getAonconRankedPosts
}