# 🚀 Quick Setup Instructions

## 1. Create Environment File

Copy the template to create your `.env` file:

```bash
cp .env.template .env
```

## 2. Add Twilio Credentials

You only need to update these Twilio values in your `.env` file:

```env
TWILIO_ACCOUNT_SID=your-actual-twilio-account-sid
TWILIO_AUTH_TOKEN=your-actual-twilio-auth-token  
TWILIO_PHONE_NUMBER=+1234567890
```

**Google Calendar credentials are already configured!** ✅

## 3. Get Twilio Credentials

1. Sign up at [Twilio.com](https://www.twilio.com/)
2. Go to Console Dashboard
3. Copy your **Account SID** and **Auth Token**
4. Buy a phone number from Twilio
5. Add these to your `.env` file

## 4. Calendar Access Setup

Your service account needs access to your calendar:

1. Open [Google Calendar](https://calendar.google.com/)
2. Go to Settings (gear icon) → Settings
3. On the left, click "Add calendar" → "Create new calendar"
4. Name it "Spa Doctors Appointments" 
5. Click "Create calendar"
6. Go to the calendar settings for your new calendar
7. Scroll to "Share with specific people"
8. Add: `spa-doctors-calendar@voicemailai-467300.iam.gserviceaccount.com`
9. Give it "Make changes to events" permission
10. Copy the Calendar ID from the calendar settings
11. Update `GOOGLE_CALENDAR_ID` in your `.env` file with this ID

## 5. Test the System

1. Start the server: `npm run dev`
2. Go to `http://localhost:3000/schedule`
3. Try booking an appointment
4. Check your Google Calendar for the event
5. Check SMS delivery (if Twilio is configured)

## 6. Go Live!

Once everything works locally:
- Deploy to your hosting platform
- Update environment variables on the server
- Update `GOOGLE_REDIRECT_URI` if needed for production

That's it! Your scheduling system is ready! 🎉