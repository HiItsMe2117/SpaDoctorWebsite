const { google } = require('googleapis');

class CalendarService {
  constructor() {
    console.log('🔧 [Calendar] Initializing CalendarService...');
    
    // Check for required environment variables
    const requiredEnvVars = ['GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.warn('⚠️ [Calendar] Missing environment variables:', missingVars.join(', '));
      console.warn('⚠️ [Calendar] Calendar service will run in fallback mode');
      this.fallbackMode = true;
      return;
    }

    try {
      // Use Service Account authentication
      this.auth = new google.auth.GoogleAuth({
        credentials: {
          type: process.env.GOOGLE_SERVICE_ACCOUNT_TYPE || 'service_account',
          project_id: process.env.GOOGLE_PROJECT_ID,
          private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          client_id: process.env.GOOGLE_CLIENT_ID,
          auth_uri: process.env.GOOGLE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
          token_uri: process.env.GOOGLE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
          auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
          client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL
        },
        scopes: ['https://www.googleapis.com/auth/calendar']
      });

      this.calendar = google.calendar({ version: 'v3', auth: this.auth });
      this.calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
      this.fallbackMode = false;
      
      console.log('✅ [Calendar] CalendarService initialized with Google API');
    } catch (error) {
      console.error('❌ [Calendar] Failed to initialize Google Auth:', error.message);
      console.warn('⚠️ [Calendar] Falling back to offline mode');
      this.fallbackMode = true;
    }
  }

  async checkAvailability(startDateTime, endDateTime) {
    if (this.fallbackMode) {
      console.log('🔄 [Calendar] Fallback mode: assuming slot available');
      return true; // In fallback mode, assume all slots are available
    }

    try {
      const response = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: startDateTime,
          timeMax: endDateTime,
          timeZone: 'America/Denver',
          items: [{ id: this.calendarId }]
        }
      });

      const busyTimes = response.data.calendars[this.calendarId]?.busy || [];
      return busyTimes.length === 0;
    } catch (error) {
      console.error('❌ [Calendar] Error checking availability:', error.message);
      console.log('🔄 [Calendar] Fallback: assuming slot available due to API error');
      return true; // Fallback to available when API fails
    }
  }

  async createEvent(eventData) {
    try {
      const event = {
        summary: eventData.title,
        description: eventData.description,
        location: eventData.location,
        start: {
          dateTime: eventData.startDateTime,
          timeZone: 'America/Denver'
        },
        end: {
          dateTime: eventData.endDateTime,
          timeZone: 'America/Denver'
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 10 }
          ]
        }
      };

      const response = await this.calendar.events.insert({
        calendarId: this.calendarId,
        requestBody: event
      });

      return {
        id: response.data.id,
        htmlLink: response.data.htmlLink,
        hangoutLink: response.data.hangoutLink
      };
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw new Error('Failed to create calendar event');
    }
  }

  async getEvents(timeMin, timeMax) {
    if (this.fallbackMode) {
      console.log('🔄 [Calendar] Fallback mode: returning empty events list');
      return []; // In fallback mode, return empty events (all slots appear available)
    }

    try {
      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: timeMin,
        timeMax: timeMax,
        maxResults: 100,
        singleEvents: true,
        orderBy: 'startTime'
      });

      const events = response.data.items || [];
      console.log('✅ [Calendar] Fetched', events.length, 'events');
      return events;
    } catch (error) {
      console.error('❌ [Calendar] Error fetching events:', error.message);
      console.log('🔄 [Calendar] Fallback: returning empty events due to API error');
      return []; // Return empty events on error (makes all slots appear available)
    }
  }

  async updateEvent(eventId, eventData) {
    try {
      const event = {
        summary: eventData.title,
        description: eventData.description,
        location: eventData.location,
        start: {
          dateTime: eventData.startDateTime,
          timeZone: 'America/Denver'
        },
        end: {
          dateTime: eventData.endDateTime,
          timeZone: 'America/Denver'
        },
      };

      const response = await this.calendar.events.update({
        calendarId: this.calendarId,
        eventId: eventId,
        requestBody: event
      });

      return response.data;
    } catch (error) {
      console.error('Error updating calendar event:', error);
      throw new Error('Failed to update calendar event');
    }
  }

  async deleteEvent(eventId) {
    try {
      await this.calendar.events.delete({
        calendarId: this.calendarId,
        eventId: eventId
      });
      return true;
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      throw new Error('Failed to delete calendar event');
    }
  }

  generateBusinessHours(date) {
    const businessStart = 7;
    const businessEnd = 19;
    const maxSlotsPerDay = 4; // Now 4 possible 3-hour slots per day
    const slots = [];

    // Use Mountain Time (America/Denver) timezone for correct local display
    const inputDate = new Date(date);
    const dateStr = inputDate.toISOString().split('T')[0];
    
    // Generate 3-hour time windows
    // Morning Period (7 AM - 1 PM): Two 3-hour slots
    
    // Early Morning: 7:00 AM - 10:00 AM
    const earlyMorningStart = new Date(`${dateStr}T07:00:00-06:00`);
    const earlyMorningEnd = new Date(`${dateStr}T10:00:00-06:00`);
    slots.push({
      start: earlyMorningStart.toISOString(),
      end: earlyMorningEnd.toISOString(),
      title: 'Early Morning Appointment',
      period: 'morning',
      displayName: '7:00 AM - 10:00 AM'
    });

    // Late Morning: 10:00 AM - 1:00 PM  
    const lateMorningStart = new Date(`${dateStr}T10:00:00-06:00`);
    const lateMorningEnd = new Date(`${dateStr}T13:00:00-06:00`);
    slots.push({
      start: lateMorningStart.toISOString(),
      end: lateMorningEnd.toISOString(),
      title: 'Late Morning Appointment',
      period: 'morning',
      displayName: '10:00 AM - 1:00 PM'
    });

    // Afternoon Period (2 PM - 7 PM): Two 3-hour slots
    
    // Early Afternoon: 2:00 PM - 5:00 PM
    const earlyAfternoonStart = new Date(`${dateStr}T14:00:00-06:00`);
    const earlyAfternoonEnd = new Date(`${dateStr}T17:00:00-06:00`);
    slots.push({
      start: earlyAfternoonStart.toISOString(),
      end: earlyAfternoonEnd.toISOString(),
      title: 'Early Afternoon Appointment',
      period: 'afternoon',
      displayName: '2:00 PM - 5:00 PM'
    });

    // Late Afternoon: 4:00 PM - 7:00 PM (overlapping option)
    const lateAfternoonStart = new Date(`${dateStr}T16:00:00-06:00`);
    const lateAfternoonEnd = new Date(`${dateStr}T19:00:00-06:00`);
    slots.push({
      start: lateAfternoonStart.toISOString(),
      end: lateAfternoonEnd.toISOString(),
      title: 'Late Afternoon Appointment',
      period: 'afternoon',
      displayName: '4:00 PM - 7:00 PM'
    });

    return slots;
  }

  // Helper method to get slots by period (for frontend filtering)
  getSlotsByPeriod(date, period) {
    const allSlots = this.generateBusinessHours(date);
    return allSlots.filter(slot => slot.period === period);
  }
}

module.exports = CalendarService;