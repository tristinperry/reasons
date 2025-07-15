const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const https = require('https');
const http = require('http');
const fs = require('fs');
require('dotenv').config();

// Profanity filter - comprehensive list of inappropriate words
const profanityList = [
  // Common profanity
        'example', 'example', 'example', 'example', 'example', 'example', 
        'example', 'example', 'example', 'example', 'example', 'example',
  // Racial slurs and hate speech
        'example', 'example', 'example', 'example', 'example', 'example', 
        'example', 'example', 'example', 'example', 'example', 'example',
            
            
  // LGBTQ+ slurs
        'example', 'example', 'example', 'example', 'example', 'example', 
        'example', 'example', 'example', 'example', 'example', 'example',
            
  // Religious slurs
        'example', 'example', 'example', 'example', 'example', 'example', 
        'example', 'example', 'example', 'example', 'example', 'example',
            
  // Disability slurs
        'example', 'example', 'example', 'example', 'example', 'example', 
        'example', 'example', 'example', 'example', 'example', 'example',
            
  // Body shaming and appearance
        'example', 'example', 'example', 'example', 'example', 'example', 
        'example', 'example', 'example', 'example', 'example', 'example',
            
  // Variations and leetspeak
        'example', 'example', 'example', 'example', 'example', 'example', 
        'example', 'example', 'example', 'example', 'example', 'example',
            
  // Internet slang variations
        'example', 'example', 'example', 'example', 'example', 'example', 
        'example', 'example', 'example', 'example', 'example', 'example',

        ];

function containsProfanity(text) {
  const normalizedText = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  // Check for exact word matches
  const words = normalizedText.split(' ');
  for (const word of words) {
    if (profanityList.includes(word)) {
      return true;
    }
  }
  
  // Check for partial matches within words (to catch leetspeak/variations)
  for (const profanity of profanityList) {
    if (normalizedText.includes(profanity)) {
      return true;
    }
  }
  
  // Check for character substitutions (e.g., @ for a, 3 for e, etc.)
  const leetText = normalizedText
    .replace(/[@4]/g, 'a')
    .replace(/3/g, 'e')
    .replace(/1/g, 'i')
    .replace(/0/g, 'o')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/\$/g, 's');
  
  for (const profanity of profanityList) {
    if (leetText.includes(profanity)) {
      return true;
    }
  }
  
  return false;
}

const app = express();
const HTTP_PORT = process.env.HTTP_PORT || 80;
const HTTPS_PORT = process.env.HTTPS_PORT || 443;

// Middleware
app.use(cors());
app.use(express.json());

// Force HTTPS redirect middleware
app.use((req, res, next) => {
  // Skip redirect for health checks or if already HTTPS
  if (req.header('x-forwarded-proto') !== 'https' && req.secure !== true && process.env.NODE_ENV === 'production') {
    return res.redirect(`https://${req.header('host')}${req.url}`);
  }
  next();
});

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.static('public'));

// Message Schema
const messageSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  color: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Add text index for search functionality
messageSchema.index({ 
  text: 'text', 
  author: 'text', 
  location: 'text' 
});

const Message = mongoose.model('Message', messageSchema);

// API Routes
app.get('/api/messages', async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    
    // If search parameter is provided, use MongoDB text search
    if (search) {
      query = {
        $or: [
          { text: { $regex: search, $options: 'i' } },
          { author: { $regex: search, $options: 'i' } },
          { location: { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(100); // Limit to last 100 messages
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const { text, author, location, color } = req.body;
    
    // Validate input
    if (!text || !author || !location || !color) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check for profanity in message text
    if (containsProfanity(text)) {
      return res.status(400).json({ 
        error: 'Your message contains inappropriate language. Please keep messages respectful.' 
      });
    }
    
    // Check for profanity in author name
    if (containsProfanity(author)) {
      return res.status(400).json({ 
        error: 'Your name contains inappropriate language. Please use a respectful name.' 
      });
    }
    
    // Check for profanity in location
    if (containsProfanity(location)) {
      return res.status(400).json({ 
        error: 'Your location contains inappropriate language. Please enter a valid location.' 
      });
    }
    
    const message = new Message({
      text: text.substring(0, 500), // Limit text length
      author: author.substring(0, 50),
      location: location.substring(0, 50),
      color
    });
    
    await message.save();
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// New search endpoint for better performance
app.get('/api/messages/search', async (req, res) => {
  try {
    const { q, limit = 50 } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const searchQuery = {
      $or: [
        { text: { $regex: q, $options: 'i' } },
        { author: { $regex: q, $options: 'i' } },
        { location: { $regex: q, $options: 'i' } }
      ]
    };
    
    const messages = await Message.find(searchQuery)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    
    const totalCount = await Message.countDocuments();
    const searchCount = await Message.countDocuments(searchQuery);
    
    res.json({
      messages,
      totalCount,
      searchCount,
      query: q
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get message statistics
app.get('/api/stats', async (req, res) => {
  try {
    const totalMessages = await Message.countDocuments();
    const uniqueAuthors = await Message.distinct('author');
    const uniqueLocations = await Message.distinct('location');
    
    res.json({
      totalMessages,
      uniqueAuthors: uniqueAuthors.length,
      uniqueLocations: uniqueLocations.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Function to create SSL server
function createSSLServer() {
  try {
    // Try to load SSL certificates
    const sslOptions = {
      key: fs.readFileSync(process.env.SSL_KEY_PATH || './ssl/private.key'),
      cert: fs.readFileSync(process.env.SSL_CERT_PATH || './ssl/certificate.crt'),
      // Include intermediate certificates if available
      ca: process.env.SSL_CA_PATH ? fs.readFileSync(process.env.SSL_CA_PATH) : undefined
    };
    
    return https.createServer(sslOptions, app);
  } catch (error) {
    console.error('SSL certificates not found or invalid:', error.message);
    console.log('Falling back to HTTP only...');
    return null;
  }
}

// Connect to MongoDB and start server
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/reasons';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Start HTTP server
    const httpServer = http.createServer(app);
    httpServer.listen(HTTP_PORT, () => {
      console.log(`HTTP Server running on port ${HTTP_PORT}`);
      console.log(`Visit: http://localhost:${HTTP_PORT}`);
    });
    
    // Try to start HTTPS server
    const httpsServer = createSSLServer();
    if (httpsServer) {
      httpsServer.listen(HTTPS_PORT, () => {
        console.log(`HTTPS Server running on port ${HTTPS_PORT}`);
        console.log(`Visit: https://localhost:${HTTPS_PORT}`);
      });
    }
  })
  .catch(error => {
    console.error('MongoDB connection error:', error);
  });

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('So long, and thanks for all the fish!');
  await mongoose.connection.close();
  process.exit(0);
});