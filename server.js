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
    content: "Regular maintenance is the key to enjoying years of trouble-free hot tub ownership. A consistent maintenance routine prevents most common problems, extends equipment life, and ensures safe, clean water for you and your family. Here's your comprehensive monthly checklist.\n\n## Weekly Tasks (5-10 minutes)\n\n**Water Testing & Chemical Balance**\n- Test pH, alkalinity, and sanitizer levels\n- Adjust chemicals as needed\n- Add shock treatment after heavy use\n- Check water level and top off if needed\n\n**Visual Inspection**\n- Look for any debris in the water or on surfaces\n- Check that all jets are functioning properly\n- Ensure spa cover is in good condition\n- Verify that control panel displays are normal\n\n## Monthly Deep Maintenance (30-45 minutes)\n\n**Filter Care**\n- Remove and rinse cartridge filters with garden hose\n- Rotate filter sets if you have spares\n- Soak heavily soiled filters in filter cleaner solution\n- Replace filters every 12-18 months or as needed\n\n**Spa Shell Cleaning**\n- Wipe down shell surfaces with spa-safe cleaner\n- Clean waterline with appropriate cleaner to remove oils and residue\n- Check and clean jet faces for any buildup\n- Inspect for any cracks or damage\n\n**Cover Maintenance**\n- Clean both sides of spa cover with mild soap\n- Condition vinyl surfaces with UV protectant\n- Check cover locks and hinges for proper operation\n- Ensure cover fits tightly for energy efficiency\n\n**Skimmer and Drains**\n- Remove and clean skimmer basket\n- Check drain covers for secure fit\n- Clear any debris from around suction points\n\n## Quarterly Tasks (1-2 hours)\n\n**Complete Water Change**\nDenver's hard water means more frequent changes may be needed:\n- Drain spa completely\n- Clean shell thoroughly while empty\n- Inspect plumbing connections for leaks\n- Refill with fresh water and balance chemistry\n\n**Deep Filter Cleaning**\n- Soak filters in commercial filter cleaner overnight\n- Rinse thoroughly and air dry\n- Consider professional filter cleaning service\n\n**Equipment Inspection**\n- Check pump and heater operation\n- Listen for unusual noises during startup\n- Verify all electrical connections are secure and dry\n- Test GFCI protection\n\n## Seasonal Tasks\n\n**Spring Startup (Colorado)**\n- Professional startup recommended after winter shutdown\n- Comprehensive system check\n- Fresh water fill and chemistry balance\n- Equipment calibration for altitude and temperature\n\n**Fall Preparation**\n- Deep clean before reduced usage\n- Check heating efficiency before cold weather\n- Inspect cover for winter weather readiness\n- Consider professional pre-winter service\n\n## Denver-Specific Considerations\n\n**Hard Water Management**\n- Use calcium hardness reducers monthly\n- Clean scale buildup from jets and surfaces\n- Monitor for white residue on spa surfaces\n\n**UV Protection**\n- Colorado's intense sun breaks down chemicals faster\n- Keep spa covered when not in use\n- Store chemicals in cool, dark locations\n\n**Altitude Adjustments**\n- Chemical reactions work differently at 5,280 feet\n- Monitor equipment performance - pumps work harder at altitude\n- Allow extra time for heating in cold weather\n\n## Red Flags: Call the Professionals\n\nWhile regular maintenance prevents most issues, contact Spa Doctors if you notice:\n- Persistent water chemistry problems\n- Unusual equipment noises or vibrations\n- Heating issues or temperature fluctuations\n- Electrical problems or error codes\n- Leaks or structural damage\n- Any safety concerns\n\n## Maintenance Supplies to Keep on Hand\n\n- Test strips or digital tester\n- pH increaser and decreaser\n- Alkalinity increaser\n- Chlorine or bromine sanitizer\n- Shock treatment\n- Filter cleaner\n- Spa surface cleaner\n- Cover conditioner\n\n## Pro Tips for Success\n\n1. **Keep a maintenance log** - Track chemical levels and maintenance dates\n2. **Buy quality supplies** - Cheap chemicals often cause more problems\n3. **Don't skip weeks** - Consistency prevents major issues\n4. **Listen to your spa** - Unusual sounds often indicate developing problems\n5. **Schedule annual professional service** - Prevention is cheaper than repairs\n\nConsistent maintenance keeps your hot tub running efficiently and extends its life significantly. When maintenance tasks become overwhelming or you encounter issues beyond basic care, professional service ensures your spa stays in peak condition.\n\n**Need help establishing a maintenance routine or dealing with persistent issues? Spa Doctors offers comprehensive maintenance services throughout the Denver metro area. Call (856) 266-7293 to schedule professional maintenance or consultation.**",
    date: new Date('2024-12-21')
  },
  {
    id: Date.now() + 2,
    title: "Common Hot Tub Problems and Quick Troubleshooting",
    content: "Every hot tub owner encounters issues from time to time. While some problems require professional repair, many common issues have simple solutions you can try at home. Here's your guide to basic troubleshooting - and when to call the experts.\n\n## Water Issues\n\n**Cloudy Water**\nFirst steps: Test your water chemistry (pH, alkalinity, sanitizer). If levels are off, adjust accordingly and run the filtration system for several hours. Clean or replace your filter if it's dirty.\n\nCall professionals if: Water remains cloudy after 24-48 hours of proper chemistry and filtration.\n\n**Foamy Water**\nQuick fix: This usually indicates soap residue from lotions, detergents, or body care products. Shock treat your spa and ensure bathers rinse off before entering.\n\nCall professionals if: Foam persists despite shock treatment and appears oily or has an unusual odor.\n\n**Green or Discolored Water**\nImmediate action: Stop using the spa immediately. This typically indicates algae growth or metal contamination. Test and shock the water.\n\nCall professionals if: You're uncomfortable handling shock chemicals or if discoloration returns quickly.\n\n## Temperature Problems\n\n**Not Heating**\nCheck first: Ensure your spa is in filter mode, not on a timer cycle. Verify the temperature is set higher than current water temp. Check that filter cartridges aren't clogged.\n\nCall professionals if: These steps don't resolve the issue - heating problems often involve electrical or pump components.\n\n**Overheating**\nSafety first: Turn off power at the breaker immediately. Check for blocked vents or dirty filters restricting water flow.\n\nCall professionals if: Your spa frequently overheats - this can indicate serious mechanical issues that could damage equipment.\n\n## Electrical and Control Issues\n\n**No Power/Display Dark**\nBasic checks: Verify power at the main breaker and GFCI outlet. Check that all connections are secure and dry.\n\nCall professionals if: Electrical issues persist - never attempt electrical repairs yourself for safety reasons.\n\n**Error Codes**\nFirst step: Note the exact error code and consult your owner's manual. Some codes indicate simple issues like sensor problems that clear with a restart.\n\nCall professionals if: Error codes persist or you're unsure about any electrical troubleshooting.\n\n## Pump and Circulation Problems\n\n**Weak Water Flow**\nTry this: Clean your filter cartridges thoroughly or replace if old. Check for debris in the skimmer basket.\n\nCall professionals if: Flow remains weak - this could indicate pump problems or internal blockages.\n\n**Noisy Operation**\nListen carefully: Grinding, squealing, or rattling sounds often indicate mechanical problems that need immediate attention.\n\nCall professionals if: Any unusual noises occur - continuing to run a damaged pump can cause expensive damage.\n\n## Denver-Specific Considerations\n\n**Altitude Effects**\nColorado's elevation can affect pump performance and heating efficiency. What seems like a malfunction might be normal operation at altitude.\n\n**Weather-Related Issues**\nExtreme temperature swings can cause temporary sensor errors or affect chemical readings. Give your spa time to stabilize after severe weather.\n\n**Hard Water Effects**\nScale buildup from Denver's hard water can affect jets, heating elements, and sensors. Regular descaling prevents many \"mechanical\" problems.\n\n## Safety First\n\n**Never attempt electrical repairs yourself**\n**Don't ignore strange smells or sounds**\n**When in doubt, turn off power and call professionals**\n**Don't use the spa if water quality is questionable**\n\n## Prevention Tips\n\n- Test water 2-3 times weekly\n- Clean filters monthly\n- Maintain proper chemical levels\n- Schedule professional maintenance annually\n- Address small issues before they become big problems\n\nRemember: A small repair cost today can prevent a major expense tomorrow. Professional technicians can often diagnose issues quickly and prevent damage to expensive components.\n\n**Experiencing persistent hot tub problems in the Denver area? Spa Doctors provides expert diagnosis and repair services. Our experienced technicians can solve issues safely and efficiently. Call (856) 266-7293 for professional troubleshooting and repair.**",
    date: new Date('2024-12-21')
  },
  {
    id: Date.now() + 3,
    title: "Hot Tub Water Chemistry 101: The Denver Owner's Guide",
    content: "Maintaining proper hot tub water chemistry is essential for safe, enjoyable soaking and protecting your spa equipment. Denver's unique water conditions and altitude add some special considerations that every hot tub owner should understand.\n\n## The Water Chemistry Basics\n\n**pH Levels (7.2-7.6 ideal range)**\nYour pH measures how acidic or basic your water is. Too low (acidic) and it can corrode equipment and irritate skin. Too high (basic) and sanitizers become less effective, and you may see cloudy water or scale buildup.\n\n**Total Alkalinity (80-120 ppm)**\nAlkalinity acts as a pH buffer, preventing wild pH swings. Denver's typically high alkaline water means you may need to monitor this more closely than in other areas.\n\n**Sanitizer Levels**\n- Chlorine: 1-3 ppm\n- Bromine: 2-4 ppm\nThese kill bacteria and keep your water safe. At Denver's altitude, chlorine can dissipate faster due to increased UV exposure and lower air pressure.\n\n## Denver-Specific Considerations\n\n**Hard Water Challenges**\nDenver area water is naturally hard (high calcium), which can lead to scale buildup on spa surfaces and equipment. Regular testing and calcium hardness management (150-300 ppm) is crucial.\n\n**Altitude Effects**\nAt 5,280 feet, water boils at a lower temperature and chemicals can behave differently. You may need to adjust chemical dosing and be more vigilant about testing.\n\n**Seasonal Changes**\nColorado's extreme temperature swings affect chemical consumption. Winter heating cycles and summer UV exposure both impact your water chemistry differently than at sea level.\n\n## Essential Testing Schedule\n\n- **2-3 times per week**: pH and sanitizer levels\n- **Weekly**: Total alkalinity and calcium hardness\n- **Monthly**: Total dissolved solids (TDS)\n\n## When to Call the Professionals\n\nWhile basic water testing and chemical adjustments are part of regular ownership, some situations require professional attention:\n- Persistent cloudy or foamy water despite proper chemistry\n- Unusual odors or skin irritation\n- Equipment showing signs of corrosion or scale damage\n- If you're uncomfortable handling chemicals safely\n\n## Pro Tips for Denver Hot Tub Owners\n\n1. **Test before and after heavy use** - More bathers mean more contaminants\n2. **Keep chemicals covered** - Denver's intense UV breaks down chlorine faster\n3. **Monitor after storms** - Rapid pressure changes can affect chemical balance\n4. **Don't guess** - Invest in quality test strips or a digital tester\n\nProper water chemistry protects both your health and your investment. When in doubt, don't hesitate to ask for professional guidance.\n\n**Need help with persistent water chemistry issues? Spa Doctors offers professional water testing and treatment services throughout the Denver metro area. Call (856) 266-7293 for expert assistance.**",
    date: new Date('2024-12-21')
  }
];
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