const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  type: {
    type: String,
    enum: ["like", "reply", "mention", "follow"],
    required: true,
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Post",
  },
  read: {
    type: Boolean,
    default: false,
  },
  message: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create indexes for faster querying
NotificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

// Pre-save hook to generate notification messages
NotificationSchema.pre("save", function(next) {
  // If message is already set, skip
  if (this.message) return next();
  
  // Generate default messages based on notification type
  switch (this.type) {
    case "like":
      this.message = "liked your post";
      break;
    case "reply":
      this.message = "replied to your post";
      break;
    case "mention":
      this.message = "mentioned you in a post";
      break;
    case "follow":
      this.message = "started following you";
      break;
    default:
      this.message = "sent you a notification";
  }
  
  next();
});

module.exports = mongoose.model("Notification", NotificationSchema); 