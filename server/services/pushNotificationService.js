const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const User = require('../models/User');

// Set VAPID keys
// In production, these should be set as environment variables
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BLgUL9GjRiWEL_vf1jHlIb9wZUgwVEzP6gYEfuPL69knn-WeZ5xjxuhze6NrBfsA3oY9B36CHRRo9i5z7wWOyW4',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'gfE9cQRPIr2kWn48LkhJRTGu2QpxGrGrEeUTKdJtMbY'
};

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:contact@uthread.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

/**
 * Initialize the push notification service
 */
const initialize = () => {
  console.log('Push notification service initialized');
};

/**
 * Save a new push subscription
 * @param {string} userId - User ID
 * @param {Object} subscription - Push subscription object
 * @returns {Promise<Object>} - Saved subscription
 */
const saveSubscription = async (userId, subscription) => {
  try {
    // Check if subscription already exists
    const existingSubscription = await PushSubscription.findOne({
      user: userId,
      'subscription.endpoint': subscription.endpoint
    });

    if (existingSubscription) {
      // Update the existing subscription
      existingSubscription.subscription = subscription;
      await existingSubscription.save();
      return existingSubscription;
    }

    // Create a new subscription
    const newSubscription = new PushSubscription({
      user: userId,
      subscription
    });

    await newSubscription.save();
    return newSubscription;
  } catch (error) {
    console.error('Error saving push subscription:', error);
    throw error;
  }
};

/**
 * Delete a push subscription
 * @param {string} userId - User ID
 * @param {string} endpoint - Subscription endpoint
 * @returns {Promise<boolean>} - Operation success
 */
const deleteSubscription = async (userId, endpoint) => {
  try {
    const result = await PushSubscription.deleteOne({
      user: userId,
      'subscription.endpoint': endpoint
    });
    
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error deleting push subscription:', error);
    throw error;
  }
};

/**
 * Send a push notification to a user
 * @param {string} userId - User ID to send notification to
 * @param {Object} notification - Notification object
 * @returns {Promise<Array>} - Results of sending operations
 */
const sendPushNotification = async (userId, notification) => {
  try {
    const subscriptions = await PushSubscription.find({ user: userId });
    
    if (!subscriptions || subscriptions.length === 0) {
      return [];
    }

    // Format notification for Web Push
    const pushPayload = JSON.stringify({
      title: 'UThread Notification',
      body: notification.message,
      icon: '/logo192.png',
      badge: '/badge.png',
      tag: notification._id.toString(),
      data: {
        url: generateNotificationUrl(notification),
        notificationId: notification._id.toString()
      }
    });

    const options = {
      TTL: 86400, // Time to live - 24 hours
      urgency: 'normal'
    };

    // Send to all subscriptions for this user
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          return await webpush.sendNotification(
            sub.subscription,
            pushPayload,
            options
          );
        } catch (error) {
          // If subscription is expired or invalid, remove it
          if (error.statusCode === 404 || error.statusCode === 410) {
            await PushSubscription.deleteOne({ _id: sub._id });
            console.log(`Deleted invalid subscription for user ${userId}`);
          }
          console.error(`Failed to send push notification to subscription:`, error);
          return null;
        }
      })
    );

    return results.filter(Boolean);
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
};

/**
 * Generate a URL to redirect to based on the notification type
 * @param {Object} notification - Notification object
 * @returns {string} - URL to redirect to
 */
const generateNotificationUrl = (notification) => {
  switch (notification.type) {
    case 'like':
    case 'reply':
    case 'mention':
      return `/post/${notification.post}`;
    case 'follow':
      return `/profile/${notification.sender}`;
    default:
      return '/notifications';
  }
};

/**
 * Get VAPID public key
 * @returns {string} - VAPID public key
 */
const getVapidPublicKey = () => {
  return vapidKeys.publicKey;
};

module.exports = {
  initialize,
  saveSubscription,
  deleteSubscription,
  sendPushNotification,
  getVapidPublicKey
}; 