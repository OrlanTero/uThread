const Topic = require("../models/Topic");
const Post = require("../models/Post");
const User = require("../models/User");
const { validationResult } = require("express-validator");

// Get all topics
exports.getAllTopics = async (req, res) => {
  try {
    const topics = await Topic.find()
      .populate("createdBy", "username avatar")
      .sort({ createdAt: -1 });
    
    res.json(topics);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get single topic by ID
exports.getTopicById = async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id)
      .populate("createdBy", "username avatar isVerified displayName")
      .populate("moderators", "username avatar isVerified displayName");
    
    if (!topic) {
      return res.status(404).json({ error: "Topic not found" });
    }
    
    res.json(topic);
  } catch (err) {
    console.error(err);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ error: "Topic not found" });
    }
    res.status(500).json({ error: "Server error" });
  }
};

// Create new topic
exports.createTopic = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const { name, description, tags, rules, image, banner, category } = req.body;
    
    // Check if topic with the same name already exists
    const existingTopic = await Topic.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingTopic) {
      return res.status(400).json({ error: "Topic with this name already exists" });
    }
    
    const newTopic = new Topic({
      name,
      description,
      createdBy: req.user.id,
      moderators: [req.user.id],
      subscribers: [req.user.id],
      rules: rules || [],
      tags: tags || [],
      image: image || "",
      banner: banner || "",
      category: category || "Other"
    });
    
    await newTopic.save();
    
    // Populate user data for response
    const topic = await Topic.findById(newTopic._id)
      .populate("createdBy", "username avatar isVerified displayName")
      .populate("moderators", "username avatar isVerified displayName");
    
    res.json(topic);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Update topic
exports.updateTopic = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const { name, description, tags, rules, image, banner, category } = req.body;
    
    const topic = await Topic.findById(req.params.id);
    
    if (!topic) {
      return res.status(404).json({ error: "Topic not found" });
    }
    
    // Check if user is creator or moderator
    if (topic.createdBy.toString() !== req.user.id && 
        !topic.moderators.some(mod => mod.toString() === req.user.id)) {
      return res.status(403).json({ error: "Not authorized to update this topic" });
    }
    
    // If name is being changed, check if new name is already taken
    if (name && name !== topic.name) {
      const existingTopic = await Topic.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: topic._id }
      });
      
      if (existingTopic) {
        return res.status(400).json({ error: "Topic with this name already exists" });
      }
      
      topic.name = name;
    }
    
    if (description) topic.description = description;
    if (tags) topic.tags = tags;
    if (rules) topic.rules = rules;
    if (image) topic.image = image;
    if (banner) topic.banner = banner;
    if (category) topic.category = category;
    
    await topic.save();
    
    // Populate user data for response
    const updatedTopic = await Topic.findById(topic._id)
      .populate("createdBy", "username avatar isVerified displayName")
      .populate("moderators", "username avatar isVerified displayName");
    
    res.json(updatedTopic);
  } catch (err) {
    console.error(err);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ error: "Topic not found" });
    }
    res.status(500).json({ error: "Server error" });
  }
};

// Delete topic
exports.deleteTopic = async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id);
    
    if (!topic) {
      return res.status(404).json({ error: "Topic not found" });
    }
    
    // Only creator can delete a topic
    if (topic.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to delete this topic" });
    }
    
    // Remove topic from all associated posts
    await Post.updateMany(
      { topicId: topic._id },
      { $set: { topicId: null } }
    );
    
    await topic.deleteOne();
    
    res.json({ message: "Topic deleted" });
  } catch (err) {
    console.error(err);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ error: "Topic not found" });
    }
    res.status(500).json({ error: "Server error" });
  }
};

// Subscribe to topic
exports.subscribeTopic = async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id);
    
    if (!topic) {
      return res.status(404).json({ error: "Topic not found" });
    }
    
    // Check if user is already subscribed
    if (topic.subscribers.some(sub => sub.toString() === req.user.id)) {
      return res.status(400).json({ error: "Already subscribed to this topic" });
    }
    
    await topic.addSubscriber(req.user.id);
    
    res.json({ message: "Subscribed to topic" });
  } catch (err) {
    console.error(err);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ error: "Topic not found" });
    }
    res.status(500).json({ error: "Server error" });
  }
};

// Unsubscribe from topic
exports.unsubscribeTopic = async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id);
    
    if (!topic) {
      return res.status(404).json({ error: "Topic not found" });
    }
    
    // Check if user is subscribed
    if (!topic.subscribers.some(sub => sub.toString() === req.user.id)) {
      return res.status(400).json({ error: "Not subscribed to this topic" });
    }
    
    await topic.removeSubscriber(req.user.id);
    
    res.json({ message: "Unsubscribed from topic" });
  } catch (err) {
    console.error(err);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ error: "Topic not found" });
    }
    res.status(500).json({ error: "Server error" });
  }
};

// Get all posts for a topic with pagination
exports.getTopicPosts = async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id);
    
    if (!topic) {
      return res.status(404).json({ error: "Topic not found" });
    }
    
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get total count for pagination metadata
    const total = await Post.countDocuments({ 
      topicId: topic._id,
      parentPostId: null
    });
    
    const posts = await Post.find({ 
      topicId: topic._id,
      parentPostId: null // Only get parent posts, not replies
    })
    .populate("userId", "username avatar isVerified displayName")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
    
    // Send response with pagination metadata
    res.json({
      posts,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasMore: skip + posts.length < total
      }
    });
  } catch (err) {
    console.error(err);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ error: "Topic not found" });
    }
    res.status(500).json({ error: "Server error" });
  }
};

// Add moderator to topic
exports.addModerator = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    
    const topic = await Topic.findById(req.params.id);
    const user = await User.findById(userId);
    
    if (!topic) {
      return res.status(404).json({ error: "Topic not found" });
    }
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Only creator can add moderators
    if (topic.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to add moderators" });
    }
    
    // Check if user is already a moderator
    if (topic.moderators.some(mod => mod.toString() === userId)) {
      return res.status(400).json({ error: "User is already a moderator" });
    }
    
    await topic.addModerator(userId);
    // Also add as subscriber if they're not already
    if (!topic.subscribers.some(sub => sub.toString() === userId)) {
      await topic.addSubscriber(userId);
    }
    
    res.json({ message: "Moderator added" });
  } catch (err) {
    console.error(err);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ error: "Invalid ID" });
    }
    res.status(500).json({ error: "Server error" });
  }
};

// Remove moderator from topic
exports.removeModerator = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    
    const topic = await Topic.findById(req.params.id);
    
    if (!topic) {
      return res.status(404).json({ error: "Topic not found" });
    }
    
    // Only creator can remove moderators
    if (topic.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to remove moderators" });
    }
    
    // Cannot remove the creator as moderator
    if (userId === topic.createdBy.toString()) {
      return res.status(400).json({ error: "Cannot remove the creator as moderator" });
    }
    
    // Check if user is a moderator
    if (!topic.moderators.some(mod => mod.toString() === userId)) {
      return res.status(400).json({ error: "User is not a moderator" });
    }
    
    await topic.removeModerator(userId);
    
    res.json({ message: "Moderator removed" });
  } catch (err) {
    console.error(err);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ error: "Invalid ID" });
    }
    res.status(500).json({ error: "Server error" });
  }
};

// Get topics by tag
exports.getTopicsByTag = async (req, res) => {
  try {
    const { tag } = req.params;
    
    const topics = await Topic.find({ 
      tags: { $in: [tag] } 
    })
    .populate("createdBy", "username avatar isVerified displayName")
    .sort({ postCount: -1 });
    
    res.json(topics);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get trending topics
exports.getTrendingTopics = async (req, res) => {
  try {
    const topics = await Topic.find()
      .populate("createdBy", "username avatar isVerified displayName")
      .sort({ postCount: -1, subscribers: -1 })
      .limit(10);
    
    res.json(topics);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get topics by category
exports.getTopicsByCategory = async (req, res) => {
  try {
    const category = req.params.category;
    
    const topics = await Topic.find({ 
      category: { $regex: new RegExp(`^${category}$`, 'i') } 
    })
      .populate("createdBy", "username avatar isVerified displayName")
      .sort({ createdAt: -1 });
    
    if (!topics.length) {
      return res.status(404).json({ message: "No topics found in this category" });
    }
    
    res.json(topics);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}; 