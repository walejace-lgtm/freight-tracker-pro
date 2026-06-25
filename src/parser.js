const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

class Parser {
  constructor(config) {
    this.config = config;
  }

  parse(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.csv') {
      return this._parseCsv(filePath);
    } else if (ext === '.txt') {
      return this._parseTxt(filePath);
    }

    throw new Error(`Unsupported file type: ${ext}`);
  }

  _parseCsv(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const records = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    });

    return records.map((row, i) => {
      const normalized = {};
      for (const [key, val] of Object.entries(row)) {
        normalized[key.trim().toLowerCase().replace(/[^a-z0-9_]/gi, '_')] = (val || '').trim();
      }

      const email = this._findEmail(normalized);
      if (!email) {
        throw new Error(`Row ${i + 1}: no email found in columns: ${Object.keys(row).join(', ')}`);
      }

      return { ...normalized, email };
    });
  }

  _parseTxt(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/);
    const leads = [];
    let currentLead = {};
    let inTemplateHeader = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || /^={3,}$/.test(trimmed)) {
        if (Object.keys(currentLead).length > 0) {
          const email = this._findEmail(currentLead);
          if (email) currentLead.email = email;
          leads.push({ ...currentLead });
        }
        currentLead = {};
        inTemplateHeader = false;
        continue;
      }

      if (/\[.*?\]/.test(trimmed)) {
        continue;
      }

      const sepIndex = trimmed.indexOf(':');
      if (sepIndex === -1) continue;

      const key = trimmed.slice(0, sepIndex).trim().toLowerCase().replace(/[^a-z0-9_]/gi, '_');
      const val = trimmed.slice(sepIndex + 1).trim();

      currentLead[key] = val;
    }

    if (Object.keys(currentLead).length > 0) {
      const email = this._findEmail(currentLead);
      if (email) currentLead.email = email;
      leads.push({ ...currentLead });
    }

    for (const lead of leads) {
      if (!lead.email) {
        const foundEmail = this._findEmail(lead);
        if (foundEmail) lead.email = foundEmail;
      }

      if (!lead.email) {
        const receiverEmail = lead[this.config.emailField];
        if (receiverEmail) lead.email = receiverEmail;
      }
    }

    return leads;
  }

  _findEmail(obj) {
    const possibleKeys = ['email', 'e_mail', 'receiver_email', 'receiveremail', 'recipient_email', 'to_email'];
    for (const key of possibleKeys) {
      if (obj[key]) return obj[key];
    }

    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        return val;
      }
    }

    return null;
  }
}

module.exports = Parser;
