const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");

// Keep track of connected users
const connectedUsers = new Map();
// Keep track of users who are typing
const typingUsers = new Map();

/**
 * Socket.IO handler for real-time notifications and messaging
 * @param {Object} io - Socket.IO server instance
 */
const socketHandler = (io) => {
  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        console.log("Socket auth failed: Token missing");
        return next(new Error("Authentication error: Token missing"));
      }
      
      // Log token info for debugging (only partial to maintain security)
      console.log(`Received token: ${token.substring(0, 15)}... (length: ${token.length})`);
      
      try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Decoded token:", JSON.stringify(decoded));
        
        // Try multiple approaches to extract the user ID
        let userId = null;
        
        // Approach 1: Extract from user.id (standard JWT structure)
        if (decoded.user && decoded.user.id) {
          userId = decoded.user.id;
          console.log("Found userId from decoded.user.id:", userId);
        } 
        // Approach 2: Extract from direct id field
        else if (decoded.id) {
          userId = decoded.id;
          console.log("Found userId from decoded.id:", userId);
        }
        // Approach 3: Extract from sub field (common JWT standard)
        else if (decoded.sub) {
          userId = decoded.sub;
          console.log("Found userId from decoded.sub:", userId);
        }
        // Approach 4: Check for _id field
        else if (decoded._id) {
          userId = decoded._id;
          console.log("Found userId from decoded._id:", userId);
        }
        // Approach 5: If decoded itself is a string, use that
        else if (typeof decoded === 'string') {
          userId = decoded;
          console.log("Using decoded string as userId:", userId);
        }
        // Approach 6: Last resort - look for any string field that might be an ID
        else {
          console.log("Searching for userId in decoded object with keys:", Object.keys(decoded));
          for (const key in decoded) {
            if (typeof decoded[key] === 'string' && decoded[key].length >= 24) {
              userId = decoded[key];
              console.log(`Found potential userId in decoded.${key}:`, userId);
              break;
            } else if (typeof decoded[key] === 'object' && decoded[key] !== null) {
              for (const subKey in decoded[key]) {
                if (typeof decoded[key][subKey] === 'string' && decoded[key][subKey].length >= 24) {
                  userId = decoded[key][subKey];
                  console.log(`Found potential userId in decoded.${key}.${subKey}:`, userId);
                  break;
                }
              }
            }
          }
        }
        
        if (!userId) {
          console.log("Failed to extract userId from token");
          return next(new Error("Authentication error: Invalid token format"));
        }
        
        // Find user by ID
        console.log("Looking up user with ID:", userId);
        const user = await User.findById(userId).select("-password");
        
        if (!user) {
          console.log("User not found with ID:", userId);
          return next(new Error("Authentication error: User not found"));
        }
        
        console.log("Socket authentication successful for user:", user.username);
        
        // Attach user data to socket
        socket.user = user;
        next();
      } catch (jwtError) {
        console.error("JWT verification error:", jwtError);
        
        // Try to extract data from token even if verification fails
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const base64Payload = parts[1];
            const payload = Buffer.from(base64Payload, 'base64').toString('utf8');
            console.log("Extracted unverified payload:", payload);
          }
        } catch (parseErr) {
          console.error("Error parsing token parts:", parseErr);
        }
        
        return next(new Error("Authentication error: Invalid token"));
      }
    } catch (error) {
      console.error("Socket authentication error:", error);
      next(new Error("Authentication error: " + error.message));
    }
  });
  
  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();
    console.log(`User connected: ${userId}`);
    
    // Store user's socket connection
    connectedUsers.set(userId, socket.id);
    
    // Join user to their personal room for targeted notifications
    socket.join(`user:${userId}`);
    
    // Broadcast online status to friends/followers
    io.emit('user_status', { userId, status: 'online' });
    
    // Send auth success confirmation
    socket.emit('auth_success', { 
      userId: userId,
      username: socket.user.username
    });
    
    // Handle message sending
    socket.on('send_message', async (data) => {
      try {
        const { receiverId, content, media } = data;
        if (!receiverId) {
          socket.emit('message_error', { error: 'Recipient not specified' });
          return;
        }
        
        if ((!content || content.trim() === '') && (!media || media.length === 0)) {
          socket.emit('message_error', { error: 'Message cannot be empty' });
          return;
        }
        
        // Create new message
        const newMessage = new Message({
          senderId: userId,
          receiverId,
          content: content || '',
          media: media || [],
          isRead: false
        });
        
        const savedMessage = await newMessage.save();
        
        // Find or create conversation
        let conversation = await Conversation.findOne({
          participants: { $all: [userId, receiverId] }
        });
        
        if (!conversation) {
          conversation = new Conversation({
            participants: [userId, receiverId],
            lastMessage: savedMessage._id,
            lastMessageText: content || (media && media.length > 0 ? 'Sent media' : ''),
            lastMessageDate: new Date(),
            unreadCount: new Map([[receiverId, 1]])
          });
          await conversation.save();
        } else {
          // Update conversation metadata manually instead of using methods that call save()
          conversation.lastMessage = savedMessage._id;
          conversation.lastMessageText = content || (media && media.length > 0 ? 'Sent media' : '');
          conversation.lastMessageDate = new Date();
          
          // Manually update unread count instead of using incrementUnread method
          const userIdStr = receiverId.toString();
          const currentCount = conversation.unreadCount.get(userIdStr) || 0;
          conversation.unreadCount.set(userIdStr, currentCount + 1);
          
          await conversation.save();
        }
        
        // Populate sender info for the receiver's view
        const populatedMessage = await Message.findById(savedMessage._id)
          .populate('senderId', 'username displayName avatar');
          
        // Send to recipient if online
        if (connectedUsers.has(receiverId)) {
          io.to(`user:${receiverId}`).emit('new_message', populatedMessage);
          
          // Also send conversation update
          const populatedConversation = await Conversation.findById(conversation._id)
            .populate('participants', 'username displayName avatar')
            .populate('lastMessage');
            
          io.to(`user:${receiverId}`).emit('conversation_update', populatedConversation);
        }
        
        // Confirm to sender
        socket.emit('message_sent', savedMessage);
        
        // Send updated conversation to sender
        const populatedConversation = await Conversation.findById(conversation._id)
          .populate('participants', 'username displayName avatar')
          .populate('lastMessage');
          
        socket.emit('conversation_update', populatedConversation);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('message_error', { error: 'Failed to send message' });
      }
    });
    
    // Handle marking messages as read
    socket.on('mark_read', async (data) => {
      try {
        const { messageId, conversationId } = data;
        
        if (messageId) {
          // Mark individual message as read
          await Message.findByIdAndUpdate(messageId, { isRead: true });
        }
        
        if (conversationId) {
          // Find the conversation
          const conversation = await Conversation.findById(conversationId);
          
          if (conversation) {
            // Manually reset unread count instead of using method that calls save()
            const userIdStr = userId.toString();
            conversation.unreadCount.set(userIdStr, 0);
            await conversation.save();
            
            // Notify other participant their message was read
            const otherParticipantId = conversation.participants.find(
              p => p.toString() !== userId
            );
            
            if (otherParticipantId && connectedUsers.has(otherParticipantId.toString())) {
              io.to(`user:${otherParticipantId}`).emit('messages_read', {
                conversationId,
                readBy: userId
              });
            }
          }
        }
        
        // Confirm to sender
        socket.emit('read_confirmed', { messageId, conversationId });
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });
    
    // Handle typing indicators
    socket.on('typing', (data) => {
      const { receiverId, isTyping } = data;
      
      if (!receiverId) return;
      
      // Store typing state for this user-receiver pair
      const typingKey = `${userId}-${receiverId}`;
      
      if (isTyping) {
        typingUsers.set(typingKey, Date.now());
      } else {
        typingUsers.delete(typingKey);
      }
      
      // Notify receiver if they're online
      if (connectedUsers.has(receiverId)) {
        io.to(`user:${receiverId}`).emit('user_typing', {
          senderId: userId,
          isTyping
        });
      }
    });
    
    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${userId}`);
      // Remove user from connected users map
      connectedUsers.delete(userId);
      
      // Clear typing indicators for this user
      for (const [key, _] of typingUsers.entries()) {
        if (key.startsWith(`${userId}-`)) {
          typingUsers.delete(key);
        }
      }
      
      // Broadcast offline status
      io.emit('user_status', { userId, status: 'offline' });
    });
  });
  
  return {
    /**
     * Send a notification to a specific user
     * @param {string} userId - The recipient's user ID
     * @param {Object} notification - The notification object
     */
    sendNotification: (userId, notification) => {
      io.to(`user:${userId}`).emit("notification", notification);
    },
    
    /**
     * Send a badge update to a specific user
     * @param {string} userId - The user ID
     * @param {number} count - The unread notification count
     */
    updateUnreadCount: (userId, count) => {
      io.to(`user:${userId}`).emit("unread_count", { count });
    },
    
    /**
     * Check if a user is online
     * @param {string} userId - The user ID to check
     * @returns {boolean} - Whether the user is online
     */
    isUserOnline: (userId) => {
      return connectedUsers.has(userId.toString());
    },
    
    /**
     * Get online status for a list of users
     * @param {Array<string>} userIds - Array of user IDs to check
     * @returns {Object} - Map of user IDs to online status
     */
    getOnlineStatus: (userIds) => {
      const statuses = {};
      userIds.forEach(id => {
        statuses[id] = connectedUsers.has(id.toString());
      });
      return statuses;
    },
    
    /**
     * Send a direct message to a specific user
     * @param {string} senderId - The sender's user ID
     * @param {string} receiverId - The recipient's user ID
     * @param {Object} message - The message object
     */
    sendDirectMessage: async (senderId, receiverId, messageData) => {
      try {
        const { content, media } = messageData;
        
        // Create new message
        const newMessage = new Message({
          senderId,
          receiverId,
          content: content || '',
          media: media || [],
          isRead: false
        });
        
        const savedMessage = await newMessage.save();
        
        // Find or create conversation
        let conversation = await Conversation.findOne({
          participants: { $all: [senderId, receiverId] }
        });
        
        if (!conversation) {
          conversation = new Conversation({
            participants: [senderId, receiverId],
            lastMessage: savedMessage._id,
            lastMessageText: content || (media && media.length > 0 ? 'Sent media' : ''),
            lastMessageDate: new Date(),
            unreadCount: new Map([[receiverId, 1]])
          });
          await conversation.save();
        } else {
          // Update conversation metadata manually instead of using methods that call save()
          conversation.lastMessage = savedMessage._id;
          conversation.lastMessageText = content || (media && media.length > 0 ? 'Sent media' : '');
          conversation.lastMessageDate = new Date();
          
          // Manually update unread count
          const userIdStr = receiverId.toString();
          const currentCount = conversation.unreadCount.get(userIdStr) || 0;
          conversation.unreadCount.set(userIdStr, currentCount + 1);
          
          await conversation.save();
        }
        
        // Send to recipient if online
        if (connectedUsers.has(receiverId)) {
          // Populate sender info
          const populatedMessage = await Message.findById(savedMessage._id)
            .populate('senderId', 'username displayName avatar');
            
          io.to(`user:${receiverId}`).emit('new_message', populatedMessage);
          
          // Send conversation update
          const populatedConversation = await Conversation.findById(conversation._id)
            .populate('participants', 'username displayName avatar')
            .populate('lastMessage');
            
          io.to(`user:${receiverId}`).emit('conversation_update', populatedConversation);
        }
        
        return savedMessage;
      } catch (error) {
        console.error('Error sending direct message:', error);
        throw error;
      }
    },
    
    /**
     * Send a message to a specific user (directly to their socket)
     * @param {string} userId - The recipient's user ID
     * @param {string} event - The event name
     * @param {Object} data - The event data
     */
    sendToUser: (userId, event, data) => {
      io.to(`user:${userId}`).emit(event, data);
    }
  };
};

module.exports = socketHandler; 