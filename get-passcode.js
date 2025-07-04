require('dotenv').config();
const crypto = require('crypto');

function generateDailyPasscode() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const secret = process.env.ADMIN_SECRET || 'fallback-secret';
  const hash = crypto.createHash('sha256').update(today + secret).digest('hex');
  const numericCode = parseInt(hash.substring(0, 8), 16) % 10000;
  return `SPA${numericCode.toString().padStart(4, '0')}`;
}

console.log('📅 Today\'s Admin Passcode:', generateDailyPasscode());
console.log('🔗 Admin Login URL: http://localhost:3000/admin/login');
console.log('📝 Blog Dashboard: http://localhost:3000/admin/blog');
console.log('');
console.log('🔐 Security Features:');
console.log('- Passcode changes daily at midnight');
console.log('- JWT tokens expire after 30 minutes');
console.log('- Rate limiting: 3 attempts per 15 minutes');
console.log('- Input sanitization prevents XSS attacks');
console.log('- Secure HTTP-only cookies');
console.log('- Vercel serverless compatible');
console.log('- All admin actions require authentication');