let map;
let markers = [];
let routeLines = [];
let currentShipment = null;
let animationIntervals = [];
let shipments = [];

// Initialize map
function initMap() {
  map = L.map('map', {
    center: [39.8283, -98.5795],
    zoom: 4,
    zoomControl: false,
    attributionControl: false
  });

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(map);

  loadShipments();
}

// Clear map
function clearMap() {
  markers.forEach(m => map.removeLayer(m));
  routeLines.forEach(l => map.removeLayer(l));
  markers = [];
  routeLines = [];
  stopAnimations();
}

// Stop all animations
function stopAnimations() {
  animationIntervals.forEach(id => clearInterval(id));
  animationIntervals = [];
}

// Create custom marker
function createMarkerIcon(type, label) {
  const colors = {
    origin: '#22c55e',
    current: '#3b82f6',
    destination: '#ef4444',
    stop: '#94a3b8'
  };
  const color = colors[type] || colors.stop;

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="position: relative;">
        <div class="marker-dot ${type}" style="background: ${color}; box-shadow: 0 0 20px ${color}40, 0 2px 8px rgba(0,0,0,0.3);"></div>
        ${label ? `<div class="marker-label">${label}</div>` : ''}
      </div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

// Draw route on map
function drawRoute(shipment) {
  clearMap();
  const { route, origin, destination, currentLocation, events } = shipment;

  if (!route || route.length < 2) return;

  // Draw route line
  const routeCoords = route.map(c => [c.coordinates.lat, c.coordinates.lng]);
  const routeLine = L.polyline(routeCoords, {
    color: '#3b82f6',
    weight: 2,
    opacity: 0.4,
    dashArray: '8, 4',
    className: 'route-line'
  }).addTo(map);
  routeLines.push(routeLine);

  // Draw traveled line
  const currentIdx = route.findIndex(c => c.city === currentLocation.city);
  if (currentIdx > 0) {
    const traveledCoords = route.slice(0, currentIdx + 1).map(c => [c.coordinates.lat, c.coordinates.lng]);
    const traveledLine = L.polyline(traveledCoords, {
      color: '#3b82f6',
      weight: 3,
      opacity: 0.8
    }).addTo(map);
    routeLines.push(traveledLine);
  }

  // Origin marker
  const originMarker = L.marker(
    [origin.coordinates.lat, origin.coordinates.lng],
    { icon: createMarkerIcon('origin', origin.city) }
  ).addTo(map);
  markers.push(originMarker);

  // Destination marker
  const destMarker = L.marker(
    [destination.coordinates.lat, destination.coordinates.lng],
    { icon: createMarkerIcon('destination', destination.city) }
  ).addTo(map);
  markers.push(destMarker);

  // Stop markers
  route.forEach((stop, idx) => {
    if (idx === 0 || idx === route.length - 1) return;
    const isCurrent = stop.city === currentLocation.city;
    if (!isCurrent) {
      const stopMarker = L.marker(
        [stop.coordinates.lat, stop.coordinates.lng],
        { icon: createMarkerIcon('stop', stop.city) }
      ).addTo(map);
      markers.push(stopMarker);
    }
  });

  // Current location marker (animated)
  const currentMarker = L.marker(
    [currentLocation.coordinates.lat, currentLocation.coordinates.lng],
    { icon: createMarkerIcon('current', currentLocation.city) }
  ).addTo(map);
  markers.push(currentMarker);

  // Fit bounds
  const bounds = L.latLngBounds([
    [origin.coordinates.lat, origin.coordinates.lng],
    [destination.coordinates.lat, destination.coordinates.lng]
  ]);
  route.forEach(stop => {
    bounds.extend([stop.coordinates.lat, stop.coordinates.lng]);
  });
  map.fitBounds(bounds, { padding: [50, 50] });

  return currentMarker;
}

// Animate marker along route
function animateShipment(shipment) {
  stopAnimations();

  if (!shipment || !shipment.route || shipment.route.length < 2) return;

  const { route, currentLocation } = shipment;
  let currentIdx = route.findIndex(c => c.city === currentLocation.city);
  if (currentIdx < 0) currentIdx = 0;

  let progress = shipment.simulatedProgress || 0;
  const currentMarker = markers[markers.length - 1];

  if (!currentMarker) return;

  const interval = setInterval(() => {
    if (progress >= 100) {
      clearInterval(interval);
      showToast('Shipment delivered!', 'success');
      return;
    }

    progress += 0.5;
    if (progress > 100) progress = 100;

    // Calculate interpolated position
    const totalStops = route.length - 1;
    const targetIdx = Math.min(Math.floor((progress / 100) * totalStops) + 1, route.length - 1);
    const segmentProgress = ((progress / 100) * totalStops) % 1;

    if (targetIdx > currentIdx || (targetIdx === currentIdx && segmentProgress > 0)) {
      const from = route[Math.min(currentIdx, route.length - 1)];
      const to = route[Math.min(targetIdx, route.length - 1)];

      const lat = from.coordinates.lat + (to.coordinates.lat - from.coordinates.lat) * segmentProgress;
      const lng = from.coordinates.lng + (to.coordinates.lng - from.coordinates.lng) * segmentProgress;

      currentMarker.setLatLng([lat, lng]);
    }

    // Update progress display
    updateProgressDisplay(progress);
  }, 100);

  animationIntervals.push(interval);
}

// Update progress display
function updateProgressDisplay(progress) {
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  if (progressFill) progressFill.style.width = `${progress}%`;
  if (progressText) progressText.textContent = `${Math.round(progress)}%`;
}

// Track shipment
async function trackShipment() {
  const input = document.getElementById('trackingInput');
  const trackingNumber = input.value.trim().toUpperCase();

  if (!trackingNumber) {
    showToast('Please enter a tracking number', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/tracking/${trackingNumber}`);
    if (!res.ok) {
      showToast('Shipment not found', 'error');
      return;
    }

    const shipment = await res.json();
    currentShipment = shipment;
    renderShipmentDetails(shipment);
    drawRoute(shipment);
    animateShipment(shipment);
    showToast(`Tracking ${trackingNumber}`, 'info');
  } catch (e) {
    showToast('Error fetching shipment', 'error');
  }
}

// Render shipment details
function renderShipmentDetails(shipment) {
  const container = document.getElementById('shipmentInfo');
  const routeCard = document.getElementById('routeCard');
  const statusBadge = document.getElementById('statusBadge');

  statusBadge.style.display = 'inline-flex';
  statusBadge.className = `badge badge-${shipment.status.toLowerCase()}`;
  statusBadge.textContent = shipment.statusLabel;

  container.innerHTML = `
    <div class="shipment-info">
      <div class="info-item">
        <div class="label">Tracking Number</div>
        <div class="value" style="font-family: monospace; color: var(--accent);">${shipment.trackingNumber}</div>
      </div>
      <div class="info-item">
        <div class="label">Carrier</div>
        <div class="value">${shipment.carrier}</div>
      </div>
      <div class="info-item">
        <div class="label">Origin</div>
        <div class="value">${shipment.origin.city}</div>
      </div>
      <div class="info-item">
        <div class="label">Destination</div>
        <div class="value">${shipment.destination.city}</div>
      </div>
      <div class="info-item">
        <div class="label">Weight</div>
        <div class="value">${shipment.weight}</div>
      </div>
      <div class="info-item">
        <div class="label">Pieces</div>
        <div class="value">${shipment.pieces}</div>
      </div>
      <div class="info-item full">
        <div class="label">Estimated Delivery</div>
        <div class="value">${new Date(shipment.estimatedDelivery).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
      </div>
    </div>
    <div class="progress-section">
      <div class="progress-header">
        <span>Transit Progress</span>
        <strong id="progressText">${shipment.progress}%</strong>
      </div>
      <div class="progress-track">
        <div class="progress-fill" id="progressFill" style="width: ${shipment.progress}%"></div>
      </div>
    </div>
  `;

  // Render route timeline
  routeCard.style.display = 'block';
  renderRouteTimeline(shipment);
}

// Render route timeline
function renderRouteTimeline(shipment) {
  const container = document.getElementById('routeSteps');
  const { events, route, currentLocation } = shipment;

  container.innerHTML = events.map((event, idx) => {
    const isLast = idx === events.length - 1;
    const isCompleted = !isLast;
    const isActive = isLast;

    const time = new Date(event.timestamp);
    const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dateStr = time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return `
      <div class="route-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}">
        <div class="step-content">
          <div class="step-header">
            <span class="step-city">${event.location}</span>
            <span class="step-time">${dateStr} ${timeStr}</span>
          </div>
          <div class="step-status">
            <span class="badge badge-${event.status.toLowerCase()}">${event.statusLabel}</span>
          </div>
          <div class="step-description">${event.description}</div>
        </div>
      </div>
    `;
  }).reverse().join('');
}

// Generate shipment
async function generateShipment() {
  const originCity = document.getElementById('originCity').value;
  const destCity = document.getElementById('destCity').value;
  const numStops = parseInt(document.getElementById('numStops').value) || 2;
  const startProgress = parseInt(document.getElementById('startProgress').value) || 30;

  const options = {
    stops: numStops,
    currentStop: Math.ceil((startProgress / 100) * (numStops + 1))
  };

  if (originCity) options.origin = { name: originCity, lat: 0, lng: 0 };
  if (destCity) options.destination = { name: destCity, lat: 0, lng: 0 };

  try {
    const res = await fetch('/api/tracking/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    const shipment = await res.json();

    currentShipment = shipment;
    document.getElementById('trackingInput').value = shipment.trackingNumber;
    renderShipmentDetails(shipment);
    drawRoute(shipment);
    animateShipment(shipment);
    closeGenerateModal();
    refreshShipments();
    showToast(`Generated: ${shipment.trackingNumber}`, 'success');
  } catch (e) {
    showToast('Error generating shipment', 'error');
  }
}

// Bulk generate
async function bulkGenerate() {
  const count = parseInt(document.getElementById('bulkCount').value) || 5;

  try {
    const res = await fetch('/api/tracking/generate-bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count })
    });
    const data = await res.json();

    closeBulkModal();
    refreshShipments();
    showToast(`Generated ${data.count} shipments`, 'success');
  } catch (e) {
    showToast('Error generating shipments', 'error');
  }
}

// Load shipments list
async function loadShipments() {
  try {
    const res = await fetch('/api/tracking');
    const data = await res.json();
    shipments = data.shipments || [];
    renderShipmentList();
    updateStats();
  } catch (e) {
    console.error('Error loading shipments:', e);
  }
}

// Refresh shipments
async function refreshShipments() {
  await loadShipments();
  showToast('Shipments refreshed', 'info');
}

// Render shipment list
function renderShipmentList() {
  const container = document.getElementById('shipmentList');

  if (shipments.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 30px;">
        <p>No active shipments</p>
      </div>
    `;
    return;
  }

  container.innerHTML = shipments.map(s => `
    <div class="shipment-item" onclick="selectShipment('${s.trackingNumber}')">
      <div>
        <div class="tracking-num">${s.trackingNumber}</div>
        <div class="shipment-route">${s.origin.city} → ${s.destination.city}</div>
      </div>
      <span class="badge badge-${s.status.toLowerCase()}">${s.statusLabel}</span>
    </div>
  `).join('');
}

// Select shipment from list
async function selectShipment(trackingNumber) {
  document.getElementById('trackingInput').value = trackingNumber;
  await trackShipment();
}

// Update stats
function updateStats() {
  const total = shipments.length;
  const active = shipments.filter(s => s.status !== 'DL').length;
  const inTransit = shipments.filter(s => s.status === 'IT' || s.status === 'AW' || s.status === 'DP').length;
  const delivered = shipments.filter(s => s.status === 'DL').length;

  document.getElementById('totalShipments').textContent = total;
  document.getElementById('activeShipments').textContent = active;
  document.getElementById('inTransit').textContent = inTransit;
  document.getElementById('delivered').textContent = delivered;
}

// Modal functions
function openGenerateModal() {
  document.getElementById('generateModal').classList.add('active');
}

function closeGenerateModal() {
  document.getElementById('generateModal').classList.remove('active');
}

function openBulkModal() {
  document.getElementById('bulkModal').classList.add('active');
}

function closeBulkModal() {
  document.getElementById('bulkModal').classList.remove('active');
}

// Toast notification
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.activeElement.id === 'trackingInput') {
    trackShipment();
  }
  if (e.key === 'Escape') {
    closeGenerateModal();
    closeBulkModal();
  }
});

// Click outside modal to close
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('active');
    }
  });
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initMap();
});
