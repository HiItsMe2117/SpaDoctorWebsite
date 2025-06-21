# Spa Doctors Website

Professional hot tub service website built with Node.js and Express.

## Features

- **Homepage**: Hero section emphasizing repairs with prominent phone contact
- **Services**: Detailed pages for all 4 services (diagnosis/repair, transport, cleaning, maintenance)
- **Gallery**: Photo gallery with admin upload capability
- **About**: Company info highlighting biBerk insurance and professional credentials
- **Contact**: Phone-first contact with backup form
- **Blog**: Simple blog system for posting articles and tips
- **Responsive Design**: Mobile-friendly layout with blue/black/white theme

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Visit `http://localhost:3000` to view the website

## Production Deployment

1. Start the production server:
   ```bash
   npm start
   ```

2. The server runs on port 3000 by default (configurable via PORT environment variable)

## Raspberry Pi Deployment

This website is optimized for Raspberry Pi hosting:

1. Transfer files to your Raspberry Pi
2. Install Node.js on the Pi
3. Run `npm install` to install dependencies
4. Use `npm start` to run the production server
5. Consider using PM2 for process management:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "spa-doctors"
   pm2 startup
   pm2 save
   ```

## Admin Features

- **Gallery Management**: Click "Admin Upload" on the gallery page to add photos
- **Blog Management**: Click "Admin: Add Article" on the blog page to publish articles
- **Contact Forms**: All form submissions are logged to the console

## Configuration

- **Phone Number**: Update the phone number in all HTML files (search for "123-456-7890")
- **Google Reviews**: Replace "YOUR_GOOGLE_BUSINESS_ID" in the homepage with your actual Google Business ID
- **Email**: Configure nodemailer settings in server.js for email notifications

## File Structure

```
SpaDoctorsWebsite/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── public/
│   ├── css/style.css      # Main stylesheet
│   ├── js/               # JavaScript files
│   └── images/           # Static images
├── views/                # EJS templates
│   ├── index.ejs         # Homepage
│   ├── services.ejs      # Services page
│   ├── gallery.ejs       # Photo gallery
│   ├── about.ejs         # About page
│   ├── contact.ejs       # Contact page
│   └── blog.ejs          # Blog page
└── uploads/              # Uploaded gallery images
```

## Support

For technical support or questions about the website, refer to the code comments or contact the developer.