const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Post = require("../models/Post");
const Topic = require("../models/Topic");
const auth = require("../middleware/auth");


router.get("/activeUsers", auth, async (req, res) => {
  const activeUsers = await User.find({ isActive: true });
  res.json({ count: activeUsers.length });
});

router.get("/totalPosts", auth, async (req, res) => {
  const totalPosts = await Post.countDocuments();
  res.json({ count: totalPosts });
});

router.get("/totalTopics", auth, async (req, res) => {
  const totalTopics = await Topic.countDocuments();
  res.json({ count: totalTopics });
});

router.get("/topicStats/:topicId", auth, async (req, res) => {
  try {
    const topicId = req.params.topicId;
    
    // Get number of posts in this topic
    const postsCount = await Post.countDocuments({ topicId });

    // Get number of followers/members for this topic
    const topic = await Topic.findById(topicId);
    const followersCount = topic ? topic.subscribers.length : 0;

    res.json({
      postsCount,
      followersCount
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
