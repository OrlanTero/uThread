/**
 * Custom CORS middleware for handling preflight requests properly
 */
const corsMiddleware = (req, res, next) => {
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', 'https://uthread.site');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');
  res.header('Access-Control-Allow-Credentials', 'true');

  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    // Set cache headers to reduce the number of preflight requests
    res.header('Access-Control-Max-Age', '86400'); // 24 hours
    return res.status(204).end();
  }

  // Continue to the next middleware
  next();
};

module.exports = corsMiddleware; 