const asyncHandler = require('express-async-handler');
const Notifications = require('../models/notifications.js');
const User = require('../models/User.js');
const Posts = require ('../models/posts.js');

// Get notifications by recipient ID
const getNotificationById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const notifications = await Notifications.find({ recipSlug: id, read: { $ne: true } })
      .select('-password')
      .lean();
    
    if (!notifications || notifications.length === 0) {
      console.log("No notifications found for ID:", id); // Log when no notifications are found
      return res.json([]);
    }
  
    res.json(notifications);
});

// Update notifications to mark them as read
const updateNotifications = asyncHandler(async (req, res) => {
    try {
        const { notifications } = req.body;
        console.log("Updating notifications:", notifications); // Log the notifications being updated
    
        await Notifications.updateMany(
          { _id: { $in: notifications.map(notification => notification._id) } },
          { $set: { read: true } }
        );
    
        res.status(200).json({ message: 'Notifications updated successfully.' });
    } catch (error) {
        console.error('Error updating notifications:', error);
        res.status(500).json({ message: 'Failed to update notifications.' });
    }
});

// Create a new notification
const createNotification = async (reqBody) => {
  const { senderSlug, recipSlug, action, post } = reqBody;

  console.log("Creating notification:", { senderSlug, recipSlug }); // Log to verify the creation request

  if (!senderSlug || !recipSlug || !action) {
      throw new Error('Missing required fields: senderSlug, recipSlug, and action are required');
  }

  const actionImages = {
      'Followed you': '/images/44eb66829a8391f5a500c955ef7aca23',
      'Supported you': '/images/7a7dd08cbfd8eef33a1d6e4567516246',
      'Made a donation': '/images/7ba3f3c59b266c8dbea9b141e7e5fcff',
      'Liked your post': '/images/48c0c09a464c1201fef174014561a481',
      'Shared your post': '/images/571f6ccfe79002095caa450d4ab7a2fc',
      'Gave you stars': '/images/b0c5d047b0364ca86530a27a53f609c3',
      'Mentioned you': '/images/b062f2f940fb5f3ea90f5d61cd0f341e',
      'Left a comment': '/images/d187d1e545e5478e01b5350fcd68b293'
  };

  // Fetch sender and recipient data
  const sender = await User.findOne({ _id: senderSlug });
  const recipient = await User.findOne({ _id: recipSlug });
  let postInfo;
    if (post && post._id) {
        postInfo = await Posts.findOne({_id: post._id});
        console.log(postInfo);
    }

  if (!sender || !recipient) {
      throw new Error('Sender or recipient not found');
  }

  const notificationsObject = {
      senderSlug,
      senderProfImage: sender.profimage,
      recipSlug,
      action,
      senderDisplayName: sender.displayName,
      actionImage: actionImages[action] || '/default/action/image/path',
      postInfo
  };

  // Add additional fields based on the action
  switch (action) {
      case 'Gave you stars':
          notificationsObject.starQuantity = post ? post.starQuantity : 0;
          break;
      case 'Made a donation':
          notificationsObject.donationQuantity = post ? post.donationQuantity : 0;
          break;
      // Add more cases for other actions if needed
  }

  const notification = await Notifications.create(notificationsObject);

  if (!notification) {
      throw new Error('Invalid notification data received');
  }

  return notification;
};

// Delete old read notifications
const deleteOldReadNotifications = async () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  
    try {
        const result = await Notifications.deleteMany({
            actionDate: { $lt: threeDaysAgo }
        });
        console.log(`${result.deletedCount} old read notifications deleted.`);
    } catch (error) {
        console.error('Error deleting old read notifications:', error);
    }
};

// Delete old read notifications
const deleteNotifications = asyncHandler(async (req, res) => {
    const { id } = req.params;
    console.log(id)
    try {
        const result = await Notifications.deleteMany({
            recipSlug: id
        });
        console.log(`${result.deletedCount} notifications deleted.`);
    } catch (error) {
        console.error('Error deleting notifications:', error);
    }
});

// Run deleteOldReadNotifications at 12:00 PM every day
function runAt12PM() {
    const now = new Date();
    const target = new Date();
    target.setHours(12, 0, 0, 0);

    if (now >= target) {
        target.setDate(target.getDate() + 1);
    }

    const delay = target.getTime() - now.getTime();
    setTimeout(() => {
        deleteOldReadNotifications();
        runAt12PM();
    }, delay);
}
  
runAt12PM();

module.exports = {
    getNotificationById,
    createNotification,
    updateNotifications,
    deleteNotifications
};