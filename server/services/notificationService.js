const Notification = require("../models/Notification");
const User = require("../models/User");
const socketHandler = require("../socket/socketHandler");
const pushNotificationService = require("./pushNotificationService");

let io;

/**
 * Initialize the notification service with Socket.IO instance
 * @param {Object} socketIo - Socket.IO server instance 
 */
const initialize = (socketIo) => {
  io = socketIo;
  // Initialize push notification service
  pushNotificationService.initialize();
};

/**
 * Create a notification and send it in real-time if the recipient is online
 * @param {Object} data - Notification data
 * @returns {Promise<Object>} - The created notification
 */
const createNotification = async (data) => {
  try {
    // Don't notify yourself
    if (data.sender.toString() === data.recipient.toString()) {
      return null;
    }
    
    // Create notification
    const notification = new Notification(data);
    await notification.save();
    
    // Populate sender information for the real-time notification
    const populatedNotification = await Notification.findById(notification._id)
      .populate("sender", ["username", "displayName", "avatar"])
      .populate("post", ["content"]);
    
    // Update unread count
    const unreadCount = await Notification.countDocuments({
      recipient: data.recipient,
      read: false
    });
    
    // Get Socket.IO handlers
    const handlers = socketHandler(io);
    
    // Send real-time notification if user is online
    if (handlers.isUserOnline(data.recipient)) {
      handlers.sendNotification(data.recipient, populatedNotification);
      handlers.updateUnreadCount(data.recipient, unreadCount);
    } else {
      // User is offline - send push notification
      await pushNotificationService.sendPushNotification(data.recipient, populatedNotification);
    }
    
    return populatedNotification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

/**
 * Create a like notification
 * @param {string} userId - User who liked a post
 * @param {string} postId - Post that was liked
 * @param {string} postAuthorId - Author of the post
 * @returns {Promise<Object>} - The created notification
 */
const createLikeNotification = async (userId, postId, postAuthorId) => {
  return createNotification({
    recipient: postAuthorId,
    sender: userId,
    type: "like",
    post: postId,
    message: "liked your post"
  });
};

/**
 * Create a reply notification
 * @param {string} userId - User who replied
 * @param {string} postId - Post that was replied to
 * @param {string} postAuthorId - Author of the original post
 * @returns {Promise<Object>} - The created notification
 */
const createReplyNotification = async (userId, postId, postAuthorId) => {
  return createNotification({
    recipient: postAuthorId,
    sender: userId,
    type: "reply",
    post: postId,
    message: "replied to your post"
  });
};

/**
 * Create a follow notification
 * @param {string} followerId - User who followed
 * @param {string} followedId - User who was followed
 * @returns {Promise<Object>} - The created notification
 */
const createFollowNotification = async (followerId, followedId) => {
  return createNotification({
    recipient: followedId,
    sender: followerId,
    type: "follow",
    message: "started following you"
  });
};

/**
 * Create a mention notification
 * @param {string} userId - User who mentioned someone
 * @param {string} postId - Post containing the mention
 * @param {string} mentionedUserId - User who was mentioned
 * @returns {Promise<Object>} - The created notification
 */
const createMentionNotification = async (userId, postId, mentionedUserId) => {
  return createNotification({
    recipient: mentionedUserId,
    sender: userId,
    type: "mention",
    post: postId,
    message: "mentioned you in a post"
  });
};

/**
 * Process post content for mentions and create notifications
 * @param {string} content - Post content
 * @param {string} postId - Post ID
 * @param {string} userId - User who created the post
 */
const processMentions = async (content, postId, userId) => {
  try {
    // Extract mentions (@username)
    const mentionRegex = /@(\w+)/g;
    const mentions = content.match(mentionRegex);
    
    if (!mentions) return;
    
    // Get unique usernames
    const usernames = [...new Set(mentions.map(mention => mention.substring(1)))];
    
    // Find users by username
    const mentionedUsers = await User.find({ username: { $in: usernames } });
    
    // Create a notification for each mentioned user
    for (const user of mentionedUsers) {
      await createMentionNotification(userId, postId, user._id);
    }
  } catch (error) {
    console.error("Error processing mentions:", error);
  }
};

module.exports = {
  initialize,
  createLikeNotification,
  createReplyNotification,
  createFollowNotification,
  createMentionNotification,
  processMentions
}; 