const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Schema for web push subscriptions
const PushSubscriptionSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  subscription: {
    type: Object,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure one subscription per user+endpoint
PushSubscriptionSchema.index({ 'user': 1, 'subscription.endpoint': 1 }, { unique: true });

module.exports = mongoose.model('pushSubscription', PushSubscriptionSchema); 