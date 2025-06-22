require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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

let blogPosts = [
  {
    id: Date.now() + 1,
    title: "Essential Hot Tub Maintenance: Your Monthly Checklist",
    content: "Regular maintenance is the key to trouble-free hot tub ownership. A consistent routine prevents problems, extends equipment life, and ensures safe, clean water.\n\n## Weekly Tasks (5-10 minutes)\n\n**Water Testing & Chemical Balance**\n- Test pH, alkalinity, and sanitizer levels\n- Adjust chemicals as needed\n- Add shock treatment after heavy use\n- Check water level and top off if needed\n\n**Visual Inspection**\n- Check for debris in water or on surfaces\n- Verify all jets are functioning properly\n- Ensure spa cover is in good condition\n\n## Monthly Deep Maintenance (30-45 minutes)\n\n**Filter Care**\n- Remove and rinse cartridge filters\n- Rotate filter sets if you have spares\n- Replace filters every 12-18 months\n\n**Spa Shell Cleaning**\n- Wipe down surfaces with spa-safe cleaner\n- Clean waterline to remove oils and residue\n- Check jet faces for buildup\n\n**Cover Maintenance**\n- Clean both sides with mild soap\n- Condition vinyl with UV protectant\n- Check locks and hinges\n\n## Quarterly Tasks (1-2 hours)\n\n**Complete Water Change**\nDenver's hard water requires more frequent changes:\n- Drain spa completely\n- Clean shell thoroughly\n- Inspect plumbing for leaks\n- Refill and balance chemistry\n\n## Denver-Specific Considerations\n\n**Hard Water Management**\n- Use calcium hardness reducers monthly\n- Clean scale buildup regularly\n- Monitor for white residue\n\n**Altitude Effects**\n- Chemicals behave differently at 5,280 feet\n- UV exposure breaks down sanitizers faster\n- Equipment works harder at altitude\n\n## When to Call Professionals\n\nContact Spa Doctors for:\n- Persistent water chemistry problems\n- Unusual equipment noises\n- Heating issues or error codes\n- Any safety concerns\n\n**Need professional maintenance help? Spa Doctors offers comprehensive services throughout Denver. Call (856) 266-7293 for expert assistance.**",
    date: new Date('2024-12-21')
  },
  {
    id: Date.now() + 2,
    title: "Common Hot Tub Problems and Quick Troubleshooting",
    content: "Every hot tub owner encounters issues. While some problems need professional repair, many have simple solutions you can try first. Here's your guide to basic troubleshooting.\n\n## Water Issues\n\n**Cloudy Water**\nFirst steps: Test water chemistry (pH, alkalinity, sanitizer). Adjust levels and run filtration for several hours. Clean or replace dirty filters.\n\nCall professionals if: Water stays cloudy after 24-48 hours.\n\n**Foamy Water**\nQuick fix: Usually soap residue from lotions or body products. Shock treat and ensure bathers rinse before entering.\n\nCall professionals if: Foam persists or appears oily.\n\n**Green or Discolored Water**\nImmediate action: Stop using spa immediately. Indicates algae or metal contamination. Test and shock water.\n\nCall professionals if: You're uncomfortable with chemicals or discoloration returns.\n\n## Temperature Problems\n\n**Not Heating**\nCheck: Spa is in filter mode, temperature set higher than current, filters aren't clogged.\n\nCall professionals if: These steps don't work - likely electrical/pump issues.\n\n**Overheating**\nSafety first: Turn off power immediately. Check for blocked vents or dirty filters.\n\nCall professionals if: Frequent overheating indicates serious mechanical problems.\n\n## Pump and Flow Issues\n\n**Weak Water Flow**\nTry: Clean filter cartridges thoroughly. Check skimmer basket for debris.\n\nCall professionals if: Flow remains weak - could be pump problems.\n\n**Noisy Operation**\nListen: Grinding, squealing, rattling sounds need immediate attention.\n\nCall professionals if: Any unusual noises - continuing can cause expensive damage.\n\n## Denver-Specific Issues\n\n**Altitude Effects**\nColorado elevation affects pump performance. What seems broken might be normal at 5,280 feet.\n\n**Hard Water Effects**\nScale buildup affects jets and heating elements. Regular descaling prevents \"mechanical\" problems.\n\n## Safety Rules\n\n- Never attempt electrical repairs yourself\n- Don't ignore strange smells or sounds\n- When in doubt, turn off power and call professionals\n- Don't use spa with questionable water quality\n\n**Experiencing persistent problems? Spa Doctors provides expert diagnosis and repair in Denver. Call (856) 266-7293 for professional help.**",
    date: new Date('2024-12-21')
  },
  {
    id: Date.now() + 3,
    title: "Hot Tub Water Chemistry 101: The Denver Owner's Guide",
    content: "Proper hot tub water chemistry is essential for safe soaking and protecting your equipment. Denver's water conditions and altitude require special attention.\n\n## Water Chemistry Basics\n\n**pH Levels (7.2-7.6 ideal)**\nMeasures how acidic or basic your water is. Too low = equipment corrosion and skin irritation. Too high = ineffective sanitizers and cloudy water.\n\n**Total Alkalinity (80-120 ppm)**\nActs as pH buffer, preventing wild swings. Denver's high alkaline water requires closer monitoring.\n\n**Sanitizer Levels**\n- Chlorine: 1-3 ppm\n- Bromine: 2-4 ppm\nKills bacteria and keeps water safe. At Denver's altitude, chlorine dissipates faster due to UV exposure.\n\n## Denver-Specific Challenges\n\n**Hard Water Issues**\nDenver water is naturally hard (high calcium), causing scale buildup. Regular calcium hardness testing (150-300 ppm) is crucial.\n\n**Altitude Effects**\nAt 5,280 feet, chemicals behave differently. You may need adjusted dosing and more frequent testing.\n\n**Seasonal Changes**\nColorado's temperature extremes affect chemical consumption. Winter heating and summer UV impact chemistry differently than sea level.\n\n## Testing Schedule\n\n- **2-3 times weekly**: pH and sanitizer\n- **Weekly**: Alkalinity and calcium hardness\n- **Monthly**: Total dissolved solids\n\n## When to Call Professionals\n\nContact experts for:\n- Persistent cloudy/foamy water despite proper chemistry\n- Unusual odors or skin irritation\n- Equipment corrosion or scale damage\n- If uncomfortable handling chemicals\n\n## Denver Pro Tips\n\n1. Test before/after heavy use\n2. Keep chemicals covered - UV breaks down chlorine faster\n3. Monitor after storms - pressure changes affect balance\n4. Invest in quality testing equipment\n\n**Need help with water chemistry issues? Spa Doctors offers professional testing and treatment in Denver. Call (856) 266-7293 for expert assistance.**",
    date: new Date('2024-12-21')
  }
];
let galleryImages = [];

// Enhanced analytics tracking
let analytics = {
  // Blog analytics
  blogPageViews: {},
  articleExpansions: {},
  
  // Business analytics
  contactSubmissions: [],
  pageViews: {},
  customerJourneys: {},
  servicePageViews: {},
  
  // Performance metrics
  dailyStats: {}
};

// Media library storage
let mediaLibrary = [];

// Social media posts storage
let socialPosts = [];

// Social media platform settings
let socialSettings = {
  google: { connected: false, credentials: null },
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

// Google Business Profile API setup
async function getGoogleReviews() {
  try {
    // For now, we'll use a simpler approach with Google Places API
    // This requires a Google Cloud Platform API key
    if (!process.env.GOOGLE_PLACES_API_KEY) {
      console.log('Google Places API key not found');
      return null;
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${process.env.GOOGLE_PLACE_ID}&fields=reviews,rating,user_ratings_total&key=${process.env.GOOGLE_PLACES_API_KEY}`
    );
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.result.reviews) {
      return {
        reviews: data.result.reviews.slice(0, 6), // Get latest 6 reviews
        rating: data.result.rating,
        total_ratings: data.result.user_ratings_total
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching Google reviews:', error);
    return null;
  }
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

app.post('/upload-image', upload.single('image'), (req, res) => {
  if (req.file) {
    galleryImages.push({
      filename: req.file.filename,
      originalname: req.file.originalname,
      uploadDate: new Date()
    });
    res.json({ success: true, message: 'Image uploaded successfully!' });
  } else {
    res.json({ success: false, message: 'Failed to upload image.' });
  }
});

app.post('/add-blog-post', (req, res) => {
  const { title, content } = req.body;
  if (title && content) {
    blogPosts.unshift({
      id: Date.now(),
      title,
      content,
      date: new Date()
    });
    res.json({ success: true, message: 'Blog post added successfully!' });
  } else {
    res.json({ success: false, message: 'Title and content are required.' });
  }
});

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
    res.json({ success: true, message: 'Media deleted successfully' });
  } catch (error) {
    console.error('Media deletion error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Social Media Routes

// Create social media post
app.post('/create-social-post', async (req, res) => {
  try {
    const { content, media, platforms } = req.body;
    
    if (!content || !platforms || platforms.length === 0) {
      return res.status(400).json({ success: false, error: 'Content and platforms are required' });
    }

    const postId = uuidv4();
    const post = {
      id: postId,
      content: content,
      mediaId: media,
      platforms: platforms,
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
    for (const platform of platforms) {
      switch (platform) {
        case 'google':
          results.google = await simulateGoogleBusinessPost(post);
          break;
        case 'facebook':
          results.facebook = await simulateFacebookPost(post);
          break;
        case 'instagram':
          results.instagram = await simulateInstagramPost(post);
          break;
      }
    }

    post.platformResults = results;
    post.status = 'published';
    socialPosts.unshift(post);

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

// Simulated social media posting functions (replace with real APIs later)
async function simulateGoogleBusinessPost(post) {
  // Simulate Google Business Profile posting
  return {
    platform: 'google',
    success: true,
    postId: 'gb_' + Date.now(),
    message: 'Posted to Google Business Profile'
  };
}

async function simulateFacebookPost(post) {
  // Simulate Facebook posting
  return {
    platform: 'facebook',
    success: true,
    postId: 'fb_' + Date.now(),
    message: 'Posted to Facebook Page'
  };
}

async function simulateInstagramPost(post) {
  // Simulate Instagram posting
  return {
    platform: 'instagram',
    success: true,
    postId: 'ig_' + Date.now(),
    message: 'Posted to Instagram'
  };
}

// Serve uploaded media files
app.use('/uploads/media', express.static(path.join(__dirname, 'uploads/media')));
app.use('/uploads/thumbnails', express.static(path.join(__dirname, 'uploads/thumbnails')));

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Spa Doctors website running on http://localhost:${PORT}`);
  });
}

module.exports = app;