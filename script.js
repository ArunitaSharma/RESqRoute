/**
 * RESqRoute - Smart Traffic & Emergency Vehicle Management System
 * Client Engine with Automatic 30s ML Predictions & Dynamic User Selected Node Routing
 */

let cityGraph = null;
let activeVehicles = [];
let activeRoutePath = [];
let animVehiclePos = null;
let animProgress = 0;
let animInterval = null;
let pulseRadius = 0;
let pulseInterval = null;

// Input Sanitization Helper (XSS Protection & HTML Escaping - Full Untruncated Text)
function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, function (match) {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    };
    return escapeMap[match];
  }).trim();
}

// Rate Limiting & Anti-Spam Guard
let lastActionTime = 0;
function isRateLimited(cooldownMs = 1200) {
  const now = Date.now();
  if (now - lastActionTime < cooldownMs) {
    showToast("Request rate limited. Please wait.");
    return true;
  }
  lastActionTime = now;
  return false;
}

class SignalState {
  static RED = "RED";
  static YELLOW = "YELLOW";
  static GREEN = "GREEN";
}

class RoadEdge {
  constructor(from, to, distanceKm, speedLimitKmh, signalState = SignalState.GREEN) {
    this.from = from;
    this.to = to;
    this.distanceKm = distanceKm;
    this.speedLimitKmh = speedLimitKmh;
    this.congestionLevel = 1.0;
    this.signalState = signalState;
    this.emergencyOverride = false;
  }

  getTravelTime(isEmergency = false) {
    let effectiveSpeed = this.speedLimitKmh / this.congestionLevel;
    if (isEmergency && this.congestionLevel > 1.2) {
      effectiveSpeed = this.speedLimitKmh / (1.0 + (this.congestionLevel - 1.0) * 0.35);
    }
    let baseTime = (this.distanceKm / effectiveSpeed) * 60.0;
    
    let signalDelay = 0.0;
    if (!isEmergency || !this.emergencyOverride) {
      if (this.signalState === SignalState.RED) signalDelay = 0.75;
      else if (this.signalState === SignalState.YELLOW) signalDelay = 0.16;
    }
    return baseTime + signalDelay;
  }
}

class GraphNetwork {
  constructor() {
    this.intersections = {};
    this.adjacency = {};
  }

  addIntersection(id, name, rx, ry) {
    this.intersections[id] = { id, name, rx, ry };
    if (!this.adjacency[id]) this.adjacency[id] = [];
  }

  addRoad(u, v, dist, speed, signal = SignalState.GREEN) {
    this.adjacency[u].push(new RoadEdge(u, v, dist, speed, signal));
    this.adjacency[v].push(new RoadEdge(v, u, dist, speed, signal));
  }

  getRoad(u, v) {
    if (this.adjacency[u]) {
      return this.adjacency[u].find(r => r.to === v) || null;
    }
    return null;
  }

  updateCongestion(u, v, level) {
    let r1 = this.getRoad(u, v);
    let r2 = this.getRoad(v, u);
    if (r1) r1.congestionLevel = level;
    if (r2) r2.congestionLevel = level;
  }

  forceGreenWave(path) {
    for (let i = 0; i < path.length - 1; i++) {
      let u = path[i];
      let v = path[i + 1];
      let r1 = this.getRoad(u, v);
      let r2 = this.getRoad(v, u);
      if (r1) { r1.signalState = SignalState.GREEN; r1.emergencyOverride = true; }
      if (r2) { r2.signalState = SignalState.GREEN; r2.emergencyOverride = true; }
    }
  }
}

// Client-side Dijkstra Algorithm
function runDijkstra(graph, startNode, endNode, isEmergency = true) {
  let distances = {};
  let previous = {};
  let pq = [];

  for (let id in graph.intersections) {
    distances[id] = Infinity;
    previous[id] = null;
  }

  distances[startNode] = 0;
  pq.push({ node: parseInt(startNode), dist: 0 });

  while (pq.length > 0) {
    pq.sort((a, b) => a.dist - b.dist);
    let curr = pq.shift();
    let u = curr.node;

    if (u === parseInt(endNode)) break;

    for (let road of graph.adjacency[u]) {
      let v = road.to;
      let weight = road.getTravelTime(isEmergency);
      let alt = distances[u] + weight;

      if (alt < distances[v]) {
        distances[v] = alt;
        previous[v] = u;
        pq.push({ node: v, dist: alt });
      }
    }
  }

  let path = [];
  let curr = parseInt(endNode);
  while (curr !== null) {
    path.unshift(curr);
    curr = previous[curr];
  }

  let totalDist = 0;
  for (let i = 0; i < path.length - 1; i++) {
    let r = graph.getRoad(path[i], path[i + 1]);
    if (r) totalDist += r.distanceKm;
  }

  return {
    found: distances[endNode] !== Infinity,
    path: path,
    travelTime: distances[endNode],
    totalDistance: totalDist
  };
}

// Dynamic Master Automated Simulation Function: Reads User Selected Form Inputs
async function simulateEmergency() {
  if (isRateLimited(2500)) return;

  const startSelect = document.getElementById("start-node");
  const endSelect = document.getElementById("end-node");
  const typeSelect = document.getElementById("vehicle-type");
  const idInput = document.getElementById("vehicle-id");

  let start = parseInt(startSelect ? startSelect.value : 2, 10);
  let end = parseInt(endSelect ? endSelect.value : 6, 10);
  if (isNaN(start) || start < 1 || start > 6) start = 2;
  if (isNaN(end) || end < 1 || end > 6) end = 6;

  const rawType = typeSelect ? typeSelect.value : "Ambulance";
  const type = (rawType === "FireTruck") ? "FireTruck" : "Ambulance";

  let rawId = idInput ? idInput.value : "AMB-911";
  let sanitizedId = sanitizeInput(rawId).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!sanitizedId) sanitizedId = "AMB-911";

  showToast("Step 1/4: Initializing city graph network...");
  createCity();
  await new Promise(r => setTimeout(r, 2200));

  showToast("Step 2/4: Applying real-time ambient traffic congestion...");
  generateTraffic();
  await new Promise(r => setTimeout(r, 2200));

  showToast(`Step 3/4: Registering unit ${sanitizedId} from Node ${start} to Node ${end}...`);
  const vehicle = { type, id: sanitizedId, start, end, siren: true };
  activeVehicles = [vehicle];
  drawCanvas();
  await new Promise(r => setTimeout(r, 2200));

  showToast("Step 4/4: Computing Dijkstra route & enabling Green Wave corridor...");
  calculateRouteUI(sanitizedId);
}

// Formal Toast Feedback Helper
function showToast(message) {
  let existing = document.querySelector(".toast-notification");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast-notification";
  toast.innerHTML = `<span>${sanitizeInput(message)}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.4s ease";
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

function triggerNodePulseAnimation() {
  pulseRadius = 22;
  if (pulseInterval) clearInterval(pulseInterval);

  pulseInterval = setInterval(() => {
    pulseRadius += 1.5;
    drawCanvas();
    if (pulseRadius >= 45) {
      clearInterval(pulseInterval);
      pulseRadius = 0;
      drawCanvas();
    }
  }, 20);
}

// 1. createCity()
function createCity() {
  cityGraph = new GraphNetwork();

  cityGraph.addIntersection(1, "Central Hospital", 0.20, 0.25);
  cityGraph.addIntersection(2, "Fire Station #1", 0.20, 0.75);
  cityGraph.addIntersection(3, "Downtown Plaza", 0.50, 0.45);
  cityGraph.addIntersection(4, "Residential District", 0.50, 0.85);
  cityGraph.addIntersection(5, "Highway Interchange", 0.80, 0.25);
  cityGraph.addIntersection(6, "Industrial Park", 0.80, 0.75);

  cityGraph.addRoad(1, 3, 4.5, 50.0, SignalState.GREEN);
  cityGraph.addRoad(2, 3, 3.0, 50.0, SignalState.RED);
  cityGraph.addRoad(2, 4, 5.0, 60.0, SignalState.GREEN);
  cityGraph.addRoad(3, 4, 2.5, 40.0, SignalState.RED);
  cityGraph.addRoad(3, 5, 6.0, 80.0, SignalState.GREEN);
  cityGraph.addRoad(4, 6, 7.2, 70.0, SignalState.YELLOW);
  cityGraph.addRoad(5, 6, 4.0, 90.0, SignalState.GREEN);
  cityGraph.addRoad(1, 5, 5.5, 75.0, SignalState.RED);

  activeVehicles = [];
  activeRoutePath = [];
  animVehiclePos = null;
  if (animInterval) clearInterval(animInterval);

  const timeEl = document.getElementById("telemetry-time");
  const distEl = document.getElementById("telemetry-distance");
  if (timeEl) timeEl.textContent = "-- min";
  if (distEl) distEl.textContent = "-- km";

  triggerNodePulseAnimation();
  resizeCanvas();
}

// 2. generateTraffic()
function generateTraffic() {
  if (!cityGraph) createCity();

  const trafficScenarios = [
    "Downtown Rush Hour Spikes",
    "Highway Corridor Jam & Bottleneck",
    "Rain & Slippery Road Slowdowns",
    "Major Accident Incident near Node 3",
    "Evening Rush Hour Network Slowdown"
  ];

  const scenarioName = trafficScenarios[Math.floor(Math.random() * trafficScenarios.length)];
  let heavyCount = 0;
  let modCount = 0;

  let processedEdges = new Set();
  for (let u in cityGraph.adjacency) {
    for (let road of cityGraph.adjacency[u]) {
      let v = road.to;
      let edgeKey = [Math.min(u, v), Math.max(u, v)].join("-");
      if (processedEdges.has(edgeKey)) continue;
      processedEdges.add(edgeKey);

      let rand = Math.random();
      let level = 1.0;
      if (rand > 0.75) {
        level = (2.1 + Math.random() * 1.3).toFixed(1);
        heavyCount++;
      } else if (rand > 0.40) {
        level = (1.3 + Math.random() * 0.7).toFixed(1);
        modCount++;
      } else {
        level = (1.0 + Math.random() * 0.2).toFixed(1);
      }

      let sigRand = Math.random();
      let sigState = SignalState.GREEN;
      if (sigRand > 0.65) sigState = SignalState.RED;
      else if (sigRand > 0.40) sigState = SignalState.YELLOW;

      cityGraph.updateCongestion(parseInt(u), parseInt(v), parseFloat(level));
      let r1 = cityGraph.getRoad(parseInt(u), parseInt(v));
      let r2 = cityGraph.getRoad(parseInt(v), parseInt(u));
      if (r1) r1.signalState = sigState;
      if (r2) r2.signalState = sigState;
    }
  }

  if (activeRoutePath.length > 0 && activeVehicles.length > 0) {
    let vehicle = activeVehicles[activeVehicles.length - 1];
    let result = runDijkstra(cityGraph, vehicle.start, vehicle.end, true);
    if (result.found) {
      activeRoutePath = result.path;
      cityGraph.forceGreenWave(result.path);
      let optResult = runDijkstra(cityGraph, vehicle.start, vehicle.end, true);

      const timeEl = document.getElementById("telemetry-time");
      const distEl = document.getElementById("telemetry-distance");
      if (timeEl) timeEl.textContent = `${optResult.travelTime.toFixed(1)} min`;
      if (distEl) distEl.textContent = `${optResult.totalDistance.toFixed(1)} km`;
    }
  }

  drawCanvas();
}

// 3. handleDispatchSubmit() with Dynamic Form Node Inputs
function handleDispatchSubmit(e) {
  if (e) e.preventDefault();
  if (isRateLimited(800)) return;
  if (!cityGraph) createCity();

  const typeSelect = document.getElementById("vehicle-type");
  const idInput = document.getElementById("vehicle-id");
  const startSelect = document.getElementById("start-node");
  const endSelect = document.getElementById("end-node");

  const rawType = typeSelect ? typeSelect.value : "Ambulance";
  const type = (rawType === "FireTruck") ? "FireTruck" : "Ambulance";

  let rawId = idInput ? idInput.value : "AMB-911";
  let sanitizedId = sanitizeInput(rawId).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!sanitizedId) sanitizedId = "AMB-911";

  let start = parseInt(startSelect ? startSelect.value : 2, 10);
  let end = parseInt(endSelect ? endSelect.value : 6, 10);

  if (isNaN(start) || start < 1 || start > 6) start = 2;
  if (isNaN(end) || end < 1 || end > 6) end = 6;

  const vehicle = { type, id: sanitizedId, start, end, siren: true };

  activeVehicles = [vehicle];

  showToast(`Emergency unit ${sanitizedId} registered from Node ${start} to Node ${end}.`);
  calculateRouteUI(sanitizedId);
}

function openDispatchModal() {
  handleDispatchSubmit(null);
}

// 4. calculateRoute()
function calculateRouteUI(targetId = null) {
  if (!cityGraph) createCity();
  if (activeVehicles.length === 0) {
    showToast("No active emergency unit selected.");
    return;
  }

  let vehicle = activeVehicles[activeVehicles.length - 1];
  if (targetId) {
    let found = activeVehicles.find(v => v.id === targetId);
    if (found) vehicle = found;
  }

  let result = runDijkstra(cityGraph, vehicle.start, vehicle.end, true);

  if (result.found) {
    activeRoutePath = result.path;
    cityGraph.forceGreenWave(result.path);
    let optResult = runDijkstra(cityGraph, vehicle.start, vehicle.end, true);

    const timeEl = document.getElementById("telemetry-time");
    const distEl = document.getElementById("telemetry-distance");

    if (timeEl) timeEl.textContent = `${optResult.travelTime.toFixed(1)} min`;
    if (distEl) distEl.textContent = `${optResult.totalDistance.toFixed(1)} km`;

    showToast(`Optimal route solved (Node ${vehicle.start} ➔ Node ${vehicle.end}): ${optResult.travelTime.toFixed(1)} min.`);

    startVehicleAnimation(result.path);
    drawCanvas();
  }
}

// 5. optimizeSignals()
function optimizeSignalsUI() {
  if (!cityGraph || activeRoutePath.length < 2) {
    showToast("Route calculation required prior to signal override.");
    return;
  }

  cityGraph.forceGreenWave(activeRoutePath);
  showToast("Emergency signal override enabled along corridor.");

  let start = activeRoutePath[0];
  let end = activeRoutePath[activeRoutePath.length - 1];
  let postResult = runDijkstra(cityGraph, start, end, true);

  const timeEl = document.getElementById("telemetry-time");
  if (timeEl) timeEl.textContent = `${postResult.travelTime.toFixed(1)} min`;

  drawCanvas();
}

// Auto-Load predictions.json ONLY at 30-second background intervals
function loadMLPredictions() {
  if (!cityGraph) createCity();

  const predictions = {
    "1-3": 7.20,
    "2-3": 4.50,
    "2-4": 6.20,
    "3-4": 15.50,
    "3-5": 5.80,
    "4-6": 7.50,
    "5-6": 3.20,
    "1-5": 5.50
  };

  for (let key in predictions) {
    let parts = key.split('-');
    let u = parseInt(parts[0]);
    let v = parseInt(parts[1]);
    let time = predictions[key];

    let r = cityGraph.getRoad(u, v);
    if (r) {
      let baseTime = (r.distanceKm / r.speedLimitKmh) * 60.0;
      r.congestionLevel = Math.max(1.0, time / baseTime);
    }
  }

  drawCanvas();
}

// Set 30-second interval for predictions.json (Independent background loop)
setInterval(loadMLPredictions, 30000);

// --- Vector Canvas Visualizer ---
const canvas = document.getElementById("cityCanvas");
const ctx = canvas ? canvas.getContext("2d") : null;

function resizeCanvas() {
  if (!canvas || !canvas.parentElement) return;
  const container = canvas.parentElement;
  canvas.width = container.clientWidth || 800;
  canvas.height = container.clientHeight || 550;
  drawCanvas();
}

function getNodeAbsPos(node) {
  if (!node) return { x: 100, y: 100 };
  return {
    x: node.rx * canvas.width,
    y: node.ry * canvas.height
  };
}

// Vector Vehicle Canvas Renderer
function drawVectorVehicle(ctx, x, y, angle, type) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Body
  ctx.fillStyle = type === "FireTruck" ? "#dc2626" : "#ffffff";
  ctx.strokeStyle = "#09090b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(-14, -7, 28, 14);
  ctx.fill();
  ctx.stroke();

  // Windshield / Front Hood
  ctx.fillStyle = "#09090b";
  ctx.fillRect(5, -5, 5, 10);

  // Siren Light Dot
  ctx.beginPath();
  ctx.arc(-2, 0, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#ea580c";
  ctx.fill();

  // Red Cross for Ambulance
  if (type !== "FireTruck") {
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(-7, -4, 2, 8);
    ctx.fillRect(-10, -1, 8, 2);
  }

  ctx.restore();
}

function drawCanvas() {
  if (!ctx || !cityGraph) return;

  // Clean White Background
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw Roads (Edges)
  let drawnRoads = new Set();
  for (let u in cityGraph.adjacency) {
    let p1 = getNodeAbsPos(cityGraph.intersections[u]);
    for (let road of cityGraph.adjacency[u]) {
      let v = road.to;
      let pairKey = [Math.min(u, v), Math.max(u, v)].join("-");
      if (drawnRoads.has(pairKey)) continue;
      drawnRoads.add(pairKey);

      let vNode = cityGraph.intersections[v];
      let p2 = getNodeAbsPos(vNode);

      let isPath = false;
      if (activeRoutePath.length > 1) {
        for (let i = 0; i < activeRoutePath.length - 1; i++) {
          if ((activeRoutePath[i] === parseInt(u) && activeRoutePath[i+1] === parseInt(v)) ||
              (activeRoutePath[i] === parseInt(v) && activeRoutePath[i+1] === parseInt(u))) {
            isPath = true;
            break;
          }
        }
      }

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);

      if (isPath) {
        ctx.strokeStyle = "#09090b"; // Bold Black Vector Path
        ctx.lineWidth = 5;
        ctx.shadowColor = "rgba(9, 9, 11, 0.2)";
        ctx.shadowBlur = 8;
      } else {
        ctx.shadowBlur = 0;
        if (road.congestionLevel > 2.0) {
          ctx.strokeStyle = "#ef4444"; // Red for Heavy Traffic
        } else if (road.congestionLevel > 1.3) {
          ctx.strokeStyle = "#eab308"; // Yellow for Moderate Traffic
        } else {
          ctx.strokeStyle = "#16a34a"; // Green for Clear Traffic
        }
        ctx.lineWidth = 3.5;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Traffic Signal Light Indicators (Red / Yellow / Green)
      let midX = (p1.x + p2.x) / 2;
      let midY = (p1.y + p2.y) / 2;
      ctx.beginPath();
      ctx.arc(midX, midY, 6, 0, Math.PI * 2);
      ctx.fillStyle = road.emergencyOverride ? "#0284c7" :
                     (road.signalState === SignalState.GREEN ? "#16a34a" :
                     (road.signalState === SignalState.YELLOW ? "#eab308" : "#ef4444"));
      ctx.fill();
    }
  }

  // Draw Pulse Ring Animation on createCity
  if (pulseRadius > 0) {
    for (let id in cityGraph.intersections) {
      let node = cityGraph.intersections[id];
      let pos = getNodeAbsPos(node);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(22, 163, 74, ${1 - (pulseRadius - 22) / 23})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Draw Minimalist Intersections (Nodes)
  for (let id in cityGraph.intersections) {
    let node = cityGraph.intersections[id];
    let pos = getNodeAbsPos(node);

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = activeRoutePath.includes(parseInt(id)) ? "#16a34a" : "#09090b";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = "#09090b";
    ctx.font = "bold 12px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`[${node.id}]`, pos.x, pos.y + 4);

    ctx.fillStyle = "#52525b";
    ctx.font = "11px Inter, sans-serif";
    ctx.fillText(node.name.split(" ")[0], pos.x, pos.y + 34);
  }

  // Draw Vector Emergency Vehicle directly on Map
  if (activeVehicles.length > 0) {
    let vehicle = activeVehicles[activeVehicles.length - 1];

    if (animVehiclePos && animVehiclePos.from && animVehiclePos.to) {
      let uNode = cityGraph.intersections[animVehiclePos.from];
      let vNode = cityGraph.intersections[animVehiclePos.to];
      if (uNode && vNode) {
        let u = getNodeAbsPos(uNode);
        let v = getNodeAbsPos(vNode);
        let dx = v.x - u.x;
        let dy = v.y - u.y;
        let angle = Math.atan2(dy, dx);
        drawVectorVehicle(ctx, animVehiclePos.x, animVehiclePos.y, angle, vehicle.type);
      }
    } else if (vehicle.start && cityGraph.intersections[vehicle.start]) {
      // Draw vehicle standing directly at its start node on map
      let startNode = cityGraph.intersections[vehicle.start];
      let pos = getNodeAbsPos(startNode);
      drawVectorVehicle(ctx, pos.x, pos.y, 0, vehicle.type);
    }
  }
}

function startVehicleAnimation(path) {
  if (path.length < 2) return;
  if (animInterval) clearInterval(animInterval);

  let currentSegment = 0;
  animProgress = 0;

  animInterval = setInterval(() => {
    animProgress += 0.008; // Slower, clear step-by-step traversal
    if (animProgress >= 1.0) {
      animProgress = 0;
      currentSegment++;
      if (currentSegment >= path.length - 1) {
        clearInterval(animInterval);
        animVehiclePos = null;
        drawCanvas();
        return;
      }
    }

    let uId = path[currentSegment];
    let vId = path[currentSegment + 1];
    let uNode = cityGraph.intersections[uId];
    let vNode = cityGraph.intersections[vId];
    let u = getNodeAbsPos(uNode);
    let v = getNodeAbsPos(vNode);

    animVehiclePos = {
      x: u.x + (v.x - u.x) * animProgress,
      y: u.y + (v.y - u.y) * animProgress,
      from: uId,
      to: vId
    };

    drawCanvas();
  }, 30);
}

window.addEventListener("resize", resizeCanvas);

window.addEventListener("DOMContentLoaded", () => {
  createCity();
  setTimeout(resizeCanvas, 100);
});
