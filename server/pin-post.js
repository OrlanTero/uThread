// Script to pin a post in the database
const mongoose = require('mongoose');
const Post = require('./models/Post');
require('dotenv').config();

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/uthread', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB Connected...'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

async function pinFirstPost() {
  try {
    // Get the first post
    const post = await Post.findOne({ parentPostId: null }).sort({ createdAt: -1 });
    
    if (!post) {
      console.log('No posts found in database');
      process.exit(0);
    }
    
    console.log(`Found post: ${post._id}`);
    console.log(`Current isPinned value: ${post.isPinned}`);
    
    // Update the post's isPinned status
    post.isPinned = true;
    await post.save();
    
    // Verify the post was updated
    const updatedPost = await Post.findById(post._id);
    console.log(`Updated isPinned value: ${updatedPost.isPinned}`);
    
    // Count all pinned posts
    const pinnedPostsCount = await Post.countDocuments({ isPinned: true });
    console.log(`Total pinned posts in database: ${pinnedPostsCount}`);
    
    // List all pinned posts
    const pinnedPosts = await Post.find({ isPinned: true });
    console.log('Pinned posts:');
    pinnedPosts.forEach(p => {
      console.log(`- ${p._id} (isPinned: ${p.isPinned})`);
    });
    
    console.log(`Successfully pinned post: ${post._id}`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

// Run the function
pinFirstPost(); 