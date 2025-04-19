const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PostSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  content: {
    type: String,
    required: true,
    maxlength: 500,
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
  parentPostId: {
    type: Schema.Types.ObjectId,
    ref: "Post",
    default: null,
  },
  replies: [
    {
      type: Schema.Types.ObjectId,
      ref: "Post",
    },
  ],
  likes: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  // New fields for topics and hashtags
  topicId: {
    type: Schema.Types.ObjectId,
    ref: "Topic",
    default: null,
  },
  hashtags: [
    {
      type: String,
      trim: true
    }
  ],
  tags: [
    {
      type: Schema.Types.ObjectId,
      ref: "User"
    }
  ],
  // ReThread fields
  isReThread: {
    type: Boolean,
    default: false
  },
  reThreadedPostId: {
    type: Schema.Types.ObjectId,
    ref: "Post",
    default: null
  },
  originalAuthor: {
    type: String,
    default: null
  },
  originalContent: {
    type: String,
    default: null
  }
});

// Method to check if a post is a parent post
PostSchema.methods.isParentPost = function () {
  return this.parentPostId === null;
};

// Method to add a reply to a post
PostSchema.methods.addReply = function (replyId) {
  this.replies.push(replyId);
  return this.save();
};

// Method to add media to a post
PostSchema.methods.addMedia = function (mediaObject) {
  this.media.push(mediaObject);
  return this.save();
};

// Method to remove media from a post
PostSchema.methods.removeMedia = function (mediaId) {
  this.media = this.media.filter(m => m._id.toString() !== mediaId.toString());
  return this.save();
};

// Extract hashtags from post content
PostSchema.pre('save', function(next) {
  if (this.isModified('content')) {
    // Extract hashtags using regex
    const hashtagRegex = /#(\w+)/g;
    const matches = this.content.match(hashtagRegex);
    
    if (matches) {
      // Remove # from the beginning and store unique hashtags
      this.hashtags = [...new Set(matches.map(tag => tag.substring(1).toLowerCase()))];
    } else {
      this.hashtags = [];
    }
  }
  next();
});

module.exports = mongoose.model("Post", PostSchema);
