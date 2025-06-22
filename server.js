require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');

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

// Simple analytics tracking
let blogAnalytics = {
  pageViews: {},
  articleExpansions: {},
  dailyStats: {}
};

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
  if (!blogAnalytics.pageViews[today]) {
    blogAnalytics.pageViews[today] = 0;
  }
  blogAnalytics.pageViews[today]++;
  
  res.render('blog', { posts: blogPosts });
});

// Analytics tracking endpoints
app.post('/track-article-expansion', (req, res) => {
  const { articleTitle } = req.body;
  const today = new Date().toISOString().split('T')[0];
  
  if (!blogAnalytics.articleExpansions[articleTitle]) {
    blogAnalytics.articleExpansions[articleTitle] = {};
  }
  if (!blogAnalytics.articleExpansions[articleTitle][today]) {
    blogAnalytics.articleExpansions[articleTitle][today] = 0;
  }
  blogAnalytics.articleExpansions[articleTitle][today]++;
  
  res.json({ success: true });
});

// Analytics dashboard endpoint (JSON API)
app.get('/analytics-data', (req, res) => {
  const summary = {
    totalPageViews: Object.values(blogAnalytics.pageViews).reduce((sum, views) => sum + views, 0),
    articleStats: {}
  };
  
  // Calculate stats for each article
  Object.keys(blogAnalytics.articleExpansions).forEach(title => {
    const totalExpansions = Object.values(blogAnalytics.articleExpansions[title]).reduce((sum, count) => sum + count, 0);
    summary.articleStats[title] = {
      totalExpansions,
      lastExpanded: Math.max(...Object.keys(blogAnalytics.articleExpansions[title]).map(date => new Date(date).getTime()))
    };
  });
  
  res.json({
    summary,
    rawData: blogAnalytics
  });
});

// Analytics dashboard page
app.get('/analytics', (req, res) => {
  res.render('analytics');
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
  const { name, email, phone, message, service } = req.body;
  
  console.log('Contact form submission:', { name, email, phone, message, service });
  
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

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Spa Doctors website running on http://localhost:${PORT}`);
  });
}

module.exports = app;