# Spa Doctors Website

Professional hot tub service website built with Node.js and Express.

## Features

- **Dynamic Blog Management**: Add and manage blog posts through admin interface
- **Business Analytics Dashboard**: Track page views, contact submissions, and customer journeys
- **Google Business Profile Integration**: Connect and manage Google Business presence
- **Media Library**: Upload and organize photos and videos with thumbnail generation
- **Social Media Management**: Create and schedule posts across platforms
- **Email Contact Forms**: Service requests sent directly to business email
- **Persistent Data Storage**: File-based data persistence with automatic backups
- **Professional Services**: Complete hot tub repair, transport, cleaning, and maintenance
- **Responsive Design**: Mobile-friendly layout optimized for all devices
- **Phone-First Contact**: Prominent phone number display throughout site

## Services Offered

- 🔧 **Diagnosis & Repair**: Expert troubleshooting and repair services
- 🚛 **Hot Tub Transport**: Safe and professional moving services  
- 🧽 **Deep Cleaning**: Thorough cleaning for optimal hygiene
- 🔄 **Regular Maintenance**: Preventive care to keep spas running perfectly

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create environment file:
   ```bash
   cp .env.example .env
   # Edit .env with your email credentials
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Visit `http://localhost:3000` to view the website

## Environment Variables

Create a `.env` file with essential settings:
```
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
BUSINESS_EMAIL=your-business@gmail.com
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

For production deployment, see `.env.production.example` for complete configuration options.

## Production Deployment

**⚠️ Important: This application is now production-ready with persistent data storage.**

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

Quick production setup:
1. Copy `.env.production.example` to `.env` and configure
2. Set up Google OAuth2 credentials for Google Business Profile
3. Configure Gmail SMTP for contact forms
4. Deploy to your preferred platform (Vercel, Railway, VPS)

The server runs on port 3000 by default (configurable via PORT environment variable).

## Contact Information

- **Phone**: (856) 266-7293
- **Email**: Doctor4Spas@gmail.com
- **Service Area**: Denver Metro Area

## File Structure

```
SpaDoctorsWebsite/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables (not in repo)
├── .env.example           # Environment template
├── public/
│   ├── css/style.css      # Main stylesheet
│   └── images/           # Static images
├── views/                # EJS templates
│   ├── index.ejs         # Homepage with reviews carousel
│   ├── services.ejs      # Services page with request form
│   ├── gallery.ejs       # Photo gallery
│   ├── about.ejs         # About page
│   ├── contact.ejs       # Contact page
│   └── blog.ejs          # Blog page
└── uploads/              # Uploaded gallery images
```
# Updated Mon Jun 23 12:48:22 MDT 2025
