const Posts = require('../models/posts.js')
const User = require('../models/User.js')
const Tags = require('../models/tags.js')
const PostRank = require('../models/postranks.js')
const Group = require('../models/groups.js')
const asyncHandler = require('express-async-handler')
const { updateCosmicTrekkerAchievement, updateSingularityAchievement, updateExpanseExplorerAchievement, updateBrightStarAchievement, updateStarTrooperAchievement } = require('./achievementsController.js');
const { updateUserLevel, getUserLevel } = require('./xpController.js');
const { reShareStarUpdate, likeGiveStarUpdate, likeReceiveStarUpdate, postStarUpdate, remixStarUpdate, } = require('./starsController.js');
const { createNotification } = require('./notificationsController.js');
const mongoose = require('mongoose');

// @desc Get all posts
// @route GET /userprofile
// @access Private, app populates list of posts
const getAllPost = asyncHandler(async (req, res) => {
  // Get all posts from MongoDB
  const posts = await Posts.find().select().lean()
  if (!posts?.length) {
    return res.status(400).json({ message: 'No posts found' })
  }
  res.json(posts)
})

const getRankedPostsByPage = asyncHandler(async (req, res) => {
  req.query.page = req.query.page || 0;
  req.query.limit = req.query.limit || 10;
  //filers are : following, supporting, id, tags
  req.query.filter = req.query.filter || 'all';
  const { page, limit, following, supporting, id, tags } = req.query;

  // Build the query object
  const query = {};
  if (following) {
    query.slug = { $in: following.split(',') };
  }
  if (supporting) {
    query.supporting = { $in: supporting.split(',') };
  }
  if (id) {
    query._id = id;
  }
  if (tags) {
    query.tags = { $in: Array.isArray(tags) ? tags.map(tag => ({ tag })) : tags.split(',').map(tag => ({ tag })) };
  }

  // Add conditions to the query
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  query.createdAt = { $gte: startOfToday };

  const postRanks = await PostRank.find(query).sort({ createdAt: -1 }).skip(page * limit).limit(limit).select().lean();
  if (!postRanks?.length) {
    return res.status(400).json({ message: 'No posts found' });
  }

  // Sort posts by PostTime in descending order
  const sortedPosts = postRanks.sort((a, b) => {
    const timeA = new Date(a.PostTime).getTime();
    const timeB = new Date(b.PostTime).getTime();
    return timeB - timeA; // Compare in descending order
  });

  res.json(sortedPosts);
});

const getPostsByPage = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page || 0, 10);
  const limit = parseInt(req.query.pageSize || 10, 10);
  const myProfile = req.query.myProfile === 'true';

  let filters = {};
  try {
    filters = typeof req.query.filters === "string"
      ? JSON.parse(req.query.filters)
      : req.query.filters || {};
  } catch (error) {
    return res.status(400).json({ message: "Invalid filters format" });
  }

  const { following, supporting, id, tags } = filters;
  const query = {};
  const myQuery = {};

  let currentUser = {};
  let myPosts = [];

  if (id) {
    currentUser = await User.findById(id).lean();
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    myQuery.slug = id;

    if (mongoose.Types.ObjectId.isValid(id)) {
      const totalPosts = await Posts.countDocuments(myQuery);
      
      const maxPage = Math.max(0, Math.ceil(totalPosts / limit) - 1);

      myPosts = await Posts.find(myQuery)
        .sort({ createdAt: -1 })
        .skip(page > 0 ? page * limit : 0)
        .limit(limit)
        .lean();
    } else {
      return res.status(400).json({ message: "Invalid user ID format" });
    }
  }

  if(!!myProfile === true){
    if (myPosts && myPosts.length > 0) {
      return res.status(200).json({ posts: myPosts });
    }
  }else{
    const { following: userFollows = [], supporting: userSupports = [], tags: userTags = [] } = currentUser;

    if (typeof following === "string") {
      query.following = { $in: following.split(",") };
    } else if (Array.isArray(following)) {
      query.following = { $in: following };
    } else if (userFollows.length > 0) {
      query.following = { $in: userFollows };
    }

    if (supporting) {
      query.supporting = { $in: Array.isArray(supporting) ? supporting : supporting.split(",") };
    } else if (userSupports.length > 0) {
      query.supporting = { $in: userSupports };
    }

    // Convert tags to an array 
    let tagsArray = [];
    if (tags && typeof tags === "object" && !Array.isArray(tags)) {
      tagsArray = Object.values(tags);
    } else if (Array.isArray(tags)) {
      tagsArray = tags;
    }

    // Use case-insensitive regex for category matching
    if (tagsArray.length > 0) {
      query.category = { 
        $in: tagsArray.map(tag => new RegExp(`^${tag}$`, 'i')) 
      };
      
      console.log('Category Query:', query.category);
    } else if (userTags.length > 0) {
      query.category = { 
        $in: userTags.map(tag => new RegExp(`^${tag}$`, 'i')) 
      };
    }

    try {

      const totalPosts = await Posts.countDocuments(query);
      const maxPage = Math.max(0, Math.ceil(totalPosts / limit) - 1);

      let posts = await Posts.find(query)
        .sort({ createdAt: -1 })
        .skip(page * limit)
        .limit(limit)
        .lean();

      if (!posts || posts.length === 0) {
        return res.status(404).json({ message: "No posts found" });
      }

      res.json({
        posts
      });
    } catch (error) {
      console.error("Error fetching posts:", error.message);
      res.status(500).json({ message: "Error fetching posts" });
    }
  }
});

const getSinglePost = asyncHandler(async (req, res) => {
  const postId = req.params.id; // Assuming the post ID is passed as a route parameter

  // Get the single post from MongoDB using findById
  const post = await Posts.findById(postId).lean();

  // If no post is found
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }

  res.json(post);
});

const filterPostRanksByTimeScale = (postRanks) => {
  const now = new Date();
  return postRanks.filter((postRank) => {
    const createdAt = new Date(postRank.createdAt);
    if (postRank.time_scale === "daily") {
      return (
        createdAt.getDate() === now.getDate() &&
        createdAt.getMonth() === now.getMonth() &&
        createdAt.getFullYear() === now.getFullYear()
      );
    } else if (postRank.time_scale === "weekly") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1);
      const endOfWeek = new Date(now);
      endOfWeek.setDate(now.getDate() + (6 - now.getDay()) + 1);
      return createdAt >= startOfWeek && createdAt <= endOfWeek;
    }
    return false;
  });
};

const getStreamPost = asyncHandler(async (req, res) => {
  // Get all posts from MongoDB
  const { slug } = req.params;

  if (!slug) {
    return res.status(404).json({ message: "Slug is required" });
  }

  const user = await User.findOne({ slug });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const aggregationPipelineForFollowing = [
    {
      $match: {
        rank: { $lte: 20 },
        $or: [{ time_scale: "daily" }, { time_scale: "weekly" }],
        slug: { $in: user.following },
      },
    },
    {
      $lookup: {
        from: "posts",
        localField: "post",
        foreignField: "_id",
        as: "newPost",
      },
    },
    {
      $unwind: "$newPost",
    },
    {
      $addFields: {
        "newPost._id": "$$REMOVE",
        "newPost.tag": "$$REMOVE",
        "newPost.slug": "$$REMOVE",
        "newPost.tags": "$$REMOVE",
        "newPost.PostTime": "$$REMOVE",
        "newPost.createdAt": "$$REMOVE",
        "newPost.__v": "$$REMOVE",
        "newPost.point": "$$REMOVE",
      },
    },
  ];

  const aggregationPipelineForTags = [
    {
      $match: {
        rank: { $lte: 20 },
        $or: [{ time_scale: "daily" }, { time_scale: "weekly" }],
        "tags.id": {
          $in: user.tagFollowing.map((tag) => tag.tagId),
        },
      },
    },
    {
      $lookup: {
        from: "posts",
        localField: "post",
        foreignField: "_id",
        as: "newPost",
      },
    },
    {
      $unwind: "$newPost",
    },
    {
      $addFields: {
        "newPost._id": "$$REMOVE",
        "newPost.tag": "$$REMOVE",
        "newPost.slug": "$$REMOVE",
        "newPost.tags": "$$REMOVE",
        "newPost.PostTime": "$$REMOVE",
        "newPost.createdAt": "$$REMOVE",
        "newPost.__v": "$$REMOVE",
        "newPost.point": "$$REMOVE",
      },
    },
  ];

  const dataFollow = await PostRank.aggregate(aggregationPipelineForFollowing);
  const dataTag = await PostRank.aggregate(aggregationPipelineForTags);

  const postRanks = [];
  let allData = [...dataFollow, ...dataTag];

  allData.map((item) => {
    let newItem = { ...item, ...item.newPost };
    delete newItem.newPost;
    postRanks.push(newItem);
  });

  let TopPost = filterPostRanksByTimeScale(postRanks);


  const uniquePosts = [];
  const seenPosts = new Set();

  TopPost.forEach((item) => {
    if (!seenPosts.has(item.post.toString())) {
      seenPosts.add(item.post.toString());
      uniquePosts.push(item);
    }
  });

  const filteredPosts = await Posts.find({
    $or: [{ NSFW: { $ne: true } }, { NSFW: user.NSFW }],
    $or: [{ slug: { $in: [...user.following, user.slug] } }],
  })
    .sort({ PostTime: -1 })
    .select()
    .lean();


  // If no posts
  if (!filteredPosts?.length && !uniquePosts?.length) {
    return res.status(400).json({ message: "No posts found" });
  }

  const idSet = new Set(filteredPosts.map(item => item._id.toString()));

  const filteredRankPost = uniquePosts.filter((item) => !idSet.has(item.post.toString()));
  filteredRankPost.forEach((item) => {
    item._id = item.post;
  });

  const mergedArray = []
  let frame
  if (filteredPosts.length > filteredRankPost.length) {
    frame = Math.floor(filteredPosts.length / filteredRankPost.length);
    if (frame > 4) {
      frame = 4
    }
    let j = 0;
    for (let i = 0; i < filteredPosts.length; i++) {
      mergedArray.push(filteredPosts[i]);
      if (j < filteredRankPost.length && (i + 1) % frame == 0) {
        mergedArray.push(filteredRankPost[j]);
        j += 1;
      }
    }
  } else {
    frame = Math.floor(filteredRankPost.length / filteredPosts.length);
    if (frame > 4) {
      frame = 4
    }
    let j = 0;
    for (let i = 0; i < filteredRankPost.length; i++) {
      mergedArray.push(filteredRankPost[i]);
      if (j < filteredPosts.length && (i + 1) % frame == 0) {
        mergedArray.push(filteredPosts[j]);
        j += 1;
      }
    }
  }

  res.status(200).json(mergedArray);
});

const getAllTags = asyncHandler(async (req, res) => {
  // Get all posts from MongoDB
  const tags = await Tags.find().select().lean()

  // If no posts 
  if (!tags?.length) {
    return res.status(400).json({ message: 'No tags found' })
  }

  res.json(tags)
})

// @desc Create new post
// @route POST /userprofile
// @access Private, only current user

const createNewPost = asyncHandler(async (req, res) => {
  const { user, text, slug, postimage, postImages ,collaborator, category, nsfw, remix, repost, profileImage, share, visibility, originalPost } = req.body;

  // Confirm data
  if (!user || !text || !slug) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // Convert the slug to ObjectId
  const userId = mongoose.Types.ObjectId(slug);

  // Search for the user using the converted ObjectId
  let userToUpdate = await User.findOne({ _id: userId });
  const groupToUpdate = await Group.findOne({ _id: userId });

  if (!userToUpdate && !groupToUpdate) {
    return res.status(404).json({ message: 'User/Group not found' });
  }

  if(userToUpdate) {
    // Update postTut for the found user
    userToUpdate.postTut = true;
    updateCosmicTrekkerAchievement(userToUpdate);
    await userToUpdate.save();

    const collaboratorObjects = [];

    if (share && collaborator) {
      collaboratorObjects.push({ slug: collaborator.slug, displayName: collaborator.displayName });
    }

    // Convert the array of collaborator objects to an array of slugs
    if (collaborator && Array.isArray(collaborator)) {
      for (const collab of collaborator) {
        const { slug } = collab;
        const collabUser = await User.findOne({ slug }).select('slug displayName');

        if (collabUser) {
          collaboratorObjects.push({ slug: collabUser.slug, displayName: collabUser.displayName });
        }
      }
    }
  }
  /*const tagObjects = [];
  if (tags && Array.isArray(tags)) {
    for (const tag of tags) {
      const { id, tag: tagName } = tag;
      tagObjects.push({ id, tag: tagName });
    }
  }*/

  const postObject = { user, text, slug, category, collaborator: collaborator ? collaborator : collaboratorObjects, NSFW: nsfw, Remix: remix, Repost: repost ?? false, postimage, postImages, profileImage, share, visibility };

  // Create and store new post
  const post = await Posts.create(postObject);

  if (!post) {
    return res.status(400).json({ message: 'Invalid post data received' });
  }

  if (repost) {
  }

  // Remixes are worth 16.667xp while normal are worth 5
if(userToUpdate) {
  if (remix) {
    updateUserLevel(16.667, userToUpdate.id);
    remixStarUpdate(userToUpdate.id);
    console.log("remixstar from postcontroller")
  } else if (repost) {
    updateUserLevel(2.5, userToUpdate.id);
    reShareStarUpdate(userToUpdate.id);
    console.log("reshare from postcontroller")
  } else {
    updateUserLevel(5, userToUpdate.id);
    postStarUpdate(userToUpdate.id);
    console.log("poststar update postscontroller")
  }

  if (remix) {
    const origPost = await Posts.findById(originalPost);
    if (origPost) {
      updateUserLevel(10, origPost.slug);
    }
  }
  
  if(share) {
    const origPost = await Posts.findById(originalPost);
    sharePost(origPost, slug)
  }
}

  res.status(201).json({

  });
});

const createNewPostAuto = async (postData) => {
  const { user, text, slug, postimage, postImages, collaborator, category, nsfw, remix, repost, profileImage, share, visibility, originalPost } = postData;

  console.log(postData)

  // Confirm data
  if (!user || !slug) {
    throw new Error('All fields are required');
  }

  // Convert the slug to ObjectId
  const userId = mongoose.Types.ObjectId(slug);

  console.log(userId, "slug:", slug)

  // Search for the user using the converted ObjectId
  /*try {
    const userToUpdate = await User.findOne({ _id: userId });
  
    if (!userToUpdate) {
      throw new Error('User not found');
    }
  
    console.log('User found:', userToUpdate);
  } catch (err) {
    console.error('Error finding user:', err);
    // You can also log more details if necessary
    console.error('Error message:', err.message);
    console.error('Error stack trace:', err.stack);
  }

  console.log("but not here")

  if (!userToUpdate) {
    throw new Error('User not found');
  }

  // Update postTut for the found user
  userToUpdate.postTut = true;
  await updateCosmicTrekkerAchievement(userToUpdate);
  await userToUpdate.save(); */

  const collaboratorObjects = [];

  if (share && collaborator) {
    collaboratorObjects.push({ slug: collaborator.slug, displayName: collaborator.displayName });
  }

  // Convert the array of collaborator objects to an array of slugs
  if (collaborator && Array.isArray(collaborator)) {
    for (const collab of collaborator) {
      const { slug } = collab;
      const collabUser = await User.findOne({ slug }).select('slug displayName');

      if (collabUser) {
        collaboratorObjects.push({ slug: collabUser.slug, displayName: collabUser.displayName });
      }
    }
  }

  const postObject = { user, text, slug, category, collaborator: collaborator ? collaborator : collaboratorObjects, NSFW: nsfw, Remix: remix, Repost: repost ?? false, postimage, postImages, profileImage, share, visibility };

  // Create and store new post
  const post = await Posts.create(postObject);

  if (!post) {
    throw new Error('Invalid post data received');
  }

  // Remixes are worth 16.667xp while normal are worth 5
  if (remix) {
    await updateUserLevel(16.667, userToUpdate.id);
    await remixStarUpdate(userToUpdate.id);
    console.log("remixstar from postcontroller");
  } else if (repost) {
    await updateUserLevel(2.5, userToUpdate.id);
    await reShareStarUpdate(userToUpdate.id);
    console.log("reshare from postcontroller");
  } else {
    await updateUserLevel(5, userToUpdate.id);
    await postStarUpdate(userToUpdate.id);
    console.log("poststar update postscontroller");
  }

  if (remix) {
    const origPost = await Posts.findById(originalPost);
    if (origPost) {
      await updateUserLevel(10, origPost.slug);
    }
  }

  if(share) {
    const origPost = await Posts.findById(originalPost);
    await sharePost(origPost, slug);
  }

  return post;
};

// @desc Update a post
// @route PATCH /userprofile
// @access Private, only user who created & admin
const updateStars = asyncHandler(async (req, res) => {
  const { id, starDonator, stars, slug } = req.body

  // Confirm data 
  if (!id) {
    return res.status(400).json({ message: 'Post id and user are required' })
  }

  // Does the post exist to update?
  const post = await Posts.findById(id).exec()

  if (!post) {
    return res.status(400).json({ message: 'Post not found' })
  }

  if (stars && starDonator) {
    post.stars += stars;
    if (!post.starDonator.includes(starDonator)) {
      post.starDonator.push(starDonator);
    }
  }

  const updatedPost = await post.save()

  // Find the user in the database and subtract their "stars" by 1
  const userToUpdate = await User.findOne({ $or: [{ _id: starDonator }, { slug: starDonator }] }).exec();
  if (userToUpdate) {
    userToUpdate.stars = Math.max(0, (userToUpdate.stars || 0) - stars);
    await userToUpdate.save();
    updateUserLevel(12, userToUpdate.id, "General xp for giving a star");
    updateBrightStarAchievement(userToUpdate.id);
  }

  // Convert slug to ObjectId
  let userToGiveStarId;
  if (mongoose.Types.ObjectId.isValid(slug)) {
    userToGiveStarId = mongoose.Types.ObjectId(slug);
  }

  // Find the user in the database and add their "stars" by 1
  const userToGiveStar = await User.findOne({ _id: userToGiveStarId }).exec();
  if (userToGiveStar) {
    userToGiveStar.stars = (userToGiveStar.stars || 0) + stars; // Increment stars by 1
    updateExpanseExplorerAchievement(userToGiveStarId);
    await userToGiveStar.save();
    updateUserLevel(25, userToGiveStar.id);
  }

  /*if (shares && shareUsers) {
    if (shares === 1) {
      console.log('1st code ran share')
      post.shares += 1;
      post.shareUsers.push(shareUsers);
    }
  }*/
  
    if (userToUpdate && userToGiveStar) {
      // Call createNotification with the correct parameters
      await createNotification({
          senderSlug: userToUpdate._id,
          recipSlug: userToGiveStar._id,
          action: 'Gave you stars',
          post: post
      }, res);
    }
  res.json({ message: `${updatedPost.user}'s post updated`, updates: { levelUpdate: await getUserLevel(userToUpdate.id),}, })
})

const likePost = asyncHandler(async (req, res) => {
  const { id, likeUser} = req.body

  // Confirm data 
  if (!id) {
    return res.status(400).json({ message: 'Post id and user are required' })
  }

  // Does the post exist to update?
  const post = await Posts.findById(id).exec()

  if (!post) {
    return res.status(400).json({ message: 'Post not found' })
  }

  if (likeUser) {
    if (!post.likesUsers.includes(likeUser)) {
      console.log('1st code ran')
      post.likes += 1;
      post.likesUsers.push(likeUser);
      updateUserLevel(1, likeUser);
      likeGiveStarUpdate(1, likeUser, "likepost");
      updateStarTrooperAchievement(likeUser);
    }
  }

  if (post.slug) {
    updateUserLevel(2, post.slug);
    likeReceiveStarUpdate(1, post.slug, "likepost");
    updateSingularityAchievement(post.slug);
  }
  const updatedPost = await post.save()

  if (likeUser && post) {
    // Call createNotification with the correct parameters
    await createNotification({
        senderSlug: likeUser,
        recipSlug: post.slug,
        action: 'Liked your post',
        post: post
    }, res);
  }

  res.json({ message: `${updatedPost}'s post like updated`, updates: { levelUpdate: await getUserLevel(likeUser)}})
})

const unlikePost = asyncHandler(async (req, res) => {
  const { id, likeUser} = req.body;

  console.log("Gryph Debug!!!");
  console.log(id);
  console.log(likeUser);

  // Confirm data 
  if (!id) {
    return res.status(400).json({ message: 'Post id and user are required' })
  }

  // Does the post exist to update?
  const post = await Posts.findById(id).exec()

  if (!post) {
    return res.status(400).json({ message: 'Post not found' })
  }

  if (post.likesUsers.includes(likeUser)) {
    console.log('code ran')
    post.likes -= 1;
    post.likesUsers = post.likesUsers.filter(userSlug => userSlug !== likeUser);
  }

  const updatedPost = await post.save();
  if (likeUser) {
    updateUserLevel(-1, likeUser);
    likeGiveStarUpdate(-1, likeUser, "unlike");
  }
  if (post?.slug) {
    updateUserLevel(-2, post.slug);
    likeReceiveStarUpdate(-1, post.slug, "unlike");
  }
  res.json({ message: `${updatedPost}'s post unlike updated`, updates: { levelUpdate: await getUserLevel(likeUser)}})
}) 

const updateCommentCount = asyncHandler(async (req, res) => {
  const { id, comments } = req.body

  if (!id || !comments) {
    return res.status(400).json({ message: 'Both id and comments fields are required' })
  }

  const post = await Posts.findById(id).exec()

  if (!post) {
    return res.status(400).json({ message: 'Post not found' })
  }

  post.comments = comments

  const updatedCommentCount = await post.save()

  res.json({ message: `${updatedCommentCount.id} updated` })
})

// @desc Delete a post
// @route DELETE /userprofile
// @access Private, only user who created & admin
const deleteRankedPostIfPostNotExists = async (postId) => {
  try {
    await PostRank.deleteMany({ post: postId });
  } catch (error) {
    console.error('Error deleting rankedposts:', error);
  }
};
const deletePost = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Confirm data
  if (!id) {
    return res.status(400).json({ message: 'Post ID Required' })
  }

  // Does the post exist to delete?
  const post = await Posts.findById(id).exec()

  if (!post) {
    return res.status(400).json({ message: 'Post not found' })
  }

  const result = await post.deleteOne()
  await deleteRankedPostIfPostNotExists(id)
  const reply = `Post by ${result.user} with ID ${result.text} deleted`

  res.json(reply)
})

const sharePost = asyncHandler(async (originalPost, sharedBy, res) => {
  console.log(originalPost, sharedBy)

  // Confirm data 
  if (!originalPost || !sharedBy) {
    return res.status(400).json({ message: 'Post id and sharing user are required' });
  }

  // Find the post in the database
  const post = originalPost;

  // Check if the post has already been shared by the user
  if (post.shareUsers.includes(sharedBy)) {
    return res.status(400).json({ message: 'Post already shared by this user' });
  }

  // Update the post's sharedBy array and increment the shares count
  post.shareUsers.push(sharedBy);
  post.shares = (post.shares || 0) + 1;

  await post.save();

  if (sharedBy && post) {
    // Call createNotification with the correct parameters
    await createNotification({
        senderSlug: sharedBy,
        recipSlug: post.slug,
        action: 'Shared your post',
        post: post
    }, res);
  }

  return { message: `Post with ID ${originalPost._id} shared by ${sharedBy}` };
});

const multer = require('multer');
const upload = multer();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');


const remixPost = async (req, res) => {
    try {
        // Access the image file data from req.file.buffer
        const imageData = req.file.buffer;
        console.log(imageData)

        // Parse the requestData from req.body.json
        const requestData = JSON.parse(req.body.json);

        // Construct JSON payload with the exact content provided
        // Construct JSON payload with the exact content provided
        const jsonPayload = {
          'prompt': requestData.prompt,
          'image\_preprocess\_mode': requestData.image_preprocess_mode,
          'controlnet\_model': requestData.controlnet_model,
          'model': requestData.model,
          'vae': requestData.vae,
          'sampler': requestData.sampler,
          'negative\_prompt': requestData.negative_prompt,
          'max\_image\_size': requestData.max_image_size,
          'controlnet\_scale': requestData.controlnet_scale,
          'guidance\_scale': requestData.guidance_scale,
          'steps': requestData.steps,
          'seed': requestData.seed,
          'clip\_skip': requestData.clip_skip,
          'use\_freeU': requestData.use_freeU,
          'freeU\_config': requestData.freeU_config,
          'canny\_config': requestData.canny_config,
          'MLSD\_config': requestData.MLSD_config
        };

                      // Create FormData object
            const formData = new FormData();

            // Append image file to FormData with filename and content type
            formData.append('image', imageData, {
              filename: 'image.png',
              contentType: 'image/png',
            });

            // Append JSON payload to FormData
            formData.append('json', JSON.stringify(jsonPayload));

            console.log(jsonPayload);

        // POST request to the specified URL
        const apiUrl = 'http://65.29.86.45:6969/controldraw';
        const response = await axios.post(apiUrl, formData, {
          headers: {
              ...formData.getHeaders() // Include headers from FormData object
          },
          responseType: 'arraybuffer' // Ensure that Axios returns binary data
      });
      
      // Log success
      console.log('API call successful');
      
      // Set content type header to indicate that the response is a PNG file
      res.set('Content-Type', 'image/png');
      
      // Send the PNG image data received from the API back to the client
      res.send(response.data);
      
    } catch (error) {
        // Log error and send error response to client
        console.error('Error during API call:', error);
        res.status(500).send('Internal Server Error'); // Handle errors
    }
};

module.exports = {
  getAllPost,
  getAllTags,
  createNewPost,
  updateStars,
  updateCommentCount,
  deletePost,
  getStreamPost,
  getSinglePost,
  likePost,
  unlikePost,
  sharePost,
  remixPost,
  createNewPostAuto,
  getPostsByPage,
  getRankedPostsByPage
}
