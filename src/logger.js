const winston = require('winston');
const path = require('path');
const fs = require('fs');

class Logger {
  constructor(label) {
    this.label = label;
    this.logDir = null;
    this.fileLogger = null;
    this._initFileLogger();
  }

  setLogDir(logDir) {
    this.logDir = logDir;
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    this._initFileLogger();
  }

  _initFileLogger() {
    if (!this.logDir) return;

    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logDir, `${date}.log`);

    this.fileLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        })
      ),
      transports: [
        new winston.transports.File({ filename: logFile })
      ]
    });
  }

  _format(msg, data) {
    let output = msg;
    if (data && typeof data === 'object') {
      const extras = Object.entries(data)
        .filter(([k]) => k !== 'message')
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      if (extras) output += ` (${extras})`;
    }
    return output;
  }

  info(msg, data) {
    const formatted = this._format(msg, data);
    console.log(`[${this.label}] ${formatted}`);
    if (this.fileLogger) this.fileLogger.info(formatted);
  }

  warn(msg, data) {
    const formatted = this._format(msg, data);
    console.warn(`[${this.label}] ⚠ ${formatted}`);
    if (this.fileLogger) this.fileLogger.warn(formatted);
  }

  error(msg, data) {
    const formatted = this._format(msg, data);
    console.error(`[${this.label}] ✖ ${formatted}`);
    if (this.fileLogger) this.fileLogger.error(formatted);
  }

  success(msg, data) {
    const formatted = this._format(msg, data);
    console.log(`[${this.label}] ✓ ${formatted}`);
    if (this.fileLogger) this.fileLogger.info(`✓ ${formatted}`);
  }
}

module.exports = Logger;
