const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// In-memory store for deployments
let shipments = {};

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

const CARRIERS = ['FedEx Freight', 'FedEx Priority', 'FedEx Economy', 'UPS Freight', 'Old Dominion', 'XPO Logistics', 'Estes Express'];
const STATUSES = [
  { code: 'PU', label: 'Picked Up', color: '#3b82f6' },
  { code: 'IT', label: 'In Transit', color: '#f59e0b' },
  { code: 'OH', label: 'Out for Delivery', color: '#8b5cf6' },
  { code: 'DL', label: 'Delivered', color: '#22c55e' },
  { code: 'EX', label: 'Exception', color: '#ef4444' },
  { code: 'AW', label: 'Arrived at Warehouse', color: '#06b6d4' },
  { code: 'DP', label: 'Departed Facility', color: '#ec4899' },
];

const WEIGHTS = ['500 lbs', '1,200 lbs', '2,400 lbs', '3,800 lbs', '5,000 lbs', '8,500 lbs', '12,000 lbs', '15,000 lbs', '20,000 lbs'];
const PIECES = ['1 pallet', '2 pallets', '3 pallets', '5 pallets', '8 pallets', '12 pallets', '15 pallets'];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function genTracking() {
  const prefix = ['FX', 'FD', 'FE', 'FP', 'F1', 'F2'][Math.floor(Math.random() * 6)];
  return prefix + Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
}

function genRoute(origin, dest, stops) {
  const route = [origin];
  const avail = CITIES.filter(c => c.name !== origin.name && c.name !== dest.name).sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(stops, avail.length); i++) route.push(avail[i]);
  route.push(dest);
  return route;
}

function genEvents(route, currentIdx, startTime) {
  const events = [];
  let t = startTime;
  for (let i = 0; i <= Math.min(currentIdx, route.length - 1); i++) {
    const city = route[i];
    const isOrigin = i === 0;
    const isDest = i === route.length - 1;
    const isLast = i === currentIdx;
    let status;
    if (isOrigin) status = STATUSES[0];
    else if (isDest && isLast) status = STATUSES[3];
    else if (isLast) status = rand([STATUSES[1], STATUSES[4], STATUSES[5], STATUSES[6]]);
    else status = rand([STATUSES[5], STATUSES[6]]);

    events.push({
      timestamp: new Date(t).toISOString(),
      location: city.name,
      coordinates: { lat: city.lat, lng: city.lng },
      status: status.code,
      statusLabel: status.label,
      statusColor: status.color,
      description: `${status.label} at ${city.name}`,
    });
    t += randInt(2, 12) * 3600000;
  }
  return events;
}

function genShipment(opts = {}) {
  const origin = opts.origin || rand(CITIES);
  let dest = opts.dest || rand(CITIES);
  while (dest.name === origin.name) dest = rand(CITIES);
  const stops = opts.stops || randInt(1, 4);
  const route = genRoute(origin, dest, stops);
  const start = Date.now() - randInt(1, 48) * 3600000;
  const curIdx = opts.currentStop || randInt(1, route.length - 1);
  const events = genEvents(route, curIdx, start);
  const cur = events[events.length - 1];

  return {
    trackingNumber: opts.trackingNumber || genTracking(),
    carrier: rand(CARRIERS),
    service: rand(['Priority', 'Economy', 'Standard', 'Express']),
    origin: { city: origin.name, coordinates: { lat: origin.lat, lng: origin.lng } },
    destination: { city: dest.name, coordinates: { lat: dest.lat, lng: dest.lng } },
    route: route.map(c => ({ city: c.name, coordinates: { lat: c.lat, lng: c.lng } })),
    weight: rand(WEIGHTS),
    pieces: rand(PIECES),
    estimatedDelivery: new Date(Date.now() + randInt(1, 5) * 86400000).toISOString(),
    status: cur.status,
    statusLabel: cur.statusLabel,
    statusColor: cur.statusColor,
    progress: Math.round((curIdx / (route.length - 1)) * 100),
    currentLocation: { city: cur.location, coordinates: cur.coordinates },
    events,
    createdAt: new Date(start).toISOString(),
    updatedAt: new Date().toISOString(),
    isLive: true,
    simulatedProgress: 0,
  };
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'src', 'dashboard', 'public')));

// API Routes
app.get('/api/tracking', (req, res) => {
  res.json({ shipments: Object.values(shipments), count: Object.keys(shipments).length });
});

app.get('/api/tracking/:num', (req, res) => {
  const s = shipments[req.params.num];
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json(s);
});

app.post('/api/tracking/generate', (req, res) => {
  const s = genShipment(req.body || {});
  shipments[s.trackingNumber] = s;
  res.json(s);
});

app.post('/api/tracking/generate-bulk', (req, res) => {
  const count = Math.min(parseInt(req.body.count) || 5, 50);
  const arr = [];
  for (let i = 0; i < count; i++) {
    const s = genShipment();
    shipments[s.trackingNumber] = s;
    arr.push(s);
  }
  res.json({ shipments: arr, count: arr.length });
});

app.post('/api/tracking/:num/progress', (req, res) => {
  const s = shipments[req.params.num];
  if (!s) return res.status(404).json({ error: 'Not found' });
  s.simulatedProgress = req.body.progress;
  if (req.body.progress >= 100) {
    s.status = 'DL'; s.statusLabel = 'Delivered'; s.statusColor = '#22c55e'; s.progress = 100; s.isLive = false;
  }
  s.updatedAt = new Date().toISOString();
  res.json(s);
});

app.delete('/api/tracking/:num', (req, res) => {
  if (!shipments[req.params.num]) return res.status(404).json({ error: 'Not found' });
  delete shipments[req.params.num];
  res.json({ deleted: true });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'dashboard', 'public', 'tracking.html'));
});

app.listen(PORT, () => {
  console.log(`Freight Tracker Pro running on port ${PORT}`);
});

module.exports = app;
