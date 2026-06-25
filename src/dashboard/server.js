const express = require('express');
const path = require('path');
const TrackingGenerator = require('../tracking-generator');

class Dashboard {
  constructor(stateManager, smtpPool, pendingQueue, config, sender) {
    this.state = stateManager;
    this.smtpPool = smtpPool;
    this.pendingQueue = pendingQueue;
    this.config = config;
    this.sender = sender;
    this.tracking = new TrackingGenerator(config.stateDir || path.join(__dirname, '..', '..', 'data'));
    this.app = express();
    this._setup();
  }

  _setup() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));

    this.app.get('/api/stats', (req, res) => {
      const stateStats = this.state.getStats();
      const senderStats = this.sender ? this.sender.getStats() : { sent: 0, failed: 0, pending: 0, sendLog: [] };
      const accounts = this.smtpPool.getAccountStats();
      const pendingCount = this.pendingQueue.count();

      res.json({
        accounts,
        globalPaused: stateStats.globalPaused,
        processedFiles: stateStats.processedCount,
        pendingQueue: pendingCount,
        sender: senderStats,
        lastDate: stateStats.lastDate
      });
    });

    this.app.get('/api/history', (req, res) => {
      const limit = parseInt(req.query.limit) || 100;
      const senderStats = this.sender ? this.sender.getStats() : { sendLog: [] };
      res.json(senderStats.sendLog.slice(0, limit));
    });

    this.app.post('/api/pause', (req, res) => {
      const { paused } = req.body;
      if (typeof paused === 'boolean') {
        this.state.setPaused(paused);
        res.json({ paused });
      } else {
        res.status(400).json({ error: 'paused must be boolean' });
      }
    });

    this.app.get('/api/accounts/verify', async (req, res) => {
      const results = await this.smtpPool.verifyAll();
      res.json(results);
    });

    this.app.get('/api/pending', (req, res) => {
      res.json({ count: this.pendingQueue.count(), queue: this.pendingQueue.getQueue().slice(0, 50) });
    });

    this.app.post('/api/pending/clear', (req, res) => {
      this.pendingQueue.clear();
      res.json({ cleared: true });
    });

    // Tracking API routes
    this.app.get('/api/tracking/:trackingNumber', (req, res) => {
      const shipment = this.tracking.getShipment(req.params.trackingNumber);
      if (!shipment) {
        return res.status(404).json({ error: 'Shipment not found' });
      }
      res.json(shipment);
    });

    this.app.get('/api/tracking', (req, res) => {
      const shipments = this.tracking.getAllShipments();
      res.json({ shipments, count: shipments.length });
    });

    this.app.post('/api/tracking/generate', (req, res) => {
      const options = req.body || {};
      const shipment = this.tracking.generateShipment(options);
      res.json(shipment);
    });

    this.app.post('/api/tracking/generate-bulk', (req, res) => {
      const count = Math.min(parseInt(req.body.count) || 5, 50);
      const shipments = this.tracking.generateBulk(count);
      res.json({ shipments, count: shipments.length });
    });

    this.app.post('/api/tracking/:trackingNumber/progress', (req, res) => {
      const { progress } = req.body;
      const shipment = this.tracking.updateShipmentProgress(req.params.trackingNumber, progress);
      if (!shipment) {
        return res.status(404).json({ error: 'Shipment not found' });
      }
      res.json(shipment);
    });

    this.app.post('/api/tracking/:trackingNumber/event', (req, res) => {
      const shipment = this.tracking.addEvent(req.params.trackingNumber, req.body);
      if (!shipment) {
        return res.status(404).json({ error: 'Shipment not found' });
      }
      res.json(shipment);
    });

    this.app.delete('/api/tracking/:trackingNumber', (req, res) => {
      const deleted = this.tracking.deleteShipment(req.params.trackingNumber);
      if (!deleted) {
        return res.status(404).json({ error: 'Shipment not found' });
      }
      res.json({ deleted: true });
    });
  }

  injectSender(sender) {
    this.sender = sender;
  }

  start(port) {
    this.server = this.app.listen(port, () => {
      console.log(`[dashboard] HTTP server running on http://localhost:${port}`);
    });
  }

  stop() {
    if (this.server) this.server.close();
  }
}

module.exports = Dashboard;
