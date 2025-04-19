const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const auth = require("../../middleware/auth");
const topicController = require("../../controllers/topicController");

// @route   GET api/topics
// @desc    Get all topics
// @access  Public
router.get("/", topicController.getAllTopics);

// @route   GET api/topics/trending
// @desc    Get trending topics
// @access  Public
router.get("/trending", topicController.getTrendingTopics);

// @route   GET api/topics/tag/:tag
// @desc    Get topics by tag
// @access  Public
router.get("/tag/:tag", topicController.getTopicsByTag);

// @route   GET api/topics/category/:category
// @desc    Get topics by category
// @access  Public
router.get("/category/:category", topicController.getTopicsByCategory);

// @route   GET api/topics/:id
// @desc    Get topic by ID
// @access  Public
router.get("/:id", topicController.getTopicById);

// @route   GET api/topics/:id/posts
// @desc    Get all posts for a topic
// @access  Public
router.get("/:id/posts", topicController.getTopicPosts);

// @route   POST api/topics
// @desc    Create a new topic
// @access  Private
router.post(
  "/",
  [
    auth,
    [
      check("name", "Name is required").not().isEmpty().trim(),
      check("name", "Name cannot exceed 50 characters").isLength({ max: 50 }),
      check("description", "Description is required").not().isEmpty(),
      check("description", "Description cannot exceed 500 characters").isLength({ max: 500 })
    ]
  ],
  topicController.createTopic
);

// @route   PUT api/topics/:id
// @desc    Update a topic
// @access  Private
router.put(
  "/:id",
  [
    auth,
    [
      check("name", "Name cannot exceed 50 characters").optional().isLength({ max: 50 }),
      check("description", "Description cannot exceed 500 characters").optional().isLength({ max: 500 })
    ]
  ],
  topicController.updateTopic
);

// @route   DELETE api/topics/:id
// @desc    Delete a topic
// @access  Private
router.delete("/:id", auth, topicController.deleteTopic);

// @route   POST api/topics/:id/subscribe
// @desc    Subscribe to a topic
// @access  Private
router.post("/:id/subscribe", auth, topicController.subscribeTopic);

// @route   POST api/topics/:id/unsubscribe
// @desc    Unsubscribe from a topic
// @access  Private
router.post("/:id/unsubscribe", auth, topicController.unsubscribeTopic);

// @route   POST api/topics/:id/moderators
// @desc    Add a moderator to a topic
// @access  Private
router.post(
  "/:id/moderators",
  [
    auth,
    [
      check("userId", "User ID is required").not().isEmpty()
    ]
  ],
  topicController.addModerator
);

// @route   DELETE api/topics/:id/moderators
// @desc    Remove a moderator from a topic
// @access  Private
router.delete(
  "/:id/moderators",
  [
    auth,
    [
      check("userId", "User ID is required").not().isEmpty()
    ]
  ],
  topicController.removeModerator
);

module.exports = router; 