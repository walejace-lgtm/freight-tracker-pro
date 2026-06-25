const fs = require('fs');
const path = require('path');

const CITIES = [
  { name: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437 },
  { name: 'Phoenix, AZ', lat: 33.4484, lng: -112.0740 },
  { name: 'Dallas, TX', lat: 32.7767, lng: -96.7970 },
  { name: 'Houston, TX', lat: 29.7604, lng: -95.3698 },
  { name: 'Atlanta, GA', lat: 33.7490, lng: -84.3880 },
  { name: 'Chicago, IL', lat: 41.8781, lng: -87.6298 },
  { name: 'Nashville, TN', lat: 36.1627, lng: -86.7816 },
  { name: 'Memphis, TN', lat: 35.1495, lng: -90.0490 },
  { name: 'Indianapolis, IN', lat: 39.7684, lng: -86.1581 },
  { name: 'Columbus, OH', lat: 39.9612, lng: -82.9988 },
  { name: 'Detroit, MI', lat: 42.3314, lng: -83.0458 },
  { name: 'New York, NY', lat: 40.7128, lng: -74.0060 },
  { name: 'Philadelphia, PA', lat: 39.9526, lng: -75.1652 },
  { name: 'Charlotte, NC', lat: 35.2271, lng: -80.8431 },
  { name: 'Miami, FL', lat: 25.7617, lng: -80.1918 },
  { name: 'Seattle, WA', lat: 47.6062, lng: -122.3321 },
  { name: 'Denver, CO', lat: 39.7392, lng: -104.9903 },
  { name: 'Kansas City, MO', lat: 39.0997, lng: -94.5786 },
  { name: 'Minneapolis, MN', lat: 44.9778, lng: -93.2650 },
  { name: 'Salt Lake City, UT', lat: 40.7608, lng: -111.8910 },
];

const CARRIERS = [
  'FedEx Freight', 'FedEx Priority', 'FedEx Economy',
  'UPS Freight', 'Old Dominion', 'XPO Logistics',
  'Estes Express', 'Saia Inc', 'ABF Freight'
];

const STATUSES = [
  { code: 'PU', label: 'Picked Up', color: '#3b82f6' },
  { code: 'IT', label: 'In Transit', color: '#f59e0b' },
  { code: 'OH', label: 'Out for Delivery', color: '#8b5cf6' },
  { code: 'DL', label: 'Delivered', color: '#22c55e' },
  { code: 'EX', label: 'Exception', color: '#ef4444' },
  { code: 'AW', label: 'Arrived at Warehouse', color: '#06b6d4' },
  { code: 'DP', label: 'Departed Facility', color: '#ec4899' },
];

const WEIGHTS = ['500 lbs', '1,200 lbs', '2,400 lbs', '3,800 lbs', '5,000 lbs', '8,500 lbs', '12,000 lbs', '15,000 lbs', '20,000 lbs', '24,000 lbs'];
const PIECES = ['1 pallet', '2 pallets', '3 pallets', '5 pallets', '8 pallets', '12 pallets', '15 pallets', '20 pallets'];

class TrackingGenerator {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.shipmentsFile = path.join(dataDir, 'shipments.json');
    this.shipments = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.shipmentsFile)) {
        return JSON.parse(fs.readFileSync(this.shipmentsFile, 'utf8'));
      }
    } catch (e) { /* ignore */ }
    return {};
  }

  _save() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    fs.writeFileSync(this.shipmentsFile, JSON.stringify(this.shipments, null, 2));
  }

  _randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  _randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  _generateTrackingNumber() {
    const prefix = ['FX', 'FD', 'FE', 'FP', 'F1', 'F2'][Math.floor(Math.random() * 6)];
    const num = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
    return prefix + num;
  }

  _generateRoute(origin, destination, numStops = 0) {
    const route = [origin];
    if (numStops > 0) {
      const available = CITIES.filter(c => c.name !== origin.name && c.name !== destination.name);
      const shuffled = available.sort(() => Math.random() - 0.5);
      for (let i = 0; i < Math.min(numStops, shuffled.length); i++) {
        route.push(shuffled[i]);
      }
    }
    route.push(destination);
    return route;
  }

  _generateEvents(route, currentStopIndex, startTime) {
    const events = [];
    const now = Date.now();
    let currentTime = startTime;

    for (let i = 0; i <= Math.min(currentStopIndex, route.length - 1); i++) {
      const city = route[i];
      const isOrigin = i === 0;
      const isDestination = i === route.length - 1;
      const isLastVisited = i === currentStopIndex;

      let status;
      if (isOrigin) {
        status = STATUSES[0]; // Picked Up
      } else if (isDestination && isLastVisited) {
        status = STATUSES[3]; // Delivered
      } else if (isLastVisited) {
        status = this._randomItem([STATUSES[1], STATUSES[4], STATUSES[5], STATUSES[6]]);
      } else {
        status = this._randomItem([STATUSES[5], STATUSES[6]]);
      }

      events.push({
        timestamp: new Date(currentTime).toISOString(),
        location: city.name,
        coordinates: { lat: city.lat, lng: city.lng },
        status: status.code,
        statusLabel: status.label,
        statusColor: status.color,
        description: this._getStatusDescription(status.code, city.name, isOrigin, isDestination),
      });

      currentTime += this._randomInt(2, 12) * 60 * 60 * 1000;
    }

    return events;
  }

  _getStatusDescription(code, city, isOrigin, isDestination) {
    const descriptions = {
      'PU': isOrigin ? `Shipment picked up from ${city}` : `Picked up at ${city}`,
      'IT': `In transit through ${city}`,
      'OH': `Out for delivery from ${city}`,
      'DL': isDestination ? `Delivered to ${city}` : `Delivered at ${city}`,
      'EX': `Exception reported at ${city}`,
      'AW': `Arrived at ${city} warehouse`,
      'DP': `Departed ${city} facility`,
    };
    return descriptions[code] || `Processed at ${city}`;
  }

  generateShipment(options = {}) {
    const origin = options.origin || this._randomItem(CITIES);
    let destination = options.destination || this._randomItem(CITIES);
    while (destination.name === origin.name) {
      destination = this._randomItem(CITIES);
    }

    const numStops = options.stops || this._randomInt(1, 4);
    const route = this._generateRoute(origin, destination, numStops);

    const startTime = Date.now() - this._randomInt(1, 48) * 60 * 60 * 1000;
    const currentStopIndex = options.currentStop || this._randomInt(1, route.length - 1);
    const events = this._generateEvents(route, currentStopIndex, startTime);

    const currentEvent = events[events.length - 1];
    const progress = Math.round((currentStopIndex / (route.length - 1)) * 100);

    const shipment = {
      trackingNumber: options.trackingNumber || this._generateTrackingNumber(),
      carrier: options.carrier || this._randomItem(CARRIERS),
      service: this._randomItem(['Priority', 'Economy', 'Standard', 'Express']),
      origin: {
        city: origin.name,
        coordinates: { lat: origin.lat, lng: origin.lng },
      },
      destination: {
        city: destination.name,
        coordinates: { lat: destination.lat, lng: destination.lng },
      },
      route: route.map(c => ({ city: c.name, coordinates: { lat: c.lat, lng: c.lng } })),
      weight: this._randomItem(WEIGHTS),
      pieces: this._randomItem(PIECES),
      estimatedDelivery: new Date(Date.now() + this._randomInt(1, 5) * 24 * 60 * 60 * 1000).toISOString(),
      status: currentEvent.status,
      statusLabel: currentEvent.statusLabel,
      statusColor: currentEvent.statusColor,
      progress,
      currentLocation: {
        city: currentEvent.location,
        coordinates: currentEvent.coordinates,
      },
      events,
      createdAt: new Date(startTime).toISOString(),
      updatedAt: new Date().toISOString(),
      isLive: true,
      simulatedProgress: 0,
    };

    this.shipments[shipment.trackingNumber] = shipment;
    this._save();

    return shipment;
  }

  getShipment(trackingNumber) {
    return this.shipments[trackingNumber] || null;
  }

  getAllShipments() {
    return Object.values(this.shipments);
  }

  updateShipmentProgress(trackingNumber, progress) {
    const shipment = this.shipments[trackingNumber];
    if (!shipment) return null;

    shipment.simulatedProgress = progress;
    shipment.updatedAt = new Date().toISOString();

    if (progress >= 100) {
      shipment.status = 'DL';
      shipment.statusLabel = 'Delivered';
      shipment.statusColor = '#22c55e';
      shipment.progress = 100;
      shipment.isLive = false;
    }

    this._save();
    return shipment;
  }

  addEvent(trackingNumber, event) {
    const shipment = this.shipments[trackingNumber];
    if (!shipment) return null;

    shipment.events.push({
      timestamp: new Date().toISOString(),
      ...event,
    });
    shipment.updatedAt = new Date().toISOString();

    this._save();
    return shipment;
  }

  deleteShipment(trackingNumber) {
    if (this.shipments[trackingNumber]) {
      delete this.shipments[trackingNumber];
      this._save();
      return true;
    }
    return false;
  }

  generateBulk(count = 5) {
    const shipments = [];
    for (let i = 0; i < count; i++) {
      shipments.push(this.generateShipment());
    }
    return shipments;
  }
}

module.exports = TrackingGenerator;
