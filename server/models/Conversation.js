const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ConversationSchema = new Schema({
  participants: [{
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  }],
  lastMessage: {
    type: Schema.Types.ObjectId,
    ref: "Message"
  },
  lastMessageText: {
    type: String,
    default: ""
  },
  lastMessageDate: {
    type: Date,
    default: Date.now
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: new Map()
  },
  isPinned: {
    type: Map,
    of: Boolean,
    default: new Map()
  },
  isMuted: {
    type: Map,
    of: Boolean,
    default: new Map()
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create index for faster queries
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ updatedAt: -1 });

// Pre-save middleware to update the updatedAt timestamp
ConversationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to increment unread count for a user (doesn't save directly)
ConversationSchema.methods.incrementUnread = function(userId) {
  const userIdStr = userId.toString();
  const currentCount = this.unreadCount.get(userIdStr) || 0;
  this.unreadCount.set(userIdStr, currentCount + 1);
  return this; // Return this instead of saving to allow caller to handle the save
};

// Method to reset unread count for a user (doesn't save directly)
ConversationSchema.methods.resetUnread = function(userId) {
  const userIdStr = userId.toString();
  this.unreadCount.set(userIdStr, 0);
  return this; // Return this instead of saving to allow caller to handle the save
};

// Method to toggle pinned status for a user (doesn't save directly)
ConversationSchema.methods.togglePinned = function(userId) {
  const userIdStr = userId.toString();
  const currentStatus = this.isPinned.get(userIdStr) || false;
  this.isPinned.set(userIdStr, !currentStatus);
  return this; // Return this instead of saving to allow caller to handle the save
};

// Method to toggle muted status for a user (doesn't save directly)
ConversationSchema.methods.toggleMuted = function(userId) {
  const userIdStr = userId.toString();
  const currentStatus = this.isMuted.get(userIdStr) || false;
  this.isMuted.set(userIdStr, !currentStatus);
  return this; // Return this instead of saving to allow caller to handle the save
};

// Method to update last message info (doesn't save directly)
ConversationSchema.methods.updateLastMessage = function(messageId, text) {
  this.lastMessage = messageId;
  this.lastMessageText = text || "";
  this.lastMessageDate = Date.now();
  return this; // Return this instead of saving to allow caller to handle the save
};

// For backward compatibility - these methods save the document
ConversationSchema.methods.incrementUnreadAndSave = async function(userId) {
  this.incrementUnread(userId);
  return await this.save();
};

ConversationSchema.methods.resetUnreadAndSave = async function(userId) {
  this.resetUnread(userId);
  return await this.save();
};

ConversationSchema.methods.togglePinnedAndSave = async function(userId) {
  this.togglePinned(userId);
  return await this.save();
};

ConversationSchema.methods.toggleMutedAndSave = async function(userId) {
  this.toggleMuted(userId);
  return await this.save();
};

ConversationSchema.methods.updateLastMessageAndSave = async function(messageId, text) {
  this.updateLastMessage(messageId, text);
  return await this.save();
};

module.exports = mongoose.model("Conversation", ConversationSchema); 