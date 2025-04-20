/**
 * Simple test endpoint for checking CORS configuration
 * 
 * Add this to your server code:
 * app.use('/cors-test', require('./cors-test'));
 */

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'CORS is working correctly if you can see this message in your browser',
    headers: {
      origin: req.headers.origin,
      host: req.headers.host
    }
  });
});

router.options('/', (req, res) => {
  res.status(200).end();
});

router.post('/', (req, res) => {
  res.json({
    success: true,
    message: 'POST request successful - CORS is working',
    headers: {
      origin: req.headers.origin,
      host: req.headers.host
    }
  });
});

module.exports = router; 