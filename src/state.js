const fs = require('fs');
const path = require('path');

class StateManager {
  constructor(statePath) {
    this.statePath = statePath;
    this.state = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.statePath)) {
        const raw = fs.readFileSync(this.statePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Failed to load state:', e.message);
    }
    return this._default();
  }

  _default() {
    return {
      accounts: {},
      processedFiles: [],
      domainCounts: {},
      globalPaused: false,
      lastDate: null
    };
  }

  _save() {
    const dir = path.dirname(this.statePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
  }

  getAccountState(accountId) {
    if (!this.state.accounts[accountId]) {
      this.state.accounts[accountId] = {
        warmupDay: 1,
        lastActiveDate: null,
        sentToday: 0,
        todayDate: null
      };
      this._save();
    }
    return this.state.accounts[accountId];
  }

  getToday() {
    return new Date().toISOString().split('T')[0];
  }

  checkDailyReset(accountId) {
    const acct = this.getAccountState(accountId);
    const today = this.getToday();

    if (acct.todayDate !== today) {
      acct.sentToday = 0;
      acct.todayDate = today;

      if (acct.lastActiveDate) {
        const lastDate = new Date(acct.lastActiveDate);
        const diffDays = Math.floor((new Date(today) - lastDate) / (1000 * 60 * 60 * 24));
        if (diffDays > 7) {
          acct.warmupDay = 1;
        }
      }

      this._save();
    }
  }

  incrementSentToday(accountId) {
    const acct = this.getAccountState(accountId);
    acct.sentToday = (acct.sentToday || 0) + 1;
    acct.lastActiveDate = this.getToday();
    this._save();
  }

  advanceWarmupDay(accountId) {
    const acct = this.getAccountState(accountId);
    acct.warmupDay = (acct.warmupDay || 1) + 1;
    this._save();
  }

  isFileProcessed(filename) {
    return this.state.processedFiles.includes(filename);
  }

  markFileProcessed(filename) {
    if (!this.isFileProcessed(filename)) {
      this.state.processedFiles.push(filename);
      this._save();
    }
  }

  isPaused() {
    return this.state.globalPaused;
  }

  setPaused(paused) {
    this.state.globalPaused = paused;
    this._save();
  }

  getDomainData(domainKey, hourKey) {
    if (!this.state.domainCounts[domainKey]) {
      this.state.domainCounts[domainKey] = {};
    }
    if (!this.state.domainCounts[domainKey][hourKey]) {
      this.state.domainCounts[domainKey][hourKey] = { count: 0 };
    }
    return this.state.domainCounts[domainKey][hourKey];
  }

  incrementDomainCount(domainKey, hourKey) {
    const data = this.getDomainData(domainKey, hourKey);
    data.count = (data.count || 0) + 1;
    this._save();
  }

  checkDailyAdvancement() {
    const today = this.getToday();
    if (this.state.lastDate !== today) {
      for (const accountId of Object.keys(this.state.accounts)) {
        this.advanceWarmupDay(accountId);
      }
      this.state.lastDate = today;
      this._save();
    }
  }

  getStats() {
    return {
      accounts: this.state.accounts,
      processedCount: this.state.processedFiles.length,
      globalPaused: this.state.globalPaused,
      lastDate: this.state.lastDate
    };
  }
}

module.exports = StateManager;
