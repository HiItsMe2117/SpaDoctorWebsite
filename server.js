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

let blogPosts = [];
let galleryImages = [];

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
  res.render('blog', { posts: blogPosts });
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