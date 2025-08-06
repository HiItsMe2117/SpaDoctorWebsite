# Scheduling Feature Setup Guide

## Overview
The scheduling feature has been successfully implemented with Google Calendar API integration and Twilio SMS notifications. Here's what you need to know to get it running.

## Features Implemented
✅ **FullCalendar Integration** - Interactive calendar view for date selection
✅ **Google Calendar API** - Real-time availability checking and event creation
✅ **Twilio SMS** - Automatic confirmation and reminder messages
✅ **Booking Form** - Complete form with service type, customer info, and details
✅ **Admin Management** - View and manage appointments through admin panel
✅ **Mobile Responsive** - Works seamlessly on all devices

## Required Environment Variables

Add these to your `.env` file:

```env
# Google Calendar API Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
GOOGLE_REFRESH_TOKEN=your-google-refresh-token
GOOGLE_CALENDAR_ID=primary

# Twilio Configuration
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

## Setup Steps

### 1. Google Calendar API Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the Calendar API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/auth/google/callback`
6. Generate a refresh token (you'll need to do OAuth flow once)

### 2. Twilio Setup
1. Sign up for [Twilio](https://www.twilio.com/)
2. Get your Account SID and Auth Token from the dashboard
3. Purchase a phone number for sending SMS
4. Add these credentials to your `.env` file

### 3. Test the Feature
1. Start your server: `npm run dev`
2. Navigate to `/schedule` on your website
3. Select a date and time
4. Fill out the booking form
5. Submit to test the complete workflow

## API Endpoints

### Public Endpoints:
- `GET /schedule` - Scheduling page
- `GET /api/available-slots/:date` - Get available time slots for a date
- `POST /api/book-appointment` - Book a new appointment

### Admin Endpoints (require authentication):
- `GET /api/admin/appointments` - Get all appointments
- `DELETE /api/admin/appointments/:eventId` - Cancel an appointment

## File Structure

```
utils/
├── calendarService.js    # Google Calendar API integration
└── smsService.js        # Twilio SMS functionality

views/
└── schedule.ejs         # Scheduling page template

server.js                # Added scheduling routes and service initialization
```

## Business Hours Configuration
Currently set to:
- **Days**: Monday - Saturday
- **Hours**: 8:00 AM - 6:00 PM
- **Slots**: 60-minute intervals

You can modify these in `utils/calendarService.js` in the `generateBusinessHours()` method.

## SMS Message Templates
The system sends:
1. **Confirmation SMS** - Immediately after booking
2. **Reminder SMS** - Can be triggered for upcoming appointments
3. **Cancellation SMS** - When appointments are cancelled

Templates can be customized in `utils/smsService.js`.

## Navigation Updates
The "Schedule" link has been added to all page navigation menus and will appear between "Contact" and "Blog" links.

## Security Features
- Phone number validation
- Input sanitization
- Double availability checking
- Admin authentication for management routes
- Rate limiting on sensitive endpoints

## Next Steps
1. Set up your Google Calendar and Twilio credentials
2. Test the booking workflow
3. Customize business hours and SMS templates as needed
4. Consider adding email notifications as a backup to SMS
5. Implement appointment reminders with a cron job

## Troubleshooting
- Ensure all environment variables are set correctly
- Check Google Calendar API quotas if requests fail
- Verify Twilio phone number format (+1XXXXXXXXXX)
- Check server logs for detailed error messages

The scheduling feature is now fully integrated and ready for production use!