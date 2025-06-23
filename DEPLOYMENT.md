# Spa Doctors Website - Production Deployment Guide

## Overview
This guide covers deploying the Spa Doctors website to production with real data persistence and API integrations.

## Pre-Deployment Checklist

### ✅ Data Migration
- [x] Replaced hardcoded blog posts with file-based storage
- [x] Implemented persistent analytics tracking
- [x] Added media library persistence
- [x] Removed simulation functions for social media posting

### ⚠️ API Setup Required
- [ ] Configure Google OAuth2 for Google Business Profile
- [ ] Set up Gmail SMTP for contact forms
- [ ] Optional: Configure Facebook Graph API
- [ ] Optional: Configure Instagram Business API

## Environment Setup

### 1. Copy Environment Variables
```bash
cp .env.production.example .env
```

### 2. Configure Required Variables
Edit `.env` with your actual credentials:

**Essential (Required):**
```env
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-gmail-app-password
BUSINESS_EMAIL=Doctor4Spas@gmail.com
```

**Google Business Profile (Recommended):**
```env
GOOGLE_CLIENT_ID=your-client-id.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google/callback
```

### 3. Create Data Directories
The app will automatically create these, but you can pre-create them:
```bash
mkdir -p data
mkdir -p data/backups
mkdir -p uploads/media
mkdir -p uploads/thumbnails
```

## Google API Setup

### Google OAuth2 Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable APIs:
   - Google Business Profile API
   - Google OAuth2 API
4. Create OAuth2 credentials
5. Add your domain to authorized redirect URIs

### Gmail SMTP Setup
1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. Use this app password as `EMAIL_PASS`

## Deployment Platforms

### Vercel (Recommended)
1. Connect your GitHub repository
2. Add environment variables in Vercel dashboard
3. Deploy automatically on git push

### Railway
1. Connect GitHub repository
2. Add environment variables
3. Deploy

### Traditional VPS
1. Install Node.js 18+
2. Clone repository
3. Set up environment variables
4. Use PM2 for process management:
```bash
npm install -g pm2
pm2 start server.js --name spa-doctors
pm2 startup
pm2 save
```

## Post-Deployment Tasks

### 1. Verify Functionality
- [ ] Contact form sends emails
- [ ] Blog posts can be added/viewed
- [ ] Media uploads work
- [ ] Analytics tracking functions
- [ ] Google Business Profile connection (if configured)

### 2. Data Backup
The system automatically creates backups on startup. For production:
- Set up automated backups of the `/data` directory
- Consider database migration for high-traffic sites

### 3. SSL Certificate
Ensure HTTPS is enabled for:
- Secure contact form submissions
- Google OAuth2 callbacks
- General security

## Monitoring

### Key Metrics to Monitor
- Contact form submissions (`/analytics-data`)
- Page views and user journeys
- Media upload success rates
- API call success/failure rates

### Log Files
- Server logs: `server.log` (if configured)
- Error tracking via console outputs
- Analytics data in `/data/analytics.json`

## Scaling Considerations

### File Storage
- Current: Local file system
- Recommended for scale: AWS S3 or similar cloud storage
- Migration path provided in environment variables

### Database Migration
- Current: JSON file-based storage
- For high traffic: PostgreSQL or MongoDB
- Schema designed for easy migration

### CDN Setup
- Serve static assets through a CDN
- Optimize image delivery for gallery and media

## Security Best Practices

### Environment Variables
- Never commit `.env` files to version control
- Use platform-specific environment variable systems
- Rotate API keys regularly

### File Uploads
- Current validation: File type and size limits
- Consider: Virus scanning for production
- Monitor: Storage usage and abuse

### Rate Limiting
- Consider implementing rate limiting for contact forms
- Monitor for spam submissions
- Add CAPTCHA if needed

## Troubleshooting

### Common Issues

**Email not sending:**
- Verify Gmail SMTP credentials
- Check app password vs regular password
- Ensure 2FA is enabled

**Google OAuth failing:**
- Verify redirect URI matches exactly
- Check API quotas in Google Cloud Console
- Ensure APIs are enabled

**Data not persisting:**
- Check file permissions on `/data` directory
- Verify disk space
- Check server logs for write errors

### Support Contacts
- Technical: Review server logs and error messages
- Google APIs: Google Cloud Console support
- Deployment: Platform-specific documentation

## Backup and Recovery

### Automated Backups
- System creates backups on startup
- Stored in `/data/backups/[timestamp]/`
- Recommended: External backup solution

### Manual Backup
```bash
# Backup all data
tar -czf spa-doctors-backup-$(date +%Y%m%d).tar.gz data/ uploads/

# Restore from backup
tar -xzf spa-doctors-backup-YYYYMMDD.tar.gz
```

### Recovery Procedures
1. Stop the application
2. Replace `/data` directory with backup
3. Restart application
4. Verify data integrity

---

**Need help?** Check the main README.md for basic setup or contact support with specific deployment issues.