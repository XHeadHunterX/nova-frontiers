
const API = "";
const app = document.getElementById("app");

let state = null;
let token = localStorage.getItem("nova_token") || "";
let selected = null;
let view = { x: 40, y: 40, z: 0.78 };
let dragging = false;
let dragStart = null;
let context = null;
let serverOffset = 0;

const worldW = 1400;
const worldH = 940;

function fmt(n) { return Math.round(Number(n || 0)).toLocaleString(); }
function pct(v, max) { return Math.max(0, Math.min(100, max ? (v / max) * 100 : 0)); }
function nowServer() { return Date.now()/1000 + serverOffset; }

async function apiAction(type, payload={}) {
  const res = await fetch("/api/action", {
    method: "POST",
    headers: {"Content-Type": "application/json", Authorization: `Bearer ${token}`},
    body: JSON.stringify({type, payload})
  });
  const data = await res.json();
  if (data.state) {
    state = data.state;
    syncServerTime();
  }
  if (!res.ok) alert(data.result?.error || "Action failed");
  render();
}

async function loadState() {
  const res = await fetch("/api/state", {headers:{Authorization:`Bearer ${token}`}});
  state = await res.json();
  syncServerTime();
  render();
}

function syncServerTime() {
  if (state?.server_time) serverOffset = state.server_time - Date.now()/1000;
}

function loginScreen() {
  app.innerHTML = `
    <div class="login">
      <div class="loginCard panel">
        <h1>NOVA FRONTIERS</h1>
        <p>Phase 22 live map, cargo timers, security response, NPC traffic.</p>
        <input id="u" value="godmode" placeholder="callsign">
        <input id="p" value="godmode123" placeholder="password" type="password">
        <button class="primary" id="loginBtn">Login</button>
      </div>
    </div>`;
  document.getElementById("loginBtn").onclick = async () => {
    const username = document.getElementById("u").value;
    const password = document.getElementById("p").value;
    const res = await fetch("/api/action", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({type:"login", payload:{username,password}})
    });
    const data = await res.json();
    token = data.result.token;
    localStorage.setItem("nova_token", token);
    state = data.state;
    syncServerTime();
    render();
  };
}

function shell() {
  if (!state) return "";
  const p = state.player;
  return `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">NOVA<br>FRONTIERS</div>
        <div class="nav">
          <button class="active">Open World Map</button>
          <button onclick="apiAction('load_cargo',{qty:20})">Load Cargo</button>
          <button onclick="apiAction('offload_cargo',{qty:20})">Offload Cargo</button>
          <button onclick="apiAction('refuel')">Refuel</button>
          <button class="danger" onclick="apiAction('reset')">Reset Universe</button>
        </div>
        <div class="panel panelBody" style="margin-top:14px">
          <h3>${p.callsign}</h3>
          <div class="bar"><div class="fill" style="width:${pct(p.hull,100)}%"></div></div>
          <p>Hull ${fmt(p.hull)} / 100</p>
          <div class="bar"><div class="fill" style="width:${pct(p.shield,100)}%"></div></div>
          <p>Shield ${fmt(p.shield)} / 100</p>
          <div class="bar"><div class="fill" style="width:${pct(p.fuel,p.max_fuel)}%"></div></div>
          <p>Fuel ${fmt(p.fuel)} / ${fmt(p.max_fuel)}</p>
          <div class="bar"><div class="fill" style="width:${pct(p.cargo,p.max_cargo)}%"></div></div>
          <p>Cargo ${fmt(p.cargo)} / ${fmt(p.max_cargo)}</p>
        </div>
      </aside>
      <main class="main">
        ${topbar()}
        <div class="content">
          ${mapPanel()}
          <section class="side">
            ${detailPanel()}
            ${marketPanel()}
            ${eventPanel()}
          </section>
        </div>
      </main>
    </div>
    ${contextMenu()}
  `;
}

function topbar() {
  const p = state.player;
  const loc = p.location || {};
  const busy = p.cargo_timer ? `${p.cargo_timer.type.toUpperCase()} ${timerText(p.cargo_timer.complete_at)}` : (p.traveling ? `TRAVEL ${Math.round(p.progress*100)}%` : "DOCKED");
  return `
    <div class="topbar">
      <div class="stat">Credits <b>${fmt(p.credits)}</b></div>
      <div class="stat">Location <b>${loc.name || "Deep Space"}</b></div>
      <div class="stat">Status <b>${busy}</b></div>
      <div class="stat">NPC Ships <b>${state.npcs.length}</b></div>
      <div class="stat">Contacts <b>${state.signatures.length}</b></div>
      ${p.god_mode ? `<div class="stat"><b>GOD MODE</b></div>` : ""}
      <button onclick="logout()">Logout</button>
    </div>`;
}

function timerText(epoch) {
  const left = Math.max(0, Math.ceil(epoch - nowServer()));
  return `${left}s`;
}

function mapPanel() {
  return `
    <section class="panel mapPanel">
      <div class="mapHeader">
        <h2>Open World Map</h2>
        <div class="mapTools">
          <button onclick="zoomBy(1.15)">Zoom In</button>
          <button onclick="zoomBy(0.87)">Zoom Out</button>
          <button onclick="resetView()">Reset View</button>
        </div>
      </div>
      <div id="viewport" class="viewport">
        <div id="world" class="world" style="transform: translate(${view.x}px, ${view.y}px) scale(${view.z})">
          <div class="stars"></div>
          <div class="lanes">${lanesSvg()}</div>
          <div class="entities">${entitiesHtml()}</div>
        </div>
      </div>
    </section>`;
}

function lanesSvg() {
  const lines = [];
  for (let i=0; i<state.planets.length; i++) {
    for (let j=i+1; j<state.planets.length; j++) {
      const a = state.planets[i], b = state.planets[j];
      const d = Math.hypot(a.x-b.x, a.y-b.y);
      if (d < 520) lines.push(`<line class="lane" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`);
    }
  }
  const p = state.player;
  if (p.traveling && p.origin && p.destination) {
    lines.push(`<line class="lane active" x1="${p.origin.x}" y1="${p.origin.y}" x2="${p.destination.x}" y2="${p.destination.y}"/>`);
  }
  for (const n of state.npcs) {
    if (n.traveling && n.origin && n.destination) {
      lines.push(`<line class="lane active" x1="${n.origin.x}" y1="${n.origin.y}" x2="${n.destination.x}" y2="${n.destination.y}" opacity=".28"/>`);
    }
  }
  return `<svg>${lines.join("")}</svg>`;
}

function entitiesHtml() {
  const p = state.player;
  const nodes = state.planets.map(pl => `
    <div class="node ${pl.id===p.location_id ? "current" : ""}" style="left:${pl.x}px;top:${pl.y}px"
      data-type="planet" data-id="${pl.id}">
      <div class="name">${pl.name}</div>
      <small>${pl.kind}</small>
      <small>Sec ${pl.security} • Market ${pl.market}</small>
    </div>`).join("");

  const px = p.render_x ?? p.x, py = p.render_y ?? p.y;
  const player = `<div class="player" title="Player" style="left:${px}px;top:${py}px">◆</div>`;

  const ships = state.npcs.map(n => `
    <div class="ship ${n.role}" title="${n.name} ${n.role}" style="left:${n.render_x ?? n.x}px;top:${n.render_y ?? n.y}px"
      data-type="npc" data-id="${n.id}">${shipIcon(n.role)}</div>`).join("");

  const sigs = state.signatures.map(s => `
    <div class="sig ${s.type}" title="${s.name}" style="left:${s.x}px;top:${s.y}px"
      data-type="${s.type}" data-id="${s.id}">${s.type==="ore" ? "⬡" : "✦"}</div>`).join("");

  return nodes + player + ships + sigs;
}

function shipIcon(role) {
  return {trader:"T", hauler:"H", miner:"M", patrol:"P", pirate:"!", salvager:"S"}[role] || "•";
}

function detailPanel() {
  const p = state.player;
  const loc = p.location || {};
  const cargoTimer = p.cargo_timer ? `
    <div class="timer">
      <b>Cargo ${p.cargo_timer.type}</b><br>
      ${p.cargo_timer.qty} units • remaining ${timerText(p.cargo_timer.complete_at)}
      <div class="bar"><div class="fill warn" style="width:${cargoProgress(p.cargo_timer)}%"></div></div>
    </div>` : "";

  const travel = p.traveling ? `
    <div class="timer">
      <b>Live Travel</b><br>
      ${Math.round((p.progress||0)*100)}% complete • arrival in ${timerText(p.arrival_time)}
      <div class="bar"><div class="fill" style="width:${Math.round((p.progress||0)*100)}%"></div></div>
    </div>` : "";

  return `
    <section class="panel panelBody">
      <h2>Ship / Location</h2>
      <div class="grid2">
        <div class="kv"><label>Ship</label><b>${p.ship.name}</b></div>
        <div class="kv"><label>Security</label><b>${loc.security ?? "Deep"}</b></div>
        <div class="kv"><label>Faction</label><b>${loc.faction || "None"}</b></div>
        <div class="kv"><label>Economy</label><b>${loc.economy || "Transit"}</b></div>
        <div class="kv"><label>Combat</label><b>${p.ship.combat}</b></div>
        <div class="kv"><label>Mining</label><b>${p.ship.mining}</b></div>
      </div>
      ${travel}
      ${cargoTimer}
      <p style="color:var(--muted)">Click planets, ships, ore, wrecks, or blank space. Action popup opens near the mouse.</p>
    </section>`;
}

function cargoProgress(timer) {
  const total = Math.max(1, timer.complete_at - timer.started_at);
  const done = Math.max(0, Math.min(1, (nowServer() - timer.started_at) / total));
  return Math.round(done * 100);
}

function marketPanel() {
  return `
    <section class="panel panelBody">
      <h2>Market Pressure</h2>
      ${state.market.slice(0,6).map(g => `
        <div class="marketItem">
          <div><b>${g.name}</b> ${g.illegal ? `<span class="badge">ILLEGAL</span>` : ""}<br>
          <small>Stock ${fmt(g.stock)} • Demand ${g.demand}</small></div>
          <div>${fmt(g.price)} cr ${g.trend>0 ? "↗" : g.trend<0 ? "↘" : "→"}</div>
        </div>`).join("")}
    </section>`;
}

function eventPanel() {
  return `
    <section class="panel panelBody">
      <h2>Event Log</h2>
      <ul class="events">${state.events.map(e => `<li>${escapeHtml(e)}</li>`).join("")}</ul>
    </section>`;
}

function contextMenu() {
  if (!context) return "";
  const x = Math.min(window.innerWidth - 230, context.screenX + 14);
  const y = Math.min(window.innerHeight - 260, context.screenY);
  return `<div class="context" style="left:${x}px;top:${y}px">${contextButtons()}</div>`;
}

function contextButtons() {
  const c = context;
  if (c.type === "blank") {
    return `
      <button onclick="apiAction('go_here',{x:${c.worldX},y:${c.worldY}}); closeContext()">Go Here</button>
      <button onclick="closeContext()">Cancel</button>`;
  }
  if (c.type === "planet") {
    const p = state.planets.find(x => x.id === c.id);
    return `
      <button onclick="selectObject('planet','${c.id}'); closeContext()">Inspect ${p.name}</button>
      <button onclick="apiAction('travel',{planet_id:'${c.id}'}); closeContext()">Travel Here</button>
      <button onclick="closeContext()">Cancel</button>`;
  }
  if (c.type === "npc") {
    const n = state.npcs.find(x => x.id === c.id);
    return `
      <button onclick="selectObject('npc','${c.id}'); apiAction('inspect_npc',{id:'${c.id}'}); closeContext()">Inspect ${n.name}</button>
      <button onclick="apiAction('intercept',{id:'${c.id}'}); closeContext()">Intercept</button>
      <button class="danger" onclick="apiAction('attack',{id:'${c.id}'}); closeContext()">Attack</button>
      <button onclick="apiAction('follow',{id:'${c.id}'}); closeContext()">Follow</button>
      <button onclick="closeContext()">Cancel</button>`;
  }
  if (c.type === "ore") {
    const s = state.signatures.find(x => x.id === c.id);
    return `
      <button onclick="selectObject('sig','${c.id}'); closeContext()">Inspect Ore</button>
      <button onclick="apiAction('mine',{id:'${c.id}'}); closeContext()">Mine</button>
      <button onclick="closeContext()">Cancel</button>`;
  }
  if (c.type === "wreck") {
    const s = state.signatures.find(x => x.id === c.id);
    return `
      <button onclick="selectObject('sig','${c.id}'); closeContext()">Inspect Wreck</button>
      <button onclick="apiAction('salvage',{id:'${c.id}'}); closeContext()">Salvage</button>
      <button onclick="closeContext()">Cancel</button>`;
  }
  return `<button onclick="closeContext()">Cancel</button>`;
}

function selectObject(type, id) {
  selected = {type, id};
}

function closeContext() {
  context = null;
  render();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function zoomBy(factor) {
  view.z = Math.max(.35, Math.min(2.4, view.z * factor));
  clampView();
  render();
}

function resetView() {
  view = { x: 40, y: 40, z: 0.78 };
  render();
}

function clampView() {
  const vp = document.getElementById("viewport");
  if (!vp) return;
  const w = vp.clientWidth, h = vp.clientHeight;
  const minX = Math.min(20, w - worldW * view.z - 80);
  const minY = Math.min(20, h - worldH * view.z - 80);
  view.x = Math.max(minX, Math.min(120, view.x));
  view.y = Math.max(minY, Math.min(120, view.y));
}

function screenToWorld(clientX, clientY) {
  const vp = document.getElementById("viewport");
  const rect = vp.getBoundingClientRect();
  return {
    x: (clientX - rect.left - view.x) / view.z,
    y: (clientY - rect.top - view.y) / view.z,
  };
}

function attachMapEvents() {
  const vp = document.getElementById("viewport");
  if (!vp) return;

  vp.onmousedown = e => {
    if (e.button !== 0) return;
    dragging = false;
    dragStart = { mx:e.clientX, my:e.clientY, vx:view.x, vy:view.y };
    vp.classList.add("dragging");
  };

  window.onmousemove = e => {
    if (!dragStart) return;
    const dx = e.clientX - dragStart.mx, dy = e.clientY - dragStart.my;
    if (Math.abs(dx)+Math.abs(dy) > 3) dragging = true;
    view.x = dragStart.vx + dx;
    view.y = dragStart.vy + dy;
    clampView();
    const world = document.getElementById("world");
    if (world) world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.z})`;
  };

  window.onmouseup = e => {
    if (!dragStart) return;
    vp.classList.remove("dragging");
    const wasDrag = dragging;
    dragStart = null;
    if (wasDrag) return;
    handleMapClick(e);
  };

  vp.onwheel = e => {
    e.preventDefault();
    const before = screenToWorld(e.clientX, e.clientY);
    const factor = e.deltaY < 0 ? 1.1 : .9;
    view.z = Math.max(.35, Math.min(2.4, view.z * factor));
    const rect = vp.getBoundingClientRect();
    view.x = e.clientX - rect.left - before.x * view.z;
    view.y = e.clientY - rect.top - before.y * view.z;
    clampView();
    render();
  };
}

function handleMapClick(e) {
  const target = e.target.closest("[data-type]");
  if (target) {
    context = {
      type: target.dataset.type === "wreck" ? "wreck" : target.dataset.type,
      id: target.dataset.id,
      screenX: e.clientX,
      screenY: e.clientY
    };
  } else {
    const w = screenToWorld(e.clientX, e.clientY);
    context = {type:"blank", worldX:Math.round(w.x), worldY:Math.round(w.y), screenX:e.clientX, screenY:e.clientY};
  }
  render();
}

function logout() {
  token = "";
  localStorage.removeItem("nova_token");
  state = null;
  render();
}

function render() {
  if (!token) {
    loginScreen();
    return;
  }
  app.innerHTML = shell();
  attachMapEvents();
}

setInterval(() => {
  if (!state) return;
  loadState();
}, 3000);

setInterval(() => {
  if (!state) return;
  const world = document.querySelector(".entities");
  const lanes = document.querySelector(".lanes");
  const top = document.querySelector(".topbar");
  const side = document.querySelector(".side");
  if (world) world.innerHTML = entitiesHtml();
  if (lanes) lanes.innerHTML = lanesSvg();
  if (top) top.outerHTML = topbar();
  if (side) side.innerHTML = detailPanel() + marketPanel() + eventPanel();
}, 500);

if (token) loadState(); else render();
