const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');

class Watcher {
  constructor(dropFolder, parser, sender, stateManager, logger) {
    this.dropFolder = dropFolder;
    this.parser = parser;
    this.sender = sender;
    this.state = stateManager;
    this.logger = logger;
    this.processingFile = null;
  }

  start() {
    this._ensureDirs();

    chokidar.watch(this.dropFolder, {
      ignored: /(^|[\/\\])(processing|done|failed)[\/\\]/,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 500
      }
    })
    .on('add', (filePath) => this._onFile(filePath))
    .on('change', (filePath) => this._onFile(filePath));

    this.logger.info(`Watching folder: ${this.dropFolder}`);
    this._processExisting();
  }

  _ensureDirs() {
    const dirs = ['processing', 'done', 'failed'];
    for (const dir of dirs) {
      const fullPath = path.join(this.dropFolder, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    }
  }

  _processExisting() {
    try {
      const files = fs.readdirSync(this.dropFolder);
      for (const file of files) {
        const filePath = path.join(this.dropFolder, file);
        if (fs.statSync(filePath).isFile()) {
          this._onFile(filePath);
        }
      }
    } catch (e) {
      this.logger.error('Error scanning existing files', { error: e.message });
    }
  }

  async _onFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.csv' && ext !== '.txt') return;

    const basename = path.basename(filePath);

    if (this.state.isFileProcessed(basename)) {
      this.logger.info(`Skipping already processed: ${basename}`);
      return;
    }

    if (this.processingFile === basename) return;
    this.processingFile = basename;

    const processingPath = path.join(this.dropFolder, 'processing', basename);

    try {
      fs.renameSync(filePath, processingPath);
      this.logger.info(`Processing: ${basename}`);

      const leads = this.parser.parse(processingPath);
      this.logger.info(`Parsed ${leads.length} leads from ${basename}`);

      const results = await this.sender.processBatch(leads);
      this.state.markFileProcessed(basename);

      const donePath = path.join(this.dropFolder, 'done', basename);
      fs.renameSync(processingPath, donePath);

      this.logger.info(`Completed: ${basename}`, results);
    } catch (e) {
      this.logger.error(`Failed to process ${basename}`, { error: e.message });
      try {
        if (fs.existsSync(processingPath)) {
          const failedPath = path.join(this.dropFolder, 'failed', basename);
          fs.renameSync(processingPath, failedPath);
        }
      } catch (renameErr) {
        this.logger.error('Failed to move file to failed/', { error: renameErr.message });
      }
    } finally {
      this.processingFile = null;
    }
  }
}

module.exports = Watcher;
