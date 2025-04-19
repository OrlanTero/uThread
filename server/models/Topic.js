const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const TopicSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  image: {
    type: String,
    default: ""
  },
  banner: {
    type: String,
    default: ""
  },
  backgroundColor: {
    type: String,
    default: ""
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  moderators: [
    {
      type: Schema.Types.ObjectId,
      ref: "User"
    }
  ],
  subscribers: [
    {
      type: Schema.Types.ObjectId,
      ref: "User"
    }
  ],
  rules: [
    {
      title: {
        type: String,
        required: true,
        trim: true
      },
      description: {
        type: String,
        required: true
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  },
  isOfficial: {
    type: Boolean,
    default: false
  },
  category: {
    type: String,
    required: true,
    enum: ['Technology', 'Science', 'Gaming', 'Sports', 'Entertainment', 'News', 'Education', 'Lifestyle', 'Art', 'Other'],
    default: 'Other'
  },
  tags: [
    {
      type: String,
      trim: true
    }
  ],
  postCount: {
    type: Number,
    default: 0
  }
});

// Virtual for URL
TopicSchema.virtual('url').get(function() {
  return `/topics/${this._id}`;
});

// Method to add subscriber
TopicSchema.methods.addSubscriber = function(userId) {
  if (!this.subscribers.includes(userId)) {
    this.subscribers.push(userId);
  }
  return this.save();
};

// Method to remove subscriber
TopicSchema.methods.removeSubscriber = function(userId) {
  this.subscribers = this.subscribers.filter(
    id => id.toString() !== userId.toString()
  );
  return this.save();
};

// Method to add moderator
TopicSchema.methods.addModerator = function(userId) {
  if (!this.moderators.includes(userId)) {
    this.moderators.push(userId);
  }
  return this.save();
};

// Method to remove moderator
TopicSchema.methods.removeModerator = function(userId) {
  this.moderators = this.moderators.filter(
    id => id.toString() !== userId.toString()
  );
  return this.save();
};

// Increment post count
TopicSchema.methods.incrementPostCount = function() {
  this.postCount += 1;
  return this.save();
};

// Decrement post count
TopicSchema.methods.decrementPostCount = function() {
  if (this.postCount > 0) {
    this.postCount -= 1;
  }
  return this.save();
};

module.exports = mongoose.model("Topic", TopicSchema); 