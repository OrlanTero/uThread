const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Keep track of connected users
const connectedUsers = new Map();

/**
 * Socket.IO handler for real-time notifications
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
    
    // Send auth success confirmation
    socket.emit('auth_success', { 
      userId: userId,
      username: socket.user.username
    });
    
    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${userId}`);
      // Remove user from connected users map
      connectedUsers.delete(userId);
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
    }
  };
};

module.exports = socketHandler; 