const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const User = require("../models/User");
const auth = require("../middleware/auth");
const socketHandler = require("../socket/socketHandler");

// @route   GET /api/messages/conversations
// @desc    Get all conversations for the current user
// @access  Private
router.get("/conversations", auth, async (req, res) => {
  try {
    // Find all conversations where the current user is a participant
    let conversations = await Conversation.find({
      participants: req.user.id
    })
      .populate({
        path: "participants",
        select: "username displayName avatar"
      })
      .populate({
        path: "lastMessage",
        populate: {
          path: "senderId",
          select: "username displayName avatar"
        }
      })
      .sort({ updatedAt: -1 });

    // For each conversation, determine the other participant
    // and compute additional metadata for the current user's view
    conversations = conversations.map(conversation => {
      const conversationObj = conversation.toObject();
      
      // Find the other participant
      const otherParticipant = conversationObj.participants.find(
        p => p._id.toString() !== req.user.id
      );
      
      // Get user-specific settings 
      const userIdStr = req.user.id.toString();
      const unreadCount = conversation.unreadCount.get(userIdStr) || 0;
      const isPinned = conversation.isPinned.get(userIdStr) || false;
      const isMuted = conversation.isMuted.get(userIdStr) || false;
      
      // Add computed fields
      return {
        ...conversationObj,
        otherParticipant,
        unreadCount,
        isPinned,
        isMuted
      };
    });

    // Sort by pinned status first, then by last message date
    conversations.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.lastMessageDate) - new Date(a.lastMessageDate);
    });

    res.json(conversations);
  } catch (err) {
    console.error("Error getting conversations:", err.message);
    res.status(500).send("Server Error");
  }
});

// @route   GET /api/messages/conversations/:id
// @desc    Get a specific conversation by ID
// @access  Private
router.get("/conversations/:id", auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate({
        path: "participants",
        select: "username displayName avatar"
      })
      .populate({
        path: "lastMessage",
        populate: {
          path: "senderId",
          select: "username displayName avatar"
        }
      });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Verify the user is a participant in this conversation
    if (!conversation.participants.some(p => p._id.toString() === req.user.id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Return the conversation with user-specific data
    const conversationObj = conversation.toObject();
    const userIdStr = req.user.id.toString();
    
    const result = {
      ...conversationObj,
      otherParticipant: conversationObj.participants.find(
        p => p._id.toString() !== req.user.id
      ),
      unreadCount: conversation.unreadCount.get(userIdStr) || 0,
      isPinned: conversation.isPinned.get(userIdStr) || false,
      isMuted: conversation.isMuted.get(userIdStr) || false
    };

    res.json(result);
  } catch (err) {
    console.error("Error getting conversation:", err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Conversation not found" });
    }
    res.status(500).send("Server Error");
  }
});

// @route   GET /api/messages/conversations/:userId/with
// @desc    Get or create a conversation with a specific user
// @access  Private
router.get("/conversations/:userId/with", auth, async (req, res) => {
  try {
    const otherUserId = req.params.userId;
    
    // Verify the other user exists
    const otherUser = await User.findById(otherUserId).select("username displayName avatar");
    if (!otherUser) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Check if trying to message themselves
    if (otherUserId === req.user.id) {
      return res.status(400).json({ message: "Cannot message yourself" });
    }
    
    // Find existing conversation or create a new one
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user.id, otherUserId] }
    })
      .populate({
        path: "participants",
        select: "username displayName avatar"
      })
      .populate({
        path: "lastMessage",
        populate: {
          path: "senderId",
          select: "username displayName avatar"
        }
      });
    
    if (!conversation) {
      // Create a new conversation
      conversation = new Conversation({
        participants: [req.user.id, otherUserId],
        unreadCount: new Map(),
        isPinned: new Map(),
        isMuted: new Map()
      });
      
      await conversation.save();
      
      // Re-fetch with populated fields
      conversation = await Conversation.findById(conversation._id)
        .populate({
          path: "participants",
          select: "username displayName avatar"
        });
    }
    
    // Return conversation with user-specific data
    const conversationObj = conversation.toObject();
    const userIdStr = req.user.id.toString();
    
    const result = {
      ...conversationObj,
      otherParticipant: conversationObj.participants.find(
        p => p._id.toString() !== req.user.id
      ),
      unreadCount: conversation.unreadCount.get(userIdStr) || 0,
      isPinned: conversation.isPinned.get(userIdStr) || false,
      isMuted: conversation.isMuted.get(userIdStr) || false
    };
    
    res.json(result);
  } catch (err) {
    console.error("Error getting or creating conversation:", err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(500).send("Server Error");
  }
});

// @route   GET /api/messages/:conversationId
// @desc    Get messages for a specific conversation with pagination
// @access  Private
router.get("/:conversationId", auth, async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Verify the conversation exists and user is a participant
    const conversation = await Conversation.findById(conversationId);
    
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    
    if (!conversation.participants.some(p => p.toString() === req.user.id)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    // Find the other participant
    const otherParticipantId = conversation.participants.find(
      p => p.toString() !== req.user.id
    );
    
    // Find messages between these users, sorted by newest first for pagination
    const total = await Message.countDocuments({
      $or: [
        { 
          senderId: req.user.id, 
          receiverId: otherParticipantId 
        },
        { 
          senderId: otherParticipantId, 
          receiverId: req.user.id 
        }
      ]
    });
    
    // Get messages with pagination, but sort by oldest first in response
    const messages = await Message.find({
      $or: [
        { 
          senderId: req.user.id, 
          receiverId: otherParticipantId 
        },
        { 
          senderId: otherParticipantId, 
          receiverId: req.user.id 
        }
      ]
    })
      .populate({
        path: "senderId",
        select: "username displayName avatar"
      })
      .sort({ createdAt: -1 }) // Newest first for pagination
      .skip(skip)
      .limit(limit);
    
    // Mark unread messages as read if they were sent to current user
    const unreadMessages = messages.filter(
      message => 
        !message.isRead && 
        message.receiverId.toString() === req.user.id
    );
    
    if (unreadMessages.length > 0) {
      await Message.updateMany(
        { 
          _id: { $in: unreadMessages.map(m => m._id) }
        },
        { 
          isRead: true 
        }
      );
      
      // Reset unread count in conversation using new pattern
      conversation.resetUnread(req.user.id);
      await conversation.save();
      
      // Find sender ID (other participant)
      const senderId = unreadMessages[0].senderId._id || unreadMessages[0].senderId;
      
      // Notify sender that messages were read via socket
      const socketInstance = req.app.get('socketInstance');
      if (socketInstance && socketInstance.isUserOnline(senderId.toString())) {
        try {
          socketInstance.sendToUser(senderId.toString(), 'messages_read', {
            conversationId,
            readBy: req.user.id
          });
        } catch (socketError) {
          console.error("Socket error when notifying messages read:", socketError);
          // Continue even if socket notification fails
        }
      }
    }
    
    // Return messages sorted by oldest first (reversing the database sort)
    res.json({
      messages: messages.reverse(),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasMore: skip + messages.length < total
      }
    });
  } catch (err) {
    console.error("Error getting messages:", err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Conversation not found" });
    }
    res.status(500).send("Server Error");
  }
});

// @route   POST /api/messages
// @desc    Send a new message
// @access  Private
router.post("/", auth, async (req, res) => {
  try {
    const { receiverId, content, media } = req.body;
    
    if (!receiverId) {
      return res.status(400).json({ message: "Recipient is required" });
    }
    
    if ((!content || content.trim() === '') && (!media || media.length === 0)) {
      return res.status(400).json({ message: "Message cannot be empty" });
    }
    
    // Verify receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: "Recipient not found" });
    }
    
    // Check if trying to message themselves
    if (receiverId === req.user.id) {
      return res.status(400).json({ message: "Cannot send message to yourself" });
    }
    
    // Use the sendDirectMessage function from the socket handler
    const socketInstance = req.app.get('socketInstance');
    let savedMessage;
    
    if (socketInstance && socketInstance.sendDirectMessage) {
      try {
        // Use socket handler to send message
        savedMessage = await socketInstance.sendDirectMessage(
          req.user.id,
          receiverId,
          { content, media }
        );
      } catch (socketError) {
        console.error("Error using socket to send message:", socketError);
        // Fall back to direct database operations
        savedMessage = null;
      }
    }
    
    // If socket handler failed or is not available, use direct database operations
    if (!savedMessage) {
      // Create new message
      const newMessage = new Message({
        senderId: req.user.id,
        receiverId,
        content: content || '',
        media: media || [],
        isRead: false
      });
      
      savedMessage = await newMessage.save();
      
      // Find or create conversation
      let conversation = await Conversation.findOne({
        participants: { $all: [req.user.id, receiverId] }
      });
      
      if (!conversation) {
        conversation = new Conversation({
          participants: [req.user.id, receiverId],
          lastMessage: savedMessage._id,
          lastMessageText: content || (media && media.length > 0 ? 'Sent media' : ''),
          lastMessageDate: new Date(),
          unreadCount: new Map([[receiverId, 1]])
        });
        await conversation.save();
      } else {
        // Update conversation metadata directly
        conversation.lastMessage = savedMessage._id;
        conversation.lastMessageText = content || (media && media.length > 0 ? 'Sent media' : '');
        conversation.lastMessageDate = new Date();
        
        // Manually update unread count
        const userIdStr = receiverId.toString();
        const currentCount = conversation.unreadCount.get(userIdStr) || 0;
        conversation.unreadCount.set(userIdStr, currentCount + 1);
        
        await conversation.save();
      }
    }
    
    // Return populated message
    const populatedMessage = await Message.findById(savedMessage._id)
      .populate({
        path: "senderId",
        select: "username displayName avatar"
      });
    
    res.json(populatedMessage);
  } catch (err) {
    console.error("Error sending message:", err.message);
    res.status(500).send("Server Error");
  }
});

// @route   PUT /api/messages/:id/read
// @desc    Mark a message as read
// @access  Private
router.put("/:id/read", auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }
    
    // Verify user is the recipient
    if (message.receiverId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    // Mark as read
    message.isRead = true;
    await message.save();
    
    // Find conversation and update unread count
    const conversation = await Conversation.findOne({
      participants: { $all: [message.senderId, message.receiverId] }
    });
    
    if (conversation) {
      // Use the new method that doesn't save directly
      conversation.resetUnread(req.user.id);
      await conversation.save();
      
      // Notify sender that message was read via socket
      const socketInstance = req.app.get('socketInstance');
      if (socketInstance && socketInstance.isUserOnline(message.senderId.toString())) {
        try {
          socketInstance.sendToUser(message.senderId.toString(), 'message_read', {
            messageId: message._id,
            conversationId: conversation._id,
            readBy: req.user.id
          });
        } catch (socketError) {
          console.error("Socket error when notifying message read:", socketError);
          // Continue even if socket notification fails
        }
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error("Error marking message as read:", err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Message not found" });
    }
    res.status(500).send("Server Error");
  }
});

// @route   PUT /api/messages/conversations/:id/read
// @desc    Mark all messages in a conversation as read
// @access  Private
router.put("/conversations/:id/read", auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    
    // Verify user is a participant
    if (!conversation.participants.some(p => p.toString() === req.user.id)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    // Find the other participant
    const otherParticipantId = conversation.participants.find(
      p => p.toString() !== req.user.id
    );
    
    // Mark all messages from other user as read
    await Message.updateMany(
      { 
        senderId: otherParticipantId,
        receiverId: req.user.id,
        isRead: false
      },
      { 
        isRead: true 
      }
    );
    
    // Reset unread count using the new method that doesn't save directly
    conversation.resetUnread(req.user.id);
    await conversation.save();
    
    // Notify other participant
    const socketInstance = req.app.get('socketInstance');
    if (socketInstance && socketInstance.isUserOnline(otherParticipantId.toString())) {
      try {
        socketInstance.sendToUser(otherParticipantId.toString(), 'messages_read', {
          conversationId: conversation._id,
          readBy: req.user.id
        });
      } catch (socketError) {
        console.error("Socket error when notifying conversation read:", socketError);
        // Continue even if socket notification fails
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error("Error marking conversation as read:", err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Conversation not found" });
    }
    res.status(500).send("Server Error");
  }
});

// @route   PUT /api/messages/conversations/:id/pin
// @desc    Toggle pinned status for a conversation
// @access  Private
router.put("/conversations/:id/pin", auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    
    // Verify user is a participant
    if (!conversation.participants.some(p => p.toString() === req.user.id)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    // Toggle pinned status using new method that doesn't save directly
    conversation.togglePinned(req.user.id);
    await conversation.save();
    
    // Get the new status
    const isPinned = conversation.isPinned.get(req.user.id.toString()) || false;
    
    res.json({ 
      success: true,
      isPinned
    });
  } catch (err) {
    console.error("Error toggling pin status:", err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Conversation not found" });
    }
    res.status(500).send("Server Error");
  }
});

// @route   PUT /api/messages/conversations/:id/mute
// @desc    Toggle muted status for a conversation
// @access  Private
router.put("/conversations/:id/mute", auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    
    // Verify user is a participant
    if (!conversation.participants.some(p => p.toString() === req.user.id)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    // Toggle muted status using new method that doesn't save directly
    conversation.toggleMuted(req.user.id);
    await conversation.save();
    
    // Get the new status
    const isMuted = conversation.isMuted.get(req.user.id.toString()) || false;
    
    res.json({ 
      success: true,
      isMuted
    });
  } catch (err) {
    console.error("Error toggling mute status:", err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Conversation not found" });
    }
    res.status(500).send("Server Error");
  }
});

// @route   DELETE /api/messages/conversations/:id
// @desc    Delete a conversation (for current user only)
// @access  Private
router.delete("/conversations/:id", auth, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    
    // Verify user is a participant
    if (!conversation.participants.some(p => p.toString() === req.user.id)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    // In a real messaging system, we might soft-delete or archive
    // For this implementation, we'll just remove the conversation
    await Conversation.findByIdAndDelete(req.params.id);
    
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting conversation:", err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ message: "Conversation not found" });
    }
    res.status(500).send("Server Error");
  }
});

module.exports = router; 