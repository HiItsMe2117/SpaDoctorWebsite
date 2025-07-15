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
// const dataManager = require('./utils/dataManager'); // Disabled for Vercel serverless

// Mock dataManager for serverless compatibility
const dataManager = {
  saveBlogPosts: () => Promise.resolve(true),
  saveAnalytics: () => Promise.resolve(true),
  saveGalleryImages: () => Promise.resolve(true),
  saveMediaLibrary: () => Promise.resolve(true),
  saveSocialPosts: () => Promise.resolve(true)
};

const app = express();
const PORT = process.env.PORT || 3000;

// SECURITY: All upload endpoints now require admin authentication (fixed 2025-07-05)

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

// Helper function for formatting blog content with enhanced markdown support
app.locals.formatArticleContent = function(content) {
  // First pass: handle block-level elements
  let processedContent = content
    // Convert section headers (lines that end with colon)
    .replace(/^(.+):$/gm, '<h3>$1</h3>')
    // Convert markdown-style headers
    .replace(/^### (.*$)/gm, '<h4>$1</h4>')
    .replace(/^## (.*$)/gm, '<h3>$1</h3>')
    .replace(/^# (.*$)/gm, '<h2>$1</h2>');

  // Split into paragraphs for processing
  return processedContent
    .split('\n\n')
    .map(paragraph => {
      paragraph = paragraph.trim();
      if (!paragraph) return '';
      
      // Don't wrap headings in paragraphs
      if (paragraph.startsWith('<h')) {
        return paragraph;
      }
      
      // Handle blockquotes (lines starting with >)
      if (paragraph.startsWith('>')) {
        const lines = paragraph.split('\n');
        const quoteContent = lines
          .map(line => line.replace(/^>\s*/, '').trim())
          .filter(line => line)
          .join('<br>');
        return `<blockquote style="border-left: 4px solid #2563eb; padding-left: 1rem; margin: 1.5rem 0; font-style: italic; color: #64748b;">${quoteContent}</blockquote>`;
      }
      
      // Handle code blocks (lines wrapped in triple backticks)
      if (paragraph.startsWith('```') && paragraph.endsWith('```')) {
        const code = paragraph.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
        return `<pre style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 0.9rem; margin: 1.5rem 0;"><code>${code}</code></pre>`;
      }
      
      // Handle bullet points (improved)
      if (paragraph.includes('\n-') || paragraph.includes('\n•')) {
        const lines = paragraph.split('\n');
        const firstLine = lines[0];
        const bullets = lines.slice(1).filter(line => line.trim().match(/^[-•]\s/));
        
        let html = firstLine && !firstLine.match(/^[-•]\s/) ? `<p>${formatInlineElements(firstLine)}</p>` : '';
        if (bullets.length > 0) {
          html += '<ul>';
          bullets.forEach(bullet => {
            const text = bullet.replace(/^[-•]\s*/, '').trim();
            if (text) html += `<li>${formatInlineElements(text)}</li>`;
          });
          html += '</ul>';
        }
        return html;
      }
      
      // Handle numbered lists
      if (paragraph.includes('\n1.') || paragraph.match(/^\d+\./)) {
        const lines = paragraph.split('\n');
        const firstLine = lines[0];
        const numberedItems = lines.filter(line => line.trim().match(/^\d+\.\s/));
        
        let html = firstLine && !firstLine.match(/^\d+\.\s/) ? `<p>${formatInlineElements(firstLine)}</p>` : '';
        if (numberedItems.length > 0) {
          html += '<ol>';
          numberedItems.forEach(item => {
            const text = item.replace(/^\d+\.\s*/, '').trim();
            if (text) html += `<li>${formatInlineElements(text)}</li>`;
          });
          html += '</ol>';
        }
        return html;
      }
      
      // Regular paragraph with inline formatting
      return `<p>${formatInlineElements(paragraph.replace(/\n/g, '<br>'))}</p>`;
    })
    .join('');
    
  // Helper function for inline elements
  function formatInlineElements(text) {
    return text
      // Convert **bold** to <strong> tags
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Convert *italic* to <em> tags
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Convert `code` to <code> tags
      .replace(/`([^`]+)`/g, '<code style="background: #f1f5f9; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: \'Courier New\', monospace; font-size: 0.9em;">$1</code>')
      // Convert [link text](url) to <a> tags
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #2563eb; text-decoration: underline;" target="_blank" rel="noopener noreferrer">$1</a>')
      // Convert ![alt text](image url) to <img> tags
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; height: auto; border-radius: 8px; margin: 1rem 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" loading="lazy">')
      // Convert phone numbers to clickable links
      .replace(/\((\d{3})\)\s*(\d{3})-(\d{4})/g, '<a href="tel:+1$1$2$3" style="color: #2563eb; font-weight: 600; text-decoration: none;">($1) $2-$3</a>');
  }
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

// Category definitions
const blogCategories = {
  "maintenance-care": {
    name: "Maintenance & Care",
    description: "Regular upkeep, cleaning, and preventive care for your hot tub",
    icon: "🧽"
  },
  "troubleshooting-repair": {
    name: "Troubleshooting & Repair", 
    description: "Common problems, repairs, and diagnostic guides",
    icon: "🔧"
  },
  "safety-electrical": {
    name: "Safety & Electrical",
    description: "Safety tips, electrical guidelines, and code compliance", 
    icon: "⚡"
  },
  "seasonal-moving": {
    name: "Seasonal & Moving",
    description: "Winter care, transport, and seasonal preparation",
    icon: "🚚"
  },
  "professional-services": {
    name: "Professional Services",
    description: "When to call experts and professional service information",
    icon: "👨‍🔧"
  }
};

// Initialize data on server start
function initializeData() {
  console.log('Initializing in-memory data for serverless...');
  // Initialize with SEO-optimized blog posts for Denver market
  blogPosts = [
    {
      id: 1,
      title: "Hot Tub Repair Denver: Expert Service for All Spa Brands",
      content: "When your hot tub breaks down in Denver, you need fast, reliable repair service from certified technicians. At Spa Doctors, we provide professional hot tub repair throughout the Denver metro area, including Aurora, Lakewood, Thornton, Westminster, and Arvada.\n\n## Common Hot Tub Repairs We Handle\n\n**Heating System Repairs**\nColorado's temperature swings put extra stress on hot tub heaters. Our technicians repair and replace:\n- Heater elements and assemblies\n- Temperature sensors and thermostats\n- Control boards and relay switches\n- Pressure switches and flow sensors\n\n**Pump and Motor Service**\nDenver's altitude and dry climate affect pump performance. We service:\n- Circulation pump repairs and replacement\n- Therapy pump motor rebuilds\n- Impeller cleaning and replacement\n- Seal and bearing repairs\n\n**Electrical System Repairs**\n- GFCI breaker troubleshooting\n- Control panel repairs\n- Wiring and connection issues\n- LED lighting system repairs\n\n**Plumbing and Leak Repairs**\n- Jet assembly repairs\n- Pipe leak detection and repair\n- Union and fitting replacement\n- Shell crack repair\n\n## Why Choose Professional Hot Tub Repair in Denver?\n\n**Certified Technicians**\nOur repair specialists are factory-trained on major spa brands including Hot Spring, Caldera, Jacuzzi, Sundance, and Bullfrog. We carry genuine OEM parts to ensure lasting repairs.\n\n**Same-Day Service Available**\nWe understand Denver winters make hot tub downtime especially frustrating. Our emergency repair service can often restore your spa the same day you call.\n\n**Warranty Protection**\nAll our hot tub repairs come with comprehensive warranties. We stand behind our work and use only quality replacement parts.\n\n**Denver Metro Coverage**\nWe service hot tubs throughout:\n- Denver\n- Aurora\n- Lakewood\n- Thornton\n- Westminster\n- Arvada\n- Wheat Ridge\n- Englewood\n- Littleton\n- Centennial\n\n## Signs Your Hot Tub Needs Professional Repair\n\n**Immediate Repair Needs:**\n- No heat or insufficient heating\n- GFCI breaker trips repeatedly\n- Pump won't start or makes unusual noises\n- Visible water leaks\n- Error codes on control panel\n\n**Don't Wait - Call Today**\nDelaying hot tub repairs often leads to more expensive problems. A simple pump seal replacement can prevent motor damage that costs hundreds more.\n\n## Denver Hot Tub Repair Costs\n\nRepair costs vary by problem complexity:\n- Diagnostic fee: $150 (applied to repair cost)\n- Heater element replacement: $250-$400\n- Pump replacement: $300-$600\n- Control board repair: $200-$500\n\nWe provide upfront pricing with no hidden fees.\n\n## Schedule Your Denver Hot Tub Repair\n\nDon't let a broken hot tub ruin your relaxation. Our Denver area hot tub repair experts are ready to diagnose and fix your spa quickly and affordably.\n\n**Call Spa Doctors at (856) 266-7293** for fast, professional hot tub repair service throughout the Denver metro area.",
      date: "2025-07-15T04:45:00.000Z",
      author: "Spa Doctors",
      category: "troubleshooting-repair"
    },
    {
      id: 2,
      title: "Hot Tub Maintenance Denver: Keep Your Spa Running Year-Round",
      content: "Regular hot tub maintenance is essential in Denver's challenging climate. From summer's intense UV rays to winter's freezing temperatures, your spa needs professional care to perform reliably year-round.\n\n## Why Denver Hot Tubs Need Expert Maintenance\n\n**Altitude Effects**\nDenver's 5,280-foot elevation affects water chemistry and equipment performance. Our technicians understand these unique challenges and adjust maintenance accordingly.\n\n**Climate Extremes**\n- Summer: Intense UV and high temperatures stress covers and surfaces\n- Winter: Freezing temperatures require special winterization protocols\n- Year-round: Low humidity increases evaporation and chemical consumption\n\n**Hard Water Challenges**\nDenver's mineral-rich water causes scale buildup that damages heaters, pumps, and jets. Professional maintenance prevents costly equipment failure.\n\n## Comprehensive Hot Tub Maintenance Services\n\n**Monthly Service Package**\n- Complete water testing and chemical balancing\n- Filter cleaning and rotation\n- Equipment inspection and lubrication\n- Shell cleaning and sanitizing\n- Cover conditioning and protection\n\n**Quarterly Deep Service**\n- System flush and biofilm removal\n- Detailed equipment inspection\n- Pump and heater performance testing\n- Plumbing system pressure testing\n- Control system diagnostics\n\n**Seasonal Maintenance**\n- Spring startup and system optimization\n- Summer UV protection and cooling efficiency\n- Fall winterization preparation\n- Winter freeze protection monitoring\n\n## DIY Maintenance vs. Professional Service\n\n**What You Can Do:**\n- Test water chemistry 2-3 times weekly\n- Rinse filters with garden hose\n- Remove debris from spa surface\n- Monitor water level\n\n**Leave to the Professionals:**\n- System diagnostics and repairs\n- Chemical system balancing\n- Equipment lubrication and calibration\n- Winterization and startup procedures\n\n## Denver Hot Tub Maintenance Schedule\n\n**Weekly (You):**\n- Test and adjust chemicals\n- Clean waterline\n- Remove debris\n\n**Monthly (Professional):**\n- Deep filter cleaning\n- Equipment inspection\n- Water quality analysis\n- System performance check\n\n**Quarterly (Professional):**\n- Complete system flush\n- Detailed equipment service\n- Efficiency optimization\n- Preventive repairs\n\n**Annually (Professional):**\n- Complete drain and refill\n- System overhaul\n- Equipment replacement planning\n- Warranty maintenance\n\n## Benefits of Professional Denver Hot Tub Maintenance\n\n**Cost Savings**\nPreventive maintenance costs far less than emergency repairs. A $150 monthly service prevents $1,500 equipment failures.\n\n**Energy Efficiency**\nProperly maintained hot tubs use 30% less energy. Clean filters and calibrated systems reduce operating costs.\n\n**Equipment Longevity**\nRegular professional service extends equipment life by 3-5 years, protecting your investment.\n\n**Health and Safety**\nProfessional water treatment prevents harmful bacteria and ensures safe soaking conditions.\n\n## Emergency Maintenance Support\n\nWhen problems arise between service visits:\n- 24/7 emergency support hotline\n- Same-day response for urgent issues\n- Mobile service throughout Denver metro\n- Direct communication with your assigned technician\n\n## Service Areas Throughout Denver Metro\n\nWe provide regular hot tub maintenance service to:\n- Central Denver and surrounding neighborhoods\n- Aurora and Green Valley Ranch\n- Lakewood and Belmar\n- Thornton and Northglenn\n- Westminster and Broomfield\n- Arvada and Wheat Ridge\n- Englewood and Cherry Hills\n- Littleton and Ken Caryl\n- Centennial and Highlands Ranch\n\n## Start Your Maintenance Program Today\n\nDon't wait for problems to develop. Our Denver hot tub maintenance programs keep your spa running efficiently while preventing expensive repairs.\n\n**Call Spa Doctors at (856) 266-7293** to schedule your first maintenance visit and protect your hot tub investment.",
      date: "2025-07-15T04:40:00.000Z",
      author: "Spa Doctors",
      category: "maintenance-care"
    },
    {
      id: 3,
      title: "Hot Tub Not Heating Denver: Quick Fixes & When to Call a Pro",
      content: "A hot tub that won't heat is one of the most frustrating problems for Denver spa owners, especially during Colorado's long winter months. Here's your complete troubleshooting guide plus when to call professional repair service.\n\n## Quick Checks Before Calling for Service\n\n**Power and Electrical**\n1. Check the GFCI breaker at your electrical panel\n2. Verify the disconnect switch near your hot tub is on\n3. Look for error codes on your control panel\n4. Ensure the hot tub has been running for at least 24 hours\n\n**Water Level and Flow**\n1. Confirm water level covers all jets by 2-3 inches\n2. Remove and clean your filter cartridges\n3. Check that all jets are open for proper circulation\n4. Verify no valves are closed in your equipment area\n\n**Settings and Programming**\n1. Ensure temperature is set higher than current water temperature\n2. Check that heating mode is activated (not just filtration)\n3. Verify timer settings haven't disabled heating\n4. Look for any \"economy\" or \"sleep\" modes that limit heating\n\n## Common Heating Problems in Denver Hot Tubs\n\n**Altitude-Related Issues**\nDenver's 5,280-foot elevation affects:\n- Heater efficiency and performance\n- Pump priming and water circulation\n- Temperature sensor accuracy\n- Control system calibration\n\n**Climate-Specific Problems**\n- Extreme temperature swings stress heating elements\n- Low humidity increases heat loss through evaporation\n- UV exposure degrades covers, reducing insulation\n- Hard water minerals coat heating elements\n\n## Heating System Components That Fail\n\n**Heater Element**\n- Most common heating failure\n- Caused by mineral buildup or age\n- Symptoms: No heat, slow heating, or tripping breakers\n- Requires professional replacement\n\n**Temperature Sensors**\n- Controls when heater operates\n- Fails due to mineral corrosion\n- Symptoms: Incorrect temperature readings, overheating\n- Professional diagnosis required\n\n**Control Board**\n- Computer that manages heating cycles\n- Damaged by power surges or moisture\n- Symptoms: Error codes, erratic operation\n- Professional repair or replacement needed\n\n**High Limit Switch**\n- Safety device that prevents overheating\n- Triggers due to poor circulation or sensor failure\n- Symptoms: Heater shuts off unexpectedly\n- Requires professional reset or replacement\n\n## When DIY Isn't Enough: Call Denver Professionals\n\n**Electrical Issues**\nNever attempt electrical repairs yourself:\n- GFCI breakers that won't reset\n- Burned or corroded connections\n- Control panel malfunctions\n- Wiring problems\n\n**Heater Repairs**\nHeater work requires specialized tools and knowledge:\n- Element replacement and testing\n- Pressure switch adjustment\n- Flow sensor calibration\n- System balancing\n\n**Warranty Considerations**\nDIY repairs often void manufacturer warranties. Professional service maintains coverage and ensures proper repair techniques.\n\n## Denver Hot Tub Heating Repair Costs\n\n**Common Repair Prices:**\n- Service call and diagnosis: $150\n- Heater element replacement: $250-$400\n- Temperature sensor replacement: $175-$300\n- Control board repair: $300-$600\n- High limit switch replacement: $150-$250\n\n*Diagnostic fee applied to repair cost when you proceed with service*\n\n## Preventing Denver Hot Tub Heating Problems\n\n**Regular Maintenance**\n- Monthly filter cleaning prevents flow restrictions\n- Quarterly system flushing removes mineral buildup\n- Annual heater inspection catches problems early\n- Professional water balancing prevents corrosion\n\n**Cover Care**\n- Quality cover reduces heat loss by 70%\n- Replace waterlogged covers immediately\n- Regular cleaning and conditioning extends life\n- Proper support prevents sagging and gaps\n\n**Water Chemistry**\n- Balanced pH prevents element corrosion\n- Proper alkalinity stabilizes chemistry\n- Regular shocking removes contaminant buildup\n- Professional testing ensures accuracy\n\n## Emergency Heating Service in Denver\n\nWhen your hot tub won't heat in winter, you need fast response:\n- Same-day service available\n- Emergency repairs within 24 hours\n- Mobile service throughout Denver metro\n- Upfront pricing with no surprises\n\n**We Service All Denver Metro Areas:**\n- Downtown Denver and Capitol Hill\n- Aurora and Glendale\n- Lakewood and Edgewater\n- Thornton and Federal Heights\n- Westminster and Commerce City\n- Arvada and Berkeley\n- Englewood and Sheridan\n- Littleton and Columbine\n- Centennial and Lone Tree\n\n## Don't Freeze This Winter - Get Your Hot Tub Heating\n\nDenver winters are long enough without a broken hot tub. Our certified technicians diagnose heating problems quickly and provide lasting repairs using quality parts.\n\n**Hot tub not heating? Call Spa Doctors at (856) 266-7293** for same-day diagnosis and expert heating system repair throughout the Denver metro area.",
      date: "2025-07-15T04:35:00.000Z",
      author: "Spa Doctors",
      category: "troubleshooting-repair"
    },
    {
      id: 4,
      title: "Professional Hot Tub Service Denver: Why Spa Doctors Leads the Market",
      content: "When you need professional hot tub service in Denver, choosing the right company makes the difference between a quick fix and a lasting solution. Here's why Denver area homeowners trust Spa Doctors for all their spa service needs.\n\n## What Sets Professional Hot Tub Service Apart\n\n**Factory Training and Certification**\nOur technicians receive ongoing training from major spa manufacturers:\n- Hot Spring Spas certified specialists\n- Caldera Spas authorized service\n- Jacuzzi premium dealer support\n- Sundance Spas certified technicians\n- Bullfrog Spas expert service\n\n**Specialized Denver Market Experience**\n- 15+ years serving Denver metro hot tub owners\n- Deep understanding of altitude and climate effects\n- Expertise with local water quality challenges\n- Established relationships with regional suppliers\n\n**Comprehensive Service Capabilities**\nUnlike general pool companies, we specialize exclusively in hot tubs:\n- Complex diagnostic equipment\n- Extensive parts inventory\n- Specialized tools and testing equipment\n- Advanced repair techniques\n\n## Complete Denver Hot Tub Services\n\n**Repair and Troubleshooting**\n- Emergency same-day service\n- Complex electrical system repairs\n- Pump and motor rebuilds\n- Heater and control system service\n- Leak detection and repair\n\n**Regular Maintenance Programs**\n- Monthly service visits\n- Quarterly deep cleaning\n- Seasonal preparation\n- Chemical balancing and water care\n- Equipment performance optimization\n\n**Installation and Setup**\n- New spa delivery and installation\n- Electrical connections (licensed electrician)\n- Startup and commissioning\n- Owner training and education\n- Warranty registration\n\n**Specialized Services**\n- Hot tub moving and relocation\n- Cover replacement and repair\n- Equipment upgrades and retrofits\n- Energy efficiency improvements\n- Water feature additions\n\n## Denver Metro Service Areas\n\n**Primary Service Zone**\nWe provide regular service throughout:\n- Central Denver (Capitol Hill, Cherry Creek, Washington Park)\n- North Denver (Berkeley, Regis, Chaffee Park)\n- West Denver (Lakewood, Edgewater, Mountain View)\n- South Denver (Glendale, Cherry Hills, Greenwood Village)\n- East Denver (Park Hill, Stapleton, Lowry)\n\n**Extended Service Area**\nWe also serve surrounding communities:\n- Aurora and Green Valley Ranch\n- Thornton and Northglenn\n- Westminster and Broomfield\n- Arvada and Wheat Ridge\n- Englewood and Sheridan\n- Littleton and Ken Caryl\n- Centennial and Highlands Ranch\n- Castle Rock and Parker\n\n## Why Denver Customers Choose Spa Doctors\n\n**Unmatched Expertise**\n\"In 15 years of hot tub ownership, Spa Doctors is the only company that consistently fixes problems right the first time. Their knowledge of our Colorado climate challenges is invaluable.\" - Sarah M., Lakewood\n\n**Honest, Transparent Service**\n- Upfront pricing with no hidden fees\n- Detailed explanations of all work needed\n- Options for different budget levels\n- No unnecessary upselling or pressure tactics\n\n**Quality Parts and Warranty**\n- OEM (Original Equipment Manufacturer) parts when possible\n- Quality aftermarket alternatives clearly identified\n- Comprehensive warranties on all repairs\n- Parts availability for older spa models\n\n**Responsive Customer Service**\n- Same-day response for emergencies\n- Scheduled appointments kept on time\n- Direct communication with technicians\n- Follow-up to ensure satisfaction\n\n## Professional Service Investment vs. DIY Costs\n\n**Hidden Costs of DIY Repairs**\n- Incorrect diagnosis leads to unnecessary parts purchases\n- Improper repairs often damage additional components\n- Voided warranties from unauthorized work\n- Safety risks from electrical or pressure system errors\n- Time and frustration of multiple repair attempts\n\n**Professional Service Value**\n- Accurate diagnosis saves money on parts\n- Proper repairs prevent future problems\n- Warranty protection maintains equipment value\n- Safety assurance from licensed, insured technicians\n- Peace of mind and guaranteed results\n\n## Emergency Service When You Need It Most\n\n**24/7 Emergency Support**\nColorado weather doesn't wait for business hours:\n- Emergency hotline for urgent problems\n- Same-day service for heating failures\n- Weekend and holiday emergency coverage\n- Mobile service throughout Denver metro\n\n**Common Emergency Situations**\n- Hot tub won't heat during winter storms\n- GFCI breaker trips and won't reset\n- Pump failure during parties or events\n- Visible leaks threatening property damage\n- Control system failures\n\n## Preventive Service Programs\n\n**Monthly Maintenance Plans**\nRegular service prevents emergency breakdowns:\n- Complete system inspection\n- Water testing and chemical balancing\n- Filter cleaning and rotation\n- Equipment lubrication and adjustment\n- Early problem identification\n\n**Seasonal Service Packages**\n- Spring startup and optimization\n- Summer efficiency and UV protection\n- Fall winterization preparation\n- Winter freeze protection monitoring\n\n## Start Professional Service Today\n\nDon't trust your hot tub investment to inexperienced technicians or attempt complex repairs yourself. Spa Doctors provides the professional expertise Denver hot tub owners depend on.\n\n**Ready for professional hot tub service? Call Spa Doctors at (856) 266-7293** to schedule service with Denver's most trusted hot tub experts.",
      date: "2025-07-15T04:30:00.000Z",
      author: "Spa Doctors", 
      category: "professional-services"
    },
    {
      id: 5,
      title: "Hot Tub Moving Denver: Professional Spa Relocation with Specialized Equipment",
      content: "Moving a hot tub in Denver requires specialized equipment, expert knowledge, and careful planning. From navigating Colorado's challenging terrain to using professional spa sleds, here's your complete guide to safe hot tub relocation in the Denver metro area.\n\n## Why Professional Hot Tub Moving Matters in Denver\n\n**Unique Denver Challenges**\nDenver's 5,280-foot elevation and diverse terrain create unique moving challenges:\n- **Elevation changes**: Steep driveways and hillside properties\n- **Narrow access**: Older Denver neighborhoods with tight spaces\n- **Weather extremes**: Snow, ice, and temperature swings affect moving conditions\n- **Variable surfaces**: From concrete to gravel to landscaped yards\n\n**Weight and Size Realities**\nMost hot tubs weigh 800-1,200 pounds empty:\n- **Dry weight**: Up to 2,000 lbs for larger models\n- **Dimensions**: 7-8 feet square, 3+ feet tall\n- **Awkward shape**: No built-in lifting points or handles\n- **Fragile components**: Jets, plumbing, and shell easily damaged\n\n## Professional Spa Moving Equipment\n\n**Spa Sleds: The Gold Standard**\nProfessional spa sleds are game-changers for safe hot tub moving:\n\n**What is a Spa Sled?**\n- Sheet of heavy-duty plastic with protective foam padding\n- Rated for 1,000+ pound capacity\n- Simple design with no mechanical components\n- Foam padding protects spa panels from damage\n- Works on grass, concrete, gravel, and more\n\n**How Spa Sleds Work:**\n1. **Positioning**: Place sled alongside the heavy side of spa (service side) to reduce top-heaviness\n2. **Securing**: Lift tub upright onto the sled and secure with separate straps as needed\n3. **Movement**: Pull sled across various surfaces using controlled force\n4. **Precision**: Navigate tight spaces and obstacles safely with reduced tipping risk\n\n**Advantages Over DIY Methods:**\n- **Surface protection**: Won't damage lawns or driveways\n- **Stability**: Spa stays level and secure\n- **Control**: Precise maneuvering around obstacles\n- **Safety**: Eliminates risk of dropping or tipping\n\n**Additional Professional Equipment**\n- **Hydraulic spa jacks**: Lift spas safely and evenly\n- **Heavy-duty winches**: Move spas uphill or across distances\n- **Protective padding**: Prevent scratches and dings\n- **Specialized dollies**: For stairs and multi-level access\n- **Crane services**: When access requires lifting over obstacles\n\n## The Professional Moving Process\n\n**Pre-Move Preparation**\n1. **Site assessment**: Measure access routes and identify challenges\n2. **Complete drainage**: Remove every drop of water using pumps\n3. **Electrical disconnect**: Licensed electrician safely disconnects power\n4. **Component removal**: Disconnect and protect fragile parts\n5. **Path preparation**: Clear obstacles and protect surfaces\n\n**Moving Day Execution**\n1. **Equipment setup**: Position jacks, sleds, and safety equipment\n2. **Lifting and positioning**: Hydraulically lift spa onto sled\n3. **Secure attachment**: Multiple straps and tie-downs\n4. **Controlled movement**: Professional crew guides sled to destination\n5. **Precise placement**: Position exactly where needed\n\n**Post-Move Services**\n1. **Reconnection**: Electrical, plumbing, and component reinstallation\n2. **Leveling and testing**: Ensure proper operation\n3. **Startup service**: Fill, balance, and test all systems\n4. **Customer training**: Operating instructions and maintenance tips\n\n## Common Denver Hot Tub Moving Scenarios\n\n**Backyard to Backyard**\n- Gate access limitations\n- Landscaping protection needs\n- Neighbor property considerations\n- Utility line clearances\n\n**Home to Home Relocation**\n- Long-distance transport coordination\n- Multiple elevation changes\n- Storage and timing considerations\n- Permit requirements for oversized loads\n\n**Delivery and Installation**\n- New spa placement\n- Foundation preparation\n- Electrical rough-in coordination\n- Access route planning\n\n**Emergency Relocation**\n- Storm damage situations\n- Construction project accommodation\n- Property sale timeline pressure\n- Insurance claim coordination\n\n## DIY Moving: Why It Fails and Costs More\n\n**Common DIY Mistakes**\n- **Inadequate equipment**: Rollers that damage surfaces\n- **Insufficient crew**: Attempting moves with too few people\n- **Poor planning**: Underestimating obstacles and challenges\n- **Improper technique**: Lifting incorrectly and causing injury\n- **Missing permits**: Legal issues with street or crane use\n\n**Hidden Costs of DIY Failure**\n- **Spa damage**: Cracked shells, broken jets, damaged equipment\n- **Property damage**: Torn up lawns, cracked driveways, broken fences\n- **Injury risks**: Back injuries, crushing hazards, strain injuries\n- **Time and frustration**: Multiple failed attempts and delays\n- **Equipment rental**: Costs add up without expertise\n\n## Denver Metro Hot Tub Moving Service Areas\n\n**Primary Service Zone**\nWe provide professional hot tub moving throughout:\n- **Central Denver**: Capitol Hill, Cherry Creek, Washington Park\n- **North Metro**: Thornton, Westminster, Northglenn, Broomfield\n- **West Metro**: Lakewood, Wheat Ridge, Arvada, Golden\n- **South Metro**: Littleton, Centennial, Highlands Ranch, Castle Rock\n- **East Metro**: Aurora, Commerce City, Glendale\n\n**Specialized Access Solutions**\n- **Hillside properties**: Steep terrain and elevation challenges\n- **Historic neighborhoods**: Narrow streets and access limitations\n- **Gated communities**: Security coordination and access permits\n- **Mountain properties**: High-altitude and remote location service\n\n## Professional Moving Costs and Value\n\n**Transparent Pricing Structure**\n- **Local moves**: $450-$750 depending on distance and access\n- **Complex access**: $750-$1,200 for crane or special equipment needs\n- **Long distance**: $800-$1,500 for metro-area to metro-area moves\n- **Emergency service**: Premium rates for urgent timeline needs\n\n**What's Included**\n- Complete drainage and preparation\n- Professional equipment and crew\n- Insurance coverage for spa and property\n- Basic reconnection and testing\n- 30-day warranty on moving service\n\n**Additional Services Available**\n- Electrical disconnection/reconnection\n- Foundation preparation and leveling\n- Startup and commissioning\n- Disposal of old or unwanted spas\n\n## Emergency and Urgent Moving Service\n\n**When You Need Fast Response**\n- **Storm damage**: Move spa away from damaged structures\n- **Construction deadlines**: Accommodate contractor schedules\n- **Property closings**: Real estate transaction requirements\n- **Special events**: Clear space for parties or gatherings\n\n**Rapid Response Capabilities**\n- Same-day service available\n- Weekend and holiday coverage\n- Emergency equipment mobilization\n- Direct coordination with contractors and real estate agents\n\n## Safety and Insurance Protection\n\n**Comprehensive Coverage**\n- **Licensed and bonded**: Colorado state licensing and bonding\n- **Full insurance**: General liability and equipment coverage\n- **Worker protection**: Workers' compensation for all crew members\n- **Property protection**: Coverage for your home and landscaping\n\n**Safety First Approach**\n- **Certified technicians**: Trained in safe lifting and moving techniques\n- **Professional equipment**: Regular inspection and maintenance\n- **Safety protocols**: Established procedures for every scenario\n- **Risk assessment**: Thorough evaluation before each move\n\n## Choose Professional Hot Tub Moving in Denver\n\nDon't risk your valuable spa investment or your safety with DIY moving attempts. Our professional crews have the specialized equipment, including spa sleds and hydraulic jacks, to move your hot tub safely and efficiently.\n\n**Ready to move your hot tub? Call Spa Doctors at (856) 266-7293** for professional spa relocation services throughout the Denver metro area. We'll protect your investment and get your hot tub exactly where you want it.",
      date: "2025-07-15T04:25:00.000Z",
      author: "Spa Doctors",
      category: "seasonal-moving"
    }
  ];
  galleryImages = [];
  mediaLibrary = [];
  socialPosts = [];
  analytics = {
    blogPageViews: {},
    articleExpansions: {},
    contactSubmissions: [],
    pageViews: {},
    customerJourneys: {},
    servicePageViews: {},
    dailyStats: {}
  };
  console.log('In-memory data initialized with 5 SEO-optimized blog posts');
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

// Visit notification system
const visitNotificationSettings = {
  enabled: true, // ✅ RE-ENABLED with smart filtering (admin detection + rate limiting)
  notifyEmail: process.env.BUSINESS_EMAIL || process.env.EMAIL_USER,
  excludeIPs: ['127.0.0.1', '::1'], // Exclude localhost
  excludePaths: ['/track-page-view', '/analytics-data', '/favicon.ico', '/robots.txt', '/sitemap.xml'],
  botUserAgents: ['bot', 'crawler', 'spider', 'scraper', 'facebook', 'twitter', 'google', 'bing', 'yahoo'],
  rateLimit: {}, // Track last notification time per IP
  rateLimitMinutes: 60 // Minimum minutes between notifications per IP
};

// Function to check if visitor is a bot
function isBot(userAgent) {
  if (!userAgent) return true;
  const ua = userAgent.toLowerCase();
  return visitNotificationSettings.botUserAgents.some(bot => ua.includes(bot));
}

// Function to get client IP address
function getClientIP(req) {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         req.ip;
}

// Function to get IP geolocation
async function getIPLocation(ip) {
  // Skip localhost and private IPs
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return {
      location: '🏠 Local/Private Network',
      city: 'Local',
      region: 'Private',
      country: 'Network',
      isp: 'Local Network'
    };
  }

  try {
    // Primary API: geojs.io (unlimited free)
    const response = await axios.get(`https://get.geojs.io/v1/ip/geo/${ip}.json`, {
      timeout: 3000
    });
    
    const data = response.data;
    return {
      location: `📍 ${data.city || 'Unknown'}, ${data.region || 'Unknown'}, ${data.country || 'Unknown'}`,
      city: data.city || 'Unknown',
      region: data.region || 'Unknown', 
      country: data.country || 'Unknown',
      isp: data.organization || 'Unknown ISP',
      coords: data.latitude && data.longitude ? `${data.latitude}, ${data.longitude}` : null
    };
  } catch (error) {
    console.log('Primary geolocation failed, trying fallback...');
    
    try {
      // Fallback API: ip-api.com (1000 requests/month free)
      const response = await axios.get(`http://ip-api.com/json/${ip}?fields=status,city,regionName,country,isp,lat,lon`, {
        timeout: 3000
      });
      
      const data = response.data;
      if (data.status === 'success') {
        return {
          location: `📍 ${data.city || 'Unknown'}, ${data.regionName || 'Unknown'}, ${data.country || 'Unknown'}`,
          city: data.city || 'Unknown',
          region: data.regionName || 'Unknown',
          country: data.country || 'Unknown', 
          isp: data.isp || 'Unknown ISP',
          coords: data.lat && data.lon ? `${data.lat}, ${data.lon}` : null
        };
      }
    } catch (fallbackError) {
      console.log('Fallback geolocation also failed');
    }
    
    // Final fallback - show IP with error note
    return {
      location: `🌐 ${ip} (Location lookup failed)`,
      city: 'Unknown',
      region: 'Unknown',
      country: 'Unknown',
      isp: 'Unknown ISP'
    };
  }
}

// Function to send visit notification email
async function sendVisitNotification(visitData) {
  if (!visitNotificationSettings.enabled) return;
  
  // Get geolocation for the IP address
  const locationData = await getIPLocation(visitData.ip);
  
  const emailTemplate = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
        🎯 New Website Visitor Alert
      </h2>
      
      <div style="background: #f8fafc; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <h3 style="color: #334155; margin-top: 0;">Visit Details</h3>
        <p><strong>📄 Page Visited:</strong> ${visitData.page}</p>
        <p><strong>📍 Location:</strong> ${locationData.location}</p>
        <p><strong>🏢 ISP:</strong> ${locationData.isp}</p>
        <p><strong>🕒 Time:</strong> ${visitData.timestamp}</p>
        <p><strong>💻 Device/Browser:</strong> ${visitData.userAgent}</p>
        <p><strong>🔗 Referrer:</strong> ${visitData.referrer || 'Direct visit'}</p>
        <p><strong>👤 Visitor Type:</strong> ${visitData.isNewVisitor ? '🆕 New Visitor' : '🔄 Returning Visitor'}</p>
        ${locationData.coords ? `<p><strong>🗺️ Coordinates:</strong> ${locationData.coords}</p>` : ''}
        <p style="font-size: 0.9em; color: #64748b;"><strong>🌐 IP:</strong> ${visitData.ip}</p>
      </div>
      
      <div style="background: #e0f2fe; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #0369a1;"><strong>💡 Quick Actions:</strong></p>
        <p style="margin: 5px 0; color: #0369a1;">• Check your analytics dashboard for more details</p>
        <p style="margin: 5px 0; color: #0369a1;">• Follow up if this was a potential customer</p>
        <p style="margin: 5px 0; color: #0369a1;">• Monitor for repeat visits from this IP</p>
      </div>
      
      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <p style="color: #64748b; font-size: 14px;">
          This notification was sent automatically by your Spa Doctors website.<br>
          <a href="https://www.spadoc.tech/admin/login" style="color: #2563eb;">Visit Admin Dashboard</a> to manage notification settings.
        </p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: visitNotificationSettings.notifyEmail,
      subject: `🎯 Visitor from ${locationData.city || 'Unknown'}, ${locationData.country || 'Unknown'} - ${visitData.page}`,
      html: emailTemplate
    });
    console.log('Visit notification sent:', visitData.page, locationData.location);
  } catch (error) {
    console.error('Error sending visit notification:', error);
  }
}

// Visit notification middleware
function visitNotificationMiddleware(req, res, next) {
  // Skip if notifications are disabled
  if (!visitNotificationSettings.enabled) {
    return next();
  }
  
  const clientIP = getClientIP(req);
  const userAgent = req.get('User-Agent') || '';
  const path = req.path;
  
  // Skip excluded paths
  if (visitNotificationSettings.excludePaths.some(excludePath => path.includes(excludePath))) {
    return next();
  }
  
  // Skip excluded IPs
  if (visitNotificationSettings.excludeIPs.includes(clientIP)) {
    return next();
  }
  
  // Skip if user is authenticated as admin
  if (isValidAdminToken(req)) {
    return next();
  }
  
  // Skip bots and crawlers
  if (isBot(userAgent)) {
    return next();
  }
  
  // Skip non-GET requests
  if (req.method !== 'GET') {
    return next();
  }
  
  // Rate limiting - check if we've notified about this IP recently
  const now = Date.now();
  const lastNotification = visitNotificationSettings.rateLimit[clientIP] || 0;
  const minutesSinceLastNotification = (now - lastNotification) / (1000 * 60);
  
  if (minutesSinceLastNotification < visitNotificationSettings.rateLimitMinutes) {
    return next(); // Skip notification, too soon since last one
  }
  
  // Update rate limit tracker
  visitNotificationSettings.rateLimit[clientIP] = now;
  
  // Prepare visit data
  const visitData = {
    page: path,
    ip: clientIP,
    userAgent: userAgent,
    timestamp: new Date().toLocaleString(),
    referrer: req.get('Referrer'),
    fullUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
    isNewVisitor: minutesSinceLastNotification > (24 * 60) // New if no visit in 24 hours
  };
  
  // Send notification asynchronously (don't block the response)
  setImmediate(() => {
    sendVisitNotification(visitData);
  });
  
  next();
}

// Apply visit notification middleware to all routes
app.use(visitNotificationMiddleware);

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

app.get('/privacy', (req, res) => {
  res.render('privacy');
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
  
  const selectedCategory = req.query.category;
  let filteredPosts = blogPosts;
  
  if (selectedCategory && blogCategories[selectedCategory]) {
    filteredPosts = blogPosts.filter(post => post.category === selectedCategory);
  }
  
  res.render('blog', { 
    posts: filteredPosts,
    allPosts: blogPosts,
    categories: blogCategories,
    selectedCategory: selectedCategory || null
  });
});

// Category route
app.get('/blog/category/:category', (req, res) => {
  const category = req.params.category;
  
  if (!blogCategories[category]) {
    return res.status(404).render('404', {
      title: 'Category Not Found',
      message: 'The blog category you are looking for does not exist.'
    });
  }
  
  const filteredPosts = blogPosts.filter(post => post.category === category);
  
  res.render('blog', {
    posts: filteredPosts,
    allPosts: blogPosts,
    categories: blogCategories,
    selectedCategory: category,
    categoryInfo: blogCategories[category]
  });
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

app.post('/admin/refresh-token', requireAdminAuth, (req, res) => {
  // Generate new token for session extension
  const newToken = generateJWT();
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.cookie('adminToken', newToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 30 * 60 * 1000, // 30 minutes
    path: '/'
  });
  
  res.json({ 
    success: true, 
    message: 'Token refreshed successfully',
    expiresIn: 30 * 60 * 1000 // 30 minutes in milliseconds
  });
});

// Visit notification admin endpoints
app.get('/admin/visit-notifications', requireAdminAuth, (req, res) => {
  res.json({
    success: true,
    settings: visitNotificationSettings
  });
});

app.post('/admin/visit-notifications', requireAdminAuth, (req, res) => {
  const { enabled, notifyEmail, excludeIPs, rateLimitMinutes } = req.body;
  
  if (typeof enabled === 'boolean') {
    visitNotificationSettings.enabled = enabled;
  }
  
  if (notifyEmail && typeof notifyEmail === 'string') {
    visitNotificationSettings.notifyEmail = notifyEmail;
  }
  
  if (Array.isArray(excludeIPs)) {
    visitNotificationSettings.excludeIPs = ['127.0.0.1', '::1', ...excludeIPs];
  }
  
  if (rateLimitMinutes && typeof rateLimitMinutes === 'number') {
    visitNotificationSettings.rateLimitMinutes = rateLimitMinutes;
  }
  
  res.json({
    success: true,
    message: 'Visit notification settings updated',
    settings: visitNotificationSettings
  });
});

// Quick enable/disable endpoints
app.post('/admin/visit-notifications/enable', requireAdminAuth, (req, res) => {
  visitNotificationSettings.enabled = true;
  res.json({
    success: true,
    message: 'Visit notifications enabled with smart filtering',
    settings: visitNotificationSettings
  });
});

app.post('/admin/visit-notifications/disable', requireAdminAuth, (req, res) => {
  visitNotificationSettings.enabled = false;
  res.json({
    success: true,
    message: 'Visit notifications disabled',
    settings: visitNotificationSettings
  });
});

// Test visit notification endpoint
app.post('/admin/test-visit-notification', requireAdminAuth, (req, res) => {
  const testVisitData = {
    page: '/test-notification',
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Test Browser)',
    timestamp: new Date().toLocaleString(),
    referrer: 'Admin Test',
    fullUrl: 'https://www.spadoc.tech/test-notification'
  };
  
  sendVisitNotification(testVisitData);
  
  res.json({
    success: true,
    message: 'Test notification sent to ' + visitNotificationSettings.notifyEmail
  });
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
    message: 'Blog post added successfully' 
  });
});

app.post('/admin/edit-post', requireAdminAuth, (req, res) => {
  const { id, title, content } = req.body;
  
  if (!id || !title || !content) {
    return res.json({ 
      success: false, 
      error: 'Post ID, title, and content are required' 
    });
  }
  
  const postIndex = blogPosts.findIndex(post => post.id === parseInt(id));
  
  if (postIndex === -1) {
    return res.json({ 
      success: false, 
      error: 'Blog post not found' 
    });
  }
  
  const sanitizedContent = sanitizeContent(content);
  
  // Update the post
  blogPosts[postIndex] = {
    ...blogPosts[postIndex],
    title: title.trim(),
    content: sanitizedContent,
    lastModified: new Date()
  };
  
  // Save to persistent storage
  dataManager.saveBlogPosts(blogPosts);
  
  res.json({ 
    success: true, 
    message: 'Blog post added successfully',
    post: newPost
  });
});

app.post('/admin/edit-post', requireAdminAuth, (req, res) => {
  const { id, title, content } = req.body;
  
  if (!id || !title || !content) {
    return res.json({ 
      success: false, 
      error: 'Post ID, title, and content are required' 
    });
  }
  
  const postIndex = blogPosts.findIndex(post => post.id === parseInt(id));
  
  if (postIndex === -1) {
    return res.json({ 
      success: false, 
      error: 'Blog post not found' 
    });
  }
  
  const sanitizedContent = sanitizeContent(content);
  
  // Update the post
  blogPosts[postIndex] = {
    ...blogPosts[postIndex],
    title: title.trim(),
    content: sanitizedContent,
    lastModified: new Date()
  };
  
  // Save to persistent storage
  dataManager.saveBlogPosts(blogPosts);
  
  res.json({ 
    success: true, 
    message: 'Blog post updated successfully',
    post: blogPosts[postIndex]
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
app.get('/dashboard', requireAdminAuth, (req, res) => {
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
  const { name, phone, zipcode, message, service, source, sessionId, referrerPage } = req.body;
  
  console.log('Contact form submission:', { name, phone, zipcode, message, service, source });
  console.log('Analytics object state:', {
    hasContactSubmissions: !!analytics.contactSubmissions,
    contactSubmissionsLength: analytics.contactSubmissions ? analytics.contactSubmissions.length : 'undefined'
  });
  
  // Ensure analytics structure exists
  if (!analytics.contactSubmissions) {
    analytics.contactSubmissions = [];
  }
  
  // Track contact form analytics
  const submissionData = {
    timestamp: new Date().toISOString(),
    service: service || 'General Contact',
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
  try {
    await dataManager.saveAnalytics(analytics);
    console.log('Analytics saved successfully');
  } catch (error) {
    console.error('Error saving analytics:', error);
  }
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.BUSINESS_EMAIL || process.env.EMAIL_USER,
    subject: `New Service Request - ${service || 'General Contact'}`,
    html: `
      <h2>New Service Request from Spa Doctors Website</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Zipcode:</strong> ${zipcode}</p>
      <p><strong>Service Requested:</strong> ${service}</p>
      <p><strong>Source:</strong> ${source || 'unknown'}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
      <hr>
      <p><em>Submitted on: ${new Date().toLocaleString()}</em></p>
    `
  };
  
  try {
    console.log('Attempting to send email...');
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
    res.json({ success: true, message: 'Thank you for your message! We will contact you soon.' });
  } catch (error) {
    console.error('Email error:', error);
    console.error('Email configuration:', {
      user: process.env.EMAIL_USER ? 'SET' : 'NOT SET',
      pass: process.env.EMAIL_PASS ? 'SET' : 'NOT SET',
      businessEmail: process.env.BUSINESS_EMAIL || 'NOT SET'
    });
    res.json({ success: true, message: 'Thank you for your message! We will contact you soon.' });
  }
});

app.post('/upload-image', requireAdminAuth, upload.single('image'), async (req, res) => {
  if (req.file) {
    const newImage = {
      id: uuidv4(),
      filename: req.file.filename,
      originalname: req.file.originalname,
      description: '',
      uploadDate: new Date(),
      path: req.file.path
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

// New unified gallery upload endpoint
app.post('/admin/upload-gallery-images', requireAdminAuth, upload.array('images', 10), async (req, res) => {
  try {
    const { description } = req.body;
    const uploadedFiles = [];

    for (const file of req.files) {
      const newImage = {
        id: uuidv4(),
        filename: file.filename,
        originalname: file.originalname,
        description: description || '',
        uploadDate: new Date(),
        path: file.path
      };

      galleryImages.push(newImage);
      uploadedFiles.push(newImage);
    }

    // Save gallery images
    await dataManager.saveGalleryImages(galleryImages);

    res.json({ 
      success: true, 
      message: `${uploadedFiles.length} image(s) uploaded successfully!`,
      count: uploadedFiles.length,
      images: uploadedFiles 
    });
  } catch (error) {
    console.error('Gallery upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get gallery images endpoint
app.get('/admin/gallery-images', requireAdminAuth, async (req, res) => {
  try {
    res.json({ 
      success: true, 
      images: galleryImages 
    });
  } catch (error) {
    console.error('Gallery images error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete gallery image endpoint
app.post('/admin/delete-gallery-image', requireAdminAuth, async (req, res) => {
  try {
    const { imageId } = req.body;
    
    const imageIndex = galleryImages.findIndex(img => img.id === imageId);
    if (imageIndex === -1) {
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    const image = galleryImages[imageIndex];
    
    // Delete the file from disk
    try {
      await fs.unlink(image.path);
    } catch (fileError) {
      console.error('Error deleting file:', fileError);
    }

    // Remove from array
    galleryImages.splice(imageIndex, 1);
    
    // Save updated gallery
    await dataManager.saveGalleryImages(galleryImages);

    res.json({ 
      success: true, 
      message: 'Image deleted successfully!' 
    });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload media endpoint
app.post('/upload-media', requireAdminAuth, mediaUpload.array('mediaFiles', 5), async (req, res) => {
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
app.delete('/media/:id', requireAdminAuth, async (req, res) => {
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
app.post('/create-social-post', requireAdminAuth, (req, res, next) => {
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
app.post('/social-settings', requireAdminAuth, (req, res) => {
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