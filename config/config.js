const path = require('path');

module.exports = {
  dropFolder: path.resolve(process.env.DROP_FOLDER || './drop-folder'),
  templatesDir: path.join(__dirname, 'templates'),
  dashboardPort: parseInt(process.env.DASHBOARD_PORT) || 3456,

  smtpAccounts: [
    {
      id: 'default',
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      fromEmail: process.env.SMTP_USER || '',
      fromName: process.env.SMTP_FROM_NAME || 'Sender',
      maxDaily: 500,
      warmupDays: 21
    }
  ],

  warmupSchedule: [
    { day: 1,  pct: 0.01 },
    { day: 2,  pct: 0.015 },
    { day: 3,  pct: 0.025 },
    { day: 4,  pct: 0.035 },
    { day: 5,  pct: 0.05 },
    { day: 6,  pct: 0.08 },
    { day: 7,  pct: 0.15 },
    { day: 8,  pct: 0.20 },
    { day: 9,  pct: 0.30 },
    { day: 10, pct: 0.40 },
    { day: 11, pct: 0.50 },
    { day: 12, pct: 0.60 },
    { day: 14, pct: 0.75 },
    { day: 16, pct: 0.85 },
    { day: 18, pct: 0.90 },
    { day: 21, pct: 1.0 }
  ],

  domainRateLimit: 50,
  warmupResetDays: 7,

  minDelay: 2,
  maxDelay: 7,

  maxRetries: 3,
  retryDelayMs: 5000,

  emailField: 'receiver_email',
  nameField: 'receiver_name',

  pendingQueueFile: path.join(__dirname, '..', 'data', 'pending.json'),
  stateFile: path.join(__dirname, '..', 'data', 'state.json'),
  logDir: path.join(__dirname, '..', 'data', 'logs'),
  stateDir: path.join(__dirname, '..', 'data')
};
