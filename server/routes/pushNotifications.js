const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const pushNotificationService = require('../services/pushNotificationService');

// @route   GET /api/push/vapidPublicKey
// @desc    Get VAPID public key for push notifications
// @access  Public
router.get('/vapidPublicKey', (req, res) => {
  try {
    const publicKey = pushNotificationService.getVapidPublicKey();
    res.json({ publicKey });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/push/subscribe
// @desc    Save a push subscription
// @access  Private
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { subscription } = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ message: 'Invalid subscription data' });
    }
    
    const savedSubscription = await pushNotificationService.saveSubscription(
      req.user.id,
      subscription
    );
    
    res.json({ success: true, subscription: savedSubscription });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   DELETE /api/push/unsubscribe
// @desc    Delete a push subscription
// @access  Private
router.delete('/unsubscribe', auth, async (req, res) => {
  try {
    const { endpoint } = req.body;
    
    if (!endpoint) {
      return res.status(400).json({ message: 'Endpoint is required' });
    }
    
    const result = await pushNotificationService.deleteSubscription(
      req.user.id,
      endpoint
    );
    
    if (result) {
      res.json({ success: true, message: 'Subscription deleted' });
    } else {
      res.status(404).json({ message: 'Subscription not found' });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router; 