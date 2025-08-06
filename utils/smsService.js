const twilio = require('twilio');

class SMSService {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
  }

  async sendConfirmation(phoneNumber, appointmentData) {
    try {
      const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      };

      const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      };

      const message = `Hi! Your appointment has been confirmed with Spa Doctors:

📅 ${appointmentData.title}
🗓️ ${formatDate(appointmentData.startDateTime)}
⏰ ${formatTime(appointmentData.startDateTime)} - ${formatTime(appointmentData.endDateTime)}
📍 ${appointmentData.location || 'Location TBD'}

${appointmentData.description ? `Details: ${appointmentData.description}` : ''}

Add to your calendar: ${appointmentData.calendarLink}

Questions? Call us at (856) 266-7293 or reply to this message.

- Spa Doctors Team`;

      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: this.formatPhoneNumber(phoneNumber)
      });

      return {
        success: true,
        messageSid: result.sid,
        status: result.status
      };
    } catch (error) {
      console.error('Error sending SMS confirmation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendReminder(phoneNumber, appointmentData) {
    try {
      const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric'
        });
      };

      const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      };

      const message = `🔔 Reminder: Your Spa Doctors appointment is tomorrow!

📅 ${appointmentData.title}
🗓️ ${formatDate(appointmentData.startDateTime)}
⏰ ${formatTime(appointmentData.startDateTime)}
📍 ${appointmentData.location || 'Location TBD'}

We look forward to helping you with your hot tub service needs!

Need to reschedule? Call (856) 266-7293

- Spa Doctors Team`;

      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: this.formatPhoneNumber(phoneNumber)
      });

      return {
        success: true,
        messageSid: result.sid,
        status: result.status
      };
    } catch (error) {
      console.error('Error sending SMS reminder:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendCancellation(phoneNumber, appointmentData) {
    try {
      const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        });
      };

      const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      };

      const message = `Your Spa Doctors appointment has been cancelled:

📅 ${appointmentData.title}
🗓️ ${formatDate(appointmentData.startDateTime)}
⏰ ${formatTime(appointmentData.startDateTime)}

Need to reschedule? Visit spadoc.tech/schedule or call (856) 266-7293

Thank you for choosing Spa Doctors!

- Spa Doctors Team`;

      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: this.formatPhoneNumber(phoneNumber)
      });

      return {
        success: true,
        messageSid: result.sid,
        status: result.status
      };
    } catch (error) {
      console.error('Error sending SMS cancellation:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  formatPhoneNumber(phoneNumber) {
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    } else {
      return phoneNumber;
    }
  }

  validatePhoneNumber(phoneNumber) {
    const cleaned = phoneNumber.replace(/\D/g, '');
    return cleaned.length === 10 || (cleaned.length === 11 && cleaned.startsWith('1'));
  }
}

module.exports = SMSService;