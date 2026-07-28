const asyncHandler = require('express-async-handler')
const Group = require('../models/groups')
const jwtUtils = require('../utils/jwtUtils')
const Posts = require("../models/posts");

const createNewGroup = asyncHandler(async (req, res) => {
  const { groupName, admins, groupBio, profimage, backimage, NSFW, tags, bgColor, title  } = req.body;

  // Confirm data (groupName is the only schema-required field; admins must be
  // non-empty since a group needs at least one owner — everything else has a
  // schema default and is legitimately optional)
  if (!groupName || !admins?.length) {
    return res.status(400).json({ message: 'groupName and admins are required' });
  }

  try {
    // Check for duplicate email
    const duplicate = await Group.findOne({ groupName }).lean().exec();

    if (duplicate) {
      return res.status(409).json({ message: 'Duplicate group' });
    }

    const groupObject = { groupName, admins, groupBio, profimage, backimage, NSFW, tags, bgColor, title };

    // Create and store new group
    const group = await Group.create(groupObject);

    // Generate a JWT token for the newly registered group
    const token = jwtUtils.generateToken(group);

    // Add the generated token to the group's collection
    group.token = token;
    await group.save();

    if (!group) {
      return res.status(400).json({ message: 'Invalid group data received' });
    }

    // Respond with the JWT token in addition to the success message
    res.status(201).json({ group: { ...group._doc, token } });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

const getGroupPosts = asyncHandler(async (req, res) => {
  const { category } = req.params;
  const page = parseInt(req.query.page || 0, 10);
  const limit = parseInt(req.query.pageSize || 10, 10);
  const myQuery = {};

  console.log("category here", category, page, limit)

  // Create query object
  myQuery.category = category ;

  // Validate category (similar to ID validation in your example)
  if (category) {
    const totalPosts = await Posts.countDocuments(myQuery);
    const maxPage = Math.ceil(totalPosts / limit) - 1;

    console.log("totalPosts", totalPosts)

    // Ensure page is within valid range
    const validatedPage = Math.min(Math.max(page, 0), maxPage);

    //need to come back to this and update handling of no posts
    if (totalPosts > 0){
      const posts = await Posts.find(myQuery)
        .sort({ createdAt: -1 })
        .skip(validatedPage * limit)
        .limit(limit)
        .lean();

      res.json({ posts });
      console.log(posts)
    }else{
      return res.status(200).json([]);
    }  
  } else {
    return res.status(400).json({ message: "Invalid category" });
  }
});

const getGroupById = asyncHandler(async (req, res) => {
    const identifier = req.params.id; // Change identifier to id

    try {
        let group;

        // Check if the identifier is a valid ObjectId (assumes MongoDB ObjectId)
        if (/^[a-fA-F0-9]{24}$/.test(identifier)) {
            group = await Group.findById(identifier).select('-password').lean();
        }

        // If no group found
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        res.json(group);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

const getAllGroups = asyncHandler(async (req, res) => {
    // Get all groups from MongoDB
    const groups = await Group.find().select('-password').lean()

    // If no groups 
    if (!groups?.length) {
        return res.status(400).json({ message: 'No groups found' })
    }

    res.json(groups)
})

const getGroupByQuery = asyncHandler(async (req, res) => {
    const { searchQuery } = req.body

    // Get all groups from MongoDB that match the query
    const groups = await Group.find({
      groupName: { $regex: new RegExp(searchQuery.toLowerCase(), 'i') }
    }).lean();

    // If no groups
    if (!groups?.length) {
        return res.status(200).json([])
    }

    res.json(groups)
})

module.exports = {
    createNewGroup,
    getGroupById,
    getAllGroups,
    getGroupByQuery,
    getGroupPosts
}