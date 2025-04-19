const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
  senderId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  receiverId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  content: {
    type: String,
    default: ""
  },
  media: [
    {
      type: {
        type: String,
        enum: ["image", "video", "audio"],
        required: true
      },
      url: {
        type: String,
        required: true
      },
      caption: {
        type: String,
        default: ""
      }
    }
  ],
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create index for faster queries
MessageSchema.index({ senderId: 1, receiverId: 1 });
MessageSchema.index({ createdAt: -1 });

// Method to check if a message has media
MessageSchema.methods.hasMedia = function () {
  return this.media && this.media.length > 0;
};

// Method to mark message as read
MessageSchema.methods.markAsRead = function () {
  this.isRead = true;
  return this.save();
};

module.exports = mongoose.model("Message", MessageSchema); 