require('dotenv').config();
const path = require('path');
const config = require('../config/config');
const Logger = require('./logger');
const StateManager = require('./state');
const Watcher = require('./watcher');
const Parser = require('./parser');
const TemplateEngine = require('./template');
const SmtpPool = require('./smtp-pool');
const Sender = require('./sender');
const Dashboard = require('./dashboard/server');
const PendingQueue = require('./pending-queue');

async function main() {
  const logger = new Logger('bot');
  logger.setLogDir(config.logDir);

  logger.info('Starting Email Bot...');
  logger.info(`Drop folder: ${config.dropFolder}`);
  logger.info(`SMTP accounts: ${config.smtpAccounts.length}`);

  const state = new StateManager(config.stateFile);
  const templateEngine = new TemplateEngine(config.templatesDir);
  const smtpPool = new SmtpPool(config.smtpAccounts, state, config);
  const pendingQueue = new PendingQueue(config.pendingQueueFile, state, config);

  const sender = new Sender(smtpPool, templateEngine, config, logger, state, pendingQueue);

  const parser = new Parser(config);

  const dashboard = new Dashboard(state, smtpPool, pendingQueue, config, sender);
  dashboard.start(config.dashboardPort);

  const verifyResults = await smtpPool.verifyAll();
  for (const r of verifyResults) {
    if (r.status === 'ok') {
      logger.info(`SMTP ${r.id}: connected`);
    } else {
      logger.warn(`SMTP ${r.id}: ${r.message}`);
    }
  }

  const pendingCount = pendingQueue.count();
  if (pendingCount > 0) {
    logger.info(`Processing ${pendingCount} queued leads...`);
    await pendingQueue.processPending(sender);
    logger.info(`Pending queue processed. Remaining: ${pendingQueue.count()}`);
  }

  const watcher = new Watcher(config.dropFolder, parser, sender, state, logger);
  watcher.start();

  process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    dashboard.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Shutting down...');
    dashboard.stop();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
