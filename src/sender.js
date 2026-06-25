class Sender {
  constructor(smtpPool, templateEngine, config, logger, stateManager, pendingQueue) {
    this.smtpPool = smtpPool;
    this.templateEngine = templateEngine;
    this.config = config;
    this.logger = logger;
    this.state = stateManager;
    this.pendingQueue = pendingQueue;
    this.stats = { sent: 0, failed: 0, pending: 0 };
    this.sendLog = [];
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _randomDelay() {
    const min = this.config.minDelay * 1000;
    const max = this.config.maxDelay * 1000;
    return this._delay(Math.floor(Math.random() * (max - min + 1)) + min);
  }

  async processLead(lead) {
    if (this.state.isPaused()) {
      return 'paused';
    }

    const toEmail = lead.email;
    if (!toEmail) {
      this.logger.warn('Skipping lead — no email', { name: lead.name || lead.receiver_name });
      return 'no_email';
    }

    const acct = this.smtpPool.getNextAvailable(toEmail);
    if (!acct) {
      this.logger.info('No SMTP account available — queuing lead', { email: toEmail });
      await this.pendingQueue.add(lead);
      this.stats.pending++;
      return 'queued';
    }

    const { subject, body } = this.templateEngine.render(lead);

    const mailOptions = {
      from: `"${acct.fromName || lead.sender_from_name || lead.sender_name || 'Sender'}" <${acct.fromEmail || acct.user}>`,
      to: toEmail,
      subject: subject,
      html: body
    };

    if (lead.reply_to) {
      mailOptions.replyTo = lead.reply_to;
    }

    let lastError = null;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        await this.smtpPool.sendMail(acct, mailOptions);
        this.smtpPool.recordSend(acct, toEmail);
        this.stats.sent++;
        this.sendLog.unshift({
          time: new Date().toISOString(),
          email: toEmail,
          name: lead.receiver_name || lead.name || '',
          account: acct.id,
          status: 'sent'
        });
        if (this.sendLog.length > 200) this.sendLog.pop();

        const acctState = this.state.getAccountState(acct.id);
        this.logger.success(`Sent → ${lead.receiver_name || toEmail}`,
          { email: toEmail, account: acct.id, sent: `${acctState.sentToday}/${this.smtpPool.getDailyLimit(acct, acctState.warmupDay)}` }
        );

        await this._randomDelay();
        return 'sent';
      } catch (err) {
        lastError = err;
        this.logger.warn(`Retry ${attempt + 1}/${this.config.maxRetries + 1} for ${toEmail}`,
          { error: err.message }
        );
        if (attempt < this.config.maxRetries) {
          await this._delay(this.config.retryDelayMs * (attempt + 1));
        }
      }
    }

    this.stats.failed++;
    this.sendLog.unshift({
      time: new Date().toISOString(),
      email: toEmail,
      name: lead.receiver_name || lead.name || '',
      account: acct ? acct.id : 'none',
      status: 'failed',
      error: lastError.message
    });
    if (this.sendLog.length > 200) this.sendLog.pop();

    this.logger.error(`Failed → ${toEmail}`, { error: lastError.message });
    return 'failed';
  }

  async processBatch(leads) {
    const results = { sent: 0, failed: 0, queued: 0, skipped: 0 };
    for (const lead of leads) {
      const result = await this.processLead(lead);
      if (result === 'sent') results.sent++;
      else if (result === 'failed') results.failed++;
      else if (result === 'queued') results.queued++;
      else results.skipped++;
    }
    return results;
  }

  getStats() {
    return {
      sent: this.stats.sent,
      failed: this.stats.failed,
      pending: this.stats.pending,
      sendLog: this.sendLog.slice(0, 100)
    };
  }

  resetStats() {
    this.stats = { sent: 0, failed: 0, pending: 0 };
  }
}

module.exports = Sender;
