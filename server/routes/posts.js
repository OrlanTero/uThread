const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Post = require("../models/Post");
const User = require("../models/User");
const auth = require("../middleware/auth");
const notificationService = require("../services/notificationService");

// @route   GET /api/posts
// @desc    Get all posts (parent posts only) with pagination
// @access  Public
router.get("/", async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get total count for pagination metadata
    const total = await Post.countDocuments({ parentPostId: null });
    
    const posts = await Post.find({ parentPostId: null })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", ["username", "avatar"]);

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
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /api/posts/hashtag/:hashtag
// @desc    Get posts by hashtag with pagination
// @access  Public
router.get("/hashtag/:hashtag", async (req, res) => {
  try {
    const { hashtag } = req.params;
    
    if (!hashtag) {
      return res.status(400).json({ message: "Hashtag is required" });
    }
    
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get total count for pagination metadata
    const total = await Post.countDocuments({ 
      hashtags: { $in: [hashtag.toLowerCase()] },
      parentPostId: null
    });
    
    // Find all posts with the hashtag (case insensitive)
    const posts = await Post.find({ 
      hashtags: { $in: [hashtag.toLowerCase()] },
      parentPostId: null // Only get parent posts, not replies
    })
    .populate("userId", ["username", "avatar"])
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
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /api/posts/bookmarks
// @desc    Get all bookmarked posts for the authenticated user
// @access  Private
router.get("/bookmarks", auth, async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get category filter if provided
    const category = req.query.category || 'all';
    
    // Get user with bookmarks
    const user = await User.findById(req.user.id).select("bookmarks");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Extract post IDs from bookmarks
    const bookmarkedPostIds = user.bookmarks.map(bookmark => bookmark.post);
    
    // Get total count for pagination
    const total = bookmarkedPostIds.length;
    
    // Apply pagination (manually since we're using an array)
    const paginatedPostIds = bookmarkedPostIds.slice(skip, skip + limit);
    
    let query = { _id: { $in: paginatedPostIds } };
    
    // If category filter is applied and it's not 'all'
    if (category && category !== 'all') {
      // Add logic to filter by category - this depends on your Post schema
      // For example, if your posts have a 'category' field:
      // query.category = category;
      
      // Alternatively, if you're filtering by content containing the category:
      query.$or = [
        { content: { $regex: category, $options: 'i' } },
        { hashtags: category.toLowerCase() }
      ];
    }
    
    // Get posts with pagination
    const posts = await Post.find(query)
      .populate("userId", ["username", "displayName", "avatar"])
      .sort({ createdAt: -1 });
    
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
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /api/posts/:id
// @desc    Get post by ID
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate("userId", [
      "username",
      "avatar",
    ]);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.json(post);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Post not found" });
    }
    res.status(500).send("Server error");
  }
});

// @route   GET /api/posts/thread/:id
// @desc    Get a complete thread with pagination for replies
// @access  Public
router.get("/thread/:id", async (req, res) => {
  try {
    // Pagination parameters for replies
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Find the parent post
    let post = await Post.findById(req.params.id).populate("userId", [
      "username",
      "avatar",
    ]);

    if (!post) {
      return res.status(404).json({ message: "Thread not found" });
    }

    // If this is a reply post, find its parent
    if (post.parentPostId) {
      post = await Post.findById(post.parentPostId).populate("userId", [
        "username",
        "avatar",
      ]);

      if (!post) {
        return res.status(404).json({ message: "Thread not found" });
      }
    }

    // Get total count of replies
    const total = await Post.countDocuments({ parentPostId: post._id });

    // Get all replies in this thread with pagination
    const replies = await Post.find({ parentPostId: post._id })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", ["username", "avatar"]);

    // Combine the parent post and replies
    const thread = {
      parent: post,
      replies: replies,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasMore: skip + replies.length < total
      }
    };

    res.json(thread);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Thread not found" });
    }
    res.status(500).send("Server error");
  }
});

// @route   POST /api/posts
// @desc    Create a post
// @access  Private
router.post("/", auth, async (req, res) => {
  try {
    const { content, parentPostId, topicId, media, isReThread, reThreadedPostId, originalAuthor, originalContent } = req.body;
    
    // Ensure content is a string, not an object
    const contentToUse = typeof content === 'object' ? 
      (content.toString ? content.toString() : "") : 
      (content || "");
    
    // Check if this is a ReThread post
    const isReThreadPost = (isReThread === true || isReThread === 'true') && reThreadedPostId;
    
    // Validate required fields - allow empty content for ReThreads
    if (!contentToUse && (!media || !Array.isArray(media) || media.length === 0) && !isReThreadPost) {
      return res.status(400).json({ message: "Post must contain content or media" });
    }
    
    // Set default content for ReThreads if it's empty
    const finalContent = (!contentToUse && isReThreadPost) ? "ReThreaded" : contentToUse;
    
    // Create post with proper field names matching the model
    const postData = {
      userId: req.user.id,
      content: finalContent
    };

    // Only add fields if they exist
    if (parentPostId) {
      // Validate parentPostId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(parentPostId)) {
        return res.status(400).json({ message: "Invalid parent post ID format" });
      }
        postData.parentPostId = parentPostId;
    }
    
    if (topicId) {
      // Validate topicId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(topicId)) {
        return res.status(400).json({ message: "Invalid topic ID format" });
      }
      postData.topicId = topicId;
    }
    
    // Handle ReThread fields
    if (isReThreadPost) {
      // Validate reThreadedPostId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(reThreadedPostId)) {
        return res.status(400).json({ message: "Invalid ReThreaded post ID format" });
      }
      
      // Check if the original post exists
      const originalPost = await Post.findById(reThreadedPostId);
      if (!originalPost) {
        return res.status(404).json({ message: "Original post for ReThread not found" });
      }
      
      // Set ReThread fields
      postData.isReThread = true;
      postData.reThreadedPostId = reThreadedPostId;
      postData.originalAuthor = originalAuthor || originalPost.userId.username || 'unknown';
      postData.originalContent = originalContent || originalPost.content;
      
      console.log("Creating ReThread post:", postData);
    }
    
    if (media && Array.isArray(media) && media.length > 0) {
      // Validate media objects
      const validMedia = media.filter(item => 
        item && item.type && item.url &&
        ['image', 'video', 'audio'].includes(item.type)
      );
      
      if (validMedia.length !== media.length) {
        return res.status(400).json({ 
          message: "All media items must have valid type and URL" 
        });
      }
      
      postData.media = media;
    }
    
    console.log("Creating post with data:", postData);
    const newPost = new Post(postData);
    const post = await newPost.save();
    
    // If this is a reply (has parentPostId), create a notification
    if (parentPostId) {
      const parentPost = await Post.findById(parentPostId);
      if (parentPost && parentPost.userId.toString() !== req.user.id) {
        await notificationService.createReplyNotification(
          req.user.id,
          post._id,
          parentPost.userId
        );
      }
    }
    
    // If this is a ReThread, create a notification for the original post author
    if (isReThread && reThreadedPostId) {
      const originalPost = await Post.findById(reThreadedPostId);
      if (originalPost && originalPost.userId.toString() !== req.user.id) {
        // We'll use the reply notification for now since it's similar
        // In a real app, you might want a dedicated ReThread notification type
        await notificationService.createReplyNotification(
          req.user.id,
          post._id,
          originalPost.userId
        );
      }
    }
    
    // Process mentions
    await notificationService.processMentions(content, post._id, req.user.id);
    
    // Populate and return the post
    const populatedPost = await Post.findById(post._id)
      .populate("userId", ["username", "displayName", "avatar"])
      .populate({
        path: "parentPostId",
        populate: {
          path: "userId",
          select: "username displayName avatar"
        }
      })
      // Also populate reThreadedPostId if this is a ReThread
      .populate({
        path: "reThreadedPostId",
        populate: {
          path: "userId",
          select: "username displayName avatar"
        }
      });

      console.log("populatedPost", populatedPost);
    
    return res.json(populatedPost);
  } catch (err) {
    console.error("Error creating post:", err.message);
    
    // Send more specific error messages
    if (err.name === 'ValidationError') {
      // Mongoose validation error
      return res.status(400).json({ 
        message: "Validation error", 
        details: Object.values(err.errors).map(e => e.message)
      });
    } else if (err.name === 'CastError') {
      // Invalid ObjectId format
      return res.status(400).json({ message: "Invalid ID format" });
    }
    
    res.status(500).json({ message: "Server Error" });
  }
});

// @route   POST /api/posts/:id/media
// @desc    Add media to an existing post
// @access  Private
router.post("/:id/media", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check user
    if (post.userId.toString() !== req.user.id) {
      return res.status(401).json({ message: "User not authorized" });
    }

    // Validate media object
    const { type, url, caption } = req.body;
    if (!type || !url) {
      return res.status(400).json({ message: "Media type and URL are required" });
    }

    // Add media to post
    post.media.push({ type, url, caption });
    await post.save();

    res.json(post);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Post not found" });
    }
    res.status(500).send("Server error");
  }
});

// @route   DELETE /api/posts/:id/media/:mediaId
// @desc    Delete media from a post
// @access  Private
router.delete("/:id/media/:mediaId", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check user
    if (post.userId.toString() !== req.user.id) {
      return res.status(401).json({ message: "User not authorized" });
    }

    // Check if media exists
    const mediaIndex = post.media.findIndex(m => m._id.toString() === req.params.mediaId);
    if (mediaIndex === -1) {
      return res.status(404).json({ message: "Media not found" });
    }

    // Remove media
    post.media.splice(mediaIndex, 1);
    await post.save();

    res.json(post);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Post not found" });
    }
    res.status(500).send("Server error");
  }
});

// @route   DELETE /api/posts/:id
// @desc    Delete a post
// @access  Private
router.delete("/:id", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check user
    if (post.userId.toString() !== req.user.id) {
      return res.status(401).json({ message: "User not authorized" });
    }

    // If this is a parent post, delete all replies
    if (!post.parentPostId) {
      await Post.deleteMany({ parentPostId: post._id });
    } else {
      // If this is a reply, update the parent post
      const parentPost = await Post.findById(post.parentPostId);
      if (parentPost) {
        parentPost.replies = parentPost.replies.filter(
          (replyId) => replyId.toString() !== post._id.toString()
        );
        await parentPost.save();
      }
    }

    // Fixed the deprecated remove() method
    await Post.deleteOne({ _id: post._id });

    res.json({ message: "Post removed" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Post not found" });
    }
    res.status(500).send("Server error");
  }
});

// @route   PUT /api/posts/:id/like
// @desc    Like a post
// @access  Private
router.put("/:id/like", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check if the post has already been liked by this user
    if (post.likes.some(like => like.toString() === req.user.id)) {
      // Unlike the post if already liked
      post.likes = post.likes.filter(like => like.toString() !== req.user.id);
      await post.save();
      return res.json(post.likes);
    }

    // Add like (directly add the userId as an ObjectId, not as an object)
    post.likes.unshift(req.user.id);
    await post.save();

    // Create notification if the post owner is not the liker
    if (post.userId.toString() !== req.user.id) {
      await notificationService.createLikeNotification(
        req.user.id,
        post._id,
        post.userId
      );
    }

    res.json(post.likes);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Post not found" });
    }
    res.status(500).send("Server error");
  }
});

// @route   PUT /api/posts/:id/bookmark
// @desc    Bookmark or unbookmark a post
// @access  Private
router.put("/:id/bookmark", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Get current user
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user already has this post bookmarked
    const isBookmarked = user.bookmarks.some(
      bookmark => bookmark.post.toString() === req.params.id
    );

    if (isBookmarked) {
      // Remove bookmark
      user.bookmarks = user.bookmarks.filter(
        bookmark => bookmark.post.toString() !== req.params.id
      );
      await user.save();
      
      return res.json({ 
        success: true,
        message: "Post unbookmarked", 
        isBookmarked: false
      });
    } else {
      // Add bookmark
      user.bookmarks.unshift({ post: req.params.id });
      await user.save();
      
      return res.json({ 
        success: true,
        message: "Post bookmarked", 
        isBookmarked: true
      });
    }
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Post not found" });
    }
    res.status(500).send("Server error");
  }
});

router.post("/:id/reply/:replyId", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const reply = await Post.findById(req.params.replyId);

    if (!post) {
      return res.status(404).json({ message: "Parent post not found" });
    }

    if (!reply) {
      return res.status(404).json({ message: "Reply post not found" });
    }

    // Ensure we have a replies array
    if (!post.replies) {
      post.replies = [];
    }

    // Check if the reply is already in the array to avoid duplicates
    if (!post.replies.includes(req.params.replyId)) {
      post.replies.push(req.params.replyId);
      await post.save();
    }

    // Return the updated post
    return res.json({ 
      success: true, 
      message: "Reply added to parent post",
      parentPost: post
    });
  } catch (err) {
    console.error("Error adding reply to parent post:", err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Invalid post ID format" });
    }
    return res.status(500).json({ message: "Server error" });
  }
});

// Add PUT endpoint for updating replies for clients using PUT method
router.put("/:id/reply/:replyId", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const reply = await Post.findById(req.params.replyId);

    if (!post) {
      return res.status(404).json({ message: "Parent post not found" });
    }

    if (!reply) {
      return res.status(404).json({ message: "Reply post not found" });
    }

    // Ensure we have a replies array
    if (!post.replies) {
      post.replies = [];
    }

    // Check if the reply is already in the array to avoid duplicates
    if (!post.replies.includes(req.params.replyId)) {
      post.replies.push(req.params.replyId);
      await post.save();
    }

    // Return the updated post
    return res.json({ 
      success: true, 
      message: "Reply added to parent post",
      parentPost: post
    });
  } catch (err) {
    console.error("Error adding reply to parent post:", err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Invalid post ID format" });
    }
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
