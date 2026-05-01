
const API = "";
const app = document.getElementById("app") || document.getElementById("root");

let state = null;
let token = localStorage.getItem("nova_token") || "";
let selected = null;
let page = localStorage.getItem("nova_page") || "map";
let view = { x: 40, y: 40, z: 0.22 };
let mapMode = localStorage.getItem("nova_map_mode") || "system";
let mapFilters = JSON.parse(localStorage.getItem("nova_map_filters") || "null") || {
  galaxies: true,
  planets: true,
  ships: true,
  mining: true,
  wrecks: true,
  derelicts: true,
  artifacts: true,
  events: true,
  blips: true,
  lanes: true,
  radar: true
};
let dragging = false;
let dragStart = null;
let context = null;
let serverOffset = 0;
let didCenter = false;
let stateRefreshTimer = null;
let stateLoadInFlight = null;

function fmt(n) { return Math.round(Number(n || 0)).toLocaleString(); }
function pct(v, max) { return Math.max(0, Math.min(100, max ? (v / max) * 100 : 0)); }
function nowServer() { return Date.now() / 1000 + serverOffset; }
function bounds() { return state?.world_bounds || { min_x: 0, min_y: 0, width: 9000, height: 7000 }; }
function worldW() { return bounds().width; }
function worldH() { return bounds().height; }
function ox() { return bounds().min_x; }
function oy() { return bounds().min_y; }
function wx(x) { return Number(x || 0) - ox(); }
function wy(y) { return Number(y || 0) - oy(); }
function esc(str) { return String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[c])); }
function uid() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }

async function apiAction(type, payload = {}) {
  const res = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ type, payload, nonce: uid() })
  });
  let data = {};
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    alert(data.detail || data.result?.error || "Action failed");
    return data;
  }
  if (data.state) {
    state = data.state;
    syncServerTime();
    render();
    return data;
  }
  // Fast-action path: backend commits the action and skips the heavy full-state build.
  // One throttled state refresh follows, which keeps battle/buttons responsive under spam clicking.
  const fast = /battle|combat|fire|attack|use_all/i.test(type);
  queueStateRefresh(fast ? 25 : 90);
  return data;
}

function queueStateRefresh(delay = 90) {
  if (!token) return;
  if (stateRefreshTimer) clearTimeout(stateRefreshTimer);
  stateRefreshTimer = setTimeout(() => {
    stateRefreshTimer = null;
    loadState();
  }, delay);
}

async function loadState() {
  if (!token) return null;
  if (stateLoadInFlight) return stateLoadInFlight;
  stateLoadInFlight = (async () => {
    const res = await fetch("/api/state", { headers: { Authorization: `Bearer ${token}` } });
    const next = await res.json();
    if (!res.ok) throw new Error(next.detail || "State load failed");
    state = next;
    syncServerTime();
    if (!didCenter) centerOnPlayer();
    render();
    return state;
  })().finally(() => { stateLoadInFlight = null; });
  return stateLoadInFlight;
}

function syncServerTime() {
  if (state?.server_time) serverOffset = state.server_time - Date.now() / 1000;
}

function loginScreen() {
  app.innerHTML = `
    <div class="login">
      <div class="loginCard panel">
        <h1>NOVA FRONTIERS</h1>
        <p>Fuel, galaxy scale, server events, and planet market economy are active.</p>
        <input id="u" value="godmode" placeholder="callsign">
        <input id="p" value="godmode123" placeholder="password" type="password">
        <button class="primary" id="loginBtn">Login</button>
      </div>
    </div>`;
  document.getElementById("loginBtn").onclick = async () => {
    const username = document.getElementById("u").value;
    const password = document.getElementById("p").value;
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.detail || "Login failed"); return; }
    token = data.token;
    localStorage.setItem("nova_token", token);
    await loadState();
    centerOnPlayer();
  };
}

function setPage(next) {
  page = next;
  localStorage.setItem("nova_page", page);
  context = null;
  render();
}

function shell() {
  if (!state) return "";
  const p = state.player;
  return `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">NOVA<br>FRONTIERS</div>
        <div class="nav">
          ${navButton("map", "Galaxy Map")}
          ${navButton("market", "Market")}
          ${navButton("contracts", "Contracts")}
          ${navButton("scan", "Scanning")}
          ${navButton("war", "War Supply")}
          ${navButton("bounties", "Bounties")}
          ${navButton("insurance", "Insurance")}
          ${navButton("fuel", "Fuel Shop")}
          ${navButton("calendar", "Calendar")}
          ${p.god_mode ? navButton("admin", "Admin") : ""}
          <button class="danger" onclick="apiAction('reset')">Reset Universe</button>
        </div>
        <div class="panel panelBody pilotCard">
          <h3>${esc(p.callsign)}</h3>
          <div class="bar"><div class="fill" style="width:${pct(p.hull, 100)}%"></div></div>
          <p>Hull ${fmt(p.hull)} / 100</p>
          <div class="bar"><div class="fill" style="width:${pct(p.shield, 100)}%"></div></div>
          <p>Shield ${fmt(p.shield)} / 100</p>
          <div class="bar"><div class="fill ${p.fuel_status === "emergency" ? "bad" : p.fuel_status === "low" ? "warn" : ""}" style="width:${pct(p.fuel, p.max_fuel)}%"></div></div>
          <p>Fuel ${fmt(p.fuel)} / ${fmt(p.max_fuel)}</p>
          <small>${fuelStatusText()}</small>
          <div class="bar"><div class="fill" style="width:${pct(p.cargo, p.max_cargo)}%"></div></div>
          <p>Cargo ${fmt(p.cargo)} / ${fmt(p.max_cargo)}</p>
        </div>
      </aside>
      <main class="main">
        ${topbar()}
        ${warningStrip()}
        <div class="pageBody">${pageContent()}</div>
      </main>
    </div>
    ${contextMenu()}`;
}

function navButton(id, label) {
  return `<button class="${page === id ? "active" : ""}" onclick="setPage('${id}')">${label}</button>`;
}

function topbar() {
  const p = state.player;
  const loc = p.location || {};
  const busy = p.traveling ? `${(p.travel_mode || "travel").toUpperCase()} ${Math.round((p.progress || 0) * 100)}%` : (mapMode === "galaxy" ? "YOU ARE HERE" : "DOCKED");
  return `
    <div class="topbar">
      <div class="stat">Credits <b>${fmt(p.credits)}</b></div>
      <div class="stat">Galaxy <b>${esc(loc.galaxy_name || "Deep Space")}</b></div>
      <div class="stat">Location <b>${esc(loc.name || "Deep Space")}</b></div>
      <div class="stat">Status <b>${busy}</b></div>
      <div class="stat">Visible Ships <b>${state.npcs.length}</b></div>
      <div class="stat">Hidden Contacts <b>${fmt((state.hidden_contact_counts?.signatures || 0) + (state.hidden_contact_counts?.npcs || 0))}</b></div>
      <div class="stat">Radar <b>${fmt(p.radar_range_effective || 0)}</b></div>
      <div class="stat">Rep <b>L${fmt(p.planet_rep?.level || 0)}</b></div>
      ${p.god_mode ? `<div class="stat"><b>GOD MODE</b></div>` : ""}
      <button onclick="logout()">Logout</button>
    </div>`;
}

function warningStrip() {
  const status = state.fuel_status || state.player.fuel_status;
  if (status === "emergency") return `<div class="warning badWarn">Emergency power: speed reduced by 50%. Jump gates are locked until refueled.</div>`;
  if (status === "low") return `<div class="warning lowWarn">Low fuel warning: fuel is at or below 20%.</div>`;
  return "";
}

function fuelStatusText() {
  const p = state.player;
  if (p.fuel_status === "emergency") return "Emergency power. Move allowed, speed -50%, jump gates locked.";
  if (p.fuel_status === "low") return "Low fuel warning. Refuel soon.";
  return `${esc(p.fuel_tank?.name || "Default Tank")} equipped.`;
}

function pageContent() {
  if (page === "market") return marketPage();
  if (page === "contracts") return contractsPage();
  if (page === "scan") return scanPage();
  if (page === "war") return warPage();
  if (page === "bounties") return bountiesPage();
  if (page === "insurance") return insurancePage();
  if (page === "fuel") return fuelPage();
  if (page === "calendar") return calendarPage();
  if (page === "admin") return adminPage();
  return mapPage();
}

function currentGalaxyId() {
  const p = state?.player || {};
  if (p.galaxy_id) return p.galaxy_id;
  const loc = p.location || {};
  if (loc.galaxy_id) return loc.galaxy_id;
  const currentPlanet = state?.planets?.find(pl => pl.id === p.location_id);
  return currentPlanet?.galaxy_id || state?.galaxies?.[0]?.id;
}

function currentGalaxy() {
  const gid = currentGalaxyId();
  return state?.galaxies?.find(g => g.id === gid) || state?.galaxies?.[0] || {};
}

function setMapMode(next) {
  mapMode = next === "galaxy" ? "galaxy" : "system";
  localStorage.setItem("nova_map_mode", mapMode);
  context = null;
  render();
}

function toggleMapFilter(key) {
  mapFilters[key] = !mapFilters[key];
  localStorage.setItem("nova_map_filters", JSON.stringify(mapFilters));
  render();
}

function iconScale() {
  return Math.max(1, Math.min(4.5, 1 / Math.max(view.z, 0.18)));
}

function galaxyWarpActive() {
  const p = state?.player || {};
  return !!(p.traveling && ["galaxy", "galaxy_route"].includes(String(p.travel_mode || "").toLowerCase()));
}

function playerShouldRenderOnCurrentMap() {
  if (mapMode === "galaxy") return galaxyWarpActive();
  if (mapMode === "system") return !galaxyWarpActive();
  return true;
}

function inCurrentGalaxy(obj) {
  return !obj.galaxy_id || obj.galaxy_id === currentGalaxyId();
}

function isSigVisibleInMode(sig) {
  if (mapMode === "system" && !inCurrentGalaxy(sig)) return false;
  if (mapMode === "galaxy" && sig.type !== "event" && sig.type !== "blip") return false;
  if (sig.type === "blip") return !!mapFilters.blips;
  if (sig.type === "ore") return !!mapFilters.mining;
  if (sig.type === "wreck") return !!mapFilters.wrecks;
  if (sig.type === "derelict") return !!mapFilters.derelicts;
  if (sig.type === "artifact") return !!mapFilters.artifacts;
  if (sig.type === "event") return !!mapFilters.events;
  return true;
}

function mapPage() {
  return `
    <div class="content">
      ${mapPanel()}
      <section class="side">
        ${detailPanel()}
        ${cargoPanel()}
        ${eventPanel()}
      </section>
    </div>`;
}

function mapPanel() {
  const cg = currentGalaxy();
  const subtitle = mapMode === "galaxy"
    ? "Galaxy view shows faction space, long-range routes, event contacts, and inter-galaxy layout."
    : `Planet view shows local planets/stations, NPCs, mining, wrecks, derelicts, artifacts, blips, and radar inside ${esc(cg.name || "current galaxy")}.`;
  return `
    <section class="panel mapPanel">
      <div class="mapHeader">
        <div>
          <h2>${mapMode === "galaxy" ? "Galaxy View" : "Planet View Map"}</h2>
          <small class="mapSubtitle">${subtitle}</small>
        </div>
        <div class="mapTools">
          <button class="${mapMode === "system" ? "activeTool" : ""}" onclick="setMapMode('system')">Planet View</button>
          <button class="${mapMode === "galaxy" ? "activeTool" : ""}" onclick="setMapMode('galaxy')">Galaxy View</button>
          <button onclick="zoomBy(1.15)">Zoom In</button>
          <button onclick="zoomBy(0.87)">Zoom Out</button>
          <button onclick="centerOnPlayer()">Center Ship</button>
        </div>
      </div>
      <div class="mapFilterBar">
        ${mapFilterButton("galaxies", "Galaxies")}
        ${mapFilterButton("planets", "Planets")}
        ${mapFilterButton("ships", "Ships")}
        ${mapFilterButton("mining", "Mining")}
        ${mapFilterButton("wrecks", "Wrecks")}
        ${mapFilterButton("derelicts", "Derelicts")}
        ${mapFilterButton("artifacts", "Artifacts")}
        ${mapFilterButton("events", "Events")}
        ${mapFilterButton("blips", "Scan Blips")}
        ${mapFilterButton("lanes", "Lanes")}
        ${mapFilterButton("radar", "Radar")}
      </div>
      <div id="viewport" class="viewport ${mapMode === "galaxy" ? "galaxyView" : "systemView"}">
        <div id="world" class="world" style="width:${worldW()}px;height:${worldH()}px;--icon-scale:${iconScale()};transform:translate(${view.x}px, ${view.y}px) scale(${view.z})">
          <div class="stars"></div>
          <div class="lanes">${lanesSvg()}</div>
          <div class="entities">${entitiesHtml()}</div>
        </div>
      </div>
    </section>`;
}

function mapFilterButton(key, label) {
  return `<button class="mapFilter ${mapFilters[key] ? "on" : "off"}" onclick="toggleMapFilter('${key}')">${label}</button>`;
}

function lanesSvg() {
  if (!mapFilters.lanes) return `<svg style="width:${worldW()}px;height:${worldH()}px"></svg>`;
  const lines = [];
  if (mapMode === "galaxy") {
    for (let i = 0; i < state.galaxies.length; i++) {
      for (let j = i + 1; j < state.galaxies.length; j++) {
        const a = state.galaxies[i], b = state.galaxies[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < state.settings.min_galaxy_gap * 2.5) lines.push(`<line class="jumpLane" x1="${wx(a.x)}" y1="${wy(a.y)}" x2="${wx(b.x)}" y2="${wy(b.y)}"/>`);
      }
    }
  } else {
    const gid = currentGalaxyId();
    const planets = state.planets.filter(p => p.galaxy_id === gid);
    for (let i = 0; i < planets.length; i++) {
      for (let j = i + 1; j < planets.length; j++) {
        const a = planets[i], b = planets[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < state.settings.min_planet_gap * 3.0) lines.push(`<line class="lane" x1="${wx(a.x)}" y1="${wy(a.y)}" x2="${wx(b.x)}" y2="${wy(b.y)}"/>`);
      }
    }
  }
  const p = state.player;
  if (p.traveling && p.origin && p.destination && ((galaxyWarpActive() && mapMode === "galaxy") || (!galaxyWarpActive() && mapMode === "system"))) {
    lines.push(`<line class="lane active" x1="${wx(p.origin.x)}" y1="${wy(p.origin.y)}" x2="${wx(p.destination.x)}" y2="${wy(p.destination.y)}"/>`);
  }
  if (mapMode === "system") {
    for (const n of state.npcs) {
      if (!inCurrentGalaxy(n)) continue;
      if (n.traveling && n.origin && n.destination) {
        lines.push(`<line class="lane npcLine" x1="${wx(n.origin.x)}" y1="${wy(n.origin.y)}" x2="${wx(n.destination.x)}" y2="${wy(n.destination.y)}"/>`);
      }
    }
  }
  return `<svg style="width:${worldW()}px;height:${worldH()}px">${lines.join("")}</svg>`;
}

function entitiesHtml() {
  const p = state.player;
  const scale = iconScale();
  const showGalaxyNodes = mapMode === "galaxy" && mapFilters.galaxies;
  const showPlanetNodes = mapMode === "system" && mapFilters.planets;
  const currentGid = currentGalaxyId();
  const galaxies = showGalaxyNodes ? state.galaxies.map(g => `
    <div class="galaxy ${g.type} ${g.id === currentGid ? "currentGalaxy" : ""}" style="left:${wx(g.x)}px;top:${wy(g.y)}px;border-color:${g.color};--icon-scale:${Math.max(1, scale * .45)};" data-type="galaxy" data-id="${g.id}">
      <div class="galaxyRing"></div>
      <b>${esc(g.name)}</b><small>${esc(g.faction)}</small>${g.id === currentGid && !galaxyWarpActive() ? `<small class="youHere">You are here</small>` : ""}
    </div>`).join("") : "";
  const visiblePlanets = state.planets.filter(pl => pl.galaxy_id === currentGid);
  const nodes = showPlanetNodes ? visiblePlanets.map(pl => `
    <div class="node ${pl.id === p.location_id ? "current" : ""} ${pl.inhabitable ? "inhabitable" : "wild"}" style="left:${wx(pl.x)}px;top:${wy(pl.y)}px;--icon-scale:${scale};" data-type="planet" data-id="${pl.id}">
      <div class="name">${esc(pl.name)}</div>
      <small>${esc(pl.kind)} ${pl.has_refuel_shop ? "• Fuel" : ""}</small>
      <small>Sec ${pl.security} • Market ${pl.market}</small>
    </div>`).join("") : "";
  const px = p.render_x ?? p.x, py = p.render_y ?? p.y;
  const renderPlayer = playerShouldRenderOnCurrentMap();
  const radar = renderPlayer && mapMode === "system" && mapFilters.radar ? `<div class="radarRing" style="left:${wx(px)}px;top:${wy(py)}px;width:${(p.radar_range_effective||640)*2}px;height:${(p.radar_range_effective||640)*2}px"></div>` : "";
  const player = renderPlayer ? `<div class="player entityShip playerShip" title="Player" style="left:${wx(px)}px;top:${wy(py)}px;--icon-scale:${scale};"><span class="avatar">◎</span><span class="lvl">${fmt(p.level || 1)}</span><span class="guild">${esc(p.guild_tag || "YOU")}</span><b>◆</b></div>` : "";
  const ships = (mapMode === "system" && mapFilters.ships) ? state.npcs.filter(inCurrentGalaxy).map(n => `
    <div class="ship entityShip ${n.alien ? "alien" : n.role}" title="${esc(n.name)} ${esc(n.role)} L${esc(n.level || "?")}" style="left:${wx(n.render_x ?? n.x)}px;top:${wy(n.render_y ?? n.y)}px;--icon-scale:${scale};" data-type="npc" data-id="${n.id}">
      <span class="avatar">${esc(n.avatar || "◌")}</span><span class="lvl">${esc(n.level || "?")}</span><span class="guild">${esc(n.guild_tag || "")}</span><b>${shipIcon(n)}</b>
    </div>`).join("") : "";
  const sigs = state.signatures.filter(isSigVisibleInMode).map(s => {
    const blipClass = s.blip_type ? "blip-" + s.blip_type : "";
    return `
    <div class="sig ${s.type} ${blipClass}" title="${esc(s.name)}" style="left:${wx(s.x)}px;top:${wy(s.y)}px;--icon-scale:${scale};" data-type="${s.type}" data-id="${s.source_id || s.id}">${sigIcon(s)}</div>`;
  }).join("");
  return galaxies + nodes + radar + player + ships + sigs;
}

function shipIcon(n) {
  if (n.alien) return "A";
  return { trader: "T", hauler: "H", miner: "M", patrol: "P", pirate: "!", salvager: "S", escort: "E", bounty: "B" }[n.role] || "•";
}

function sigIcon(s) {
  if (s.type === "blip") return s.icon || "•";
  if (s.type === "ore") return "⬡";
  if (s.type === "wreck") return "✦";
  if (s.type === "derelict") return "▣";
  if (s.type === "artifact") return "◇";
  if (s.event_type === "alien_raid") return "◎";
  if (s.event_type === "wormhole_control") return "◉";
  return "◇";
}

function detailPanel() {
  const p = state.player;
  const loc = p.location || {};
  const travel = p.traveling ? `
    <div class="timer">
      <b>Live ${esc(p.travel_mode || "Travel")}</b><br>
      ${Math.round((p.progress || 0) * 100)}% complete • arrival in ${timerText(p.arrival_time)}
      <div class="bar"><div class="fill" style="width:${Math.round((p.progress || 0) * 100)}%"></div></div>
    </div>` : "";
  return `
    <section class="panel panelBody">
      <h2>Ship / Location</h2>
      <div class="grid2">
        <div class="kv"><label>Ship</label><b>${esc(p.ship.name)}</b></div>
        <div class="kv"><label>Role</label><b>${esc(p.ship.role_profile?.name || p.ship.role || "Explorer")}</b></div>
        <div class="kv"><label>Tank</label><b>${esc(p.fuel_tank?.name || "Default")}</b></div>
        <div class="kv"><label>Scanner</label><b>${esc((state.scanner_modules || []).find(s => s.id === p.equipped_scanner)?.name || p.equipped_scanner || "Basic")}</b></div>
        <div class="kv"><label>Security</label><b>${loc.security ?? "Deep"}</b></div>
        <div class="kv"><label>Faction</label><b>${esc(loc.faction || "None")}</b></div>
        <div class="kv"><label>Economy</label><b>${esc(loc.economy || "Transit")}</b></div>
        <div class="kv"><label>Fuel Rule</label><b>${state.fuel_status === "emergency" ? "Emergency" : "Normal"}</b></div>
        <div class="kv"><label>Planet Rep</label><b>L${fmt(p.planet_rep?.level || 0)} / ${fmt(p.planet_rep?.xp || 0)} XP</b></div>
        <div class="kv"><label>Scan Radius</label><b>${fmt(p.scan_radius || 0)} / CD ${fmt(p.scan_cooldown_remaining || 0)}s</b></div>
      </div>
      ${travel}
      ${activeMissionPanel()}
      <p class="muted">Fuel does not modify combat. At 0 fuel, travel still works on emergency power at half speed, but jump gates are blocked.</p>
    </section>`;
}

function cargoPanel() {
  const goodsBy = Object.fromEntries(state.trade_goods.map(g => [g.code, g]));
  const rows = Object.entries(state.player.cargo_items || {}).map(([code, qty]) => {
    const g = goodsBy[code] || { name: code, icon: "?", category_name: "Unknown" };
    return `<div class="cargoRow"><span>${g.icon} ${esc(g.name)}</span><b>${qty}</b></div>`;
  }).join("") || `<p class="muted">Cargo empty.</p>`;
  const arts = artifactMiniList();
  return `<section class="panel panelBody"><h2>Cargo Hold</h2>${rows}${arts}<p class="muted">Trade goods are market cargo only. Unidentified artifacts are lost if your ship is destroyed.</p></section>`;
}


function activeMissionPanel() {
  const p = state.player;
  const c = p.active_cargo_contract;
  const e = p.active_escort_contract;
  let html = "";
  if (c) html += `<div class="missionMini"><b>Cargo Contract</b><small>${esc(c.qty)}x ${esc(c.cargo_name)} → ${esc(c.destination_name)} • ${timerText(c.expires_at)}</small><button onclick="apiAction('abandon_cargo_contract')">Abandon</button></div>`;
  if (e) html += `<div class="missionMini"><b>Escort Contract</b><small>${esc(e.escort_name)} → ${esc(e.destination_name)} • ${timerText(e.expires_at)}</small><button onclick="apiAction('abandon_escort_contract')">Abandon</button></div>`;
  if (p.bounty_locked) html += `<div class="missionMini dangerBox"><b>Bounty Lock</b><small>Own-faction kill lock: ship/equipment locked until bounty is claimed.</small></div>`;
  return html;
}

function artifactMiniList() {
  const p = state.player;
  const unknown = p.unidentified_artifacts || [];
  const active = p.active_identifications || [];
  const known = p.identified_artifacts || [];
  if (!unknown.length && !active.length && !known.length) return "";
  return `<div class="artifactBox"><h3>Artifacts</h3>
    ${unknown.map(a => `<div class="cargoRow"><span>◇ Unidentified Artifact</span><button onclick="apiAction('identify_artifact',{id:'${a.id}'})">Identify</button></div>`).join("")}
    ${active.map(a => `<div class="cargoRow"><span>⌛ Identifying ${esc(a.artifact_name)}</span><b>${timerText(a.complete_at)}</b></div>`).join("")}
    ${known.map(a => `<div class="cargoRow"><span>◆ ${esc(a.artifact_name)}</span><small>${esc(a.bonus)}</small></div>`).join("")}
  </div>`;
}

function contractsPage() {
  const cargo = state.available_contracts?.cargo || [];
  const escort = state.available_contracts?.escort || [];
  return `<div class="wideGrid">
    <section class="panel panelBody">
      <h2>Enemy-Territory Cargo Contracts</h2>
      <p class="muted">No short hauls. These require crossing into enemy territory. XP and money pay only on completion.</p>
      ${cargo.map(contractCard).join("") || `<p class="muted">No enemy-territory cargo contracts at this dock.</p>`}
    </section>
    <section class="panel panelBody">
      <h2>Escort Contracts</h2>
      <p class="muted">Escort joins your bubble, follows your movement, and can be targeted in combat. Timer maxes near two hours.</p>
      ${escort.map(escortCard).join("") || `<p class="muted">No escort contracts here.</p>`}
    </section>
    <section class="panel panelBody">${activeMissionPanel() || `<h2>No Active Contract</h2><p class="muted">Accept a cargo or escort route from an inhabitable planet.</p>`}</section>
  </div>`;
}

function contractCard(c) {
  return `<div class="contractCard">
    <b>${esc(c.cargo_name)} → ${esc(c.destination_name)}</b><span>L${fmt(c.level)}</span>
    <small>${esc(c.destination_galaxy)} • ${fmt(c.distance)} distance • ${c.deep_enemy ? "deep enemy territory" : "enemy border"}</small>
    <small>${fmt(c.qty)} units • reward ${fmt(c.reward)} cr • rep XP ${fmt(c.xp)} • timer ${Math.round(c.expires_in/60)}m</small>
    <button class="primary" ${state.player.active_cargo_contract ? "disabled" : ""} onclick="apiAction('accept_cargo_contract',{id:'${c.id}'})">Accept Cargo</button>
  </div>`;
}

function escortCard(c) {
  return `<div class="contractCard escortCard">
    <b>${esc(c.escort_name)} → ${esc(c.destination_name)}</b><span>L${fmt(c.level)}</span>
    <small>${esc(c.destination_galaxy)} • ${fmt(c.distance)} distance • combat target roll: 65% you / 35% escort</small>
    <small>reward ${fmt(c.reward)} cr • rep XP ${fmt(c.xp)} • timer ${Math.round(c.expires_in/60)}m</small>
    <button class="primary" ${state.player.active_escort_contract ? "disabled" : ""} onclick="apiAction('accept_escort_contract',{id:'${c.id}'})">Accept Escort</button>
  </div>`;
}

function scanPage() {
  const p = state.player;
  const scanner = (state.scanner_modules || []).find(s => s.id === p.equipped_scanner) || {};
  return `<div class="wideGrid">
    <section class="panel panelBody">
      <h2>Scanning / Probes</h2>
      <div class="grid2">
        <div class="kv"><label>Radar</label><b>${fmt(p.radar_range_effective)}</b></div>
        <div class="kv"><label>Area Scan Radius</label><b>${fmt(p.scan_radius)}</b></div>
        <div class="kv"><label>Cooldown</label><b>${fmt(p.scan_cooldown_remaining)}s remaining</b></div>
        <div class="kv"><label>Skill</label><b>${fmt(p.skills?.scanning || 0)}</b></div>
      </div>
      <p class="muted">Click blank map space outside radar and choose Scan Area. Blips show category only and clear after 30 seconds. Scan Object rolls 20%-80% success against counter modules.</p>
      <h3>Equipped: ${esc(scanner.name || p.equipped_scanner)}</h3>
      <p>${esc(scanner.desc || "")}</p>
    </section>
    <section class="panel panelBody">
      <h2>Scanner Modules</h2>
      ${(state.scanner_modules || []).map(s => `<div class="ruleBox"><b>${esc(s.name)} T${s.tier}</b><span>Radius ${fmt(s.radius)} • cooldown ${fmt(s.cooldown)}s • detail ${s.detail} • ${esc(s.desc)}</span></div>`).join("")}
    </section>
    <section class="panel panelBody">
      <h2>Active Blips</h2>
      ${(state.active_blips || []).map(b => `<div class="cargoRow"><span>${esc(b.icon || "•")} ${esc(b.name)} (${esc(b.blip_type)})</span><b>${timerText(b.expires_at)}</b></div>`).join("") || `<p class="muted">No active scan blips.</p>`}
    </section>
  </div>`;
}

function warPage() {
  const loc = state.player.location || {};
  const goodsBy = Object.fromEntries(state.trade_goods.map(g => [g.code, g]));
  const cargoRows = Object.entries(state.player.cargo_items || {}).map(([code, qty]) => {
    const g = goodsBy[code] || { name: code, icon: "?" };
    return `<div class="marketRow"><div><b>${g.icon || "□"} ${esc(g.name)}</b><small>Have ${fmt(qty)} • contribution based on value/tier</small></div><div></div><div></div><div class="rowBtns"><button onclick="apiAction('supply_war',{code:'${code}',qty:5})">Supply 5</button><button onclick="apiAction('supply_war',{code:'${code}',qty:${qty}})">Supply All</button></div></div>`;
  }).join("");
  const supply = Object.values(state.war_supply || {});
  return `<div class="wideGrid">
    <section class="panel panelBody marketPanelList"><h2>Supply The War</h2><p class="muted">Border galaxies only. Dump existing cargo/materials into your faction’s frontline pool for galaxy-local bonuses up to level 5.</p>${cargoRows || `<p class="muted">No cargo to contribute.</p>`}</section>
    <section class="panel panelBody"><h2>Current Border Bonuses</h2>${supply.map(warEntry).join("") || `<p class="muted">No war supply records yet.</p>`}</section>
    <section class="panel panelBody"><h2>Bonus Ladder</h2>${(state.war_bonus_levels || []).map(x => `<div class="ruleBox"><b>Level ${x.level}: ${esc(x.name)}</b><span>${esc(x.bonus)}</span></div>`).join("")}</section>
  </div>`;
}

function warEntry(w) {
  const g = state.galaxies.find(x => x.id === w.galaxy_id) || { name: w.galaxy_id };
  return `<div class="contractCard"><b>${esc(g.name)} • ${esc(w.faction_id)}</b><span>L${fmt(w.level)}</span><small>${fmt(w.points)} contribution • threshold ${fmt(w.threshold)}</small>${(w.bonuses || []).map(b => `<small>${esc(b.bonus)}</small>`).join("")}</div>`;
}

function bountiesPage() {
  const board = state.bounty_board || [];
  return `<div class="wideGrid">
    <section class="panel panelBody"><h2>Bounty Board</h2><p class="muted">NPC bounties are server-limited and never stack more than one per galaxy. Location intel updates every 30 minutes.</p>${board.map(bountyCard).join("") || `<p class="muted">No open bounties.</p>`}</section>
    <section class="panel panelBody"><h2>Post Player Bounty</h2><label class="adminInput"><span>Target callsign</span><input id="bountyTarget" value="Rival Pilot"></label><label class="adminInput"><span>Amount</span><input id="bountyAmount" value="5000"></label><button class="primary" onclick="postBounty()">Post + Burn 10% Fee</button></section>
  </div>`;
}

function bountyCard(b) {
  const age = Math.max(0, Math.round((nowServer() - (b.last_seen_at || nowServer())) / 60));
  return `<div class="contractCard bountyCard"><b>${esc(b.target_name)}</b><span>${fmt(b.reward)} cr</span><small>${esc(b.source)} bounty • Level ${esc(b.level)} • last seen ${esc(b.last_seen_galaxy)} • updated ${age}m ago</small><button onclick="apiAction('hunt_bounty',{id:'${b.id}'})">Hunt / Claim Attempt</button></div>`;
}

function postBounty() {
  apiAction('place_bounty', { target: document.getElementById('bountyTarget').value, amount: document.getElementById('bountyAmount').value });
}

function insurancePage() {
  const p = state.player;
  return `<div class="wideGrid">
    <section class="panel panelBody"><h2>Insurance / Recovery</h2><p class="muted">Insurance softens ship loss. Cargo rider protects a small cargo portion. Repeated payout has cooldown to block intentional safe-zone death loops.</p>${Object.entries(state.insurance_plans || {}).map(([id, plan]) => insuranceCard(id, plan)).join("")}</section>
    <section class="panel panelBody"><h2>Emergency Services</h2><div class="grid2"><div class="kv"><label>Current Plan</label><b>${esc((state.insurance_plans || {})[p.insurance_plan]?.name || "None")}</b></div><div class="kv"><label>Cooldown</label><b>${timerText(p.insurance_cooldown_until || nowServer())}</b></div></div><button class="danger" ${p.fuel > 0 ? "disabled" : ""} onclick="apiAction('emergency_tow')">Emergency Tow</button><p class="muted">Tow is expensive and only available at 0 fuel.</p></section>
    <section class="panel panelBody"><h2>Ship Role Restrictions</h2>${Object.entries(state.ship_roles || {}).map(([id, r]) => `<div class="ruleBox"><b>${esc(r.name)}</b><span>${esc(r.desc)} Weapons: ${(r.weapon_classes || []).join(", ")}</span></div>`).join("")}</section>
  </div>`;
}

function insuranceCard(id, plan) {
  const price = state.player.insurance_price?.[id] || 0;
  const active = state.player.insurance_plan === id;
  return `<div class="contractCard"><b>${esc(plan.name)}</b><span>${fmt(price)} cr</span><small>Ship recovery ${Math.round(plan.ship_pct*100)}% • cargo ${Math.round(plan.cargo_pct*100)}% • cooldown ${plan.cooldown_minutes}m</small><button ${active ? "disabled" : ""} onclick="apiAction('buy_insurance',{plan:'${id}'})">${active ? "Active" : "Buy"}</button></div>`;
}

function marketPage() {
  return `<div class="wideGrid">${marketPanel(true)}${cargoPanel()}${marketRulesPanel()}</div>`;
}

function marketPanel(full = false) {
  const loc = state.player.location || {};
  const rows = (state.local_market || []).filter(r => r.buyable || r.sellable).slice(0, full ? 48 : 10);
  return `
    <section class="panel panelBody marketPanelList">
      <h2>${esc(loc.name || "Local")} Market</h2>
      <p class="muted">Illicit goods removed. Trade goods are balanced per planet, with real profit pushed toward inter-galaxy hauling.</p>
      <div class="marketHeader"><span>Category / Good</span><span>Buy</span><span>Sell</span><span>Action</span></div>
      ${marketRowsHtml(rows)}
    </section>`;
}

function marketRowsHtml(rows) {
  if (!rows.length) return `<p class="muted">No market here.</p>`;
  let lastCategory = "";
  return rows.map(g => {
    const cat = g.category_name || g.category || "Trade";
    const header = cat !== lastCategory ? `<div class="marketCategoryHeader"><span>${g.category_icon || g.icon || "□"}</span><b>${esc(cat)}</b></div>` : "";
    lastCategory = cat;
    return header + marketRow(g);
  }).join("");
}

function marketRow(g) {
  const have = state.player.cargo_items?.[g.code] || 0;
  return `
    <div class="marketRow">
      <div><b>${g.category_icon || g.icon || "□"} ${esc(g.name)}</b><small>${esc(g.category_name || g.category)} • Stock ${fmt(g.stock)} • Demand ${fmt(g.demand)} • Have ${fmt(have)}</small></div>
      <div>${g.buyable ? fmt(g.buy_price) : "—"}</div>
      <div>${g.sellable ? fmt(g.sell_price) : "—"}</div>
      <div class="rowBtns">
        <button ${!g.buyable ? "disabled" : ""} onclick="apiAction('buy_trade',{code:'${g.code}',qty:5})">Buy 5</button>
        <button ${!g.sellable || have <= 0 ? "disabled" : ""} onclick="apiAction('sell_trade',{code:'${g.code}',qty:5})">Sell 5</button>
      </div>
    </div>`;
}

function marketRulesPanel() {
  const rules = state.storage_rules || {};
  return `
    <section class="panel panelBody">
      <h2>Economy Rules</h2>
      <div class="ruleBox"><b>Global</b><span>${(rules.global || []).join(", ")}</span></div>
      <div class="ruleBox"><b>Planet-scoped</b><span>${(rules.planet_scoped || []).join(", ")}</span></div>
      <div class="ruleBox"><b>Player trade</b><span>${esc(rules.player_trade)}</span></div>
      <div class="ruleBox"><b>Trade goods</b><span>${esc(rules.trade_goods)}</span></div>
    </section>`;
}

function fuelPage() {
  const p = state.player;
  const loc = p.location || {};
  const shop = loc.has_refuel_shop;
  const tanks = state.ship_parts.fuel_tanks || [];
  return `
    <div class="wideGrid">
      <section class="panel panelBody">
        <h2>Refueling</h2>
        <div class="grid2">
          <div class="kv"><label>Current Fuel</label><b>${fmt(p.fuel)} / ${fmt(p.max_fuel)}</b></div>
          <div class="kv"><label>Dock</label><b>${shop ? "Refuel shop available" : "No refuel shop"}</b></div>
          <div class="kv"><label>Burn Reduction</label><b>${Math.round((p.fuel_tank?.burn_reduction || 0) * 100)}%</b></div>
          <div class="kv"><label>Fuel Cost Discount</label><b>${Math.round((p.fuel_tank?.cost_discount || 0) * 100)}%</b></div>
        </div>
        <button class="primary" ${!shop ? "disabled" : ""} onclick="apiAction('refuel')">Refuel to Full</button>
        <p class="muted">Refueling exists only at inhabitable planets and stations. Jumping between galaxies burns no fuel, but requires fuel above 0.</p>
      </section>
      <section class="panel panelBody tankList">
        <h2>Fuel Tanks / Ship Parts</h2>
        ${tanks.map(t => tankCard(t)).join("")}
      </section>
    </div>`;
}

function tankCard(t) {
  const owned = state.player.owned_fuel_tanks?.includes(t.id);
  const equipped = state.player.equipped_fuel_tank === t.id;
  return `
    <div class="tankCard tier-${String(t.tier).toLowerCase()}">
      <div><b>${esc(t.name)}</b> <span class="tierBadge">${esc(t.tier)}</span><small>${esc(t.desc)}</small></div>
      <div class="tankStats">Cap ${fmt(t.capacity)} • Burn -${Math.round(t.burn_reduction * 100)}% • Fuel Cost -${Math.round(t.cost_discount * 100)}% • ${fmt(t.price)} cr</div>
      <div class="rowBtns">
        <button ${owned || t.id === "default_tank" ? "disabled" : ""} onclick="apiAction('buy_fuel_tank',{tank_id:'${t.id}'})">Buy</button>
        <button ${!owned || equipped ? "disabled" : ""} onclick="apiAction('equip_fuel_tank',{tank_id:'${t.id}'})">${equipped ? "Equipped" : "Equip"}</button>
      </div>
    </div>`;
}

function calendarPage() {
  const events = state.calendar || [];
  return `
    <div class="wideGrid">
      <section class="panel panelBody">
        <h2>Server Calendar</h2>
        ${events.map(ev => eventCard(ev)).join("")}
      </section>
      <section class="panel panelBody">
        <h2>Event Designs For Review</h2>
        ${(state.server_event_designs || []).map(d => `
          <div class="designCard"><b>${esc(d.name)}</b><small>${esc(d.cadence)} • warning ${d.warning_hours}h • duration ${d.duration_hours}h</small><p>${esc(d.summary)}</p></div>`).join("")}
      </section>
    </div>`;
}

function eventCard(ev) {
  const t = nowServer();
  const status = t >= ev.starts_at && t < ev.ends_at ? "ACTIVE" : t >= ev.warns_at && t < ev.starts_at ? "WARNING" : ev.design_only ? "DESIGN" : "UPCOMING";
  return `
    <div class="calendarCard ${status.toLowerCase()}">
      <b>${esc(ev.name)}</b><span>${status}</span>
      <small>Warn ${dateTime(ev.warns_at)} • Start ${dateTime(ev.starts_at)} • End ${dateTime(ev.ends_at)}</small>
    </div>`;
}

function adminPage() {
  if (!state.player.god_mode) return `<section class="panel panelBody"><h2>Admin only.</h2></section>`;
  const s = state.settings;
  return `
    <div class="wideGrid">
      <section class="panel panelBody adminPanel">
        <h2>World Baseline Settings</h2>
        <p class="muted">Planet and galaxy spacing use the baseline values below. Saving regenerates galaxies, planets, NPCs, signatures, and markets.</p>
        ${adminInput("planet_gap_multiplier", "Planet gap multiplier", s.planet_gap_multiplier)}
        ${adminInput("min_planet_gap", "Minimum planet gap", s.min_planet_gap)}
        ${adminInput("galaxy_gap_multiplier", "Galaxy gap multiplier", s.galaxy_gap_multiplier)}
        ${adminInput("min_galaxy_gap", "Minimum galaxy gap", s.min_galaxy_gap)}
        ${adminInput("market_item_count", "Trade good count", s.market_item_count)}
        ${adminInput("refuel_base_price", "Base fuel price", s.refuel_base_price)}
        <button class="primary" onclick="saveAdminSettings()">Save + Regenerate Layout</button>
        <button onclick="apiAction('admin_regenerate_world')">Regenerate With Current Settings</button>
        <button onclick="apiAction('admin_simulate_npc_events')">Simulate NPC Events In Current Galaxy</button>
      </section>
      ${marketRulesPanel()}
    </div>`;
}

function adminInput(id, label, value) {
  return `<label class="adminInput"><span>${label}</span><input id="admin_${id}" value="${value}"></label>`;
}

function saveAdminSettings() {
  const keys = ["planet_gap_multiplier", "min_planet_gap", "galaxy_gap_multiplier", "min_galaxy_gap", "market_item_count", "refuel_base_price"];
  const payload = {};
  keys.forEach(k => payload[k] = document.getElementById(`admin_${k}`).value);
  apiAction("admin_update_settings", payload);
}

function eventPanel() {
  return `
    <section class="panel panelBody">
      <h2>Event Log</h2>
      <ul class="events">${state.events.slice(0, 32).map(e => `<li>${esc(e)}</li>`).join("")}</ul>
    </section>`;
}

function contextMenu() {
  if (!context) return "";
  const x = Math.min(window.innerWidth - 240, context.screenX + 14);
  const y = Math.min(window.innerHeight - 280, context.screenY);
  return `<div class="context" style="left:${x}px;top:${y}px">${contextButtons()}</div>`;
}

function contextButtons() {
  const c = context;
  if (c.type === "blank") {
    if (mapMode === "galaxy") return `<div class="contextNote">Galaxy map is warp-only. Pick a destination galaxy.</div><button onclick="closeContext()">Cancel</button>`;
    return `<button onclick="apiAction('go_here',{x:${c.worldX},y:${c.worldY},map_type:mapMode});closeContext()">Go Here</button><button onclick="apiAction('scan_area',{x:${c.worldX},y:${c.worldY},map_type:mapMode});closeContext()">Scan Area</button><button onclick="closeContext()">Cancel</button>`;
  }
  if (c.type === "galaxy") {
    const g = state.galaxies.find(x => x.id === c.id);
    const isCurrent = g && g.id === currentGalaxyId();
    const locked = state.player.traveling;
    return `
      <button onclick="selectObject('galaxy','${c.id}');closeContext()">Inspect ${esc(g?.name || 'Galaxy')}</button>
      ${isCurrent ? `<button onclick="setMapMode('system');closeContext()">Open Planet View</button>` : `<button ${locked ? "disabled" : ""} onclick="apiAction('galaxy_travel',{galaxy_id:'${c.id}'});closeContext()">Travel To Galaxy</button>`}
      <button onclick="closeContext()">Cancel</button>`;
  }
  if (c.type === "planet") {
    const p = state.planets.find(x => x.id === c.id);
    const jump = state.player.location && state.player.location.galaxy_id !== p.galaxy_id;
    return `
      <button onclick="selectObject('planet','${c.id}');closeContext()">Inspect ${esc(p.name)}</button>
      <button onclick="apiAction('travel',{planet_id:'${c.id}'});closeContext()">${jump ? "Jump Gate Here" : "Travel Here"}</button>
      <button onclick="closeContext()">Cancel</button>`;
  }
  if (c.type === "npc") {
    const n = state.npcs.find(x => x.id === c.id);
    return `
      <button onclick="selectObject('npc','${c.id}');apiAction('inspect_npc',{id:'${c.id}'});closeContext()">Inspect ${esc(n.name)}</button>
      <button onclick="apiAction('scan_object',{id:'${c.id}'});closeContext()">Scan Object</button>
      <button onclick="apiAction('intercept',{id:'${c.id}'});closeContext()">Intercept</button>
      <button class="danger" onclick="apiAction('attack',{id:'${c.id}'});closeContext()">Attack</button>
      <button onclick="apiAction('follow',{id:'${c.id}'});closeContext()">Follow</button>
      <button onclick="closeContext()">Cancel</button>`;
  }
  if (c.type === "ore") {
    return `<button onclick="selectObject('sig','${c.id}');closeContext()">Inspect Ore</button><button onclick="apiAction('scan_object',{id:'${c.id}'});closeContext()">Scan Object</button><button onclick="apiAction('mine',{id:'${c.id}'});closeContext()">Mine</button><button onclick="closeContext()">Cancel</button>`;
  }
  if (c.type === "wreck") {
    return `<button onclick="selectObject('sig','${c.id}');closeContext()">Inspect Wreck</button><button onclick="apiAction('scan_object',{id:'${c.id}'});closeContext()">Scan Object</button><button onclick="apiAction('salvage',{id:'${c.id}'});closeContext()">Salvage</button><button onclick="closeContext()">Cancel</button>`;
  }
  if (c.type === "derelict") {
    return `<button onclick="selectObject('sig','${c.id}');closeContext()">Inspect Derelict</button><button onclick="apiAction('scan_object',{id:'${c.id}'});closeContext()">Scan Object</button><button onclick="apiAction('explore_derelict',{id:'${c.id}'});closeContext()">Dock / Explore</button><button onclick="closeContext()">Cancel</button>`;
  }
  if (c.type === "artifact") {
    return `<button onclick="selectObject('sig','${c.id}');closeContext()">Inspect Artifact</button><button onclick="apiAction('scan_object',{id:'${c.id}'});closeContext()">Scan Object</button><button onclick="apiAction('mine_artifact',{id:'${c.id}'});closeContext()">Recover Artifact</button><button onclick="closeContext()">Cancel</button>`;
  }
  if (c.type === "blip") {
    return `<button onclick="apiAction('scan_object',{id:'${c.id}'});closeContext()">Scan Blip</button><button onclick="apiAction('go_here',{x:${c.worldX||0},y:${c.worldY||0},map_type:mapMode});closeContext()">Move Toward Blip</button><button onclick="closeContext()">Cancel</button>`;
  }
  if (c.type === "event") {
    return `<button onclick="selectObject('event','${c.id}');closeContext()">Inspect Event</button><button onclick="closeContext()">Cancel</button>`;
  }
  return `<button onclick="closeContext()">Cancel</button>`;
}

function selectObject(type, id) { selected = { type, id }; render(); }
function closeContext() { context = null; render(); }
function timerText(epoch) { return `${Math.max(0, Math.ceil(epoch - nowServer()))}s`; }
function dateTime(epoch) { return new Date(epoch * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }

function zoomBy(factor) {
  view.z = Math.max(0.08, Math.min(1.6, view.z * factor));
  clampView();
  render();
}

function centerOnPlayer() {
  if (!state) return;
  const vp = document.getElementById("viewport");
  const w = vp?.clientWidth || window.innerWidth - 420;
  const h = vp?.clientHeight || window.innerHeight - 170;
  const p = state.player;
  let target = { x: p.render_x ?? p.x, y: p.render_y ?? p.y };
  if (mapMode === "galaxy" && !galaxyWarpActive()) {
    const g = currentGalaxy();
    target = { x: g.x ?? target.x, y: g.y ?? target.y };
  }
  if (mapMode === "system" && galaxyWarpActive()) {
    const pl = state.planets.find(x => x.id === p.location_id) || {};
    target = { x: pl.x ?? target.x, y: pl.y ?? target.y };
  }
  const x = wx(target.x), y = wy(target.y);
  view.x = w / 2 - x * view.z;
  view.y = h / 2 - y * view.z;
  clampView();
  didCenter = true;
}

function clampView() {
  const vp = document.getElementById("viewport");
  if (!vp) return;
  const w = vp.clientWidth, h = vp.clientHeight;
  const minX = Math.min(40, w - worldW() * view.z - 80);
  const minY = Math.min(40, h - worldH() * view.z - 80);
  view.x = Math.max(minX, Math.min(180, view.x));
  view.y = Math.max(minY, Math.min(180, view.y));
}

function screenToWorld(clientX, clientY) {
  const vp = document.getElementById("viewport");
  const rect = vp.getBoundingClientRect();
  return {
    x: (clientX - rect.left - view.x) / view.z + ox(),
    y: (clientY - rect.top - view.y) / view.z + oy(),
  };
}

function attachMapEvents() {
  const vp = document.getElementById("viewport");
  if (!vp) return;
  vp.onmousedown = e => {
    if (e.button !== 0) return;
    dragging = false;
    dragStart = { mx: e.clientX, my: e.clientY, vx: view.x, vy: view.y };
    vp.classList.add("dragging");
  };
  window.onmousemove = e => {
    if (!dragStart) return;
    const dx = e.clientX - dragStart.mx, dy = e.clientY - dragStart.my;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragging = true;
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
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    view.z = Math.max(0.08, Math.min(1.6, view.z * factor));
    const rect = vp.getBoundingClientRect();
    view.x = e.clientX - rect.left - (before.x - ox()) * view.z;
    view.y = e.clientY - rect.top - (before.y - oy()) * view.z;
    clampView();
    render();
  };
}

function handleMapClick(e) {
  const target = e.target.closest("[data-type]");
  if (target) {
    const w = screenToWorld(e.clientX, e.clientY);
    context = { type: target.dataset.type, id: target.dataset.id, worldX: Math.round(w.x), worldY: Math.round(w.y), screenX: e.clientX, screenY: e.clientY };
  } else {
    const w = screenToWorld(e.clientX, e.clientY);
    context = { type: "blank", worldX: Math.round(w.x), worldY: Math.round(w.y), screenX: e.clientX, screenY: e.clientY };
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

function exposeInlineHandlers() {
  Object.assign(window, {
    apiAction,
    loadState,
    setPage,
    logout,
    zoomBy,
    centerOnPlayer,
    selectObject,
    closeContext,
    saveAdminSettings,
    postBounty,
    setMapMode,
    toggleMapFilter,
  });
}
exposeInlineHandlers();

window.addEventListener("error", e => {
  const msg = String(e?.message || "");
  if (msg.includes("is not defined") && /apiAction|setPage|logout|zoomBy|centerOnPlayer|selectObject|closeContext|saveAdminSettings|postBounty|setMapMode|toggleMapFilter/.test(msg)) {
    exposeInlineHandlers();
  }
});

setInterval(() => {
  if (!state) return;
  loadState();
}, 3000);

setInterval(() => {
  if (!state || page !== "map") return;
  const entities = document.querySelector(".entities");
  const lanes = document.querySelector(".lanes");
  const top = document.querySelector(".topbar");
  const side = document.querySelector(".side");
  if (entities) entities.innerHTML = entitiesHtml();
  if (lanes) lanes.innerHTML = lanesSvg();
  if (top) top.outerHTML = topbar();
  if (side) side.innerHTML = detailPanel() + cargoPanel() + eventPanel();
}, 500);

if (token) loadState(); else render();
