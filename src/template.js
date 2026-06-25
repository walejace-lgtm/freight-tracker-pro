const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

class TemplateEngine {
  constructor(templatesDir) {
    this.templatesDir = templatesDir;
    this.subjectTemplate = null;
    this.bodyTemplate = null;
    this._load();
  }

  _load() {
    const subjectPath = path.join(this.templatesDir, 'subject.hbs');
    const bodyPath = path.join(this.templatesDir, 'body.hbs');

    if (fs.existsSync(subjectPath)) {
      const subjectSrc = fs.readFileSync(subjectPath, 'utf8');
      this.subjectTemplate = Handlebars.compile(subjectSrc);
    }

    if (fs.existsSync(bodyPath)) {
      const bodySrc = fs.readFileSync(bodyPath, 'utf8');
      this.bodyTemplate = Handlebars.compile(bodySrc);
    }
  }

  render(data) {
    const normalized = {};
    for (const [key, val] of Object.entries(data)) {
      normalized[key.toLowerCase().replace(/[^a-z0-9_]/gi, '_')] = val;
    }

    let subject = '';
    let body = '';

    try {
      subject = this.subjectTemplate ? this.subjectTemplate(normalized) : 'No subject template';
    } catch (e) {
      subject = 'Template error';
    }

    try {
      body = this.bodyTemplate ? this.bodyTemplate(normalized) : '<p>No body template</p>';
    } catch (e) {
      body = '<p>Template rendering error</p>';
    }

    return { subject, body, normalized };
  }
}

module.exports = TemplateEngine;
