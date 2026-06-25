const fs = require('fs');
const path = require('path');

class PendingQueue {
  constructor(queuePath, stateManager, config) {
    this.queuePath = queuePath;
    this.state = stateManager;
    this.config = config;
    this.queue = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.queuePath)) {
        const raw = fs.readFileSync(this.queuePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Failed to load pending queue:', e.message);
    }
    return [];
  }

  _save() {
    const dir = path.dirname(this.queuePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.queuePath, JSON.stringify(this.queue, null, 2));
  }

  async add(lead) {
    this.queue.push({
      lead,
      addedAt: new Date().toISOString()
    });
    this._save();
  }

  async processPending(sender) {
    if (this.queue.length === 0) return;

    const remaining = [];

    for (const item of this.queue) {
      const result = await sender.processLead(item.lead);
      if (result === 'queued') {
        remaining.push(item);
      }
    }

    this.queue = remaining;
    this._save();
  }

  count() {
    return this.queue.length;
  }

  clear() {
    this.queue = [];
    this._save();
  }

  getQueue() {
    return this.queue;
  }
}

module.exports = PendingQueue;
