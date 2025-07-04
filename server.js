require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const nodemailer = require('nodemailer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const dataManager = require('./utils/dataManager');

const app = express();
const PORT = process.env.PORT || 3000;

// Cookie parser for JWT tokens
app.use(cookieParser());

// Rate limiting for admin routes
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 attempts
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Security functions
function generateDailyPasscode() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const secret = process.env.ADMIN_SECRET || 'fallback-secret';
  const hash = crypto.createHash('sha256').update(today + secret).digest('hex');
  const numericCode = parseInt(hash.substring(0, 8), 16) % 10000;
  return `SPA${numericCode.toString().padStart(4, '0')}`;
}

function generateJWT() {
  const payload = {
    isAdmin: true,
    loginTime: new Date().toISOString(),
    exp: Math.floor(Date.now() / 1000) + (30 * 60) // 30 minutes
  };
  return jwt.sign(payload, process.env.JWT_SECRET || 'fallback-jwt-secret');
}

function verifyJWT(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'fallback-jwt-secret');
  } catch (error) {
    return null;
  }
}

function isValidAdminToken(req) {
  const token = req.cookies.adminToken;
  if (!token) return false;
  
  const decoded = verifyJWT(token);
  return decoded && decoded.isAdmin === true;
}

function requireAdminAuth(req, res, next) {
  if (!isValidAdminToken(req)) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  next();
}

function sanitizeContent(content) {
  // Basic HTML sanitization - remove script tags and dangerous elements
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Helper function for formatting blog content
app.locals.formatArticleContent = function(content) {
  return content
    // Convert **bold** to <strong> tags
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Convert section headers (lines that end with colon)
    .replace(/^(.+):$/gm, '<h3>$1</h3>')
    // Split into paragraphs and wrap in <p> tags
    .split('\n\n')
    .map(paragraph => {
      paragraph = paragraph.trim();
      if (!paragraph) return '';
      
      // Don't wrap headings in paragraphs
      if (paragraph.startsWith('<h')) {
        return paragraph;
      }
      
      // Handle bullet points
      if (paragraph.includes('\n-')) {
        const lines = paragraph.split('\n');
        const firstLine = lines[0];
        const bullets = lines.slice(1).filter(line => line.trim().startsWith('-'));
        
        let html = firstLine ? `<p>${firstLine.replace(/\n/g, '<br>')}</p>` : '';
        if (bullets.length > 0) {
          html += '<ul>';
          bullets.forEach(bullet => {
            const text = bullet.replace(/^-\s*/, '').trim();
            if (text) html += `<li>${text}</li>`;
          });
          html += '</ul>';
        }
        return html;
      }
      
      // Regular paragraph
      return `<p>${paragraph.replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
};

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Data storage variables - loaded from persistent storage
let blogPosts = [];
let galleryImages = [];
let analytics = {};
let mediaLibrary = [];
let socialPosts = [];

// Initialize data on server start
async function initializeData() {
  try {
    console.log('Loading persistent data...');
    blogPosts = await dataManager.loadBlogPosts();
    galleryImages = await dataManager.loadGalleryImages();
    analytics = await dataManager.loadAnalytics();
    mediaLibrary = await dataManager.loadMediaLibrary();
    socialPosts = await dataManager.loadSocialPosts();
    
    console.log(`Loaded: ${blogPosts.length} blog posts, ${galleryImages.length} gallery images, ${mediaLibrary.length} media items, ${socialPosts.length} social posts`);
    
    // Create backup on startup
    await dataManager.createBackup();
  } catch (error) {
    console.error('Error initializing data:', error);
  }
}

// Social media platform settings
let socialSettings = {
  google: { 
    connected: false, 
    credentials: null,
    refreshToken: null,
    businessLocations: []
  },
  facebook: { connected: false, credentials: null },
  instagram: { connected: false, credentials: null },
  defaultTemplate: "#HotTubRepair #DenverServices #SpaExperts\n\nCall (856) 266-7293 for professional hot tub service!"
};


// Enhanced multer setup for media uploads
const mediaStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/media/');
  },
  filename: function (req, file, cb) {
    const uniqueName = uuidv4() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const mediaUpload = multer({ 
  storage: mediaStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  }
});

// Reviews functionality (Google Places API removed)
async function getGoogleReviews() {
  // Google Places API removed - using fallback reviews
  console.log('Google Places API removed - using fallback reviews');
  return null;

}

// API endpoint to get reviews
app.get('/api/reviews', async (req, res) => {
  try {
    const reviews = await getGoogleReviews();
    if (reviews) {
      res.json({ success: true, data: reviews });
    } else {
      res.json({ success: false, message: 'Reviews not available' });
    }
  } catch (error) {
    console.error('Reviews API error:', error);
    res.json({ success: false, message: 'Error fetching reviews' });
  }
});

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/services', (req, res) => {
  res.render('services');
});

app.get('/gallery', (req, res) => {
  res.render('gallery', { images: galleryImages });
});

app.get('/about', (req, res) => {
  res.render('about');
});

app.get('/contact', (req, res) => {
  res.render('contact');
});

app.get('/blog', (req, res) => {
  // Track blog page view
  const today = new Date().toISOString().split('T')[0];
  if (!analytics.blogPageViews[today]) {
    analytics.blogPageViews[today] = 0;
  }
  analytics.blogPageViews[today]++;
  
  res.render('blog', { posts: blogPosts });
});

// Individual blog post route
app.get('/blog/:id', (req, res) => {
  const postId = parseInt(req.params.id);
  const post = blogPosts.find(p => p.id === postId);
  
  if (!post) {
    return res.status(404).render('404', { 
      title: 'Blog Post Not Found',
      message: 'The blog post you are looking for does not exist.' 
    });
  }
  
  // Track individual article view
  const today = new Date().toISOString().split('T')[0];
  if (!analytics.articleExpansions[today]) {
    analytics.articleExpansions[today] = {};
  }
  if (!analytics.articleExpansions[today][post.title]) {
    analytics.articleExpansions[today][post.title] = 0;
  }
  analytics.articleExpansions[today][post.title]++;
  
  res.render('blog-post', { post });
});

// Admin routes
app.get('/admin/blog', (req, res) => {
  if (!isValidAdminToken(req)) {
    return res.redirect('/admin/login');
  }
  res.render('admin-dashboard', { 
    posts: blogPosts,
    todaysCode: generateDailyPasscode()
  });
});

app.get('/admin/login', (req, res) => {
  if (isValidAdminToken(req)) {
    return res.redirect('/admin/blog');
  }
  res.render('admin-login');
});

app.post('/admin/login', adminLimiter, (req, res) => {
  const { passcode } = req.body;
  const validPasscode = generateDailyPasscode();
  
  if (!passcode || passcode.toUpperCase() !== validPasscode) {
    return res.json({ 
      success: false, 
      error: 'Invalid passcode. Please check today\'s code and try again.' 
    });
  }
  
  const token = generateJWT();
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.cookie('adminToken', token, {
    httpOnly: true,
    secure: isProduction, // HTTPS only in production
    sameSite: 'strict',
    maxAge: 30 * 60 * 1000, // 30 minutes
    path: '/'
  });
  
  res.json({ 
    success: true, 
    message: 'Login successful' 
  });
});

app.get('/admin/logout', (req, res) => {
  res.clearCookie('adminToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });
  res.redirect('/blog');
});

app.post('/admin/add-post', requireAdminAuth, (req, res) => {
  const { title, content } = req.body;
  
  if (!title || !content) {
    return res.json({ 
      success: false, 
      error: 'Title and content are required' 
    });
  }
  
  const sanitizedContent = sanitizeContent(content);
  
  const newPost = {
    id: Date.now(),
    title: title.trim(),
    content: sanitizedContent,
    date: new Date(),
    author: 'Admin'
  };
  
  blogPosts.unshift(newPost);
  
  // Save to persistent storage
  dataManager.saveBlogPosts(blogPosts);
  
  res.json({ 
    success: true, 
    message: 'Blog post added successfully',
    post: newPost
  });
});

app.post('/admin/delete-post', requireAdminAuth, (req, res) => {
  const { postId } = req.body;
  
  if (!postId) {
    return res.json({ 
      success: false, 
      error: 'Post ID is required' 
    });
  }
  
  const initialLength = blogPosts.length;
  blogPosts = blogPosts.filter(post => post.id !== parseInt(postId));
  
  if (blogPosts.length === initialLength) {
    return res.json({ 
      success: false, 
      error: 'Post not found' 
    });
  }
  
  // Save to persistent storage
  dataManager.saveBlogPosts(blogPosts);
  
  res.json({ 
    success: true, 
    message: 'Blog post deleted successfully' 
  });
});

// Bulk import sample posts
app.post('/admin/import-sample-posts', requireAdminAuth, async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    // Read the sample posts file
    const samplePostsPath = path.join(__dirname, 'blog-content-ready.json');
    const sampleData = await fs.readFile(samplePostsPath, 'utf8');
    const samplePosts = JSON.parse(sampleData);
    
    let importCount = 0;
    
    // Add each post with proper formatting
    for (const post of samplePosts) {
      const newPost = {
        id: Date.now() + importCount, // Ensure unique IDs
        title: post.title.trim(),
        content: sanitizeContent(post.content),
        date: new Date(),
        author: 'Spa Doctors'
      };
      
      blogPosts.unshift(newPost);
      importCount++;
      
      // Small delay to ensure unique timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Save to persistent storage
    await dataManager.saveBlogPosts(blogPosts);
    
    res.json({
      success: true,
      message: `Successfully imported ${importCount} sample blog posts`,
      count: importCount
    });
    
  } catch (error) {
    console.error('Error importing sample posts:', error);
    res.json({
      success: false,
      error: 'Failed to import sample posts. Please try again.'
    });
  }
});

// Bulk import custom posts
app.post('/admin/bulk-import', requireAdminAuth, async (req, res) => {
  try {
    const { posts } = req.body;
    
    if (!posts || !Array.isArray(posts)) {
      return res.json({
        success: false,
        error: 'Invalid data format. Expected array of posts.'
      });
    }
    
    let importCount = 0;
    
    // Add each post with proper formatting
    for (const post of posts) {
      if (!post.title || !post.content) {
        continue; // Skip posts without required fields
      }
      
      const newPost = {
        id: Date.now() + importCount, // Ensure unique IDs
        title: post.title.trim(),
        content: sanitizeContent(post.content),
        date: new Date(),
        author: post.author || 'Admin'
      };
      
      blogPosts.unshift(newPost);
      importCount++;
      
      // Small delay to ensure unique timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Save to persistent storage
    await dataManager.saveBlogPosts(blogPosts);
    
    res.json({
      success: true,
      message: `Successfully imported ${importCount} blog posts`,
      count: importCount
    });
    
  } catch (error) {
    console.error('Error in bulk import:', error);
    res.json({
      success: false,
      error: 'Failed to import posts. Please check your data format.'
    });
  }
});

// Serve sitemap.xml with proper content-type
app.get('/sitemap.xml', (req, res) => {
  res.setHeader('Content-Type', 'application/xml');
  res.sendFile(path.join(__dirname, 'public/sitemap.xml'));
});

// Serve robots.txt
app.get('/robots.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.sendFile(path.join(__dirname, 'public/robots.txt'));
});

// Analytics tracking endpoints
app.post('/track-article-expansion', (req, res) => {
  const { articleTitle } = req.body;
  const today = new Date().toISOString().split('T')[0];
  
  if (!analytics.articleExpansions[articleTitle]) {
    analytics.articleExpansions[articleTitle] = {};
  }
  if (!analytics.articleExpansions[articleTitle][today]) {
    analytics.articleExpansions[articleTitle][today] = 0;
  }
  analytics.articleExpansions[articleTitle][today]++;
  
  res.json({ success: true });
});

// Track page views for customer journey
app.post('/track-page-view', (req, res) => {
  const { page, sessionId, timestamp } = req.body;
  const today = new Date().toISOString().split('T')[0];
  
  // Track overall page views
  if (!analytics.pageViews[page]) {
    analytics.pageViews[page] = {};
  }
  if (!analytics.pageViews[page][today]) {
    analytics.pageViews[page][today] = 0;
  }
  analytics.pageViews[page][today]++;
  
  // Track customer journey
  if (!analytics.customerJourneys[sessionId]) {
    analytics.customerJourneys[sessionId] = {
      pages: [],
      startTime: timestamp,
      lastActivity: timestamp
    };
  }
  
  analytics.customerJourneys[sessionId].pages.push({
    page: page,
    timestamp: timestamp
  });
  analytics.customerJourneys[sessionId].lastActivity = timestamp;
  
  res.json({ success: true });
});

// Analytics dashboard endpoint (JSON API)
app.get('/analytics-data', (req, res) => {
  const summary = {
    // Blog analytics
    totalBlogViews: Object.values(analytics.blogPageViews).reduce((sum, views) => sum + views, 0),
    articleStats: {},
    
    // Business analytics
    totalContacts: analytics.contactSubmissions.length,
    serviceRequests: {},
    contactTrends: {},
    customerJourneyStats: {},
    pagePerformance: {}
  };
  
  // Calculate blog article stats
  Object.keys(analytics.articleExpansions).forEach(title => {
    const totalExpansions = Object.values(analytics.articleExpansions[title]).reduce((sum, count) => sum + count, 0);
    summary.articleStats[title] = {
      totalExpansions,
      lastExpanded: Object.keys(analytics.articleExpansions[title]).length > 0 ? 
        Math.max(...Object.keys(analytics.articleExpansions[title]).map(date => new Date(date).getTime())) : null
    };
  });
  
  // Calculate service request stats
  analytics.contactSubmissions.forEach(submission => {
    const service = submission.service;
    if (!summary.serviceRequests[service]) {
      summary.serviceRequests[service] = {
        count: 0,
        avgMessageLength: 0,
        hasEmailCount: 0,
        hasPhoneCount: 0,
        referrerPages: {}
      };
    }
    
    summary.serviceRequests[service].count++;
    summary.serviceRequests[service].avgMessageLength += submission.messageLength;
    if (submission.hasEmail) summary.serviceRequests[service].hasEmailCount++;
    if (submission.hasPhone) summary.serviceRequests[service].hasPhoneCount++;
    
    const referrer = submission.referrerPage;
    if (!summary.serviceRequests[service].referrerPages[referrer]) {
      summary.serviceRequests[service].referrerPages[referrer] = 0;
    }
    summary.serviceRequests[service].referrerPages[referrer]++;
  });
  
  // Calculate averages
  Object.keys(summary.serviceRequests).forEach(service => {
    const stats = summary.serviceRequests[service];
    stats.avgMessageLength = Math.round(stats.avgMessageLength / stats.count);
  });
  
  // Calculate contact trends by day of week and hour
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  analytics.contactSubmissions.forEach(submission => {
    const day = dayNames[submission.dayOfWeek];
    const hour = submission.hourOfDay;
    
    if (!summary.contactTrends[day]) summary.contactTrends[day] = 0;
    summary.contactTrends[day]++;
  });
  
  // Page performance stats
  Object.keys(analytics.pageViews).forEach(page => {
    const totalViews = Object.values(analytics.pageViews[page]).reduce((sum, count) => sum + count, 0);
    summary.pagePerformance[page] = totalViews;
  });
  
  res.json({
    summary,
    rawData: analytics
  });
});

// Business dashboard page (formerly analytics)
app.get('/dashboard', (req, res) => {
  res.render('analytics'); // Still using analytics.ejs template
});

// Keep old analytics route for backwards compatibility
app.get('/analytics', (req, res) => {
  res.redirect('/dashboard');
});

// Serve sitemap.xml
app.get('/sitemap.xml', (req, res) => {
  res.set('Content-Type', 'application/xml');
  res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});

// Serve robots.txt
app.get('/robots.txt', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'robots.txt'));
});

app.post('/contact', async (req, res) => {
  const { name, email, phone, message, service, sessionId, referrerPage } = req.body;
  
  console.log('Contact form submission:', { name, email, phone, message, service });
  
  // Track contact form analytics
  const submissionData = {
    timestamp: new Date().toISOString(),
    service: service || 'General Contact',
    hasEmail: !!email,
    hasPhone: !!phone,
    messageLength: message ? message.length : 0,
    referrerPage: referrerPage || 'unknown',
    sessionId: sessionId,
    customerJourney: analytics.customerJourneys[sessionId] || null,
    dayOfWeek: new Date().getDay(),
    hourOfDay: new Date().getHours()
  };
  
  analytics.contactSubmissions.push(submissionData);
  
  // Save analytics data
  await dataManager.saveAnalytics(analytics);
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.BUSINESS_EMAIL || process.env.EMAIL_USER,
    subject: `New Service Request - ${service || 'General Contact'}`,
    html: `
      <h2>New Service Request from Spa Doctors Website</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      ${email ? `<p><strong>Email:</strong> ${email}</p>` : ''}
      ${service ? `<p><strong>Service Requested:</strong> ${service}</p>` : ''}
      <p><strong>Message:</strong></p>
      <p>${message}</p>
      <hr>
      <p><em>Submitted on: ${new Date().toLocaleString()}</em></p>
    `
  };
  
  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Thank you for your message! We will contact you soon.' });
  } catch (error) {
    console.error('Email error:', error);
    res.json({ success: true, message: 'Thank you for your message! We will contact you soon.' });
  }
});

app.post('/upload-image', upload.single('image'), async (req, res) => {
  if (req.file) {
    const newImage = {
      filename: req.file.filename,
      originalname: req.file.originalname,
      uploadDate: new Date()
    };
    galleryImages.push(newImage);
    
    // Save gallery images
    await dataManager.saveGalleryImages(galleryImages);
    
    res.json({ success: true, message: 'Image uploaded successfully!' });
  } else {
    res.json({ success: false, message: 'Failed to upload image.' });
  }
});

// Legacy insecure endpoint removed - use /admin/add-post instead

// Media Management Routes

// Create media uploads directory if it doesn't exist
const createDirectories = async () => {
  try {
    await fs.mkdir('./uploads/media', { recursive: true });
    await fs.mkdir('./uploads/thumbnails', { recursive: true });
  } catch (error) {
    console.log('Directories already exist or created successfully');
  }
};
createDirectories();

// Upload media endpoint
app.post('/upload-media', mediaUpload.array('mediaFiles', 5), async (req, res) => {
  try {
    const { title, tags } = req.body;
    const uploadedFiles = [];

    for (const file of req.files) {
      const mediaItem = {
        id: uuidv4(),
        filename: file.filename,
        originalName: file.originalname,
        title: title || file.originalname,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
        type: file.mimetype.startsWith('image/') ? 'image' : 'video',
        size: file.size,
        uploadDate: new Date(),
        path: file.path
      };

      // Generate thumbnail for images
      if (mediaItem.type === 'image') {
        try {
          const thumbnailName = 'thumb_' + mediaItem.filename;
          await sharp(file.path)
            .resize(300, 300, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toFile(path.join('./uploads/thumbnails', thumbnailName));
          mediaItem.thumbnail = thumbnailName;
        } catch (thumbError) {
          console.error('Thumbnail generation failed:', thumbError);
        }
      }

      mediaLibrary.push(mediaItem);
      uploadedFiles.push(mediaItem);
    }

    // Save media library
    await dataManager.saveMediaLibrary(mediaLibrary);

    res.json({ 
      success: true, 
      message: `${uploadedFiles.length} file(s) uploaded successfully!`,
      files: uploadedFiles 
    });
  } catch (error) {
    console.error('Media upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get media library
app.get('/media-library', (req, res) => {
  res.json(mediaLibrary.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate)));
});

// Delete media item
app.delete('/media/:id', async (req, res) => {
  try {
    const mediaId = req.params.id;
    const mediaIndex = mediaLibrary.findIndex(item => item.id === mediaId);
    
    if (mediaIndex === -1) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }

    const mediaItem = mediaLibrary[mediaIndex];
    
    // Delete files from disk
    try {
      await fs.unlink(mediaItem.path);
      if (mediaItem.thumbnail) {
        await fs.unlink(path.join('./uploads/thumbnails', mediaItem.thumbnail));
      }
    } catch (fileError) {
      console.error('File deletion error:', fileError);
    }

    // Remove from library
    mediaLibrary.splice(mediaIndex, 1);
    
    // Save media library
    await dataManager.saveMediaLibrary(mediaLibrary);
    
    res.json({ success: true, message: 'Media deleted successfully' });
  } catch (error) {
    console.error('Media deletion error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Social Media Routes

// Create social media post
app.post('/create-social-post', (req, res, next) => {
  // Use multer conditionally - only if there's a file
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    mediaUpload.single('mediaFile')(req, res, next);
  } else {
    next();
  }
}, async (req, res) => {
  try {
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Received request body:', req.body);
    console.log('Received file:', req.file ? 'Yes' : 'No');
    
    const { content, platforms } = req.body;
    console.log('Raw platforms data:', platforms);
    
    // Handle platforms - if it's already an array (JSON), use it; if string, parse it
    let parsedPlatforms;
    if (Array.isArray(platforms)) {
      parsedPlatforms = platforms;
    } else {
      parsedPlatforms = JSON.parse(platforms || '[]');
    }
    console.log('Parsed platforms:', parsedPlatforms);
    
    if (!content || !parsedPlatforms || parsedPlatforms.length === 0) {
      console.log('Validation failed - content:', !!content, 'platforms length:', parsedPlatforms?.length);
      return res.status(400).json({ success: false, error: 'Content and platforms are required' });
    }

    let mediaId = null;
    
    // Handle uploaded file
    if (req.file) {
      const mediaItem = {
        id: uuidv4(),
        filename: req.file.filename,
        originalName: req.file.originalname,
        title: req.file.originalname,
        type: req.file.mimetype.startsWith('image/') ? 'image' : 'video',
        size: req.file.size,
        uploadDate: new Date(),
        path: req.file.path
      };
      
      // Generate thumbnail for images
      if (mediaItem.type === 'image') {
        try {
          const thumbnailName = 'thumb_' + mediaItem.filename;
          await sharp(req.file.path)
            .resize(300, 300, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toFile(path.join('./uploads/thumbnails', thumbnailName));
          mediaItem.thumbnail = thumbnailName;
        } catch (thumbError) {
          console.error('Thumbnail generation failed:', thumbError);
        }
      }
      
      mediaLibrary.push(mediaItem);
      mediaId = mediaItem.id;
    }

    const postId = uuidv4();
    const post = {
      id: postId,
      content: content,
      mediaId: mediaId,
      platforms: parsedPlatforms,
      status: 'scheduled', // For now, we'll mark as scheduled until APIs are fully implemented
      postDate: new Date(),
      createdAt: new Date(),
      analytics: {
        views: 0,
        likes: 0,
        shares: 0,
        comments: 0
      }
    };

    // In a real implementation, this is where we'd call the social media APIs
    // For now, we'll simulate the posting
    const results = {};
    for (const platform of parsedPlatforms) {
      switch (platform) {
        case 'google':
          results.google = {
            platform: 'google_business',
            success: false,
            error: 'Google Business Profile integration removed (API access denied)',
            message: 'Please post manually to your Google Business listing'
          };
          break;
        case 'facebook':
          results.facebook = await postToFacebook(post);
          break;
        case 'instagram':
          results.instagram = await postToInstagram(post);
          break;
      }
    }

    post.platformResults = results;
    post.status = 'published';
    socialPosts.unshift(post);
    
    // Save social posts
    await dataManager.saveSocialPosts(socialPosts);

    res.json({ 
      success: true, 
      message: 'Post created successfully!',
      post: post,
      results: results
    });
  } catch (error) {
    console.error('Social post creation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get social media posts
app.get('/social-posts', (req, res) => {
  res.json(socialPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// Get social media settings
app.get('/social-settings', (req, res) => {
  res.json(socialSettings);
});

// Update social media settings
app.post('/social-settings', (req, res) => {
  try {
    const { defaultTemplate, autoAddContact, includeWebsiteLink, sendNotifications } = req.body;
    
    if (defaultTemplate) {
      socialSettings.defaultTemplate = defaultTemplate;
    }
    
    socialSettings.autoAddContact = autoAddContact;
    socialSettings.includeWebsiteLink = includeWebsiteLink;
    socialSettings.sendNotifications = sendNotifications;
    
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Real social media posting functions - ready for API integration
async function postToFacebook(post) {
  // TODO: Implement Facebook Graph API posting
  // Requires: Facebook Page Access Token, Facebook App ID
  console.log('Facebook posting not yet implemented - requires Facebook Graph API setup');
  return {
    platform: 'facebook',
    success: false,
    error: 'Facebook API not configured',
    message: 'Please configure Facebook Graph API credentials',
    setupRequired: true
  };
}

async function postToInstagram(post) {
  // TODO: Implement Instagram Basic Display API posting
  // Requires: Instagram Business Account, Facebook Graph API
  console.log('Instagram posting not yet implemented - requires Instagram Business API setup');
  return {
    platform: 'instagram',
    success: false,
    error: 'Instagram API not configured',
    message: 'Please configure Instagram Business API credentials',
    setupRequired: true
  };
}

// Google Business Profile integration removed (API access denied)


// Serve uploaded media files
app.use('/uploads/media', express.static(path.join(__dirname, 'uploads/media')));
app.use('/uploads/thumbnails', express.static(path.join(__dirname, 'uploads/thumbnails')));

// Initialize data on server start
initializeData();

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Spa Doctors website running on http://localhost:${PORT}`);
  });
}

module.exports = app;