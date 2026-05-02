
const API = "";
const app = document.getElementById("app") || document.getElementById("root");

let state = null;
let token = sessionStorage.getItem("nova_token") || localStorage.getItem("nova_token") || "";
if (token) sessionStorage.setItem("nova_token", token);
localStorage.removeItem("nova_token");
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
  territory: true,
  radar: true
};
let planetTab = localStorage.getItem("nova_planet_tab") || "overview";
let planetScope = localStorage.getItem("nova_planet_scope") || "planet";
let planetSearch = localStorage.getItem("nova_planet_search") || "";
let planetItemFilters = JSON.parse(localStorage.getItem("nova_planet_item_filters") || "null") || {
  ships: true,
  modules: true,
  cargo: true,
  raw_materials: true,
  crafting_materials: true,
  refined_materials: true,
  consumables: true,
  equipment: true,
  artifacts: true,
  other: true
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
function jsString(str) { return String(str ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n"); }
function uid() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }
const FACTION_COLOR_FALLBACKS = {
  orange: "#ffcf70",
  gold: "#ffd84d",
  yellow: "#ffe45e",
  red: "#ff3f55",
  crimson: "#ff3f55",
  purple: "#b071ff",
  violet: "#b071ff",
  grey: "#a7b0ba",
  gray: "#a7b0ba",
  blue: "#67e8f9",
  cyan: "#67e8f9",
  green: "#8cffb1",
  neutral: "#9fb7c7"
};

function cssColor(raw, fallback = "#9fb7c7") {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return fallback;
  if (value.startsWith("#")) return value;
  return FACTION_COLOR_FALLBACKS[value] || raw || fallback;
}

function hexToRgb(hex) {
  const clean = String(hex || "").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map(c => c + c).join("") : clean;
  const n = parseInt(full, 16);
  if (!Number.isFinite(n)) return { r: 159, g: 183, b: 199 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbaColor(raw, alpha = 1) {
  const rgb = hexToRgb(cssColor(raw));
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

function factionById(id) {
  return (state?.factions || []).find(f => String(f.id) === String(id));
}

function factionName(id, fallback = "Neutral") {
  return factionById(id)?.name || fallback;
}

function factionColor(id, fallback = "#9fb7c7") {
  const faction = factionById(id);
  return cssColor(faction?.color, fallback);
}

function mapNodeX(obj) {
  if (mapMode === "galaxy") return Number(obj?.x_pct ?? 50) / 100 * worldW();
  return wx(obj?.x);
}

function mapNodeY(obj) {
  if (mapMode === "galaxy") return Number(obj?.y_pct ?? 50) / 100 * worldH();
  return wy(obj?.y);
}

function systemMapX(obj) {
  if (obj?.x !== undefined && obj?.x !== null) return wx(obj.x);
  return wx(((Number(obj?.x_pct ?? 50) - 50) / 1.45) * 2.3);
}

function systemMapY(obj) {
  if (obj?.y !== undefined && obj?.y !== null) return wy(obj.y);
  return wy(((Number(obj?.y_pct ?? 50) - 50) / 1.45) * 2.3);
}

function galaxyNodeById(id) {
  return (state?.galaxy_map?.nodes || state?.galaxies || []).find(g => String(g.id) === String(id));
}

function systemNodeById(id) {
  return (state?.system_map?.nodes || state?.planets || []).find(p => String(p.id) === String(id));
}

function galaxyIntel(id) {
  return state?.galaxy_war_intel?.by_galaxy?.[String(id)] || null;
}

const NOVA_MODAL_FOCUSABLE = "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";

function novaModal(config = {}) {
  return new Promise(resolve => {
    const previousFocus = document.activeElement;
    const kind = config.kind || "info";
    const dangerous = kind === "danger";
    const overlay = document.createElement("div");
    overlay.className = `novaModalOverlay ${dangerous ? "danger" : kind}`;
    overlay.innerHTML = `
      <section class="novaModalShell ${dangerous ? "danger" : kind}" role="dialog" aria-modal="true" aria-labelledby="nova-modal-title" aria-describedby="nova-modal-message" tabindex="-1">
        <div class="novaModalHeader">
          <span class="novaModalIcon" aria-hidden="true">${dangerous ? "!" : "i"}</span>
          <div>
            <h2 id="nova-modal-title">${esc(config.title || (dangerous ? "Confirm Critical Action" : "Transmission"))}</h2>
            ${config.eyebrow ? `<small>${esc(config.eyebrow)}</small>` : ""}
          </div>
          ${config.allowClose === false ? "" : `<button type="button" class="novaModalClose" data-cancel aria-label="Close">×</button>`}
        </div>
        <p id="nova-modal-message" class="novaModalMessage">${esc(config.message || "")}</p>
        ${config.confirmationPhrase ? `<label class="novaModalField"><span>${esc(config.inputLabel || `Type ${config.confirmationPhrase} to confirm`)}</span><input data-modal-input placeholder="${esc(config.confirmationPhrase)}" autocomplete="off"></label><div class="novaModalHint" data-modal-hint>Confirmation phrase must match exactly.</div>` : ""}
        <div class="novaModalActions">
          ${kind === "info" ? "" : `<button type="button" class="novaModalSecondary" data-cancel>${esc(config.cancelLabel || "Cancel")}</button>`}
          <button type="button" class="novaModalPrimary" data-accept>${esc(config.confirmLabel || (kind === "info" ? "Acknowledge" : "Confirm"))}</button>
        </div>
      </section>`;
    const shell = overlay.querySelector(".novaModalShell");
    const input = overlay.querySelector("[data-modal-input]");
    const accept = overlay.querySelector("[data-accept]");
    const hint = overlay.querySelector("[data-modal-hint]");
    const expected = String(config.confirmationPhrase || "");
    const canAccept = () => !expected || String(input?.value || "").trim() === expected;
    const syncAccept = () => {
      accept.disabled = !canAccept();
      if (hint) hint.style.display = canAccept() ? "none" : "block";
    };
    const finish = (value) => {
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      previousFocus?.focus?.();
      resolve(value);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape" && config.allowEscape !== false) {
        event.preventDefault();
        finish(kind === "info" ? undefined : false);
        return;
      }
      if (event.key === "Enter" && canAccept()) {
        event.preventDefault();
        finish(kind === "info" ? undefined : true);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(shell.querySelectorAll(NOVA_MODAL_FOCUSABLE)).filter(el => el.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        shell.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    overlay.querySelectorAll("[data-cancel]").forEach(btn => btn.addEventListener("click", () => finish(false)));
    accept.addEventListener("click", () => {
      if (canAccept()) finish(kind === "info" ? undefined : true);
    });
    input?.addEventListener("input", syncAccept);
    syncAccept();
    document.body.appendChild(overlay);
    document.addEventListener("keydown", onKeyDown);
    setTimeout(() => (input || accept || shell).focus(), 0);
  });
}

function showInfoDialog(message, options = {}) {
  return novaModal({kind:"info", message, ...options});
}

function askCriticalDialog(message, options = {}) {
  return novaModal({kind:"danger", message, confirmationPhrase:"DELETE", ...options});
}

async function apiAction(type, payload = {}) {
  const res = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ type, payload, nonce: uid() })
  });
  let data = {};
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    await showInfoDialog(data.detail || data.result?.error || "Action failed", {title:"Action Failed"});
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
        <input id="u" value="" placeholder="callsign">
        <input id="p" value="" placeholder="password" type="password">
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
    if (!res.ok) { await showInfoDialog(data.detail || "Login failed", {title:"Login Failed"}); return; }
    token = data.token;
    sessionStorage.setItem("nova_token", token);
    localStorage.removeItem("nova_token");
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
          <button class="danger" onclick="askCriticalDialog('Reset Universe? This permanently clears the current universe state.', {title:'Reset Universe', eyebrow:'Permanent action', confirmLabel:'Reset', confirmationPhrase:'RESET', inputLabel:'Type RESET to confirm'}).then(ok => ok && apiAction('reset'))">Reset Universe</button>
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
  const travel = state.travel_state || {};
  const busy = (p.traveling || travel.active)
    ? `${(travel.mode || p.travel_mode || "travel").toUpperCase()} ${Math.round(Number(travel.progress_pct ?? (p.progress || 0) * 100))}%`
    : (mapMode === "galaxy" ? "YOU ARE HERE" : "DOCKED");
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
  return galaxyNodeById(gid) || state?.galaxies?.find(g => g.id === gid) || state?.galaxies?.[0] || {};
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

function setMapFilters(value) {
  Object.keys(mapFilters).forEach(key => mapFilters[key] = !!value);
  localStorage.setItem("nova_map_filters", JSON.stringify(mapFilters));
  render();
}

function setPlanetTab(tab) {
  planetTab = ["overview", "refining", "crafting", "storage", "inventory"].includes(tab) ? tab : "overview";
  localStorage.setItem("nova_planet_tab", planetTab);
  render();
}

function setPlanetScope(scope) {
  planetScope = scope === "everywhere" ? "everywhere" : "planet";
  localStorage.setItem("nova_planet_scope", planetScope);
  render();
}

function togglePlanetItemFilter(key) {
  planetItemFilters[key] = !planetItemFilters[key];
  localStorage.setItem("nova_planet_item_filters", JSON.stringify(planetItemFilters));
  render();
}

function setPlanetItemFilters(value) {
  Object.keys(planetItemFilters).forEach(key => planetItemFilters[key] = !!value);
  localStorage.setItem("nova_planet_item_filters", JSON.stringify(planetItemFilters));
  render();
}

function setPlanetSearch(value) {
  planetSearch = String(value || "");
  localStorage.setItem("nova_planet_search", planetSearch);
  render();
}

function iconScale() {
  return Math.max(1, Math.min(4.5, 1 / Math.max(view.z, 0.18)));
}

function galaxyWarpActive() {
  const p = state?.player || {};
  const travel = state?.travel_state || {};
  const mode = String(travel.mode || p.travel_mode || "").toLowerCase();
  return !!((travel.active || p.traveling) && ["galaxy", "galaxy_route"].includes(mode));
}

function activeGateCountdownForGalaxy(galaxyId) {
  const travel = state?.travel_state || {};
  if (mapMode !== "galaxy" || travel.mode !== "galaxy_route") return "";
  const segment = (travel.route_segments || [])[Number(travel.route_segment_index) || 0] || {};
  if (String(segment.from_galaxy_id || travel.origin_galaxy_id) !== String(galaxyId)) return "";
  const remaining = Math.max(0, Number(travel.remaining_seconds || 0));
  const status = String(travel.gate_jump_status || "").toLowerCase();
  const label = status === "waiting" ? "Gate wait" : status === "initiating" ? "Jump in" : "Gate jump";
  return `<small class="gateCountdown">${label} ${Math.ceil(remaining)}s</small>`;
}

function playerSpawnImmunityActive() {
  return Number(state?.travel_state?.spawn_immunity_remaining_seconds || 0) > 0;
}

function galaxyPctToWorldPoint(xPct, yPct) {
  return {
    x: ox() + (Number(xPct ?? 50) / 100) * worldW(),
    y: oy() + (Number(yPct ?? 50) / 100) * worldH()
  };
}

function systemPctToWorldPoint(xPct, yPct) {
  return {
    x: ((Number(xPct ?? 50) - 50) / 1.45) * 2.3,
    y: ((Number(yPct ?? 50) - 50) / 1.45) * 2.3
  };
}

function playerRenderPoint() {
  const p = state?.player || {};
  const travel = state?.travel_state || {};
  if (mapMode === "galaxy" && travel.map_type === "galaxy" && travel.origin_x_pct !== undefined && travel.destination_x_pct !== undefined) {
    const progress = Math.max(0, Math.min(1, Number(travel.progress || 0)));
    const x = Number(travel.origin_x_pct || 50) + (Number(travel.destination_x_pct || 50) - Number(travel.origin_x_pct || 50)) * progress;
    const y = Number(travel.origin_y_pct || 50) + (Number(travel.destination_y_pct || 50) - Number(travel.origin_y_pct || 50)) * progress;
    return galaxyPctToWorldPoint(x, y);
  }
  if (mapMode === "system") {
    if (travel.active && travel.map_type === "system" && travel.origin_x_pct !== undefined && travel.destination_x_pct !== undefined) {
      const progress = Math.max(0, Math.min(1, Number(travel.progress || 0)));
      const x = Number(travel.origin_x_pct || 50) + (Number(travel.destination_x_pct || 50) - Number(travel.origin_x_pct || 50)) * progress;
      const y = Number(travel.origin_y_pct || 50) + (Number(travel.destination_y_pct || 50) - Number(travel.origin_y_pct || 50)) * progress;
      return systemPctToWorldPoint(x, y);
    }
    if (travel.open_space && travel.open_space_x_pct !== undefined) {
      return systemPctToWorldPoint(travel.open_space_x_pct, travel.open_space_y_pct);
    }
    const current = state.planets?.find(pl => String(pl.id) === String(p.location_id || p.location_planet_id));
    if (current) return { x: current.x, y: current.y };
  }
  return { x: p.render_x ?? p.x ?? 0, y: p.render_y ?? p.y ?? 0 };
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
        <button class="mapFilter filterBulk" onclick="setMapFilters(true)">Check All</button>
        <button class="mapFilter filterBulk" onclick="setMapFilters(false)">Uncheck All</button>
        ${mapFilterButton("galaxies", "Galaxies")}
        ${mapFilterButton("planets", "Planets")}
        ${mapFilterButton("ships", "Ships")}
        ${mapFilterButton("mining", "Mining")}
        ${mapFilterButton("wrecks", "Wrecks")}
        ${mapFilterButton("derelicts", "Derelicts")}
        ${mapFilterButton("artifacts", "Artifacts")}
        ${mapFilterButton("events", "Events")}
        ${mapFilterButton("blips", "Scan Blips")}
        ${mapFilterButton("territory", "Territory")}
        ${mapFilterButton("lanes", "Lanes")}
        ${mapFilterButton("radar", "Radar")}
      </div>
      <div id="viewport" class="viewport ${mapMode === "galaxy" ? "galaxyView" : "systemView"}">
        <div id="world" class="world" style="width:${worldW()}px;height:${worldH()}px;--icon-scale:${iconScale()};transform:translate(${view.x}px, ${view.y}px) scale(${view.z})">
          <div class="stars"></div>
          <div class="territory">${territorySvg()}</div>
          <div class="lanes">${lanesSvg()}</div>
          <div class="entities">${entitiesHtml()}</div>
        </div>
      </div>
    </section>`;
}

function mapFilterButton(key, label) {
  return `<button class="mapFilter ${mapFilters[key] ? "on" : "off"}" onclick="toggleMapFilter('${key}')">${label}</button>`;
}

function convexHull(points) {
  const uniq = [...new Map(points.map(p => [`${Math.round(p.x)}:${Math.round(p.y)}`, p])).values()]
    .sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
  if (uniq.length <= 2) return uniq;
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const p of uniq) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = uniq.length - 1; i >= 0; i--) {
    const p = uniq[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function factionTerritoryGroups() {
  const groups = {};
  if (mapMode === "galaxy") {
    for (const g of (state.galaxy_map?.nodes || state.galaxies || [])) {
      const intel = galaxyIntel(g.id);
      const owner = intel?.owner_faction || factionById(g.faction_id) || {};
      const key = String(owner.id || g.faction_id || "neutral");
      if (!groups[key]) groups[key] = { key, name: owner.name || g.faction_name || g.faction || "Neutral", color: cssColor(owner.color || g.faction_color || g.color), points: [], hot: false };
      groups[key].points.push({ x: mapNodeX(g), y: mapNodeY(g), status: intel?.war_state || g.territory_status || "peace" });
      groups[key].hot ||= ["active_war", "contested", "mobilizing"].includes(intel?.war_state || "");
    }
  } else {
    const nodes = state.system_map?.nodes?.filter(n => n.kind === "planet") || state.planets.filter(p => p.galaxy_id === currentGalaxyId());
    for (const p of nodes) {
      const owner = p.owner_faction || factionById(p.controlling_faction_id || p.faction_id) || {};
      const key = String(owner.id || p.controlling_faction_id || p.faction_id || "neutral");
      if (!groups[key]) groups[key] = { key, name: owner.name || p.faction_name || "Neutral", color: cssColor(owner.color || p.faction_color || factionColor(key)), points: [], hot: false };
      groups[key].points.push({ x: systemMapX(p), y: systemMapY(p), status: p.territory_status || "secure" });
      groups[key].hot ||= ["war", "contested"].includes(p.territory_status || "");
    }
  }
  return Object.values(groups).filter(g => g.points.length);
}

function territorySvg() {
  if (!mapFilters.territory) return `<svg style="width:${worldW()}px;height:${worldH()}px"></svg>`;
  const shapes = [];
  const pad = mapMode === "galaxy" ? 620 : 58;
  for (const group of factionTerritoryGroups()) {
    const samples = [];
    for (const p of group.points) {
      const hot = ["war", "contested", "active_war", "mobilizing"].includes(p.status);
      const r = hot ? pad * 1.12 : pad;
      for (let i = 0; i < 12; i++) {
        const a = (Math.PI * 2 * i) / 12;
        samples.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r });
      }
      shapes.push(`<circle class="territoryCore ${hot ? "hot" : ""}" cx="${p.x}" cy="${p.y}" r="${Math.max(20, pad * .24)}" fill="${rgbaColor(group.color, hot ? .28 : .16)}" stroke="${rgbaColor(group.color, .62)}"/>`);
    }
    const hull = convexHull(samples);
    const points = hull.map(p => `${Math.round(p.x)},${Math.round(p.y)}`).join(" ");
    if (points) {
      shapes.unshift(`<polygon class="territoryZone ${group.hot ? "hot" : ""}" points="${points}" fill="${rgbaColor(group.color, group.hot ? .22 : .13)}" stroke="${rgbaColor(group.color, group.hot ? .92 : .72)}"/>`);
    }
  }
  return `<svg class="territorySvg" style="width:${worldW()}px;height:${worldH()}px">${shapes.join("")}</svg>`;
}

function lanesSvg() {
  if (!mapFilters.lanes) return `<svg style="width:${worldW()}px;height:${worldH()}px"></svg>`;
  const lines = [];
  if (mapMode === "galaxy") {
    for (const lane of (state.galaxy_map?.lanes || [])) {
      const a = galaxyNodeById(lane.from);
      const b = galaxyNodeById(lane.to);
      if (!a || !b) continue;
      lines.push(`<line class="jumpLane ${lane.visited ? "visited" : ""} ${lane.active ? "active" : ""}" x1="${mapNodeX(a)}" y1="${mapNodeY(a)}" x2="${mapNodeX(b)}" y2="${mapNodeY(b)}"/>`);
    }
  } else {
    const lanes = state.system_map?.lanes || [];
    if (lanes.length) {
      for (const lane of lanes) {
        const a = systemNodeById(lane.from);
        const b = systemNodeById(lane.to);
        if (!a || !b) continue;
        lines.push(`<line class="lane ${lane.gate ? "gateLane" : ""} ${lane.visited ? "visited" : ""} ${lane.active ? "active" : ""}" x1="${systemMapX(a)}" y1="${systemMapY(a)}" x2="${systemMapX(b)}" y2="${systemMapY(b)}"/>`);
      }
    } else {
      const gid = currentGalaxyId();
      const planets = state.planets.filter(p => p.galaxy_id === gid);
      for (let i = 0; i < planets.length; i++) {
        for (let j = i + 1; j < planets.length; j++) {
          const a = planets[i], b = planets[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < (state.settings?.min_planet_gap || 80) * 3.0) lines.push(`<line class="lane" x1="${wx(a.x)}" y1="${wy(a.y)}" x2="${wx(b.x)}" y2="${wy(b.y)}"/>`);
        }
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
  const galaxyNodes = state.galaxy_map?.nodes || state.galaxies || [];
  const galaxies = showGalaxyNodes ? galaxyNodes.map(g => {
    const intel = galaxyIntel(g.id);
    const owner = intel?.owner_faction || factionById(g.faction_id) || {};
    const color = cssColor(owner.color || g.faction_color || g.color);
    const gateCountdown = activeGateCountdownForGalaxy(g.id);
    return `
    <div class="galaxy ${g.type || ""} ${intel?.war_state || ""} ${g.id === currentGid ? "currentGalaxy" : ""}" style="left:${mapNodeX(g)}px;top:${mapNodeY(g)}px;border-color:${color};--faction-color:${color};--icon-scale:${Math.max(1, scale * .45)};" data-type="galaxy" data-id="${g.id}">
      <div class="galaxyRing"></div>
      <b>${esc(g.name)}</b><small>${esc(owner.name || g.faction_name || g.faction || "Neutral")}</small>${intel ? `<small class="warState">${esc(intel.war_label)}</small>` : ""}${g.id === currentGid && !galaxyWarpActive() ? `<small class="youHere">You are here</small>` : ""}${gateCountdown}
    </div>`;
  }).join("") : "";
  const systemNodesById = Object.fromEntries((state.system_map?.nodes || []).map(n => [String(n.id), n]));
  const visiblePlanets = state.planets.filter(pl => pl.galaxy_id === currentGid);
  const nodes = showPlanetNodes ? visiblePlanets.map(pl => {
    const intel = systemNodesById[String(pl.id)] || pl;
    const color = cssColor(intel.faction_color || factionColor(intel.faction_id || pl.faction_id));
    return `
    <div class="node ${pl.id === p.location_id ? "current" : ""} ${pl.inhabitable ? "inhabitable" : "wild"} ${intel.territory_status || ""}" style="left:${wx(pl.x)}px;top:${wy(pl.y)}px;--faction-color:${color};--icon-scale:${scale};" data-type="planet" data-id="${pl.id}">
      <div class="name">${esc(pl.name)}</div>
      <small><span class="miniFactionDot" style="background:${color}"></span>${esc(intel.faction_name || factionName(pl.faction_id))}${intel.territory_status && intel.territory_status !== "secure" ? ` / ${esc(intel.territory_status)}` : ""}</small>
      <small>${esc(pl.kind)} ${pl.has_refuel_shop ? "• Fuel" : ""}</small>
      <small>Sec ${pl.security} • Market ${pl.market}</small>
    </div>`;
  }).join("") : "";
  const playerPoint = playerRenderPoint();
  const px = playerPoint.x, py = playerPoint.y;
  const renderPlayer = playerShouldRenderOnCurrentMap();
  const radar = renderPlayer && mapMode === "system" && mapFilters.radar ? `<div class="radarRing" style="left:${wx(px)}px;top:${wy(py)}px;width:${(p.radar_range_effective||640)*2}px;height:${(p.radar_range_effective||640)*2}px"></div>` : "";
  const player = renderPlayer ? `<div class="player entityShip playerShip ${playerSpawnImmunityActive() ? "spawnImmune" : ""}" title="Player" style="left:${wx(px)}px;top:${wy(py)}px;--icon-scale:${scale};"><span class="avatar">◎</span><span class="lvl">${fmt(p.level || 1)}</span><span class="guild">${esc(p.guild_tag || "YOU")}</span><b>◆</b></div>` : "";
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

function statBar(label, value, color = "var(--accent)", inverse = false) {
  const pctValue = Math.max(0, Math.min(100, Number(value || 0)));
  const fill = inverse ? 100 - pctValue : pctValue;
  return `<div class="inspectStat"><span>${esc(label)}</span><b>${fmt(pctValue)}</b><div class="miniBar"><i style="width:${fill}%;background:${color}"></i></div></div>`;
}

function buffText(buff) {
  const entries = Object.entries(buff || {});
  if (!entries.length) return "No active supply buff";
  return entries.map(([k, v]) => `${k.replaceAll("_", " ")} ${Number(v) >= 0 ? "+" : ""}${v}`).join(", ");
}

function laneRowsForGalaxy(galaxyId) {
  const lanes = (state.galaxy_map?.lanes || []).filter(l => String(l.from) === String(galaxyId) || String(l.to) === String(galaxyId));
  return lanes.map(l => {
    const otherId = String(l.from) === String(galaxyId) ? l.to : l.from;
    const g = galaxyNodeById(otherId) || {};
    const intel = galaxyIntel(otherId);
    const owner = intel?.owner_faction || factionById(g.faction_id) || {};
    const color = cssColor(owner.color || g.faction_color || g.color);
    return `<div class="laneIntel"><span class="miniFactionDot" style="background:${color}"></span><b>${esc(g.name || `Galaxy ${otherId}`)}</b><small>${esc(owner.name || "Neutral")} / ${esc(intel?.war_label || "At Peace")}</small><em>${l.active ? "ACTIVE" : l.visited ? "VISITED" : "GATE"}</em></div>`;
  }).join("") || `<p class="muted">No gate lanes found for this galaxy.</p>`;
}

function selectedInspectPanel() {
  if (!selected || selected.type === "none") return "";
  if (selected.type === "galaxy") return galaxyInspectPanel(selected.id);
  if (selected.type === "planet") return planetInspectPanel(selected.id);
  return "";
}

function galaxyInspectPanel(id) {
  const g = galaxyNodeById(id) || state.galaxies.find(x => String(x.id) === String(id)) || {};
  const intel = galaxyIntel(id);
  const owner = intel?.owner_faction || factionById(g.faction_id) || {};
  const color = cssColor(owner.color || g.faction_color || g.color);
  const controlRows = (intel?.control_breakdown || []).map(row => {
    const c = cssColor(row.faction?.color);
    return `<div class="controlRow"><span class="miniFactionDot" style="background:${c}"></span><b>${esc(row.faction?.name || "Unknown")}</b><div class="miniBar"><i style="width:${row.percent}%;background:${c}"></i></div><em>${fmt(row.planets)} / ${row.percent}%</em></div>`;
  }).join("") || `<p class="muted">No planet control data yet.</p>`;
  const buffs = (intel?.supply?.buffs || []).map(b => `<div class="buffPill"><b>${esc(b.planet_name || "Supply")}</b><span>T${fmt(b.tier)} ${esc(buffText(b.buff))}</span></div>`).join("") || `<p class="muted">No active war supply buffs.</p>`;
  const planetRows = (intel?.planets || []).map(pl => {
    const pc = cssColor(pl.owner_faction?.color);
    return `<div class="planetControlRow ${pl.territory_status}">
      <div><span class="miniFactionDot" style="background:${pc}"></span><b>${esc(pl.name)}</b><small>${esc(pl.owner_faction?.name || "Neutral")} / ${esc(pl.territory_status || "secure")}${pl.contested_by_faction ? ` vs ${esc(pl.contested_by_faction.name)}` : ""}</small></div>
      <div class="inspectStats">${statBar("Sec", pl.security, "#8cffb1")}${statBar("Stab", pl.stability, "#67e8f9")}${statBar("Conflict", pl.conflict, "#ff7d7d")}</div>
      <small>Supply T${fmt(pl.supply?.tier)} / ${fmt(pl.supply?.points)} pts / Tax ${Math.round((pl.tax_rate || 0) * 100)}%</small>
    </div>`;
  }).join("") || `<p class="muted">No planets registered in this galaxy.</p>`;
  return `<section class="panel panelBody inspectPanel" style="--faction-color:${color}">
    <div class="inspectHeader"><div><h2>${esc(g.name || "Galaxy")}</h2><small><span class="miniFactionDot" style="background:${color}"></span>${esc(owner.name || "Neutral")} / ${esc(intel?.war_label || "At Peace")}</small></div><button onclick="selectObject('none','')">Close</button></div>
    <div class="grid2">
      <div class="kv"><label>War State</label><b>${esc(intel?.war_label || "At Peace")}</b></div>
      <div class="kv"><label>War Supply</label><b>T${fmt(intel?.supply?.max_tier || 0)} / ${fmt(intel?.supply?.points || 0)} pts</b></div>
      <div class="kv"><label>Planets</label><b>${fmt(intel?.planet_count || 0)}</b></div>
      <div class="kv"><label>Frontline</label><b>${fmt((intel?.war_planets || 0) + (intel?.contested_planets || 0))}</b></div>
    </div>
    <h3>Zones Of Control</h3>${controlRows}
    <h3>Lanes To Each Galaxy</h3><div class="laneIntelList">${laneRowsForGalaxy(id)}</div>
    <h3>War Supply Buffs</h3>${buffs}
    <h3>Planet Control</h3><div class="planetControlList">${planetRows}</div>
  </section>`;
}

function planetInspectPanel(id) {
  const pl = state.planets.find(x => String(x.id) === String(id)) || {};
  const node = systemNodeById(id) || pl;
  const ownerId = node.controlling_faction_id || node.faction_id || pl.faction_id;
  const color = cssColor(node.faction_color || factionColor(ownerId));
  const tab = ["overview", "refining", "crafting", "storage", "inventory"].includes(planetTab) ? planetTab : "overview";
  return `<section class="panel panelBody inspectPanel" style="--faction-color:${color}">
    <div class="inspectHeader"><div><h2>${esc(pl.name || node.name || "Planet")}</h2><small><span class="miniFactionDot" style="background:${color}"></span>${esc(node.faction_name || factionName(ownerId))} / ${esc(node.territory_status || "secure")}</small></div><button onclick="selectObject('none','')">Close</button></div>
    <div class="planetTabs">
      ${planetTabButton("overview", "Overview", tab)}
      ${planetTabButton("refining", "Refining", tab)}
      ${planetTabButton("crafting", "Crafting", tab)}
      ${planetTabButton("storage", "Storage", tab)}
      ${planetTabButton("inventory", "Inventory", tab)}
    </div>
    ${planetTabContent(tab, pl, node)}
  </section>`;
}

function planetTabButton(id, label, active) {
  return `<button class="planetTab ${active === id ? "activeTool" : ""}" onclick="setPlanetTab('${id}')">${label}</button>`;
}

function planetTabContent(tab, pl, node) {
  if (tab === "refining") return planetProductionTab(pl, node, "refining");
  if (tab === "crafting") return planetProductionTab(pl, node, "crafting");
  if (tab === "storage") return planetStorageTab(pl);
  if (tab === "inventory") return planetInventoryTab(pl);
  return planetOverviewTab(pl, node);
}

function planetOverviewTab(pl, node) {
  return `
    <div class="inspectStats">${statBar("Security", pl.security_level ?? node.security_level, "#8cffb1")}${statBar("Stability", pl.stability_level ?? node.stability_level, "#67e8f9")}${statBar("Market", pl.market_activity ?? node.market_activity, "#ffcf70")}${statBar("Pirates", pl.pirate_activity ?? node.pirate_activity, "#ff7d7d")}${statBar("Conflict", pl.conflict_level ?? node.conflict_level, "#ff7d7d")}</div>
    <div class="grid2">
      <div class="kv"><label>Controller</label><b>${esc(pl.controller_type || "npc")}</b></div>
      <div class="kv"><label>Supply</label><b>T${fmt(node.territory_supply_tier || 0)}</b></div>
      <div class="kv"><label>Border</label><b>${node.is_border_system ? "Yes" : "No"}</b></div>
      <div class="kv"><label>Tax</label><b>${Math.round((pl.tax_rate || 0) * 100)}%</b></div>
    </div>
    <h3>Supply Buff</h3><p class="muted">${esc(buffText(node.territory_supply_buff || {}))}</p>`;
}

function currentPlanetIdValue() {
  const p = state?.player || {};
  return p.location_planet_id ?? p.location_id ?? p.location?.id ?? state?.location?.id;
}

function planetScopeBar(pl, includeFilters = true) {
  return `
    <div class="planetFilterPanel">
      <div class="planetScopeRow">
        <button class="mapFilter ${planetScope === "planet" ? "on" : "off"}" onclick="setPlanetScope('planet')">This Planet</button>
        <button class="mapFilter ${planetScope === "everywhere" ? "on" : "off"}" onclick="setPlanetScope('everywhere')">Everywhere</button>
        <input class="planetSearch" value="${esc(planetSearch)}" placeholder="Search items, ships, recipes..." oninput="setPlanetSearch(this.value)">
      </div>
      ${includeFilters ? planetItemFilterBar() : ""}
    </div>`;
}

function planetItemFilterBar() {
  const labels = [
    ["ships", "Ships"],
    ["modules", "Modules"],
    ["cargo", "Cargo"],
    ["raw_materials", "Raw"],
    ["crafting_materials", "Crafting Mats"],
    ["refined_materials", "Refined"],
    ["consumables", "Consumables"],
    ["equipment", "Equipment"],
    ["artifacts", "Artifacts"],
    ["other", "Other"]
  ];
  return `<div class="mapFilterBar planetItemFilters">
    <button class="mapFilter filterBulk" onclick="setPlanetItemFilters(true)">Check All</button>
    <button class="mapFilter filterBulk" onclick="setPlanetItemFilters(false)">Uncheck All</button>
    ${labels.map(([key, label]) => `<button class="mapFilter ${planetItemFilters[key] ? "on" : "off"}" onclick="togglePlanetItemFilter('${key}')">${label}</button>`).join("")}
  </div>`;
}

function isSelectedPlanetScope(row, planetId) {
  if (planetScope === "everywhere") return true;
  const id = row?.planet_id ?? row?.location_planet_id ?? row?.planetId ?? row?.locationPlanetId;
  return String(id) === String(planetId);
}

function itemBucket(row) {
  const category = String(row?.category || row?.item_category || "").toLowerCase();
  const type = String(row?.item_type || row?.type || row?.role || "").toLowerCase();
  const source = String(row?.source || "").toLowerCase();
  const kind = String(row?.kind || "").toLowerCase();
  if (kind === "ship" || category === "ships" || type.includes("ship_template")) return "ships";
  if (category === "ship_modules" || type.includes("module") || source.includes("module")) return "modules";
  if (source === "cargo_hold" || row?.trade_only || category === "goods" || category === "illicit_goods") return "cargo";
  if (category === "raw_materials") return "raw_materials";
  if (category === "crafting_materials" || category === "salvage") return "crafting_materials";
  if (category === "refined_materials" || type.includes("refined")) return "refined_materials";
  if (category === "consumables" || category === "fuel_supplies") return "consumables";
  if (category === "weapons" || category === "armor" || category === "ship_parts") return "equipment";
  if (category === "rare_artifacts" || type.includes("artifact") || type.includes("relic")) return "artifacts";
  return "other";
}

function rowMatchesPlanetFilters(row) {
  const bucket = itemBucket(row);
  if (!planetItemFilters[bucket]) return false;
  const q = planetSearch.trim().toLowerCase();
  if (!q) return true;
  return [
    row?.name, row?.item_name, row?.item_code, row?.recipe_name, row?.category,
    row?.item_type, row?.rarity, row?.location_name, row?.planet_name, row?.galaxy_name
  ].some(value => String(value || "").toLowerCase().includes(q));
}

function isRefiningRecipe(recipe) {
  const category = String(recipe?.category || "").toLowerCase();
  const output = recipe?.output || {};
  const outputCategory = String(output.category || output.item_type || "").toLowerCase();
  return !!recipe?.requires_refinery || category.includes("refining") || outputCategory === "refined_materials" || outputCategory.includes("refined");
}

function recipeOutputBucket(recipe) {
  const output = recipe?.output || {};
  return itemBucket({
    category: output.category || output.item_type || recipe?.category,
    item_type: output.item_type || output.kind || output.module_code || output.ship_code,
    kind: output.kind === "ship" ? "ship" : ""
  });
}

function recipeMatchesPlanetFilters(recipe) {
  const bucket = recipeOutputBucket(recipe);
  if (!planetItemFilters[bucket]) return false;
  const q = planetSearch.trim().toLowerCase();
  if (!q) return true;
  const inputs = Object.keys(recipe?.inputs || {}).join(" ");
  const output = Object.values(recipe?.output || {}).join(" ");
  return [recipe?.name, recipe?.code, recipe?.category, recipe?.description, inputs, output]
    .some(value => String(value || "").toLowerCase().includes(q));
}

function planetProductionTab(pl, node, mode) {
  const selectedPlanetId = pl.id || node.id;
  const isCurrent = String(currentPlanetIdValue()) === String(selectedPlanetId);
  const recipes = (state.crafting_recipes || [])
    .filter(r => mode === "refining" ? isRefiningRecipe(r) : !isRefiningRecipe(r))
    .filter(recipeMatchesPlanetFilters);
  const jobs = (state.crafting_queue || [])
    .filter(j => mode === "refining" ? String(j.job_kind || "").toLowerCase() === "refining" : String(j.job_kind || "").toLowerCase() !== "refining")
    .filter(j => isSelectedPlanetScope(j, selectedPlanetId))
    .filter(rowMatchesPlanetFilters);
  const activeJobs = jobs.filter(j => j.status === "active");
  const completeJobs = jobs.filter(j => j.status === "complete");
  const claim = completeJobs.length ? `<button class="primary" onclick="apiAction('claim_crafting')">Claim Complete</button>` : "";
  return `
    ${planetScopeBar(pl)}
    <div class="planetMiniSummary">
      <div class="kv"><label>Scope</label><b>${planetScope === "planet" ? esc(pl.name || "This planet") : "Everywhere"}</b></div>
      <div class="kv"><label>Active</label><b>${fmt(activeJobs.length)}</b></div>
      <div class="kv"><label>Ready</label><b>${fmt(completeJobs.length)}</b></div>
      <div class="kv"><label>Access</label><b>${isCurrent ? "Docked" : "Remote"}</b></div>
    </div>
    <div class="planetSectionHead"><h3>${mode === "refining" ? "Refining Jobs" : "Crafting Jobs"}</h3>${claim}</div>
    ${jobs.map(craftingJobCard).join("") || `<p class="muted">No ${mode} jobs in this scope.</p>`}
    <div class="planetSectionHead"><h3>${mode === "refining" ? "Refining Recipes" : "Crafting Recipes"}</h3></div>
    ${recipes.map(r => recipeCard(r, mode, isCurrent)).join("") || `<p class="muted">No ${mode} recipes match these filters.</p>`}`;
}

function craftingJobCard(job) {
  const active = job.status === "active";
  const pctDone = Math.max(0, Math.min(100, Number(job.progress_pct || 0)));
  return `<div class="planetItemCard">
    <div>
      <b>${esc(job.recipe_name || "Queued Job")}</b>
      <small>${esc(job.location_name || "Unknown location")} / ${esc(job.status || "active")} / ${active ? esc(job.remaining_label || "") : esc(job.outcome || "")}</small>
      <div class="bar"><div class="fill" style="width:${pctDone}%"></div></div>
    </div>
    <div class="rowBtns">
      ${active ? `<button onclick="apiAction('cancel_crafting',{job_id:${Number(job.id) || 0}})">Cancel</button>` : ""}
    </div>
  </div>`;
}

function recipeInputText(recipe) {
  const inputs = recipe?.inputs || {};
  const parts = Object.entries(inputs).map(([code, qty]) => `${fmt(qty)}x ${code.replaceAll("_", " ")}`);
  return parts.join(", ") || "No material inputs";
}

function recipeOutputText(recipe) {
  const output = recipe?.output || {};
  const qty = output.qty || 1;
  const name = output.name || output.item_name || output.item_code || output.module_code || output.ship_code || output.kind || "Output";
  return `${fmt(qty)}x ${String(name).replaceAll("_", " ")}`;
}

function recipeCard(recipe, mode, isCurrent) {
  const blockers = recipe.blockers || recipe.locked_reasons || [];
  const canCraft = isCurrent && !!recipe.can_craft;
  const reason = !isCurrent ? "Dock at this planet to start jobs." : blockers.join("; ");
  const odds = recipe.success_odds !== undefined ? `${Math.round(Number(recipe.success_odds || 0) * 100)}%` : "n/a";
  return `<div class="planetItemCard recipeCard">
    <div>
      <b>${esc(recipe.name)}</b>
      <small>T${fmt(recipe.recipe_tier || recipe.tier || 1)} / ${esc(recipe.category || mode)} / ${esc(recipe.craft_time_label || "")} / ${odds} odds</small>
      <small>Input: ${esc(recipeInputText(recipe))}</small>
      <small>Output: ${esc(recipeOutputText(recipe))}</small>
      ${reason ? `<small class="muted">${esc(reason)}</small>` : ""}
    </div>
    <div class="rowBtns"><button class="primary" ${canCraft ? "" : "disabled"} onclick="apiAction('craft_recipe',{recipe_code:'${jsString(recipe.code)}'})">Start</button></div>
  </div>`;
}

function planetStorageTab(pl) {
  const selectedPlanetId = pl.id;
  const currentId = currentPlanetIdValue();
  const isCurrent = String(currentId) === String(selectedPlanetId);
  const stored = (state.player_storage?.stored || [])
    .filter(row => isSelectedPlanetScope(row, selectedPlanetId))
    .filter(rowMatchesPlanetFilters);
  const depositCandidates = (state.player_storage?.depositCandidates || [])
    .filter(rowMatchesPlanetFilters);
  const canModify = isCurrent && planetScope === "planet" && !(state.player_storage?.rules || {}).inOpenSpace;
  return `
    ${planetScopeBar(pl)}
    <div class="planetSectionHead"><h3>Stored Inventory</h3><span class="muted">${planetScope === "planet" ? esc(pl.name || "This planet") : "All stocked locations"}</span></div>
    ${stored.map(storageRowCard).join("") || `<p class="muted">No stored inventory in this scope.</p>`}
    <div class="planetSectionHead"><h3>Store From Ship</h3><span class="muted">${canModify ? "Docked here" : "Storage changes require docking on this planet."}</span></div>
    ${canModify ? (depositCandidates.map(depositCandidateCard).join("") || `<p class="muted">No inventory available to store.</p>`) : `<p class="muted">Use Everywhere to review remote storage, or travel here to deposit and withdraw.</p>`}`;
}

function storageRowCard(item) {
  return `<div class="planetItemCard">
    <div>
      <b>${esc(item.item_name || item.name)}</b>
      <small>${esc(item.planet_name || "Unknown planet")} / ${esc(item.galaxy_name || "")} / ${esc(item.category || item.item_type || "item")} / ${esc(item.rarity || "common")}</small>
      <small>${esc(item.description || "")}</small>
    </div>
    <div class="rowBtns">
      <b>${fmt(item.qty)}</b>
      <button ${item.available_here ? "" : "disabled"} onclick="apiAction('withdraw_storage_item',{storage_id:${Number(item.id) || 0},qty:1})">Withdraw 1</button>
      <button ${item.available_here ? "" : "disabled"} onclick="apiAction('withdraw_storage_item',{storage_id:${Number(item.id) || 0},qty:${Number(item.qty) || 1}})">All</button>
    </div>
  </div>`;
}

function depositCandidatePayload(item, qty) {
  if (item.source === "cargo_hold") return `{source:'cargo_hold',commodity_id:${Number(item.commodity_id) || 0},qty:${qty}}`;
  if (item.source === "module_storage") return `{source:'module_storage',module_id:${Number(item.id) || 0},qty:1}`;
  return `{source:'inventory',item_code:'${jsString(item.item_code)}',qty:${qty}}`;
}

function depositCandidateCard(item) {
  const qty = Math.max(1, Number(item.available_qty || item.qty || 1));
  return `<div class="planetItemCard">
    <div>
      <b>${esc(item.name || item.item_name)}</b>
      <small>${esc(item.source || "inventory")} / ${esc(item.category || item.item_type || "item")} / ${esc(item.rarity || "common")}</small>
    </div>
    <div class="rowBtns">
      <b>${fmt(qty)}</b>
      <button onclick="apiAction('store_item',${depositCandidatePayload(item, 1)})">Store 1</button>
      <button onclick="apiAction('store_item',${depositCandidatePayload(item, qty)})">All</button>
    </div>
  </div>`;
}

function inventoryLocationRows(pl) {
  const currentId = currentPlanetIdValue();
  const currentLoc = state.player?.location || state.location || {};
  const shipRows = (state.inventory_summary || []).map(item => ({
    ...item,
    planet_id: currentId,
    planet_name: currentLoc.name || state.location?.name || "Ship Hold",
    galaxy_name: currentLoc.galaxy_name || state.location?.galaxy_name || "",
    location_name: "Ship Hold"
  }));
  const ownedShips = (state.ships || []).map(ship => ({
    ...ship,
    kind: "ship",
    category: "ships",
    item_type: ship.role || ship.class_name || "ship",
    name: ship.name || ship.template_name || "Ship",
    qty: 1,
    planet_id: ship.location_planet_id || currentId,
    planet_name: ship.planet_name || currentLoc.name || "Ship Hangar",
    galaxy_name: ship.galaxy_name || currentLoc.galaxy_name || "",
    location_name: "Hangar"
  }));
  const stored = (state.player_storage?.stored || []).map(item => ({
    ...item,
    name: item.item_name,
    location_name: "Planet Storage"
  }));
  return shipRows.concat(ownedShips, stored)
    .filter(row => Number(row.qty || row.available_qty || 0) > 0)
    .filter(row => isSelectedPlanetScope(row, pl.id))
    .filter(rowMatchesPlanetFilters);
}

function planetInventoryTab(pl) {
  const rows = inventoryLocationRows(pl);
  const groups = {};
  for (const item of rows) {
    const key = `${item.planet_id || "ship"}:${item.location_name || ""}`;
    if (!groups[key]) groups[key] = { planet: item.planet_name || "Unknown location", galaxy: item.galaxy_name || "", location: item.location_name || "Inventory", rows: [] };
    groups[key].rows.push(item);
  }
  const groupHtml = Object.values(groups).map(group => `
    <div class="inventoryLocationGroup">
      <div class="planetSectionHead"><h3>${esc(group.planet)}</h3><span class="muted">${esc(group.location)}${group.galaxy ? ` / ${esc(group.galaxy)}` : ""}</span></div>
      ${group.rows.map(inventoryItemCard).join("")}
    </div>`).join("");
  return `
    ${planetScopeBar(pl)}
    ${groupHtml || `<p class="muted">No inventory exists in locations matching these filters.</p>`}`;
}

function inventoryItemCard(item) {
  const qty = Number(item.available_qty || item.qty || 1);
  return `<div class="planetItemCard">
    <div>
      <b>${esc(item.name || item.item_name)}</b>
      <small>${esc(item.category || item.item_type || "item")} / ${esc(item.rarity || item.class_name || "standard")} / ${esc(item.source || item.location_name || "")}</small>
      ${item.description ? `<small>${esc(item.description)}</small>` : ""}
    </div>
    <b>${fmt(qty)}</b>
  </div>`;
}

function detailPanel() {
  const p = state.player;
  const inspect = selectedInspectPanel();
  if (inspect) return inspect;
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
    const locked = state.player.traveling || state.travel_state?.active;
    return `
      <button onclick="selectObject('galaxy','${c.id}');closeContext()">Inspect ${esc(g?.name || 'Galaxy')}</button>
      ${isCurrent ? `<button onclick="setMapMode('system');closeContext()">Open Planet View</button>` : `<button ${locked ? "disabled" : ""} onclick="apiAction('galaxy_travel',{galaxy_id:'${c.id}'});closeContext()">Jump To Galaxy</button>`}
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

function selectObject(type, id) {
  if (type === "planet" && (!selected || selected.type !== "planet" || String(selected.id) !== String(id))) {
    planetScope = "planet";
    localStorage.setItem("nova_planet_scope", planetScope);
  }
  selected = type === "none" ? null : { type, id };
  render();
}
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
  let target = playerRenderPoint();
  if (mapMode === "galaxy" && !galaxyWarpActive()) {
    const g = currentGalaxy();
    view.x = w / 2 - mapNodeX(g) * view.z;
    view.y = h / 2 - mapNodeY(g) * view.z;
    clampView();
    render();
    return;
  }
  if (mapMode === "system" && galaxyWarpActive()) {
    const pl = state.planets.find(x => String(x.id) === String(p.location_id || p.location_planet_id)) || {};
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
  sessionStorage.removeItem("nova_token");
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
    setMapFilters,
    setPlanetTab,
    setPlanetScope,
    togglePlanetItemFilter,
    setPlanetItemFilters,
    setPlanetSearch,
  });
}
exposeInlineHandlers();

window.addEventListener("error", e => {
  const msg = String(e?.message || "");
  if (msg.includes("is not defined") && /apiAction|setPage|logout|zoomBy|centerOnPlayer|selectObject|closeContext|saveAdminSettings|postBounty|setMapMode|toggleMapFilter|setMapFilters|setPlanetTab|setPlanetScope|togglePlanetItemFilter|setPlanetItemFilters|setPlanetSearch/.test(msg)) {
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
  const territory = document.querySelector(".territory");
  const top = document.querySelector(".topbar");
  const side = document.querySelector(".side");
  if (entities) entities.innerHTML = entitiesHtml();
  if (lanes) lanes.innerHTML = lanesSvg();
  if (territory) territory.innerHTML = territorySvg();
  if (top) top.outerHTML = topbar();
  if (side) side.innerHTML = detailPanel() + cargoPanel() + eventPanel();
}, 500);

if (token) loadState(); else render();
