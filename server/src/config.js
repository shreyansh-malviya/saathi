// Central place for configuration read from the environment.
// Fails fast on boot if something required is missing, instead of
// failing later in the middle of a request.

const required = ['MONGODB_URI', 'JWT_SECRET'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

export const config = {
  isProd,
  port: Number(process.env.PORT) || 5050,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  cronSecret: process.env.CRON_SECRET || '',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:hello@saathi.app',
  },
  // How long a logged-in session lasts for family members.
  sessionDays: 7,
  // How long a paired parent phone stays signed in (they should never have to log in again).
  parentDeviceDays: 365,
  // Demo circles are deleted after this many hours.
  demoTtlHours: 48,
};
