const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const User = require("../models/User");
const Post = require("../models/Post");
const auth = require("../middleware/auth");

// @route   GET /api/notifications
// @desc    Get all notifications for a user
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Filter by read/unread if specified
    const filter = { recipient: req.user.id };
    if (req.query.read === "true") {
      filter.read = true;
    } else if (req.query.read === "false") {
      filter.read = false;
    }
    
    // Get total count for pagination metadata
    const total = await Notification.countDocuments(filter);
    
    // Get notifications for the user
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("sender", ["username", "displayName", "avatar"])
      .populate("post", ["content"]);

    // Send response with pagination metadata
    res.json({
      notifications,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasMore: skip + notifications.length < total
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /api/notifications/count
// @desc    Get unread notification count for a user
// @access  Private
router.get("/count", auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user.id,
      read: false
    });
    
    res.json({ count });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   PUT /api/notifications/read
// @desc    Mark all notifications as read
// @access  Private
router.put("/read", auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, read: false },
      { $set: { read: true } }
    );
    
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark a specific notification as read
// @access  Private
router.put("/:id/read", auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    
    // Check if the notification belongs to the current user
    if (notification.recipient.toString() !== req.user.id) {
      return res.status(401).json({ message: "Not authorized" });
    }
    
    notification.read = true;
    await notification.save();
    
    res.json(notification);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.status(500).send("Server error");
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete a notification
// @access  Private
router.delete("/:id", auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    
    // Check if the notification belongs to the current user
    if (notification.recipient.toString() !== req.user.id) {
      return res.status(401).json({ message: "Not authorized" });
    }
    
    await notification.remove();
    
    res.json({ success: true, message: "Notification removed" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.status(500).send("Server error");
  }
});

// @route   DELETE /api/notifications
// @desc    Delete all notifications for a user
// @access  Private
router.delete("/", auth, async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user.id });
    
    res.json({ success: true, message: "All notifications deleted" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router; 