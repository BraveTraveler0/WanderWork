const User = require('../models/User')
const Tags = require('../models/tags')
const Post = require('../models/posts')
const Join = require('../models/joinlist')
const Career = require('../models/career')
const Comment = require('../models/comments')
const Achievements = require('../models/achievements')
const { updateStellarWindAchievement, updateMeteorShowerAchievement, updateOrbitTrackerAchievement, updateSatelliteAchievement } = require('./achievementsController.js');
const { updateUserLevel, getUserLevel } = require('./xpController.js');
const { updateUserStars } = require('./starsController.js');
const asyncHandler = require('express-async-handler')
const bcrypt = require('bcrypt')
const axios = require('axios')
const AWS = require('aws-sdk');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createNotification } = require('./notificationsController.js');

// @desc Get all users
// @route GET /users
// @access Private
const getAllUsers = asyncHandler(async (req, res) => {
    // Get all users from MongoDB
    const users = await User.find().select('-password').lean()

    // If no users 
    if (!users?.length) {
        return res.status(400).json({ message: 'No users found' })
    }

    res.json(users)
})

const getUserByQuery = asyncHandler(async (req, res) => {
    try {
        const { searchQuery } = req.body; // Extract searchQuery from the request body

        const users = await User.find({ displayName: { $regex: searchQuery, $options: 'i' } }).select('-password').lean();

        if (!users?.length) {
            return res.status(400).json({ message: 'No users found' });
        }

        res.json(users);
    } catch (error) {
        console.error('Error fetching users by search query:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

/*const initAonCon2024 = asyncHandler(async (req, res) => {
    const id = req.params.id;
  
    console.log(id, "initaoncon");
  
    // Check if aoncon2024 already exists for the user
    const user = await User.findById(id);
    console.log(user.aoncon2024)
    if (user && user.aoncon2024) {
      // aoncon2024 already exists, so do nothing
      console.log("aoncon2024 already exists for the user");
      return res.status(200).json({
        success: true,
        data: user
      });
    }
  
    // Find the user and update their document
    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        $set: {
            aoncon2024: {
              cosplayVote: false,
              smash: false,
              raffle: false,
              plushie: false,
              sneaker: false,
              art: false,
              fashion: false,
              love: false,
              crackCode: false,
              followBeltline: false,
              followAon: false,
              captureMoment: false,
              dance: false,
              nonCosplay: false
            }
          }
      },
      { new: true } // This option returns the updated document
    );
  
    if (!updatedUser) {
      res.status(404);
      throw new Error('User not found');
    }
  
    console.log("aoncon2024 initialized successfully");
  
    res.status(200).json({
      success: true,
      data: updatedUser
    });
  });*/

  const updateEvents = asyncHandler(async (req, res) => {
    const id = req.params.id;

    try {
        // Define the new event data to replace the entire array
        const updateData = [{
            cosplayVote: req.body.cosplayVote,
            smash: req.body.smash,
            raffle: req.body.raffle,
            plushie: req.body.plushie,
            sneaker: req.body.sneaker,
            art: req.body.art,
            fashion: req.body.fashion,
            love: req.body.love,
            crackCode: req.body.crackCode,
            followBeltline: req.body.followBeltline,
            followAon: req.body.followAon,
            captureMoment: req.body.captureMoment,
            dance: req.body.dance,
            nonCosplay: req.body.nonCosplay,
            date: Date.now() // Timestamp for the new entry
        }];

        const aonconStars = req.body.star;

        // First, find the user to get the current stars value
        const user = await User.findById(id);

        user.stars = user.stars + aonconStars;

        await user.save();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update the aoncon2024 array
        const updatedUser = await User.findByIdAndUpdate(
            id,
            { $set: { aoncon2024: updateData } },
            { new: true }
        );

        res.status(200).json({
            success: true,
            data: updatedUser.aoncon2024,
            message: 'Events updated successfully'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating events',
            error: error.message
        });
    }
});

const updateEventTutorial = asyncHandler(async (req, res) => {
    const id = req.params.id;
    
    try {
        // Define the new event data to replace the entire array
        const updateData = [{
            cosplayVote: req.body.cosplayVote,
            profimage: req.body.profimage,
            username: req.body.username,
            color: req.body.color,
            newperson: req.body.newperson,
            igscreenshot: req.body.igscreenshot
        }];

        const aonconStars = req.body.star;

        // First, find the user to get the current stars value
        const user = await User.findById(id);

        user.stars = user.stars + aonconStars;

        await user.save();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update the aoncon2024 array
        const updatedUser = await User.findByIdAndUpdate(
            id,
            { $set: { aonconeventtut: updateData } },
            { new: true }
        );

        res.status(200).json({
            success: true,
            data: updatedUser.aonconeventtut,
            message: 'EventTut updated successfully'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating eventtut',
            error: error.message
        });
    }
});

const getSupportingUsers = asyncHandler(async (req, res) => {
    const id = req.params.id;
  
    try {
      // Get the user by ID
      const user = await User.findById(id).select('-password').lean();
  
      // If no user is found
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Extract slugs from the supporting array
      const slugs = user.supporting.map((support) => support);
      console.log(slugs);
  
      // If no slugs
      if (!slugs.length) {
        return res.status(400).json({ message: 'No slugs found in supporting array' });
      }
  
      // Find users with matching slugs in the database
      const matchingUsers = await User.find({ _id: { $in: slugs } }).select('-password').lean();
  
      // If no matching users
      if (!matchingUsers.length) {
        // Perform a new query to find users by _id using the slugs value
        const usersById = await User.find({ _id: { $in: slugs } }).select('-password').lean();
  
        // Handle the result of the new query
        if (usersById.length > 0) {
          // Users found by _id
          return res.json(usersById);
        } else {
          // No users found by _id
          return res.status(400).json({ message: 'No matching users found' });
        }
      }
  
      res.json(matchingUsers);
    } catch (error) {
      console.error('Error fetching supporting users:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  const getFollowingUsers = asyncHandler(async (req, res) => {
    const id = req.params.id;
  
    try {
      // Get the user by ID
      const user = await User.findById(id).select('-password').lean();
  
      // If no user is found
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Extract slugs from the following array
      const slugs = user.following.map((follow) => follow);
  
      // If no slugs
      if (!slugs.length) {
        return res.status(400).json({ message: 'No slugs found in the following array' });
      }
  
      // Find users with matching slugs in the database
      const matchingUsers = await User.find({ _id: { $in: slugs } }).select('-password').lean();
  
      // If no matching users
      if (!matchingUsers.length) {
        // Perform a new query to find users by _id using the slugs value
        const usersById = await User.find({ _id: { $in: slugs } }).select('-password').lean();
  
        // Handle the result of the new query
        if (usersById.length > 0) {
          // Users found by _id
          console.log('Users found by _id:', usersById);
          return res.json(usersById);
        } else {
          // No users found by _id
          console.log('No users found by _id.');
          return res.status(400).json({ message: 'No matching users found' });
        }
      }
  
      res.json(matchingUsers);
    } catch (error) {
      console.error('Error fetching following users:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

const getTagById = asyncHandler(async (req, res) => {
    const tagName = req.params.tag.toLowerCase(); // get the tag name from the request parameters

    // Find the tag by name
    const tag = await Tags.findOne({ tag: tagName }).lean();
    if (!tag) {
        return res.status(400).json({ message: 'Tag not found' });
    }

    res.json({ tagId: tag._id });
});

// @desc Create new user
// @route POST /users
// @access Private
const createNewUser = asyncHandler(async (req, res) => {
    const { email, password, displayName, slug } = req.body

    // Confirm data
    if (!email || !password) {
        return res.status(400).json({ message: 'All fields are required' })
    }

    // Check for duplicate username
    const duplicate = await User.findOne({ email }).lean().exec()

    if (duplicate) {
        return res.status(409).json({ message: 'Duplicate email' })
    }

    // Hash password 
    const hashedPwd = await bcrypt.hash(password, 10) // salt rounds

    // Fetch all achievements from the database
    const achievements = await Achievements.find().lean().exec();

    // Create an array of achievements for the user
    const userAchievements = achievements.map(({ _id, crown, goal }) => ({
        id: _id,
        crown,
        goal,
    }));

    const tags = [
    "Photography",
    "Comics",
    "Anime",
    "AI Art",
    "Film",
    "Travel",
    "NSFW",
    "Painting",
    "Video Games",
    "Sci-Fi",
    "Memes",
    "Sports",
    "History",
    "Music",
    "Cosplay",
    "Concept Art",
    "Fashion",
    "Manga",
    "Classical",
    "Traditional Art",
    "Digital Art (Non AI)",
    "Abstract & Modeling",
    "Cartoons",
    "Design",
    "Nature & Science"
    ]

    const userObject = { email, "password": hashedPwd, displayName, slug, stars: 5, achievements: userAchievements, tags, profileImage: "/images/2cc849b35837ccb7f4c968159b626a24", backImage: "/images/062a789423f6fe6e937f568ac9b73f76" }

    // Create and store new user 
    const user = await User.create(userObject)

    const stripeUser = await stripe.customers.create(
        {
            email,
            name: displayName,
        });
    user.stripeId = stripeUser.id;
    await user.save();

    if (user) { //created 
        res.status(201).json({ message: `New user ${email} created` })
    } else {
        res.status(400).json({ message: 'Invalid user data received' })
    }
})


//add user to maillist 
const createNewMailer = asyncHandler(async (req, res) => {
    const { email, name } = req.body

    // Confirm data
    if (!email || !name) {
        return res.status(400).json({ message: 'All fields are required' })
    }

    // Check for duplicate username
    const duplicate = await User.findOne({ email }).lean().exec()

    if (duplicate) {
        return res.status(409).json({ message: 'Duplicate email' })
    }

    const userObject = { email, name }

    // Create and store new user 
    const user = await Join.create(userObject)

    if (user) { //created 
        res.status(201).json({ message: `Welcome ${email} you have been added to AON Mailer. Please stand by for updates on the cool space launch since Apollo 11` })
    } else {
        res.status(400).json({ message: 'Invalid user data received, Please check provided information for errors.' })
    }
})

const createCareerCandidate = asyncHandler(async (req, res) => {
    const { email, name, title, salary, comment, resume } = req.body

    // Confirm data
    if (!email || !name) {
        return res.status(400).json({ message: 'All fields are required' })
    }

    // Check for duplicate username
    const duplicate = await User.findOne({ email }).lean().exec()

    if (duplicate) {
        return res.status(409).json({ message: 'Duplicate email' })
    }

    const userObject = { email, name, title, salary, comment, resume }

    // Create and store new user 
    const user = await Career.create(userObject)

    if (user) { //created 
        res.status(201).json({ message: `Welcome ${email} you have been added to AON Career Pool. Please stand by for updates on the cool space launch since Apollo 11` })
    } else {
        res.status(400).json({ message: 'Invalid user data received, Please check provided information for errors.' })
    }
})


// @desc Update a user
// @route PATCH /users
// @access Private
const updateUser = asyncHandler(async (req, res) => {
    const { id, title, titleTut } = req.body

    // Confirm data 
    if (!id || !title) {
        return res.status(400).json({ message: 'Both id and title fields are required' })
    }

    // Does the user exist to update?
    const user = await User.findById(id).exec()

    if (!user) {
        return res.status(400).json({ message: 'User not found' })
    }

    user.title = title
    user._id = id
    user.titleTut = titleTut

    const updatedUser = await user.save()

    res.json({ message: `${updatedUser.displayName} updated` })
})

const updateBgColor = asyncHandler(async (req, res) => {
    const { id, bgColor } = req.body

    console.log(id)
    console.log(bgColor)

    // Confirm data 
    if (!id || !bgColor) {
        return res.status(400).json({ message: 'Both id and bgColor fields are required' })
    }

    // Does the user exist to update?
    const user = await User.findById(id).exec()

    if (!user) {
        return res.status(400).json({ message: 'User not found' })
    }

    user.bgColor = bgColor
    user._id = id

    const updatedUser = await user.save()

    res.json({ message: `${updatedUser.displayName} updated` })
})

const updateDisplayname = asyncHandler(async (req, res) => {
    const { id, displayName, slug } = req.body

    // Confirm data 
    if (!id || !displayName) {
        return res.status(400).json({ message: "Both id and displayname fields are required" });
    }

    const existingUser = await User.findOne({ displayName }).exec();
    if (existingUser && existingUser._id.toString() !== id) {
        return res.status(400).json({ message: "Displayname already in use, please enter a different one" });
    }

    // Does the user exist to update?
    const user = await User.findById(id).exec();

    if (!user) {
        return res.status(400).json({ message: "User not found" });
    }

    // Update posts with old displayName to new displayName
    await Post.updateMany({ slug: slug }, { user: displayName });

    user.displayName = displayName;
    user._id = id;

    const updatedUser = await user.save();

    res.json({ message: `${updatedUser.displayName} updated` });
});

const updateBio = asyncHandler(async (req, res) => {
    const { id, bio, bioTut } = req.body

    // Confirm data 
    if (!id || !bio) {
        return res.status(400).json({ message: 'Both id and bio fields are required' })
    }

    // Does the user exist to update?
    const user = await User.findById(id).exec()

    if (!user) {
        return res.status(400).json({ message: 'User not found' })
    }

    user.bio = bio
    user.bioTut = bioTut

    const updatedUser = await user.save()

    res.json({ message: `${updatedUser.bio} updated` })
})

const updatePostTut = asyncHandler(async (req, res) => {
    const { id, postTut } = req.body

    // Confirm data 
    if (!id) {
        return res.status(400).json({ message: 'Both id and bio fields are required' })
    }

    // Does the user exist to update?
    const user = await User.findById(id).exec()

    if (!user) {
        return res.status(400).json({ message: 'User not found' })
    }

    user.postTut = postTut

    const updatedUser = await user.save()

    res.json({ message: `${updatedUser.postTut} updated` })
})

const updateProfpic = asyncHandler(async (req, res) => {
    const { id, profImageTut } = req.body

    // Confirm data 
    if (!id) {
        return res.status(400).json({ message: 'Both id and img fields are required' })
    }

    // Does the user exist to update?
    const user = await User.findById(id).exec()

    if (!user) {
        return res.status(400).json({ message: 'User not found' })
    }

    user.profImageTut = profImageTut;

    const updatedUser = await user.save()

    res.json({ message: `${updatedUser.profileImage} updated` })
});

const updateBackgroundpic = asyncHandler(async (req, res) => {
    const { id, backImage, backImageTut } = req.body


    // Confirm data 
    if (!id) {
        return res.status(400).json({ message: 'Both id and img fields are required' })
    }

    // Does the user exist to update?
    const user = await User.findById(id).exec()

    if (!user) {
        return res.status(400).json({ message: 'User not found' })
    }

    user.backImage = backImage;
    user.backImageTut = backImageTut;

    const updatedUser = await user.save()

    res.json({ message: `${updatedUser.backImage} updated` })
});

const updateFollowing = asyncHandler(async (req, res) => {
    const { id, slug, objId } = req.body;
    console.log(id, slug, objId)

    // Confirm data
    if (!id || !slug) {
        return res.status(400).json({ message: "Both id and slug fields are required" });
    }

    // Does the user exist to update?
    const user = await User.findById(id).exec();

    if (!user) {
        return res.status(400).json({ message: "User not found" });
    }

    console.log('a')
    
    user._id = id;

    user.following.push(objId);
    
    updateSatelliteAchievement(id);

    const updatedUser = await user.save();

    const otherId = slug

    // Find the otheruser by slug and update their followers
    let otheruser;

    if (otherId) {
        otheruser = await User.findById(objId).exec();
    } else {
        otheruser = await User.findOne({ slug: otherId }).exec();
    }
    console.log(otheruser)

    if (otheruser) {
        otheruser.followers.push(id);
        await otheruser.save();
        updateStellarWindAchievement(otheruser._id);
    }

    await updateUserLevel(50, id);
    updateUserLevel(100, otherId);
    updateUserStars(3, otherId);

    if (slug && user) {
        // Call createNotification with the correct parameters
        await createNotification({
            senderSlug: user._id,
            recipSlug: otheruser._id,
            action: 'Followed you'
        }, res);
      }

    res.json({ following: updatedUser.following, message: `${updatedUser.following} updated`, updates: { levelUpdate: await getUserLevel(id)} });
});

const updateUnfollowing = asyncHandler(async (req, res) => {
    const { id, removeSlug, objId } = req.body

    console.log(id, removeSlug, objId)

    // Confirm data 
    if (!id || !removeSlug) {
        return res.status(400).json({ message: "Both id and slug fields are required" });
    }

    // Does the user exist to update?
    const user = await User.findById(id).exec();

    if (!user) {
        return res.status(400).json({ message: "User not found" });
    }

    user._id = id;

    console.log(removeSlug)
    const index = user.following.findIndex(slug => slug === removeSlug);
    if (index !== -1) {
        user.following.splice(index, 1);
        await user.save()
    }

    const otherId = removeSlug;

    let otheruser;

    if (otherId) {
    otheruser = await User.findById(objId).exec();
    } else {
    otheruser = await User.findOne({ slug: otherId }).exec();
    }
    console.log(otheruser)

    const otherindex = otheruser.followers.findIndex(slug => slug === id);
    if (otherindex !== -1) {
        otheruser.followers.splice(otherindex, 1);
        await otheruser.save();
    }

    updateUserLevel(-100, otherId);
    updateUserStars(-3, otherId);
    await updateUserLevel(-50, id);

    res.json({ following: user.following, updates: { levelUpdate: await getUserLevel(id) }, });
});

const updateSupporting = asyncHandler(async (req, res) => {
    const { id, slug, objId } = req.body;
    if (!id || !slug) {
        return res.status(400).json({ message: "Both id and slug fields are required" });
    }

    // Does the user exist to update?
    const user = await User.findById(id).exec();

    if (!user) {
        return res.status(400).json({ message: "User not found" });
    }

    user._id = id;
    user.supporting.push(slug);
    updateOrbitTrackerAchievement(id);
    console.log(slug)
    const updatedUser = await user.save();
    const otherId = slug
    // Find the otheruser by slug and update their followers
    let otheruser;

    if (otherId) {
    otheruser = await User.findById(objId).exec();
    } else {
    otheruser = await User.findOne({ slug: otherId }).exec();
    }
    console.log(otheruser)
    if (otheruser) {
        otheruser.supporters.push(id);
        updateMeteorShowerAchievement(otheruser.id);
        await otheruser.save();
    }

    updateUserLevel(100, slug);
    updateUserStars(10, slug);
    await updateUserLevel(50, id);

    if (slug && user) {
        // Call createNotification with the correct parameters
        await createNotification({
            senderSlug: user._id,
            recipSlug: otheruser._id,
            action: 'Supported you'
        }, res);
      }

    res.json({ supporting: updatedUser.supporting, message: `${updatedUser.supporting} updated`, updates: { levelUpdate: await getUserLevel(id) }, });
});
const updateUnsupporting = asyncHandler(async (req, res) => {
    const { id, removeSlug, objId } = req.body

    // Confirm data 
    if (!id || !removeSlug) {
        return res.status(400).json({ message: "Both id and slug fields are required" });
    }

    // Does the user exist to update?
    const user = await User.findById(id).exec();

    if (!user) {
        return res.status(400).json({ message: "User not found" });
    }

    user._id = id;
    const index = user.supporting.findIndex(slug => slug === removeSlug);
    if (index !== -1) {
        user.supporting.splice(index, 1);
        await user.save()
    }

    const otherId = removeSlug;

    let otheruser;

    if (otherId) {
    otheruser = await User.findById(objId).exec();
    } else {
    otheruser = await User.findOne({ slug: otherId }).exec();
    }
    console.log(otheruser)

    const otherindex = otheruser.supporters.findIndex(slug => slug === id);
    if (otherindex !== -1) {
        otheruser.supporters.splice(otherindex, 1);
        await otheruser.save();
    }

    updateUserLevel(-100, removeSlug);
    updateUserStars(-10, removeSlug);
    await updateUserLevel(-50, id);
    res.json({ supporting: user.supporting, updates: { levelUpdate: await getUserLevel(id) }});
});


const updateCreateTagFollowing = asyncHandler(async (req, res) => {
    const { id, tags } = req.body;

    // Confirm data 
    if (!id || !tags || !Array.isArray(tags)) {
        return res.status(400).json({ message: "Both id and tags fields are required and tags must be an array" });
    }

    try {
        // Retrieve the user by id
        const user = await User.findById(id).exec();

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        // Update user's tags field with the entire array of tags
        user.tags = tags;

        // Save the updated user
        const updatedUser = await user.save();

        res.json({ message: `${updatedUser.tags.length} tags following updated` });
    } catch (error) {
        console.error('Error updating user tags:', error);
        res.status(500).json({ message: "Internal server error" });
    }
});

const getUserTags = asyncHandler(async (req, res) => {
    const { id } = req.params; // Assuming id is passed as a route parameter

    // Confirm data 
    if (!id) {
        return res.status(400).json({ message: "User ID is required" });
    }

    try {
        // Retrieve the user by id
        const user = await User.findById(id).exec();

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Return the tags array to the frontend
        res.json({ tags: user.tags });
    } catch (error) {
        console.error('Error retrieving user tags:', error);
        res.status(500).json({ message: "Internal server error" });
    }
});

const removeTagsFromUser = asyncHandler(async (req, res) => {
    const { id, tagsToRemove } = req.body;

    // Confirm data
    if (!id || !tagsToRemove || !Array.isArray(tagsToRemove)) {
        return res.status(400).json({ message: "Both id and tagsToRemove fields are required, and tagsToRemove must be an array" });
    }

    // Does the user exist to update?
    const user = await User.findOne({ slug: id }).exec();

    if (!user) {
        return res.status(400).json({ message: "User not found" });
    }

    user.tags = user.tags.filter(existingTag => !tagsToRemove.some(tagToRemove => tagToRemove.tagId === existingTag.tagId));

    const updatedUser = await user.save();

    res.json({ message: updatedUser });
});

const removePreference = asyncHandler(async (req, res) => {
    const { id, tag } = req.body;

    console.log(id, tag)

    // Confirm data
    if (!id || !tag) {
        return res.status(400).json({ message: "Both id and tag fields are required" });
    }

    try {
        // Retrieve the user by id
        const user = await User.findById(id).exec();

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Remove the tag from the user's tags array
        user.tags = user.tags.filter(existingTag => existingTag !== tag);

        // Save the updated user
        const updatedUser = await user.save();

        // Return the updated user's tags array to the frontend
        res.json({ tags: updatedUser.tags });
    } catch (error) {
        console.error('Error removing user tag:', error);
        res.status(500).json({ message: "Internal server error" });
    }
});

const tutcomplete = asyncHandler(async (req, res) => {
    const { id, tutcomplete } = req.body

    // Confirm data 
    if (!id) {
        return res.status(400).json({ message: 'Both id and tutcomplete fields are required' })
    }

    // Does the user exist to update?
    const user = await User.findById(id).exec()

    if (!user) {
        return res.status(400).json({ message: 'User not found' })
    }

    if (tutcomplete) {
        user.tutcomplete = tutcomplete;
        user.tutview = false;
        user.stars = (user.stars || 0) + 5;
    }

    const updatedUser = await user.save()

    res.json({ message: `${updatedUser.tutcomplete} updated` })
});

const updateStars = asyncHandler(async (req, res) => {
    const { id, stars } = req.body;

    // Confirm data
    if (!id) {
        return res.status(400).json({ message: 'Both id and stars fields are required' });
    }

    // First try to find the user by slug
    let user = await User.findOne({ slug: id }).exec();

    // If the user wasn't found, try to find by ID
    if (!user) {
        user = await User.findById(id).exec();
    }

    // If the user is still not found, return an error
    if (!user) {
        return res.status(400).json({ message: 'User not found' });
    }

    // If stars were provided, update the user's stars
    if (stars) {
        user.stars = stars;
    }

    // Save the updated user data
    const updatedUser = await user.save();

    // Send the response with the updated stars
    res.json({ message: `${updatedUser.stars} stars updated` });
});

// @desc Delete a user
// @route DELETE /users
// @access Private
const deleteUser = asyncHandler(async (req, res) => {
    const { email, id, password } = req.body || {};

    if (req.user?.email) {
        const authEmail = String(req.user.email).trim().toLowerCase();
        const authId = req.user._id || req.user.id;
        const deletedUser = await User.findOneAndDelete({
            $or: [
                ...(authId ? [{ _id: authId }] : []),
                { email: authEmail },
            ],
        });

        if (!deletedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        try {
            const Candidates = require('../models/JobSeeker/jobSeeker.Candidate');
            await Candidates.deleteMany({ email: authEmail });
        } catch (error) {
            console.warn('Deleted user but failed to delete candidate profile:', error.message);
        }

        return res.json({ success: true, message: 'User deleted successfully' });
    }

    // Confirm data
    if (!id || !email || !password) {
        return res.status(400).json({ message: 'User ID, email, and password are required' });
    }

    try {
        // Find the user by email
        const user = await User.findOne({ email });

        // If user not found
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if password matches
        const isPasswordMatch = await user.comparePassword(password);

        if (!isPasswordMatch) {
            return res.status(400).json({ message: 'Incorrect password' });
        }

        // Check if the id passed in matches the id of the user found
        if (user._id.toString() !== id) {
            return res.status(400).json({ message: 'Invalid user ID, please contact support' });
        }

        // Delete the user
        const deletedUser = await User.findOneAndDelete({ _id: id });

        if (!deletedUser) {
            return res.status(500).json({ message: 'Error deleting user' });
        }

        const reply = `Username ${deletedUser.displayName} with ID ${deletedUser._id} deleted`;
        res.json(reply);
    } catch (error) {
        console.error('Error deleting user:', error);
        return res.status(500).json({ message: 'Server Error', error });
    }
});

// Configure AWS credentials and region
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    region: process.env.AWS_BUCKET_REGION
});

const s3 = new AWS.S3();

const updateQrcode = asyncHandler(async (req, res) => {
    const { id } = req.body;

    // Confirm data
    if (!id) {
        return res.status(400).json({ message: 'Both id and tutcomplete fields are required' });
    }

    // Does the user exist to update?
    const user = await User.findById(id).exec();

    if (!user) {
        return res.status(400).json({ message: 'User not found' });
    }

    // Check if the user already has a QR code
    if (user.qrcode) {
        return res.json({ message: 'User already has a QR code', user });
    }

    const landingPage = `https://aon-286p.vercel.app/${id}`;

    // Build the QR code URL
    const qrCodeUrl = `http://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(landingPage)}&size=200x200&margin=6&color=04d9ff`;

    try {
        // Send a GET request to the QR code URL
        const response = await axios.get(qrCodeUrl, { responseType: 'arraybuffer' });

        // Upload the QR code image to S3 bucket
        const uploadParams = {
            Bucket: 'aonverse',
            Key: `qr-codes${id}.png`, // Specify the file name
            Body: response.data,
            ContentType: 'image/png' // Adjust the content type based on your image format
        };

        await s3.upload(uploadParams).promise();

        // Store the key in the user's qrcode field
        user.qrcode = `/images/qr-codes${id}.png`;
        await user.save();

        // Handle the response as needed, you might want to save it, send it to the client, etc.
        return res.json({ message: 'QR code image uploaded to S3', qrcode: user.qrcode });
    } catch (error) {
        console.error('Error creating QR code:', error);
        return res.status(500).json({ message: 'Error creating QR code' });
    }
});

module.exports = {
    getAllUsers,
    getUserByQuery,
    getSupportingUsers,
    getFollowingUsers,
    getTagById,
    createNewUser,
    updateUser,
    updateDisplayname,
    updateBio,
    updatePostTut,
    updateProfpic,
    updateBackgroundpic,
    updateFollowing,
    updateUnfollowing,
    updateQrcode,
    updateCreateTagFollowing,
    removeTagsFromUser,
    tutcomplete,
    updateStars,
    deleteUser,
    createNewMailer,
    createCareerCandidate,
    updateSupporting,
    updateUnsupporting,
    updateBgColor,
    getUserTags,
    removePreference,
    //initAonCon2024,
    updateEvents,
    updateEventTutorial
}
