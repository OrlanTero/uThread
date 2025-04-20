const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const postRoutes = require("./routes/posts");
const uploadRoutes = require("./routes/upload");
const topicRoutes = require("./routes/api/topics");
const notificationRoutes = require("./routes/notifications");
const statsRoutes = require("./routes/stats");
const messagesRoutes = require("./routes/messages");
const socketHandler = require("./socket/socketHandler");
const notificationService = require("./services/notificationService");

// Load environment variables
dotenv.config();

const development = process.env.NODE_ENV === "development";

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server and Socket.IO server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['https://uthread.site', 'http://uthread.site', 'http://localhost:3000'], // Match the Express CORS settings
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-auth-token"],
    credentials: true
  }
});

// Middleware
app.use(express.json());

// Configure CORS - update to allow specific origins
app.use(cors({
  origin: ['https://uthread.site', 'http://uthread.site', 'http://localhost:3000'], // Allow both HTTP and HTTPS
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Add a specific handler for OPTIONS requests (preflight)
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');
  res.header('Access-Control-Allow-Credentials', true);
  res.status(204).end();
});

// Serve static files from the uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Connect to MongoDB
mongoose
  .connect(development ? process.env.MONGO_URI_LOCAL : process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Initialize Socket.IO connection handler
const socketInstance = socketHandler(io);

// Make socket instance available to routes
app.set('socketInstance', socketInstance);

// Initialize notification service with Socket.IO
notificationService.initialize(io);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/topics", topicRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/messages", messagesRoutes);

// Print registered routes for debugging
app._router.stack.forEach(function(r){
  if (r.route && r.route.path) {
    console.log('Route:', r.route.path)
  } else if (r.name === 'router' && r.handle.stack) {
    console.log('Router middleware:', r.regexp);
    r.handle.stack.forEach(function(r2){
      if (r2.route && r2.route.path) {
        console.log(' - Route:', r2.route.path);
      }
    });
  }
});

// Default route
app.get("/", (req, res) => {
  res.send("UThread API is running");
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
