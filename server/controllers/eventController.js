const asyncHandler = require('express-async-handler');
const { Events, UserMission } = require('../models/events');
const User = require('../models/User');
const mongoose = require('mongoose');
const jwtUtils = require('../utils/jwtUtils');

const createEvent = asyncHandler(async (req, res) => {
  // Extract all fields from request body
  const { 
    eventName, 
    admins, 
    eventBio,
    callToAction, 
    title, 
    NSFW, 
    tags, 
    bgColor, 
    missions, 
    quest,
    codes, 
    eventStart, 
    eventEnd 
  } = req.body;

  // Handle image files if they exist in the request
  const eventProfImage = req.files?.eventProfImage ? {
    data: req.files.eventProfImage.data,
    contentType: req.files.eventProfImage.mimetype
  } : undefined;

  const eventBackImage = req.files?.eventBackImage ? {
    data: req.files.eventBackImage.data,
    contentType: req.files.eventBackImage.mimetype
  } : undefined;

  // Confirm required data
  if (!eventName || !admins) {
    return res.status(400).json({ message: 'Event name and admins are required' });
  }

  try {
    // Check for duplicate event name
    const duplicate = await Events.findOne({ eventName }).lean().exec();

    if (duplicate) {
      return res.status(409).json({ message: 'Event with this name already exists' });
    }

    // Prepare mission data if provided
    const missionData = missions ? missions.map((mission, index) => {
      // Process mission icon if provided
      let missionIcon = undefined;
      if (mission.icon) {
        missionIcon = {
          data: Buffer.from(mission.icon.data || '', 'base64'),
          contentType: mission.icon.contentType || 'image/png'
        };
      }

      // Set type-specific fields based on the 'type' value
      let missionType = {};
      if (mission.type === 'contest') {
        missionType = "contest";
      } else if (mission.type === 'optin') {
        missionType = "optin";
      } else if (mission.type === 'hasPost') {
        missionType = "hasPost";
      } else {
        missionType = "none";
      }

      return {
        title: mission.title,
        description: mission.description,
        stars: mission.stars,
        starValue: mission.starValue || 1,
        ...missionType,
        icon: missionIcon,
        type: missionType,
        tag: mission.tag || null,
        key: mission.key || index + 1, // Assign keys if not provided
        active: mission.active !== undefined ? mission.active : true,
        createdAt: mission.createdAt || new Date(),
        updatedAt: mission.updatedAt || new Date()
      };
    }) : [];

    // Process quest images if provided
    let questData = null;
    if (quest) {
      const questImage = req.files?.questImage ? {
        data: req.files.questImage.data,
        contentType: req.files.questImage.mimetype
      } : undefined;

      questData = {
        quest1: quest.quest1 || null,
        quest2: quest.quest2 || null,
        quest3: quest.quest3 || null,
        quest4: quest.quest4 || null,
        quest5: quest.quest5 || null,
        questImage
      };
    }

    // Convert codes to Map if provided
    const codesMap = codes ? new Map(Object.entries(codes)) : new Map();

    // Create event object
    const eventObject = { 
      eventName, 
      admins: Array.isArray(admins) ? admins : [admins], // Ensure admins is an array
      eventBio: eventBio || "Who are you, brave traveler?", 
      callToAction: callToAction,
      title,
      eventProfImage,
      eventBackImage,
      followers: [],
      supporters: [],
      active: true,
      NSFW: NSFW !== undefined ? NSFW : true, 
      tags: tags || [], 
      bgColor, 
      missions: missionData,
      quest: questData,
      codes: codesMap,
      eventStart: eventStart ? new Date(eventStart) : undefined,
      eventEnd: eventEnd ? new Date(eventEnd) : undefined
    };

    // Create and store new event
    const event = await Events.create(eventObject);

    if (!event) {
      return res.status(400).json({ message: 'Invalid event data received' });
    }

    // Generate a JWT token for the newly created event
    const token = jwtUtils.generateToken(event);

    // Add the generated token to the event's collection
    event.token = token;
    await event.save();

    // Return a clean response without binary image data for better performance
    const responseEvent = {
      ...event._doc,
      eventProfImage: event.eventProfImage ? {
        contentType: event.eventProfImage.contentType,
        exists: !!event.eventProfImage.data
      } : null,
      eventBackImage: event.eventBackImage ? {
        contentType: event.eventBackImage.contentType,
        exists: !!event.eventBackImage.data
      } : null,
      missions: event.missions.map(mission => ({
        ...mission._doc,
        icon: mission.icon ? {
          contentType: mission.icon.contentType,
          exists: !!mission.icon.data
        } : null
      })),
      quest: event.quest ? {
        ...event.quest._doc,
        questImage: event.quest.questImage ? {
          contentType: event.quest.questImage.contentType,
          exists: !!event.quest.questImage.data
        } : null
      } : null
    };

    // Respond with the event data including the token
    res.status(201).json({ event: { ...responseEvent, token } });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

/**
 * Get all events
 */
const getAllEvents = asyncHandler(async (req, res) => {
  try {
    const events = await Events.find().lean();
    res.json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

/**
 * Get event by ID
 */
const getEventById = asyncHandler(async (req, res) => {
  try {
    const event = await Events.findById(req.params.id).lean();
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    res.json(event);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

const completeMission = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { missionKey, userId, missionType, metadata = {} } = req.body;
    
    if (!userId || !eventId || !missionKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID, Event ID, and Mission Key are required' 
      });
    }
    
    // Validate the event exists
    const event = await Events.findById(eventId);
    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }
    
    // Check if the mission exists in the event
    const missionExists = event.missions.some(m => m.key === parseInt(missionKey));
    if (!missionExists) {
      return res.status(404).json({ 
        success: false, 
        message: 'Mission not found in this event' 
      });
    }
    
    // Find or create user mission record
    let userMission = await UserMission.findOne({ 
      userId, 
      eventId, 
      missionKey: parseInt(missionKey) 
    });
    
    if (userMission) {
      // Mission already exists, update it
      userMission.completed = true;
      userMission.completedAt = new Date();
      userMission.missionType = missionType;
      
      // Add any mission-specific metadata
      if (metadata) {
        userMission.metadata = { ...userMission.metadata, ...metadata };
      }
      
      // If this is a post mission, store the post ID
      if (req.body.postId) {
        userMission.postId = req.body.postId;
      }
    } else {
      // Create new mission record
      userMission = new UserMission({
        userId,
        eventId,
        missionKey: parseInt(missionKey),
        completed: true,
        missionType,
        metadata,
        completedAt: new Date(),
        postId: req.body.postId || null
      });
    }
    
    await userMission.save();
    
    // Get updated progress
    const progress = await UserMission.getUserEventProgress(userId, eventId);
    
    return res.json({
      success: true,
      message: 'Mission completed successfully',
      userMission,
      progress
    });
  } catch (error) {
    console.error('Error completing mission:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};

const redeemCode = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { code } = req.body;
    const userId = req.user.id; // Assuming auth middleware sets req.user
    
    if (!userId || !eventId || !code) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID, Event ID, and Code are required' 
      });
    }
    
    // Check if the code exists and is valid for this event
    const codeRecord = await Code.findOne({ 
      code, 
      eventId,
      isActive: true,
      expiresAt: { $gt: new Date() }
    });
    
    if (!codeRecord) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired code' 
      });
    }
    
    // Check if user has already redeemed this code
    if (codeRecord.redeemedBy && codeRecord.redeemedBy.includes(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'You have already redeemed this code' 
      });
    }
    
    // Mark code as redeemed by this user
    codeRecord.redeemedBy = [...(codeRecord.redeemedBy || []), userId];
    codeRecord.redeemedCount = (codeRecord.redeemedCount || 0) + 1;
    
    // If the code has a max redemption count, check if it's reached
    if (codeRecord.maxRedemptions && codeRecord.redeemedCount >= codeRecord.maxRedemptions) {
      codeRecord.isActive = false;
    }
    
    await codeRecord.save();
    
    // Process rewards from the code
    // This depends on your rewards system
    const reward = {
      type: codeRecord.rewardType,
      amount: codeRecord.rewardAmount,
      description: codeRecord.rewardDescription
    };
    
    // You might want to add the reward to the user's account here
    
    return res.json({
      success: true,
      message: 'Code redeemed successfully',
      reward
    });
  } catch (error) {
    console.error('Error redeeming code:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};

const getUserMissionProgress = async (req, res) => {
  try {
    const { eventId, userId } = req.query;
    
    if (!userId || !eventId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID and Event ID are required' 
      });
    }
    
    // Get all mission progress for this user and event
    const userMissions = await UserMission.find({ userId, eventId });
    
    // Get the event to get total mission count
    const event = await Events.findById(eventId);

    if (!event) {
      return res.status(404).json({ 
        success: false, 
        message: 'Event not found' 
      });
    }
    
    // Format progress as a map for easier client-side consumption
    const missionProgress = {};
    userMissions.forEach(mission => {
      missionProgress[mission.missionKey] = {
        completed: mission.completed,
        completedAt: mission.completedAt,
        missionType: mission.missionType,
        metadata: mission.metadata
      };
    });
    
    return res.json({
      success: true,
      missionProgress,
      totalCompleted: userMissions.filter(m => m.completed).length,
      totalMissions: event.missions.length,
      isComplete: event.missions.length > 0 && 
                 event.missions.length === userMissions.filter(m => m.completed).length
    });
  } catch (error) {
    console.error('Error fetching user mission progress:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};

const getUserEventStats = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming auth middleware sets req.user
    
    // Get all events the user has participated in
    const userMissions = await UserMission.find({ userId }).distinct('eventId');
    
    const stats = {
      totalEvents: userMissions.length,
      eventsCompleted: 0,
      totalMissionsCompleted: 0,
      eventDetails: []
    };
    
    // For each event, get the completion details
    for (const eventId of userMissions) {
      const progress = await UserMission.getUserEventProgress(userId, eventId);
      const event = await Event.findById(eventId);
      
      if (!event) continue;
      
      // Check if all missions in the event are completed
      const isEventCompleted = progress.isComplete;
      
      if (isEventCompleted) {
        stats.eventsCompleted++;
      }
      
      stats.totalMissionsCompleted += progress.completedCount;
      
      stats.eventDetails.push({
        eventId,
        eventName: event.name,
        missionCount: event.missions.length,
        completedCount: progress.completedCount,
        isComplete: isEventCompleted
      });
    }
    
    return res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching user event stats:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
};

module.exports = {
  createEvent,
  getAllEvents,
  getEventById,
  completeMission,
  redeemCode,
  getUserMissionProgress,
  getUserEventStats
};