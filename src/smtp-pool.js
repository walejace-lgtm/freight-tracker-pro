const nodemailer = require('nodemailer');

class SmtpPool {
  constructor(accounts, stateManager, config) {
    this.accounts = accounts;
    this.state = stateManager;
    this.config = config;
    this.transporters = new Map();
    this.lastUsedIndex = -1;
    this._initTransporters();
  }

  _initTransporters() {
    for (const acct of this.accounts) {
      this.state.getAccountState(acct.id);
    }
  }

  _createTransporter(acct) {
    const transporter = nodemailer.createTransport({
      host: acct.host,
      port: acct.port,
      secure: acct.secure || false,
      auth: {
        user: acct.user,
        pass: acct.pass
      },
      pool: true,
      maxConnections: 3,
      maxMessages: 50
    });
    return transporter;
  }

  _getTransporter(acct) {
    if (!this.transporters.has(acct.id)) {
      this.transporters.set(acct.id, this._createTransporter(acct));
    }
    return this.transporters.get(acct.id);
  }

  _validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  getDailyLimit(acctConfig, warmupDay) {
    const { maxDaily, warmupDays } = acctConfig;
    const schedule = this.config.warmupSchedule;

    let limit = Math.round(maxDaily * 0.01);

    for (const m of schedule) {
      if (warmupDay >= m.day) {
        limit = Math.round(maxDaily * m.pct);
      }
    }

    if (warmupDay >= warmupDays) {
      limit = maxDaily;
    }

    return Math.max(1, Math.min(maxDaily, limit));
  }

  _getDomain(toEmail) {
    const parts = toEmail.split('@');
    return parts.length > 1 ? parts[1].toLowerCase() : null;
  }

  canSend(acct, toEmail) {
    if (!this._validateEmail(toEmail)) return false;

    this.state.checkDailyReset(acct.id);
    const acctState = this.state.getAccountState(acct.id);
    const dailyLimit = this.getDailyLimit(acct, acctState.warmupDay);

    if ((acctState.sentToday || 0) >= dailyLimit) return false;

    const domain = this._getDomain(toEmail);
    if (domain) {
      const hourKey = `${new Date().getHours()}`;
      const domainKey = `${acct.id}:${domain}`;
      const domainData = this.state.getDomainData(domainKey, hourKey);
      if ((domainData.count || 0) >= this.config.domainRateLimit) return false;
    }

    return true;
  }

  getNextAvailable(toEmail) {
    const accounts = this.accounts;
    if (accounts.length === 0) return null;

    for (let i = 0; i < accounts.length; i++) {
      this.lastUsedIndex = (this.lastUsedIndex + 1) % accounts.length;
      const acct = accounts[this.lastUsedIndex];
      if (this.canSend(acct, toEmail)) {
        return acct;
      }
    }

    for (const acct of accounts) {
      if (this.canSend(acct, toEmail)) {
        return acct;
      }
    }

    return null;
  }

  recordSend(acct, toEmail) {
    this.state.incrementSentToday(acct.id);

    const domain = this._getDomain(toEmail);
    if (domain) {
      const hourKey = `${new Date().getHours()}`;
      const domainKey = `${acct.id}:${domain}`;
      this.state.incrementDomainCount(domainKey, hourKey);
    }
  }

  async sendMail(acct, mailOptions) {
    const transporter = this._getTransporter(acct);
    return transporter.sendMail(mailOptions);
  }

  getAccountStats() {
    return this.accounts.map(acct => {
      const acctState = this.state.getAccountState(acct.id);
      const dailyLimit = this.getDailyLimit(acct, acctState.warmupDay);
      return {
        id: acct.id,
        host: acct.host,
        user: acct.user,
        fromName: acct.fromName,
        maxDaily: acct.maxDaily,
        warmupDays: acct.warmupDays,
        warmupDay: acctState.warmupDay,
        sentToday: acctState.sentToday || 0,
        dailyLimit,
        progressPct: dailyLimit > 0 ? Math.round(((acctState.sentToday || 0) / dailyLimit) * 100) : 0,
        warmupPct: Math.round(((acctState.warmupDay || 1) / acct.warmupDays) * 100)
      };
    });
  }

  async verifyAll() {
    const results = [];
    for (const acct of this.accounts) {
      try {
        const transporter = this._getTransporter(acct);
        await transporter.verify();
        results.push({ id: acct.id, status: 'ok' });
      } catch (e) {
        results.push({ id: acct.id, status: 'error', message: e.message });
      }
    }
    return results;
  }
}

module.exports = SmtpPool;
