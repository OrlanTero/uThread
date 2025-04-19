const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Post = require("../models/Post");
const auth = require("../middleware/auth");
const notificationService = require("../services/notificationService");

// @route   GET /api/user/search
// @desc    Search users by username
// @access  Public
router.get("/search", async (req, res) => {
  try {
    const { username } = req.query;
    
    console.log(`Server received search request for username: ${username}`);
    
    // If no username provided, return a few random users
    if (!username) {
      const randomUsers = await User.find({})
        .select("username displayName avatar")
        .limit(5);
      
      console.log(`No username provided, returning ${randomUsers.length} random users`);
      return res.json(randomUsers);
    }
    
    // Find users whose username matches the search term (case insensitive)
    const users = await User.find({
      username: { $regex: username, $options: "i" }
    })
      .select("username displayName avatar")
      .limit(10);
    
    console.log(`Server found ${users.length} users matching "${username}"`);
    res.json(users);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /api/user/:id
// @desc    Get user by ID
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate("followers", "username displayName avatar isVerified")
      .populate("following", "username displayName avatar isVerified");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(500).send("Server error");
  }
});

// @route   GET /api/user/:id/posts
// @desc    Get posts by user ID with pagination
// @access  Public
router.get("/:id/posts", async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get total count for pagination metadata
    const total = await Post.countDocuments({
      userId: req.params.id,
      parentPostId: null,
    });
    
    const posts = await Post.find({
      userId: req.params.id,
      parentPostId: null,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", ["username", "displayName", "avatar", "isVerified"]);

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

// @route   GET /api/user/:id/followers
// @desc    Get user's followers
// @access  Public
router.get("/:id/followers", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("followers", "username displayName avatar bio isVerified");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user.followers);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(500).send("Server error");
  }
});

// @route   GET /api/user/:id/following
// @desc    Get users that the specified user is following
// @access  Public
router.get("/:id/following", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("following", "username displayName avatar bio isVerified");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user.following);
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(500).send("Server error");
  }
});

// @route   PUT /api/user/follow/:id
// @desc    Follow or unfollow a user
// @access  Private
router.put("/follow/:id", auth, async (req, res) => {
  try {
    // Check if trying to follow self
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: "Cannot follow yourself" });
    }
    
    const userToFollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user.id);
    
    if (!userToFollow || !currentUser) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Check if current user already follows the other user
    const alreadyFollows = currentUser.following.some(
      follow => follow.user.toString() === req.params.id
    );
    
    if (alreadyFollows) {
      // Unfollow logic - remove from both following and followers lists
      currentUser.following = currentUser.following.filter(
        follow => follow.user.toString() !== req.params.id
      );
      userToFollow.followers = userToFollow.followers.filter(
        follow => follow.user.toString() !== req.user.id
      );
      
      await currentUser.save();
      await userToFollow.save();
      
      return res.json({ 
        message: "User unfollowed", 
        following: currentUser.following,
        followers: userToFollow.followers
      });
    } else {
      // Follow logic - add to both following and followers lists
      currentUser.following.unshift({ user: req.params.id });
      userToFollow.followers.unshift({ user: req.user.id });
      
      await currentUser.save();
      await userToFollow.save();
      
      // Create follow notification
      await notificationService.createFollowNotification(
        req.user.id, 
        userToFollow._id
      );
      
      return res.json({ 
        message: "User followed", 
        following: currentUser.following,
        followers: userToFollow.followers
      });
    }
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(500).send("Server error");
  }
});

// @route   PUT /api/user
// @desc    Update user profile
// @access  Private
router.put("/", auth, async (req, res) => {
  const { bio, displayName, location, country, gender, website, birthday, avatar, coverPhoto, coverColor } = req.body;

  // Build user object
  const userFields = {};
  if (bio !== undefined) userFields.bio = bio;
  if (displayName !== undefined) userFields.displayName = displayName;
  if (location !== undefined) userFields.location = location;
  if (country !== undefined) userFields.country = country;
  if (gender !== undefined) userFields.gender = gender;
  if (website !== undefined) userFields.website = website;
  if (birthday !== undefined) userFields.birthday = birthday;
  if (avatar !== undefined) userFields.avatar = avatar;
  if (coverPhoto !== undefined) userFields.coverPhoto = coverPhoto;
  if (coverColor !== undefined) userFields.coverColor = coverColor;

  try {
    // Update user
    let user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: userFields },
      { new: true }
    ).select("-password");

    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile (extended version supporting AccountSetup)
// @access  Private
router.put("/profile", auth, async (req, res) => {
  try {
    // Extract fields from the request body
    const { name, bio, location, country, gender, birthday, occupation, education, interests } = req.body;
    
    // Build user object
    const userFields = {};
    if (name !== undefined) userFields.displayName = name;
    if (bio !== undefined) userFields.bio = bio;
    if (location !== undefined) userFields.location = location;
    if (country !== undefined) userFields.country = country;
    if (gender !== undefined) userFields.gender = gender;
    if (birthday !== undefined) userFields.birthday = birthday;
    if (occupation !== undefined) userFields.occupation = occupation;
    if (education !== undefined) userFields.education = education;
    
    // Handle interests array
    if (interests !== undefined) {
      try {
        userFields.interests = typeof interests === 'string' ? JSON.parse(interests) : interests;
      } catch (err) {
        console.error("Error parsing interests:", err);
        userFields.interests = [];
      }
    }
    
    // Handle profile image upload if included
    if (req.files && req.files.profileImage) {
      // Here you would implement file upload logic
      // For now, just set the avatar field
      userFields.avatar = '/default-avatar.png'; // Placeholder
    }
    
    // Update user
    let user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: userFields },
      { new: true }
    ).select("-password");

    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   PUT /api/user/block/:id
// @desc    Block or unblock a user
// @access  Private
router.put("/block/:id", auth, async (req, res) => {
  try {
    // Check if trying to block self
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: "Cannot block yourself" });
    }
    
    const userToBlock = await User.findById(req.params.id);
    if (!userToBlock) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const currentUser = await User.findById(req.user.id);
    
    // Check if user is already blocked
    const alreadyBlocked = currentUser.blockedUsers.some(
      block => block.user.toString() === req.params.id
    );
    
    if (alreadyBlocked) {
      // Unblock user
      currentUser.blockedUsers = currentUser.blockedUsers.filter(
        block => block.user.toString() !== req.params.id
      );
      
      await currentUser.save();
      
      return res.json({ 
        message: "User unblocked",
        blocked: false,
        blockedUsers: currentUser.blockedUsers
      });
    } else {
      // Block user
      currentUser.blockedUsers.unshift({ user: req.params.id });
      
      // If currently following, unfollow
      if (currentUser.following.some(follow => follow.user.toString() === req.params.id)) {
        currentUser.following = currentUser.following.filter(
          follow => follow.user.toString() !== req.params.id
        );
        
        // Also remove from their followers list
        userToBlock.followers = userToBlock.followers.filter(
          follow => follow.user.toString() !== req.user.id
        );
        await userToBlock.save();
      }
      
      await currentUser.save();
      
      return res.json({ 
        message: "User blocked",
        blocked: true,
        blockedUsers: currentUser.blockedUsers
      });
    }
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(500).send("Server error");
  }
});

// @route   GET /api/user/blocked/:id
// @desc    Get all blocked users
// @access  Private
router.get("/blocked/:id", auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("blockedUsers.user", "username displayName avatar isVerified");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json(user.blockedUsers);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET /api/user/test
// @desc    Test endpoint to check user model and routes
// @access  Public
router.get("/test", async (req, res) => {
  try {
    // List all routes in this router
    const routes = [];
    router.stack.forEach(function(r){
      if (r.route && r.route.path) {
        routes.push({
          path: r.route.path,
          methods: Object.keys(r.route.methods).join(', ')
        });
      }
    });
    
    // Return test data
    res.json({
      message: "User routes are working",
      routes: routes,
      userSchema: {
        paths: Object.keys(User.schema.paths),
        blockedUsersField: User.schema.paths.blockedUsers ? "exists" : "not found"
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
