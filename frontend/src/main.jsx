
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Home, Globe2, Store, Rocket, Users, Crosshair, Briefcase, Factory,
  Hammer, Brain, Building2, Mail, Trophy, Settings, Shield, Zap, Info, Plus,
  ShipWheel, HeartPulse, AlertTriangle, Coins, Fuel, Package, Clock, Swords,
  UserRound, MessageCircle, Send, Save, CalendarDays, Minus, RotateCcw,
  LocateFixed, Radar, Layers, MoreHorizontal, X, Pin, Lock, Eye, Search,
  Filter, ArrowUp, ArrowDown, CheckSquare, Square
} from 'lucide-react';
import './styles.css';
import { resolveAsset, imageFallbackFor, brandAssets, factionAssets, celestialSunAssets } from './assets/gameAssets';
import novaFrontiersCore from './assets/generated/landing/nova-frontiers-core.png';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const uid = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
const SILENT_ACTION_TYPES = new Set(['advance_combat_battle', 'auto_explore_battle_tick']);
const NO_AUTO_STATE_REFRESH_ACTION_TYPES = new Set(['advance_combat_battle', 'combat_action']);
const BACKGROUND_REFRESH_ACTION_TYPES = new Set([
  'go_here', 'travel', 'galaxy_travel', 'cancel_travel', 'cancel_cargo_operation',
  'scan_area', 'scan_object', 'scan_exploration_site', 'investigate_exploration_site',
  'intercept_traveler', 'resolve_intercept_now',
  'mine_ore_site', 'salvage_site',
  'enter_pirate_station', 'place_player_base', 'dock_player_base',
  'start_planet_mission_travel', 'auto_explore_battle_tick'
]);
const MAP_SLICE_REFRESH_ACTION_TYPES = new Set([
  'go_here', 'travel', 'galaxy_travel', 'cancel_travel',
  'scan_area', 'scan_object', 'scan_exploration_site', 'investigate_exploration_site',
  'intercept_traveler', 'resolve_intercept_now',
  'mine_ore_site', 'salvage_site',
  'enter_pirate_station', 'place_player_base', 'dock_player_base',
  'start_planet_mission_travel', 'auto_explore_battle_tick'
]);
const CLIENT_VISUAL_TRAVEL_ACTION_TYPES = new Set(['go_here', 'travel', 'galaxy_travel', 'intercept_traveler']);
const SERVER_VALIDATED_EVENT_ACTION_TYPES = new Set([
  'mine_ore_site', 'salvage_site', 'scan_exploration_site', 'investigate_exploration_site',
  'resolve_intercept_now'
]);
const AUTO_BATTLE_INACTIVITY_MS = 60 * 1000;
const AUTO_EXPLORE_TICK_MS = 2500;
const AUTO_EXPLORE_MODE_OPTIONS = [
  {key:'pirate', label:'Pirate AFK', activeLabel:'Stop Pirate AFK', statusActive:'Auto Pirate AFK active', statusPaused:'Auto Pirate AFK paused', start:'Starting pirate-only patrol.', idle:'Pirate-only patrol idle.', target:'pirates only', tooltip:'Auto pirate AFK patrol'},
  {key:'salvage', label:'Salvage AFK', activeLabel:'Stop Salvage AFK', statusActive:'Auto Salvage AFK active', statusPaused:'Auto Salvage AFK paused', start:'Starting salvage AFK sweep.', idle:'Salvage AFK idle.', target:'wrecks', tooltip:'Auto salvage AFK'},
  {key:'anomaly', label:'Anomaly AFK', activeLabel:'Stop Anomaly AFK', statusActive:'Auto Anomaly AFK active', statusPaused:'Auto Anomaly AFK paused', start:'Starting anomaly AFK sweep.', idle:'Anomaly AFK idle.', target:'anomalies', tooltip:'Auto anomaly AFK'},
  {key:'mining', label:'Mining AFK', activeLabel:'Stop Mining AFK', statusActive:'Auto Mining AFK active', statusPaused:'Auto Mining AFK paused', start:'Starting mining AFK sweep.', idle:'Mining AFK idle.', target:'ore sites', tooltip:'Auto mining AFK'}
];
const AUTO_EXPLORE_MODE_BY_KEY = Object.fromEntries(AUTO_EXPLORE_MODE_OPTIONS.map(mode => [mode.key, mode]));

function initialAuthToken() {
  const saved = sessionStorage.getItem('nova_token') || localStorage.getItem('nova_token') || '';
  if (saved) sessionStorage.setItem('nova_token', saved);
  localStorage.removeItem('nova_token');
  return saved;
}

function storeAuthToken(value) {
  sessionStorage.setItem('nova_token', value);
  localStorage.removeItem('nova_token');
}

function clearAuthToken() {
  sessionStorage.removeItem('nova_token');
  localStorage.removeItem('nova_token');
}

function storeGoogleEmailHint(value) {
  const email = String(value || '').trim();
  if (email) sessionStorage.setItem('nova_google_email_hint', email);
  else sessionStorage.removeItem('nova_google_email_hint');
}

function clearGoogleClientState() {
  try {
    const hint = sessionStorage.getItem('nova_google_email_hint') || '';
    window.google?.accounts?.id?.disableAutoSelect?.();
    window.google?.accounts?.id?.cancel?.();
    if (hint && window.google?.accounts?.id?.revoke) {
      window.google.accounts.id.revoke(hint, () => {});
    }
  } catch {}
  sessionStorage.removeItem('nova_google_email_hint');
}

function factionCssColor(value) {
  const key = String(value || '').trim().toLowerCase();
  const map = {
    purple: '#9b5cff', violet: '#9b5cff', veil: '#9b5cff',
    orange: '#ff9f3d', gold: '#ff9f3d', solar: '#ff9f3d',
    grey: '#9ca3af', gray: '#9ca3af', meridian: '#9ca3af',
    blue: '#4da3ff', patrol: '#4da3ff', cyan: '#45d8ff'
  };
  return map[key] || value || '#45d8ff';
}

function visualSeed(value) {
  const text = String(value || 'nova');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function galaxyVisualFor(node) {
  const seed = visualSeed(`${node?.id ?? ''}:${node?.name ?? ''}:${node?.faction_name ?? ''}`);
  const hue = seed % 360;
  const companionHue = (hue + 112 + (seed % 58)) % 360;
  return {
    visualClass: `galaxyVisual${seed % 5}`,
    cssVars: {
      '--galaxy-hue': `${hue}deg`,
      '--galaxy-companion-hue': `${companionHue}deg`,
      '--galaxy-tilt': `${(seed % 70) - 35}deg`,
      '--galaxy-spin': `${(seed % 96) - 48}deg`,
      '--galaxy-glow-scale': String(0.86 + (seed % 42) / 100),
      '--galaxy-dust-offset': `${seed % 120}px`
    }
  };
}

function mapNodeFactionColor(node) {
  return factionCssColor(node?.faction_color || node?.color || node?.factionColor || node?.controller_color);
}

function isGalaxyGateMapNode(node) {
  const kind = String(node?.kind || '').toLowerCase();
  const type = String(node?.type || node?.details_label || '').toLowerCase();
  const name = String(node?.name || '').toLowerCase();
  return kind === 'gate' || !!node?.is_gate || type.includes('galaxy gate') || (type.includes('gate') && name.includes('gate'));
}

const MAP_NODE_TYPE_COLORS = {
  planet: '#4dff91',
  gate: '#d97cff',
  uninhabitable: '#ff8f5a'
};

function mapObjectDisplayName(obj) {
  const raw = obj?.realName || obj?.name || obj?.label || obj?.ship_name || 'Map target';
  if (isGalaxyGateMapNode(obj)) return raw;
  return String(raw)
    .replace(/\s+Station$/i, '')
    .replace(/\s+Hub$/i, ' Prime')
    .replace(/\s+Relay$/i, ' Reach')
    .replace(/\s+Outpost$/i, ' Frontier')
    .replace(/\s+Freeport$/i, ' Haven')
    .replace(/\s+Gate$/i, ' Terminus')
    .trim() || 'Map target';
}

function isUninhabitableMapNode(node, mapType = 'system') {
  return String(mapType || 'system').toLowerCase() === 'system'
    && !!node
    && (node.isUninhabitable || node.is_uninhabitable || /uninhab|barren|toxic|frozen|volcanic|irradiated|gas giant|desert tomb/i.test(String(node.type || '')));
}

function mapNodeAccentColor(node, mapType = 'system') {
  const normalizedMapType = String(mapType || 'system').toLowerCase();
  if (normalizedMapType === 'galaxy') return mapNodeFactionColor(node);
  const kind = String(node?.kind || '').toLowerCase();
  const typeText = String(node?.type || '').toLowerCase();
  const nameText = String(node?.name || '').toLowerCase();
  if (isGalaxyGateMapNode(node) || kind === 'gate' || /gate|jump/.test(typeText) || /gate|jump/.test(nameText)) return MAP_NODE_TYPE_COLORS.gate;
  if (isUninhabitableMapNode(node, normalizedMapType)) return MAP_NODE_TYPE_COLORS.uninhabitable;
  if (kind === 'planet' || kind === 'node') return MAP_NODE_TYPE_COLORS.planet;
  return mapNodeFactionColor(node);
}

function shipFactionColor(ship, summary) {
  return factionCssColor(ship?.playerFactionColor || ship?.npcFactionColor || ship?.faction_color || summary?.player_faction?.color);
}

function clampPct(value, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(99, n));
}

function distancePct(a, b) {
  const ax = clampPct(a?.x_pct ?? a?.x);
  const ay = clampPct(a?.y_pct ?? a?.y);
  const bx = clampPct(b?.x_pct ?? b?.x);
  const by = clampPct(b?.y_pct ?? b?.y);
  return Math.hypot(bx - ax, by - ay);
}

const SYSTEM_MAP_Y_ASPECT = 31200 / 48000;
const MAP_DOCK_DEPARTURE_RADIUS_PCT = 2.75;

function dockDeparturePoint(anchor, target) {
  const ax = clampPct(anchor?.x_pct ?? anchor?.x);
  const ay = clampPct(anchor?.y_pct ?? anchor?.y);
  const tx = clampPct(target?.x_pct ?? target?.x, ax + 1);
  const ty = clampPct(target?.y_pct ?? target?.y, ay);
  let dx = tx - ax;
  let dy = (ty - ay) * SYSTEM_MAP_Y_ASPECT;
  let dist = Math.hypot(dx, dy);
  if (!Number.isFinite(dist) || dist < 0.001) {
    dx = 1;
    dy = 0;
    dist = 1;
  }
  return {
    x_pct: clampPct(ax + (dx / dist) * MAP_DOCK_DEPARTURE_RADIUS_PCT, 1),
    y_pct: clampPct(ay + (dy / dist) * (MAP_DOCK_DEPARTURE_RADIUS_PCT / SYSTEM_MAP_Y_ASPECT), 1),
  };
}

function findStateMapNode(state, mapType, id) {
  const map = mapType === 'galaxy' ? state?.galaxy_map : state?.system_map;
  return (map?.nodes || []).find(n =>
    String(n?.id) === String(id) ||
    String(n?.galaxy_id) === String(id) ||
    String(n?.planet_id) === String(id)
  ) || null;
}

function normalizeServerEvent(event = {}) {
  const site = event.mapSite || event.map_site || event.site || {};
  const location = event.location || {};
  const metadata = event.metadata || {};
  return {
    ...event,
    id: event.id,
    event_type: event.event_type || event.eventType || metadata.eventType || '',
    name: event.name || metadata.eventName || 'Server Event',
    status: event.status || 'scheduled',
    starts_at: event.starts_at || event.startsAt,
    warning_at: event.warning_at || event.warningAt,
    ends_at: event.ends_at || event.endsAt,
    schedule_type: event.schedule_type || event.cadence || 'server',
    target_galaxy_id: event.target_galaxy_id ?? event.targetGalaxyId ?? site.galaxy_id ?? site.galaxyId ?? location.galaxy_id ?? location.galaxyId,
    target_planet_id: event.target_planet_id ?? event.targetPlanetId ?? site.planet_id ?? site.planetId ?? location.planet_id ?? location.planetId,
    mapSite: {
      ...site,
      objectKey: site.objectKey || site.object_key,
      map_type: site.map_type || site.mapType || event.map_type || event.mapType,
      x_pct: site.x_pct ?? site.xPct ?? event.x_pct ?? event.xPct ?? location.x_pct ?? location.xPct,
      y_pct: site.y_pct ?? site.yPct ?? event.y_pct ?? event.yPct ?? location.y_pct ?? location.yPct,
      galaxy_id: site.galaxy_id ?? site.galaxyId ?? event.target_galaxy_id ?? event.targetGalaxyId,
      planet_id: site.planet_id ?? site.planetId ?? event.target_planet_id ?? event.targetPlanetId,
    }
  };
}

function currentStateMapPoint(state, mapType) {
  const wanted = String(mapType || 'system').toLowerCase() === 'galaxy' ? 'galaxy' : 'system';
  const travel = state?.travel_state || {};
  const travelMapType = String(travel.map_type || travel.open_space_map_type || '').toLowerCase();
  if (travel.open_space && travel.open_space_x_pct != null && travel.open_space_y_pct != null && (!travel.open_space_map_type || travelMapType === wanted)) {
    return {x_pct:clampPct(travel.open_space_x_pct), y_pct:clampPct(travel.open_space_y_pct)};
  }
  if (travel.active && travel.origin_x_pct != null && travel.origin_y_pct != null && travel.destination_x_pct != null && travel.destination_y_pct != null && (!travelMapType || travelMapType === wanted)) {
    const progress = travelProgress(travel, Date.now());
    const pt = lerpPoint(
      {x_pct:clampPct(travel.origin_x_pct), y_pct:clampPct(travel.origin_y_pct)},
      {x_pct:clampPct(travel.destination_x_pct), y_pct:clampPct(travel.destination_y_pct)},
      progress
    );
    return {x_pct:clampPct(pt.x), y_pct:clampPct(pt.y)};
  }
  const map = wanted === 'galaxy' ? state?.galaxy_map : state?.system_map;
  const currentId = wanted === 'galaxy'
    ? (map?.current_galaxy_id ?? state?.location?.galaxy_id)
    : (map?.current_planet_id ?? state?.location?.planet_id);
  const node = (map?.nodes || []).find(n => n?.current || String(n?.id) === String(currentId));
  if (node) return {x_pct:clampPct(node.x_pct), y_pct:clampPct(node.y_pct)};
  const summary = map?.summary || {};
  return {x_pct:clampPct(summary.radar_center_x_pct ?? summary.player_x_pct), y_pct:clampPct(summary.radar_center_y_pct ?? summary.player_y_pct)};
}

function buildOptimisticTravelState(prevState, actionType, payload = {}) {
  if (!prevState || !payload || typeof payload !== 'object') return null;
  const type = String(actionType || '').toLowerCase();
  const p = payload || {};
  let mapType = String(p.map_type || p.mapType || '').toLowerCase();
  let dest = null;
  let mode = 'waypoint';
  let destinationLabel = p.label || 'Waypoint';

  if (type === 'go_here') {
    mapType = mapType === 'galaxy' ? 'galaxy' : 'system';
    if (mapType === 'galaxy') return null;
    dest = {x_pct:clampPct(p.x_pct ?? p.x ?? p.destination_x_pct), y_pct:clampPct(p.y_pct ?? p.y ?? p.destination_y_pct)};
  } else if (type === 'travel' && p.planet_id != null) {
    mapType = 'system';
    mode = 'local';
    const node = findStateMapNode(prevState, mapType, p.planet_id);
    if (!node) return null;
    dest = {x_pct:clampPct(node.x_pct), y_pct:clampPct(node.y_pct)};
    destinationLabel = node.name || p.label || 'Planet';
  } else if (type === 'galaxy_travel' && p.galaxy_id != null) {
    return null;
  } else if (type === 'intercept_traveler') {
    mapType = String(p.map_type || p.mapType || '').toLowerCase() === 'galaxy' ? 'galaxy' : 'system';
    mode = 'intercept';
    dest = {x_pct:clampPct(p.x_pct ?? p.x ?? p.target_x_pct), y_pct:clampPct(p.y_pct ?? p.y ?? p.target_y_pct)};
    destinationLabel = p.label || p.name || p.ship_name || 'Intercept target';
  } else {
    return null;
  }

  let origin = currentStateMapPoint(prevState, mapType);
  const wasDocked = mapType === 'system'
    && !prevState?.travel_state?.active
    && !prevState?.travel_state?.open_space
    && prevState?.travel_state?.docked !== false;
  if (wasDocked && ['go_here', 'travel'].includes(type)) {
    origin = dockDeparturePoint(origin, dest);
  }
  const speed = Math.max(0.28, Math.min(4.25, Number(prevState?.active_ship?.effective_map_speed || prevState?.active_ship?.drive_speed || 1)));
  const seconds = Math.max(2, Math.ceil((distancePct(origin, dest) * 5.8) / speed));
  const startedAt = new Date();
  const arrivalAt = new Date(startedAt.getTime() + seconds * 1000);
  const visualId = `client-visual:${type}:${startedAt.getTime()}:${Math.random().toString(36).slice(2)}`;
  return {
    ...prevState,
    travel_state: {
      ...(prevState.travel_state || {}),
      active: true,
      docked: false,
      open_space: false,
      optimistic: true,
      client_visual: true,
      client_visual_id: visualId,
      client_action_type: type,
      mode,
      map_type: mapType,
      started_at: startedAt.toISOString(),
      arrival_at: arrivalAt.toISOString(),
      remaining_seconds: seconds,
      origin_x_pct: origin.x_pct,
      origin_y_pct: origin.y_pct,
      destination_x_pct: dest.x_pct,
      destination_y_pct: dest.y_pct,
      destination_label: destinationLabel,
      origin_planet_id: prevState?.system_map?.current_planet_id ?? prevState?.location?.planet_id,
      origin_galaxy_id: prevState?.galaxy_map?.current_galaxy_id ?? prevState?.location?.galaxy_id,
      destination_planet_id: p.planet_id ?? prevState?.travel_state?.destination_planet_id,
      destination_galaxy_id: p.galaxy_id ?? prevState?.travel_state?.destination_galaxy_id,
      intercept_target_ref: p.target_ref ?? prevState?.travel_state?.intercept_target_ref,
      intercept_target_name: mode === 'intercept' ? destinationLabel : prevState?.travel_state?.intercept_target_name,
    }
  };
}

function applyClientVisualTravelState(baseState, visualTravel) {
  if (!baseState || !visualTravel?.active || !visualTravel?.client_visual) return baseState;
  return {
    ...baseState,
    travel_state: {
      ...(baseState.travel_state || {}),
      ...visualTravel,
    }
  };
}

function withImmediateMapResult(prevState, actionType, payload = {}, result = {}) {
  if (!prevState || !result || typeof result !== 'object') return prevState;
  const type = String(actionType || '').toLowerCase();
  const mapType = String(payload?.map_type || payload?.mapType || result?.map_type || 'system').toLowerCase() === 'galaxy' ? 'galaxy' : 'system';
  const mapKey = mapType === 'galaxy' ? 'galaxy_map' : 'system_map';
  const map = prevState?.[mapKey];
  let nextState = prevState;

  if (result.mapOperation) {
    nextState = {...nextState, map_operation: result.mapOperation};
  }

  if (type === 'scan_area' && map) {
    const x = clampPct(payload?.x_pct ?? payload?.x ?? result?.x_pct);
    const y = clampPct(payload?.y_pct ?? payload?.y ?? result?.y_pct);
    const now = Date.now();
    const duration = Math.max(5, Number(result?.scan_area?.duration_seconds || 30));
    const animationSeconds = Math.max(1, Number(result?.scan_area?.animation_seconds || map?.summary?.scan_area?.animation_seconds || 8));
    const cooldown = Math.max(0, Number(result?.scan_area?.cooldown_seconds || 0));
    const cooldownStartedAt = result?.scan_area?.cooldown_started_at || (cooldown ? new Date(now).toISOString() : null);
    const cooldownUntil = result?.scan_area?.cooldown_until || (cooldown ? new Date(now + cooldown * 1000).toISOString() : null);
    const fallbackPing = {
      id: `optimistic-scan:${mapType}:${Math.round(x * 10)}:${Math.round(y * 10)}:${now}`,
      x_pct: x,
      y_pct: y,
      radius_pct: Number(result?.scan_area?.radius_pct || map?.summary?.scan_area?.radius_pct || 8),
      expires_at: new Date(now + Math.min(duration, animationSeconds + 0.4) * 1000).toISOString(),
      animation_seconds: animationSeconds,
    };
    const mergeMapObjects = (incoming, existing, limit) => {
      const out = [];
      const seen = new Set();
      [...(incoming || []), ...(existing || [])].forEach(obj => {
        const key = obj?.id || obj?.objectKey || obj?.object_key;
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push(obj);
      });
      return out.slice(0, limit);
    };
    const serverPings = Array.isArray(result?.scan_pings) && result.scan_pings.length ? result.scan_pings : [fallbackPing];
    const serverBlips = Array.isArray(result?.scan_blips) ? result.scan_blips : [];
    nextState = {
      ...nextState,
      [mapKey]: {
        ...map,
        scan_pings: mergeMapObjects(serverPings, map.scan_pings, 8),
        scan_blips: mergeMapObjects(serverBlips, map.scan_blips, 80),
        summary: {
          ...(map.summary || {}),
          scan_area: {
            ...((map.summary || {}).scan_area || {}),
            ...(result.scan_area || {}),
            cooldown_until: cooldownUntil,
            cooldown_started_at: cooldownStartedAt,
            cooldown_active: !!cooldownUntil,
            remaining_seconds: cooldown,
            cooldown_ready_pct: cooldownUntil ? 0 : 100,
          }
        }
      }
    };
  }

  return nextState;
}

const nav = [
  ['Map', Globe2],
  ['Planet', Building2],
  ['Character', UserRound],
  ['Guilds / War', Shield],
  ['Ship / Cargo', Rocket],
  ['Auction', Store],
  ['Events', CalendarDays],
  ['Social', Users],
  ['Suggestions', MessageCircle],
  ['Messages', Mail],
  ['Admin', Settings],
  ['Leaderboards', Trophy],
];

const NAV_GROUPS = [
  { label:'Navigation', pages:['Map','Planet','Character','Guilds / War','Ship / Cargo','Auction','Events','Social','Suggestions','Messages','Admin','Leaderboards'] },
];

const HUB_DEFAULT_TABS = {
  Galaxy: 'navigation',
  Planet: 'overview',
  Character: 'character',
  Market: 'auction',
};

const LEGACY_PAGE_TO_HUB_TAB = {
  Dashboard: ['Galaxy', 'overview'],
  Galaxy: ['Galaxy', 'navigation'],
  Map: ['Galaxy', 'navigation'],
  Calendar: ['Galaxy', 'events'],
  'Planet Control': ['Planet', 'overview'],
  Industry: ['Planet', 'industry'],
  Crafting: ['Planet', 'industry'],
  Properties: ['Planet', 'storage'],
  Profile: ['Character', 'character'],
  'Ships & Hangar': ['Character', 'ship'],
  'Ship / Cargo': ['Character', 'ship'],
  Inventory: ['Character', 'ship'],
  Skills: ['Character', 'skills'],
  Medical: ['Character', 'effects'],
  Fight: ['Galaxy', 'combat'],
  Chat: ['Market', 'social'],
  Party: ['Market', 'social'],
  Social: ['Market', 'social'],
  Suggestions: ['Market', 'forum'],
  Forum: ['Market', 'forum'],
  Messages: ['Market', 'messages'],
  Guild: ['Market', 'guilds'],
  'Guilds / War': ['Market', 'guilds'],
  'Faction War': ['Market', 'guilds'],
  Warfare: ['Market', 'guilds'],
  Leaderboards: ['Market', 'leaderboards'],
  Admin: ['Market', 'admin'],
  Auction: ['Market', 'auction'],
  Market: ['Market', 'auction'],
  Events: ['Market', 'events'],
};

function resolveHubDestination(pageName, currentHub='Galaxy') {
  if (HUB_DEFAULT_TABS[pageName]) return {hub:pageName, tab:HUB_DEFAULT_TABS[pageName]};
  const mapped = LEGACY_PAGE_TO_HUB_TAB[pageName];
  if (mapped) return {hub:mapped[0], tab:mapped[1]};
  return {hub:HUB_DEFAULT_TABS[currentHub] ? currentHub : 'Galaxy', tab:HUB_DEFAULT_TABS[currentHub] || HUB_DEFAULT_TABS.Galaxy};
}

function isDockedAtPlanetOrStation(state) {
  const travel = state?.travel_state || {};
  if (travel.active || travel.open_space || travel.docked === false) return false;
  if (state?.active_pirate_station) return true;
  return !!(
    travel.dock_planet_id ||
    travel.dock_base_id ||
    state?.location?.id ||
    state?.location?.planet_id
  );
}

function planetNavDisabled(state) {
  return !isDockedAtPlanetOrStation(state);
}

const SITE_PALETTE_ACCENT = '#58e6ff';

const PAGE_INTEL = {
  Galaxy: { eyebrow:'Navigation', title:'Map', deck:'Galaxy and local-space navigation, scanning, pilots, conflict zones, anomalies, travel, and battle entry.', accent:'#58e6ff' },
  Planet: { eyebrow:'Docked Operations', title:'Planet', deck:'Docked planet controls, Sell Inventory, NPC Goods Market, storage, and Refining/Crafting.', accent:'#7df5a8' },
  Character: { eyebrow:'Pilot', title:'Character', deck:'Pilot identity, skills, ship equipment, cargo, loadouts, buffs, debuffs, and recovery.', accent:'#b174ff' },
  Market: { eyebrow:'Global Exchange', title:'Auction', deck:'Global player listings, social tools, messages, events, guild war, leaderboards, and admin controls when permitted.', accent:'#57ffa3' },
  Auction: { eyebrow:'Global Exchange', title:'Auction', deck:'Global player listings with planet-bound delivery.', accent:'#57ffa3' },
  Events: { eyebrow:'Operations', title:'Events', deck:'Server events, bounties, wormholes, derelicts, artifacts, refining windows, and weekly ladder activity.', accent:'#b174ff' },
  'Guilds / War': { eyebrow:'Guild War', title:'Guilds / War', deck:'Guild organization, treasury, territory pressure, faction conflict, and warfare readiness.', accent:'#a9e86f' },
  'Ship / Cargo': { eyebrow:'Shipyard', title:'Ship / Cargo', deck:'Active ship, owned hulls, equipment, cargo, materials, modules, repairs, and loadout readiness.', accent:'#6cf6ff' },
  Dashboard: { eyebrow:'Live Command', title:'Bridge Overview', deck:'The full pulse of your pilot, ship, market, route, and local sector pressure.', accent:'#6cf6ff' },
  Profile: { eyebrow:'Pilot Identity', title:'Public Signal', deck:'Shape how other captains see you across chat, social, achievements, and the frontier record.', accent:'#b174ff' },
  Chat: { eyebrow:'Comms', title:'Open Channel', deck:'Live station noise, pilot chatter, and social signals from the edge.', accent:'#7df5a8' },
  Party: { eyebrow:'Squad', title:'Crew Coordination', deck:'Invite allies, form runs, and keep your group ready for contracts or combat.', accent:'#ffbf5a' },
  Social: { eyebrow:'Network', title:'Pilot Contacts', deck:'Friends, public profiles, trade invites, and reputation ties in one place.', accent:'#8cfaff' },
  Suggestions: { eyebrow:'Community', title:'Suggestions', deck:'Player ideas, votes, comments, and admin status tracking.', accent:'#74a7ff' },
  Forum: { eyebrow:'Community', title:'Suggestions', deck:'Player ideas, votes, comments, and admin status tracking.', accent:'#74a7ff' },
  Map: { eyebrow:'Navigation', title:'Living Star Map', deck:'Scan, route, intercept, mine, salvage, and read the pressure systems before committing.', accent:'#58e6ff' },
  Calendar: { eyebrow:'Operations', title:'Server Calendar', deck:'Events, anomalies, raids, wormholes, and timed opportunities shaping the galaxy.', accent:'#b174ff' },
  Inventory: { eyebrow:'Cargo', title:'Ship / Cargo', deck:'Ship equipment, cargo, materials, modules, consumables, sale value, and item inspection.', accent:'#ffc247' },
  'Ships & Hangar': { eyebrow:'Shipyard', title:'Hangar Bay', deck:'Choose a hull, fit modules, repair, insure, and understand what your ship is built to do.', accent:'#6cf6ff' },
  Fight: { eyebrow:'Combat', title:'Battle Desk', deck:'Targets, recent outcomes, and battlefield readiness.', accent:'#ff744d' },
  Guild: { eyebrow:'Guild', title:'Faction Table', deck:'Organize treasury, territory, defense, influence, and shared power.', accent:'#a9e86f' },
  'Faction War': { eyebrow:'Warfront', title:'Faction War', deck:'Conflict theaters, active pressure, contested space, and the faction map.', accent:'#ff744d' },
  Warfare: { eyebrow:'Strategy', title:'Warfare Console', deck:'Threat posture, defenses, deployments, and galaxy-scale pressure.', accent:'#ff9270' },
  'Planet Control': { eyebrow:'Territory', title:'Planet Control', deck:'Influence, taxes, conflict, defense, economy, and control actions.', accent:'#58e6ff' },
  Contracts: { eyebrow:'Work Board', title:'Contracts', deck:'Credit routes, missions, and local opportunities with operational context.', accent:'#ffbf5a' },
  Skills: { eyebrow:'Skills', title:'Skill Matrix', deck:'Spend points, compare trees, and sharpen the way your pilot bends the game.', accent:'#b174ff' },
  Industry: { eyebrow:'Production', title:'Refining/Crafting', deck:'Refining, crafting recipes, queues, output previews, and upgrade paths.', accent:'#cfd7df' },
  Crafting: { eyebrow:'Production', title:'Refining/Crafting', deck:'Refining, crafting recipes, queues, output previews, and upgrade paths.', accent:'#ffc247' },
  Properties: { eyebrow:'Holdings', title:'Property Ledger', deck:'Bases, storage, ownership, and orbital claims across the frontier.', accent:'#a9e86f' },
  Medical: { eyebrow:'Recovery', title:'Med Bay', deck:'Hospital timers, surgery options, and return-to-flight readiness.', accent:'#ff92ae' },
  Messages: { eyebrow:'Inbox', title:'Signal Inbox', deck:'Actionable messages, alerts, social events, and server dispatches.', accent:'#8cfaff' },
  Leaderboards: { eyebrow:'Rankings', title:'Frontier Legends', deck:'Guild standings, planetary control, and the players shaping the server story.', accent:'#ffc247' },
  Admin: { eyebrow:'Control Room', title:'Admin Console', deck:'World tuning, security, economy, spawns, missions, and live operation tools.', accent:'#ff744d' },
};

const HUB_TAB_INTEL_PAGES = {
  Galaxy: {
    navigation: 'Map',
    events: 'Calendar',
    combat: 'Fight',
  },
  Planet: {
    overview: 'Planet',
    goods: 'Planet',
    industry: 'Industry',
    storage: 'Properties',
  },
  Character: {
    character: 'Character',
    ship: 'Ship / Cargo',
    skills: 'Skills',
    effects: 'Medical',
  },
  Market: {
    guilds: 'Guilds / War',
    auction: 'Auction',
    events: 'Events',
    social: 'Social',
    forum: 'Suggestions',
    messages: 'Messages',
    admin: 'Admin',
    leaderboards: 'Leaderboards',
  },
};

function ribbonPageFor(pageName, hubTabs={}) {
  const activeTab = hubTabs?.[pageName];
  return HUB_TAB_INTEL_PAGES[pageName]?.[activeTab] || pageName;
}

const STATE_SLICE_ENDPOINTS = {
  profile: '/api/state/profile',
  chat: '/api/state/chat',
  map: '/api/map/snapshot',
  party: '/api/state/party',
  social: '/api/state/social',
  public_profiles: '/api/profile/public-profiles',
};

const DEFERRED_STATE_KEYS = ['achievements', 'avatar_options', 'chat_messages', 'galaxy_map', 'gathering_state', 'map_operation', 'map_snapshot', 'party', 'planet_missions', 'public_profiles', 'social', 'system_map', 'player_core', 'active_battle'];

function mergeDeferredState(prev, next) {
  if (!prev || !next || typeof next !== 'object') return next;
  const merged = {...next};
  DEFERRED_STATE_KEYS.forEach(key => {
    if (merged[key] === undefined && prev[key] !== undefined) merged[key] = prev[key];
  });
  if (prev.profile && next.profile) merged.profile = {...prev.profile, ...next.profile};
  return merged;
}

function mergeMapPingState(prev, data) {
  if (!prev || !data || typeof data !== 'object') return prev;
  const next = {...prev};
  if (data.player_core !== undefined) next.player_core = data.player_core;
  if (data.location !== undefined) next.location = {...(next.location || {}), ...(data.location || {})};
  if (data.active_battle !== undefined) next.active_battle = data.active_battle;
  if (data.travel_state !== undefined) next.travel_state = data.travel_state;
  if (data.map_operation !== undefined) next.map_operation = data.map_operation;
  if (data.planet_missions !== undefined) next.planet_missions = data.planet_missions;
  for (const mapKey of ['system_map', 'galaxy_map']) {
    const delta = data.map_delta?.[mapKey];
    if (delta && typeof delta === 'object') next[mapKey] = {...(next[mapKey] || {}), ...delta};
    else if (data[mapKey] && typeof data[mapKey] === 'object') next[mapKey] = data[mapKey];
  }
  if (data.map_snapshot) next.map_snapshot = {...(next.map_snapshot || {}), ...data.map_snapshot};
  if (data.server_time) next.server_time = data.server_time;
  return next;
}

function mapSnapshotObjectRevision(snapshot) {
  return snapshot?.version || snapshot?.objectRevision || snapshot?.object_revision || snapshot?.revision || '';
}

function mapSnapshotGroupHashes(snapshot) {
  return snapshot?.groupHashes || snapshot?.group_hashes || {};
}

function mapPollingCadenceMs(state, pageName, hasActiveBattle, tabHidden) {
  const polling = state?.map_snapshot?.polling || {};
  const n = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  if (tabHidden) return n(polling.backgroundMs, 30000);
  if (hasActiveBattle) return Math.max(750, Math.min(1500, n(polling.combatMs, 1000)));
  if (pageName === 'Map') return Math.max(2500, Math.min(5000, n(polling.activeMapMs, 3500)));
  return Math.max(8000, Math.min(15000, n(polling.dockedMs, 12000)));
}

function actionPayloadDedupeKey(type, payload) {
  try {
    return `${type}:${JSON.stringify(payload || {})}`;
  } catch {
    return `${type}:pending`;
  }
}

function sliceNamesForPage(pageName) {
  if (pageName === 'Profile') return ['profile'];
  if (pageName === 'Chat') return ['chat', 'public_profiles'];
  if (pageName === 'Party') return ['party', 'public_profiles'];
  if (pageName === 'Social') return ['social'];
  if (pageName === 'Map') return ['map', 'party', 'public_profiles'];
  if (pageName === 'Galaxy') return ['map', 'party', 'public_profiles'];
  if (pageName === 'Character') return ['profile', 'public_profiles'];
  if (pageName === 'Market') return ['chat', 'party', 'social', 'public_profiles'];
  return [];
}

function sliceNamesForAction(type) {
  if (['update_profile', 'set_achievement_badge'].includes(type)) return ['profile'];
  if (type === 'send_chat_message') return ['chat', 'public_profiles'];
  if (['scan_area', 'scan_object'].includes(type)) return ['map'];
  if (String(type || '').startsWith('party_')) return ['party', 'public_profiles'];
  if (String(type || '').startsWith('social_')) return ['social', 'public_profiles'];
  if (String(type || '').startsWith('trade_')) return ['social'];
  return [];
}

const MODAL_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function NovaDialogModal({dialog, onCancel, onConfirm, onInputChange}) {
  const shellRef = useRef(null);
  const inputRef = useRef(null);
  const lastActiveRef = useRef(null);
  const behaviorRef = useRef({allowEscape:false, canConfirm:false, onCancel, onConfirm});
  const kind = dialog?.kind || 'info';
  const dangerous = kind === 'danger';
  const hasInput = kind === 'prompt' || !!dialog?.confirmationPhrase;
  const typedConfirmation = String(dialog?.confirmationValue || '').trim();
  const expectedConfirmation = String(dialog?.confirmationPhrase || '').trim();
  const confirmationMatches = !expectedConfirmation || typedConfirmation === expectedConfirmation;
  const canConfirm = !dialog?.loading && confirmationMatches;
  const allowEscape = dialog?.allowEscape !== false && !dialog?.loading;
  const title = dialog?.title || (dangerous ? 'Confirm Critical Action' : kind === 'prompt' ? 'Input Required' : kind === 'confirm' ? 'Confirm Action' : 'Transmission');
  const confirmLabel = dialog?.confirmLabel || (dangerous ? 'Confirm' : kind === 'prompt' ? 'Submit' : kind === 'confirm' ? 'Confirm' : 'Acknowledge');
  const cancelLabel = dialog?.cancelLabel || 'Cancel';

  useEffect(() => {
    behaviorRef.current = {allowEscape, canConfirm, onCancel, onConfirm};
  }, [allowEscape, canConfirm, onCancel, onConfirm]);

  useEffect(() => {
    if (!dialog) return undefined;
    lastActiveRef.current = document.activeElement;
    const focusTarget = inputRef.current || shellRef.current?.querySelector(MODAL_FOCUSABLE_SELECTOR) || shellRef.current;
    window.setTimeout(() => focusTarget?.focus?.(), 0);
    const onKeyDown = (event) => {
      const shell = shellRef.current;
      if (!shell) return;
      const behavior = behaviorRef.current;
      if (event.key === 'Escape' && behavior.allowEscape) {
        event.preventDefault();
        behavior.onCancel();
        return;
      }
      if (event.key === 'Enter' && !event.shiftKey && behavior.canConfirm) {
        const tag = String(event.target?.tagName || '').toLowerCase();
        if (tag !== 'textarea') {
          event.preventDefault();
          behavior.onConfirm();
          return;
        }
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(shell.querySelectorAll(MODAL_FOCUSABLE_SELECTOR))
        .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
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
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      lastActiveRef.current?.focus?.();
    };
  }, [dialog?.id]);

  if (!dialog) return null;
  return <div
    className={`novaModalOverlay ${dangerous ? 'danger' : kind}`}
    role="presentation"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget && allowEscape && !dangerous) onCancel();
    }}
  >
    <section
      className={`novaModalShell ${dangerous ? 'danger' : kind}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="nova-modal-title"
      aria-describedby="nova-modal-message"
      ref={shellRef}
      tabIndex={-1}
      onMouseDown={event => event.stopPropagation()}
    >
      <div className="novaModalHeader">
        <span className="novaModalIcon" aria-hidden="true">{dangerous ? <AlertTriangle size={20}/> : <Info size={20}/>}</span>
        <div>
          <h2 id="nova-modal-title">{title}</h2>
          {dialog?.eyebrow && <small>{dialog.eyebrow}</small>}
        </div>
        {allowEscape && <button type="button" className="novaModalClose" onClick={onCancel} aria-label="Close"><X size={18}/></button>}
      </div>
      <p id="nova-modal-message" className="novaModalMessage">{dialog.message}</p>
      {hasInput && <label className="novaModalField">
        <span>{dialog.inputLabel || (expectedConfirmation ? `Type ${expectedConfirmation} to confirm` : 'Response')}</span>
        <input
          ref={inputRef}
          value={expectedConfirmation ? (dialog.confirmationValue ?? '') : (dialog.inputValue ?? '')}
          placeholder={dialog.placeholder || dialog.defaultValue || expectedConfirmation}
          disabled={dialog.loading}
          onChange={event => onInputChange(event.target.value)}
        />
      </label>}
      {expectedConfirmation && !confirmationMatches && <div className="novaModalHint">Confirmation phrase must match exactly.</div>}
      <div className="novaModalActions">
        {kind !== 'info' && <button type="button" className="novaModalSecondary" disabled={dialog.loading} onClick={onCancel}>{cancelLabel}</button>}
        <button type="button" className="novaModalPrimary" disabled={!canConfirm} onClick={onConfirm}>{dialog.loading ? (dialog.loadingLabel || 'Working...') : confirmLabel}</button>
      </div>
    </section>
  </div>;
}

function App() {
  const [token, setToken] = useState(initialAuthToken);
  const [state, setState] = useState(null);
  const [page, setPage] = useState('Galaxy');
  const [hubTabs, setHubTabs] = useState(() => ({...HUB_DEFAULT_TABS}));
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bootError, setBootError] = useState('');
  const [clock, setClock] = useState(Date.now());
  const [globalBattle, setGlobalBattle] = useState(null);
  const [tradeModalId, setTradeModalId] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [mapFocus, setMapFocus] = useState(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [clientVisualTravel, setClientVisualTravel] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [refiningPanelOpen, setRefiningPanelOpen] = useState(false);
  const [tabHidden, setTabHidden] = useState(() => typeof document !== 'undefined' ? document.hidden : false);
  const [autoExploreMode, setAutoExploreMode] = useState(() => {
    const saved = localStorage.getItem('nova_auto_explore_mode') || '';
    if (AUTO_EXPLORE_MODE_BY_KEY[saved]) return saved;
    return localStorage.getItem('nova_auto_explore_pirates') === '1' ? 'pirate' : '';
  });
  const [autoExploreLastMode, setAutoExploreLastMode] = useState(() => localStorage.getItem('nova_auto_explore_last_mode') || 'pirate');
  const [autoExploreStatus, setAutoExploreStatus] = useState(() => localStorage.getItem('nova_auto_explore_status') || '');
  const seenBattleRef = useRef(null);
  const toastSeenRef = useRef(new Set());
  const friendOnlineRef = useRef(new Map());
  const actionInFlightRef = useRef(false);
  const actionInFlightCountRef = useRef(0);
  const actionDedupeRef = useRef(new Set());
  const autoExploreBusyRef = useRef(false);
  const actRef = useRef(null);
  const loadInFlightRef = useRef(null);
  const sliceInFlightRef = useRef(new Map());
  const sliceLoadedAtRef = useRef(new Map());
  const loadSeqRef = useRef(0);
  const battleAlertInFlightRef = useRef(false);
  const clientVisualTravelRef = useRef(null);
  const stateRef = useRef(null);
  const dialogResolveRef = useRef(null);
  const completedRefiningToastRef = useRef(new Set());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const setClientVisualTravelState = useCallback((travel) => {
    clientVisualTravelRef.current = travel || null;
    setClientVisualTravel(travel || null);
  }, []);

  const closeDialog = useCallback((value) => {
    const resolve = dialogResolveRef.current;
    dialogResolveRef.current = null;
    setDialog(null);
    resolve?.(value);
  }, []);

  const openDialog = useCallback((config) => new Promise(resolve => {
    dialogResolveRef.current = resolve;
    setDialog({
      id: uid(),
      kind: 'info',
      message: '',
      loading: false,
      ...config,
      inputValue: config?.defaultValue ?? config?.inputValue ?? '',
      confirmationValue: ''
    });
  }), []);

  const novaDialog = useMemo(() => ({
    info(message, options = {}) {
      return openDialog({kind:'info', title:'Transmission', confirmLabel:'Acknowledge', ...options, message}).then(() => undefined);
    },
    decision(message, options = {}) {
      return openDialog({kind:'confirm', title:'Confirm Action', confirmLabel:'Confirm', ...options, message}).then(Boolean);
    },
    textInput(message, defaultValue = '', options = {}) {
      return openDialog({kind:'prompt', title:'Input Required', confirmLabel:'Submit', ...options, message, defaultValue}).then(value => value);
    },
    critical(message, options = {}) {
      return openDialog({
        kind:'danger',
        title:'Confirm Critical Action',
        confirmLabel:'Confirm',
        confirmationPhrase: options.confirmationPhrase || 'DELETE',
        allowEscape: options.allowEscape ?? true,
        ...options,
        message
      }).then(Boolean);
    }
  }), [openDialog]);

  const clearClientVisualTravel = useCallback((visualId = '') => {
    if (visualId && clientVisualTravelRef.current?.client_visual_id !== visualId) return;
    setClientVisualTravelState(null);
  }, [setClientVisualTravelState]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('nova:auth-changed', {
      detail: { authenticated: !!token }
    }));
    if (!token) setState(null);
  }, [token]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onVisibilityChange = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  async function completeAuth(res) {
    if (!res.ok) {
      const text = await res.text();
      let message = text || 'Authentication failed';
      try {
        const parsed = JSON.parse(text);
        message = parsed.detail || message;
      } catch {}
      throw new Error(message);
    }
    const data = await res.json();
    storeAuthToken(data.token);
    storeGoogleEmailHint(data.user?.google_email || '');
    setToken(data.token);
    return data;
  }

  async function login(username, password) {
    return completeAuth(await fetch(`${API}/api/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username, password}) }));
  }

  async function register(payload) {
    return completeAuth(await fetch(`${API}/api/auth/register`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) }));
  }

  async function googleLogin(credential, payload={}) {
    return completeAuth(await fetch(`${API}/api/auth/google/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({credential, ...payload}) }));
  }

  async function googleRegisterStart(credential) {
    const res = await fetch(`${API}/api/auth/google/register-start`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({credential}) });
    if (!res.ok) {
      const text = await res.text();
      let message = text || 'Google registration failed';
      try {
        const parsed = JSON.parse(text);
        message = parsed.detail || message;
      } catch {}
      throw new Error(message);
    }
    const data = await res.json();
    storeGoogleEmailHint(data.email || '');
    return data;
  }

  async function clearGoogleRegistration(googleRegistrationToken='') {
    clearGoogleClientState();
    await fetch(`${API}/api/auth/google/clear`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({google_registration_token:googleRegistrationToken}) }).catch(()=>null);
  }

  async function logout() {
    const currentToken = sessionStorage.getItem('nova_token') || token || '';
    clearAuthToken();
    clearGoogleClientState();
    setToken('');
    setState(null);
    setBootError('');
    await fetch(`${API}/api/auth/logout`, {
      method:'POST',
      headers:{'Content-Type':'application/json', ...(currentToken ? {Authorization:`Bearer ${currentToken}`} : {})},
      body:JSON.stringify({})
    }).catch(()=>null);
  }

  async function deleteProfile(confirmation) {
    const currentToken = sessionStorage.getItem('nova_token') || token || '';
    const res = await fetch(`${API}/api/profile/delete`, { method:'DELETE', headers:{'Content-Type':'application/json', Authorization:`Bearer ${currentToken}`}, body:JSON.stringify({confirmation}) });
    if (!res.ok) {
      const text = await res.text();
      let message = text || 'Profile deletion failed';
      try {
        const parsed = JSON.parse(text);
        message = parsed.detail || message;
      } catch {}
      throw new Error(message);
    }
    await logout();
    return res.json().catch(()=>({ok:true}));
  }

  async function changePassword(payload) {
    const currentToken = sessionStorage.getItem('nova_token') || token || '';
    const res = await fetch(`${API}/api/profile/password`, { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${currentToken}`}, body:JSON.stringify(payload) });
    if (!res.ok) {
      const text = await res.text();
      let message = text || 'Password change failed';
      try {
        const parsed = JSON.parse(text);
        message = parsed.detail || message;
      } catch {}
      throw new Error(message);
    }
    return res.json().catch(()=>({ok:true, message:'Password updated.'}));
  }

  function pushToast(toast) {
    if (!toast?.key || toastSeenRef.current.has(toast.key)) return;
    toastSeenRef.current.add(toast.key);
    setToasts(v => [...v.filter(t => t.key !== toast.key), toast].slice(-6));
    setTimeout(() => setToasts(v => v.filter(t => t.key !== toast.key)), 10000);
  }

  function dismissToast(key) {
    setToasts(v => v.filter(t => t.key !== key));
  }

  function goToHubPage(nextPage) {
    const destination = resolveHubDestination(nextPage, page);
    setPage(destination.hub);
    setHubTabs(prev => ({...prev, [destination.hub]:destination.tab}));
    syncFeatureHash(destination.hub);
  }

  const openServerEventOnMap = useCallback((event) => {
    const ev = normalizeServerEvent(event);
    const site = ev.mapSite || {};
    setMapFocus({
      kind: 'server_event',
      id: ev.id,
      eventId: ev.id,
      eventType: ev.event_type,
      name: ev.name,
      status: ev.status,
      mapType: site.map_type || site.mapType,
      targetGalaxyId: ev.target_galaxy_id,
      targetPlanetId: ev.target_planet_id,
      x_pct: site.x_pct,
      y_pct: site.y_pct,
      objectKey: site.objectKey || site.object_key,
      nonce: Date.now()
    });
    setPage('Galaxy');
    setHubTabs(prev => ({...prev, Galaxy:'navigation'}));
    syncFeatureHash('Galaxy');
  }, []);

  async function load(options = {}) {
    if (!token) return null;
    const silent = !!options.silent;
    const force = !!options.force;
    const skipDuringAction = options.skipDuringAction !== false;
    if (skipDuringAction && actionInFlightRef.current) return null;
    if (!force && loadInFlightRef.current) return loadInFlightRef.current;
    const loadSeq = ++loadSeqRef.current;
    const params = new URLSearchParams();
    if (force) params.set('refresh', uid());
    if (options.maps === false) params.set('maps', '0');
    const stateUrl = `${API}/api/state${params.toString() ? `?${params.toString()}` : ''}`;
    const run = (async () => {
      try {
        const res = await fetch(stateUrl, { headers:{Authorization:`Bearer ${token}`} });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            clearAuthToken();
            clearGoogleClientState();
            setToken('');
            setState(null);
          }
          throw new Error(await res.text());
        }
        const nextState = await res.json();
        if (nextState && typeof nextState === 'object') {
          setBootError('');
          if (nextState.system_map || nextState.galaxy_map) sliceLoadedAtRef.current.set('map', Date.now());
          if (loadSeq === loadSeqRef.current) setState(prev => mergeDeferredState(prev, nextState));
          return nextState;
        }
        throw new Error('State endpoint returned an empty response.');
      } catch (e) {
        const message = e.message || 'Failed to load state';
        if (!silent) {
          setBootError(message);
          setLog(l => [`ERROR: ${message}`, ...l].slice(0, 8));
        }
        return null;
      } finally {
        if (loadInFlightRef.current === run) loadInFlightRef.current = null;
      }
    })();
    loadInFlightRef.current = run;
    return run;
  }

  async function loadStateSlice(name, options = {}) {
    if (!token || !state) return null;
    const endpoint = STATE_SLICE_ENDPOINTS[name];
    if (!endpoint) return null;
    const force = !!options.force;
    const ttlMs = Number(options.ttlMs ?? 30000);
    const loadedAt = Number(sliceLoadedAtRef.current.get(name) || 0);
    if (!force && loadedAt && Date.now() - loadedAt < ttlMs) return null;
    if (!force && sliceInFlightRef.current.has(name)) return sliceInFlightRef.current.get(name);
    const run = (async () => {
      try {
        const sep = endpoint.includes('?') ? '&' : '?';
        const url = force && name === 'map' ? `${API}${endpoint}${sep}refresh=1` : `${API}${endpoint}`;
        const res = await fetch(url, { headers:{Authorization:`Bearer ${token}`} });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || data.error || `Failed to load ${name}`);
        sliceLoadedAtRef.current.set(name, Date.now());
        setState(prev => prev ? mergeDeferredState(prev, {...prev, ...data}) : prev);
        return data;
      } catch (err) {
        if (!options.silent) setLog(l => [`ERROR: ${err.message}`, ...l].slice(0, 8));
        return null;
      } finally {
        if (sliceInFlightRef.current.get(name) === run) sliceInFlightRef.current.delete(name);
      }
    })();
    sliceInFlightRef.current.set(name, run);
    return run;
  }

  async function pingMapSlice(options = {}) {
    const currentState = stateRef.current || state;
    if (!token || !currentState) return null;
    const ttlMs = Number(options.ttlMs ?? 0);
    const loadedAt = Number(sliceLoadedAtRef.current.get('map') || 0);
    if (!options.force && ttlMs > 0 && loadedAt && Date.now() - loadedAt < ttlMs) return null;
    const snapshot = currentState.map_snapshot || {};
    const revision = mapSnapshotObjectRevision(snapshot);
    const hashes = mapSnapshotGroupHashes(snapshot);
    if (!revision || !Object.keys(hashes).length) {
      return loadStateSlice('map', {silent:true, force:true, ttlMs:0});
    }
    if (!options.force && sliceInFlightRef.current.has('map-ping')) return sliceInFlightRef.current.get('map-ping');
    const run = (async () => {
      try {
        const params = new URLSearchParams({
          revision,
          lastKnownVersion: revision,
          map_type: options.mapType || window.__novaActiveMapType || 'all',
          group_hashes: JSON.stringify(hashes),
        });
        const res = await fetch(`${API}/api/map/delta?${params.toString()}`, { headers:{Authorization:`Bearer ${token}`} });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || data.error || 'Failed to ping map');
        sliceLoadedAtRef.current.set('map', Date.now());
        if (data.resyncRequired) return loadStateSlice('map', {silent:true, force:true, ttlMs:0});
        if (data.changed) setState(prev => mergeMapPingState(prev, data));
        else if (data.map_snapshot || data.server_time) setState(prev => prev ? {
          ...prev,
          server_time: data.server_time || prev.server_time,
          map_snapshot: data.map_snapshot ? {...(prev.map_snapshot || {}), ...data.map_snapshot} : prev.map_snapshot,
        } : prev);
        return data;
      } catch (err) {
        if (!options.silent) setLog(l => [`ERROR: ${err.message}`, ...l].slice(0, 8));
        return null;
      } finally {
        if (sliceInFlightRef.current.get('map-ping') === run) sliceInFlightRef.current.delete('map-ping');
      }
    })();
    sliceInFlightRef.current.set('map-ping', run);
    return run;
  }

  function refreshStateSlices(names, options = {}) {
    [...new Set(names || [])].forEach(name => {
      loadStateSlice(name, options);
    });
  }

  function scheduleStateRefresh(options = {}, delay = 250) {
    window.setTimeout(() => {
      load({ silent:true, skipDuringAction:false, ...options });
    }, delay);
  }

  function scheduleMapRefresh(options = {}, delay = 250) {
    window.setTimeout(() => {
      pingMapSlice({silent:true, force:!!options.force, ttlMs:Number(options.ttlMs ?? 0)});
    }, delay);
  }

  async function act(type, payload={}, options={}) {
    const silent = !!options.silent || SILENT_ACTION_TYPES.has(type);
    const skipRefresh = !!options.skipRefresh || NO_AUTO_STATE_REFRESH_ACTION_TYPES.has(type);
    const dedupeKey = options.dedupeKey || actionPayloadDedupeKey(type, payload);
    if (dedupeKey && actionDedupeRef.current.has(dedupeKey)) return null;
    if (dedupeKey) actionDedupeRef.current.add(dedupeKey);
    const previousStateForOptimisticTravel = state;
    const optimisticTravelState = buildOptimisticTravelState(previousStateForOptimisticTravel, type, payload);
    const optimisticTravel = optimisticTravelState?.travel_state || null;
    const optimisticVisualId = optimisticTravel?.client_visual_id || '';
    if (optimisticTravelState) {
      setClientVisualTravelState(optimisticTravel);
      setState(prev => applyClientVisualTravelState(prev || previousStateForOptimisticTravel, optimisticTravel));
    }
    actionInFlightCountRef.current += 1;
    actionInFlightRef.current = true;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API}/api/action`, { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body:JSON.stringify({type, payload, nonce: uid()}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || JSON.stringify(data) || res.statusText);
      const result = data.result || {};
      const hasState = data.state && typeof data.state === 'object';
      if (hasState) {
        loadSeqRef.current += 1;
        setState(prev => mergeDeferredState(prev, data.state));
      }
      const resultSlice = {};
      DEFERRED_STATE_KEYS.forEach(key => {
        if (result[key] !== undefined) resultSlice[key] = result[key];
      });
      if (Object.keys(resultSlice).length) setState(prev => prev ? mergeDeferredState(prev, {...prev, ...resultSlice}) : prev);
      if (result.openTradeId) setTradeModalId(Number(result.openTradeId));
      if (result.battle?.id) {
        seenBattleRef.current = result.battle.id;
        clearClientVisualTravel();
        if (!['start_combat','advance_combat_battle','attempt_combat_escape'].includes(type)) setGlobalBattle(result.battle);
      }
      if (type === 'cancel_travel' || SERVER_VALIDATED_EVENT_ACTION_TYPES.has(type)) {
        clearClientVisualTravel();
      }
      if (result.openPage) {
        const mapPages = new Set(['Galaxies','System Map','Star Map']);
        const target = mapPages.has(result.openPage) ? 'Map' : result.openPage;
        const destination = resolveHubDestination(target, page);
        setPage(destination.hub);
        setHubTabs(prev => ({...prev, [destination.hub]:destination.tab}));
      }
      if (!silent) setLog(l => [result.message || `${type} complete`, ...l].slice(0, 8));
      refreshStateSlices(sliceNamesForAction(type), {force:true, silent:true});
      if (!hasState && data.refresh !== false && !skipRefresh) {
        const forceRefresh = type === 'admin_spawn_map_objects' || !!result.forceStateRefresh;
        const refreshInBackground = options.backgroundRefresh || BACKGROUND_REFRESH_ACTION_TYPES.has(type);
        if (refreshInBackground) {
          setState(prev => withImmediateMapResult(prev, type, payload, result));
          if (MAP_SLICE_REFRESH_ACTION_TYPES.has(type)) {
            if (!SERVER_VALIDATED_EVENT_ACTION_TYPES.has(type) && (!optimisticTravelState || !CLIENT_VISUAL_TRAVEL_ACTION_TYPES.has(type))) {
              scheduleMapRefresh({ force:forceRefresh }, 320);
            }
          } else {
            scheduleStateRefresh({ force:forceRefresh, maps:false }, optimisticTravelState ? 650 : 180);
          }
          return data;
        }
        if (optimisticTravelState) {
          return data;
        }
        actionInFlightCountRef.current = Math.max(0, actionInFlightCountRef.current - 1);
        actionInFlightRef.current = actionInFlightCountRef.current > 0;
        await load({ silent:true, skipDuringAction:false, force:forceRefresh, maps:false });
        actionInFlightCountRef.current += 1;
        actionInFlightRef.current = true;
      }
      return data;
    } catch (e) {
      if (optimisticTravelState && previousStateForOptimisticTravel) {
        clearClientVisualTravel(optimisticVisualId);
        setState(previousStateForOptimisticTravel);
      } else if (SERVER_VALIDATED_EVENT_ACTION_TYPES.has(type) && clientVisualTravelRef.current?.active) {
        clearClientVisualTravel();
        scheduleMapRefresh({ force:true }, 0);
      }
      if (!silent) setLog(l => [`ERROR: ${e.message}`, ...l].slice(0, 8));
      return null;
    } finally {
      if (dedupeKey) actionDedupeRef.current.delete(dedupeKey);
      actionInFlightCountRef.current = Math.max(0, actionInFlightCountRef.current - 1);
      actionInFlightRef.current = actionInFlightCountRef.current > 0;
      if (!silent) setLoading(false);
    }
  }
  actRef.current = act;

  useEffect(() => {
    if (!token || !clientVisualTravel?.active || !clientVisualTravel?.arrival_at) return;
    const arrivalMs = new Date(clientVisualTravel.arrival_at).getTime();
    if (!Number.isFinite(arrivalMs)) return;
    let closed = false;
    const delay = Math.max(80, arrivalMs - Date.now() + 150);
    const id = window.setTimeout(async () => {
      const data = await pingMapSlice({silent:true, force:true, ttlMs:0});
      if (!closed && data) clearClientVisualTravel(clientVisualTravel.client_visual_id);
    }, delay);
    return () => {
      closed = true;
      window.clearTimeout(id);
    };
  }, [token, clientVisualTravel?.client_visual_id, clientVisualTravel?.arrival_at, clearClientVisualTravel]);

  useEffect(() => { load(); }, [token]);
  useEffect(() => {
    const handler = (evt) => {
      const detail = evt?.detail || {};
      if (detail.hub) {
        const nextHub = String(detail.hub);
        const nextTab = detail.tab ? String(detail.tab) : HUB_DEFAULT_TABS[nextHub];
        setPage(nextHub);
        if (nextTab) setHubTabs(prev => ({...prev, [nextHub]:nextTab}));
        syncFeatureHash(nextHub);
        return;
      }
      const nextPage = detail.page;
      if (nextPage) {
        const destination = resolveHubDestination(nextPage, page);
        setPage(destination.hub);
        setHubTabs(prev => ({...prev, [destination.hub]:destination.tab}));
      }
    };
    window.addEventListener('nova:set-page', handler);
    return () => window.removeEventListener('nova:set-page', handler);
  }, [page]);
  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = String(event.key || '').toLowerCase();
      const hotkey = {m:'Galaxy', p:'Planet', c:'Character', o:'Market'}[key];
      if (!hotkey) return;
      event.preventDefault();
      goToHubPage(hotkey);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [page]);
  useEffect(() => {
    if (!token || !state) return;
    const tutorialUserKey = String(
      state.user?.id ||
      state.user?.user_id ||
      state.user?.username ||
      state.profile?.username ||
      state.player?.player_id ||
      state.player?.callsign ||
      'local-player'
    );
    window.dispatchEvent(new CustomEvent('nova:tutorial-user-ready', {
      detail: {
        userKey: tutorialUserKey,
        displayName: state.profile?.displayName || state.player?.callsign || state.user?.username || 'Pilot'
      }
    }));
  }, [
    token,
    state?.user?.id,
    state?.user?.user_id,
    state?.user?.username,
    state?.profile?.username,
    state?.profile?.displayName,
    state?.player?.player_id,
    state?.player?.callsign
  ]);
  useEffect(() => { const id = setInterval(() => setClock(Date.now()), 250); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (autoExploreMode) localStorage.setItem('nova_auto_explore_mode', autoExploreMode);
    else localStorage.removeItem('nova_auto_explore_mode');
    if (autoExploreMode) {
      localStorage.setItem('nova_auto_explore_last_mode', autoExploreMode);
      setAutoExploreLastMode(autoExploreMode);
    }
    localStorage.removeItem('nova_auto_explore_pirates');
  }, [autoExploreMode]);
  useEffect(() => {
    if (autoExploreStatus) localStorage.setItem('nova_auto_explore_status', autoExploreStatus);
  }, [autoExploreStatus]);
  useEffect(() => {
    if (!token || !state || !autoExploreMode) return;
    let closed = false;
    const activeMode = autoExploreMode;
    const activeConfig = AUTO_EXPLORE_MODE_BY_KEY[activeMode] || AUTO_EXPLORE_MODE_BY_KEY.pirate;
    const runTick = async () => {
      if (closed || autoExploreBusyRef.current || !actRef.current) return;
      autoExploreBusyRef.current = true;
      try {
        const data = await actRef.current('auto_explore_battle_tick', {mode:activeMode, pirates_only:activeMode === 'pirate'}, {
          silent:true,
          dedupeKey:`auto-explore-${activeMode}`,
          backgroundRefresh:true
        });
        const result = data?.result || {};
        if (!data) {
          setAutoExploreStatus(`${activeConfig.statusPaused} after an action error.`);
          setAutoExploreMode('');
          return;
        }
        setAutoExploreStatus(result.message || data.detail || `${activeConfig.label} tick complete.`);
        if (result.stopAutoExplore || result.nonPirateBattle || result.docked) {
          setAutoExploreMode('');
        }
      } catch (err) {
        setAutoExploreStatus(String(err?.message || err || `${activeConfig.statusPaused} after an error.`));
        setAutoExploreMode('');
      } finally {
        window.setTimeout(() => {
          autoExploreBusyRef.current = false;
        }, 250);
      }
    };
    runTick();
    const id = window.setInterval(runTick, AUTO_EXPLORE_TICK_MS);
    return () => {
      closed = true;
      window.clearInterval(id);
    };
  }, [token, !!state, autoExploreMode]);
  const effectivePage = state?.active_pirate_station ? 'Planet' : page;
  const activeMapBattle = !!(globalBattle?.id || state?.active_battle?.id || state?.fight?.latestBattle?.id);
  const refreshSeconds = Math.max(20, Number(state?.game_tuning?.client_runtime?.state_refresh_seconds || 45));
  const mapRefreshMs = mapPollingCadenceMs(state, effectivePage, activeMapBattle, tabHidden);
  const battleAlertPollMs = activeMapBattle
    ? mapRefreshMs
    : Math.max(5000, Number(state?.game_tuning?.client_runtime?.battle_alert_poll_ms || 10000));
  useEffect(() => {
    if (!token) return undefined;
    const intervalMs = tabHidden ? 30000 : refreshSeconds * 1000;
    const id = setInterval(() => load({ silent:true, maps:false }), intervalMs);
    return () => clearInterval(id);
  }, [token, refreshSeconds, tabHidden]);
  useEffect(() => {
    const latest = state?.fight?.latestBattle;
    if (!latest?.id) return;
    const openSpace = !!state?.travel_state?.open_space;
    if (seenBattleRef.current == null) { seenBattleRef.current = latest.id; return; }
    if (seenBattleRef.current !== latest.id) {
      seenBattleRef.current = latest.id;
      if (openSpace && page !== 'Galaxy') {
        setPage('Galaxy');
        setHubTabs(prev => ({...prev, Galaxy:'navigation'}));
      }
      setGlobalBattle(latest);
    }
  }, [state?.fight?.latestBattle?.id, state?.travel_state?.open_space, page]);
  useEffect(() => {
    (state?.party?.incomingInvites || []).forEach(invite => pushToast({
      key:`party:${invite.id}`,
      type:'party',
      message:`${invite.inviter_callsign || invite.inviter_username || 'Pilot'} asked you to join a party.`,
      actionLabel:'Open Party',
      onClick:()=>goToHubPage('Party')
    }));
    (state?.trade?.incomingTrades || []).forEach(trade => pushToast({
      key:`trade:${trade.id}`,
      type:'trade',
      message:`${trade.right?.player?.displayName || 'Pilot'} initiated a trade.`,
      actionLabel:'Open Trade',
      onClick:()=>setTradeModalId(Number(trade.id))
    }));
    (state?.social?.incomingFriendRequests || []).forEach(req => pushToast({
      key:`friend:${req.id}`,
      type:'social',
      message:`${req.displayName || req.username || 'Pilot'} sent you a friend request.`,
      actionLabel:'Open Social',
      onClick:()=>goToHubPage('Social')
    }));
  }, [state?.party?.incomingInvites, state?.trade?.incomingTrades, state?.social?.incomingFriendRequests]);

  useEffect(() => {
    const completed = (state?.crafting_queue || []).filter(j => j.job_kind === 'refining' && j.status === 'complete' && !completedRefiningToastRef.current.has(j.id));
    if (!completed.length) return;
    completed.forEach(j => completedRefiningToastRef.current.add(j.id));
    pushToast({
      key:`refining-complete:${completed.map(j=>j.id).join('-')}`,
      type:'refining',
      message:completed.length === 1 ? `${completed[0].recipe_name} finished refining.` : `${completed.length} refining jobs finished.`,
      actionLabel:'Open Pipeline',
      onClick:()=>setRefiningPanelOpen(true)
    });
  }, [state?.crafting_queue]);

  useEffect(() => {
    const friends = state?.social?.friends || [];
    const prev = friendOnlineRef.current;
    if (prev.size) {
      friends.forEach(f => {
        const id = String(f.playerId);
        if (f.online && prev.get(id) === false) {
          pushToast({key:`friend-online:${id}:${Date.now()}`, type:'social', message:`${f.displayName || f.username || 'Friend'} is online.`, actionLabel:'View Social', onClick:()=>goToHubPage('Social')});
        }
      });
    }
    const next = new Map();
    friends.forEach(f => next.set(String(f.playerId), !!f.online));
    friendOnlineRef.current = next;
  }, [state?.social?.friends]);


  useEffect(() => {
    const fuel = state?.phase_expansion?.fuelStatus || state?.fuel_status;
    if (fuel?.empty) pushToast({key:'fuel-empty', type:'fuel', message:fuel.message || 'Emergency power active. Speed reduced and jump gates disabled.', actionLabel:'Open Calendar', onClick:()=>goToHubPage('Calendar')});
    else if (fuel?.low) pushToast({key:'fuel-low', type:'fuel', message:fuel.message || 'Low fuel warning.', actionLabel:'Refuel', onClick:()=>goToHubPage('Calendar')});
    (state?.phase_expansion?.serverEvents || []).filter(e => ['warning','active'].includes(e.status)).slice(0,6).forEach(e => {
      pushToast({key:`server-event:${e.id}:${e.status}`, type:'event', message:`${e.name} ${e.status === 'active' ? 'is active' : 'starts soon'}.`, actionLabel:'Open Map', onClick:()=>openServerEventOnMap(e)});
    });
  }, [state?.phase_expansion?.fuelStatus?.pct, state?.phase_expansion?.serverEvents, openServerEventOnMap]);

  useEffect(() => {
    if (!token || !state?.travel_state?.open_space || globalBattle?.id) return;
    let closed = false;
    const pollBattleAlert = async () => {
      if (closed || actionInFlightRef.current || loadInFlightRef.current || battleAlertInFlightRef.current) return;
      battleAlertInFlightRef.current = true;
      try {
        const res = await fetch(`${API}/api/battle-alert`, { headers:{Authorization:`Bearer ${token}`} });
        if (!res.ok) return;
        const data = await res.json();
        const battle = data?.battle;
        if (closed || !data?.hasActiveBattle || !battle?.id) return;
        if (seenBattleRef.current === battle.id && globalBattle?.id === battle.id) return;
        seenBattleRef.current = battle.id;
        setPage('Galaxy');
        setHubTabs(prev => ({...prev, Galaxy:'navigation'}));
        setGlobalBattle(battle);
      } catch {
      } finally {
        battleAlertInFlightRef.current = false;
      }
    };
    const initial = setTimeout(pollBattleAlert, Math.min(750, battleAlertPollMs));
    const id = setInterval(pollBattleAlert, battleAlertPollMs);
    return () => {
      closed = true;
      clearTimeout(initial);
      clearInterval(id);
      battleAlertInFlightRef.current = false;
    };
  }, [token, state?.travel_state?.open_space, battleAlertPollMs, globalBattle?.id]);

  useEffect(() => {
    if (!token || !state) return;
    refreshStateSlices(sliceNamesForPage(effectivePage), {silent:true});
    if (!['Galaxy', 'Market'].includes(effectivePage)) return;
    const intervalMs = effectivePage === 'Galaxy'
      ? mapRefreshMs
      : (tabHidden ? 30000 : 15000);
    const id = setInterval(() => {
      if (effectivePage === 'Galaxy') {
        pingMapSlice({silent:true, ttlMs:Math.max(1000, mapRefreshMs - 250)});
        if (!tabHidden) refreshStateSlices(['party', 'public_profiles'], {force:true, silent:true});
      } else {
        refreshStateSlices(['chat', 'party', 'social', 'public_profiles'], {force:true, silent:true});
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [token, !!state, effectivePage, mapRefreshMs, tabHidden]);

  if (!token) return <Login onLogin={login} onRegister={register} onGoogleLogin={googleLogin} onGoogleRegisterStart={googleRegisterStart} onClearGoogle={clearGoogleRegistration} />;
  if (!state) return <div className="boot">
    <div className="bootCard">
      <b>{bootError ? 'Unable to Load Nova Frontiers' : 'Loading Nova Frontiers...'}</b>
      {bootError && <>
        <p>{bootError}</p>
        <div className="bootActions">
          <button className="primary" onClick={() => load({ force:true, skipDuringAction:false })}>Retry</button>
          <button onClick={logout}>Log Out</button>
        </div>
      </>}
    </div>
  </div>;

  const renderState = applyClientVisualTravelState(state, clientVisualTravel);
  const visiblePage = effectivePage;
  const guardedSetPage = (nextPage) => {
    const requested = String(nextPage || '');
    const destination = resolveHubDestination(requested, visiblePage);
    if (requested === 'Planet' && planetNavDisabled(renderState)) {
      return;
    }
    setPage(destination.hub);
    setHubTabs(prev => ({...prev, [destination.hub]:destination.tab}));
    syncFeatureHash(requested);
  };
  const setHubTab = (hub, tab) => {
    setPage(hub);
    setHubTabs(prev => ({...prev, [hub]:tab}));
    syncFeatureHash(hub);
  };
  const toggleAutoExploreMode = (mode) => {
    const config = AUTO_EXPLORE_MODE_BY_KEY[mode] || AUTO_EXPLORE_MODE_BY_KEY.pirate;
    const enabling = autoExploreMode !== mode;
    setAutoExploreStatus(enabling ? config.start : 'Paused by pilot.');
    if (enabling) setAutoExploreLastMode(mode);
    setAutoExploreMode(enabling ? mode : '');
  };
  const ctx = {
    state: renderState,
    act,
    loading,
    log,
    setPage: guardedSetPage,
    clock,
    setTradeModalId,
    token,
    refreshState: load,
    mapFocus,
    openServerEventOnMap,
    autoExploreMode,
    autoExploreLastMode,
    autoExploreStatus,
    onToggleAutoExploreMode: toggleAutoExploreMode,
    dialogs: novaDialog
  };
  const cancelDialog = () => closeDialog(dialog?.kind === 'prompt' ? null : false);
  const confirmDialog = () => closeDialog(dialog?.kind === 'prompt' ? (dialog.inputValue ?? '') : true);
  const updateDialogInput = (value) => {
    setDialog(prev => prev ? {
      ...prev,
      [prev.confirmationPhrase ? 'confirmationValue' : 'inputValue']: value
    } : prev);
  };
  return <div className={`appShell page-${pageSlug(visiblePage)}`} style={{'--page-accent':pageIntel(visiblePage).accent}}>
    <div className="authBackdrop" aria-hidden="true">
      <span className="authOrbit authOrbitOne" />
      <span className="authOrbit authOrbitTwo" />
      <span className="authScanline" />
    </div>
    <Sidebar page={visiblePage} setPage={guardedSetPage} state={renderState} hubTabs={hubTabs} />
    <MobileMoreMenu open={mobileMoreOpen} page={visiblePage} setPage={guardedSetPage} state={renderState} onClose={()=>setMobileMoreOpen(false)} />
    <main className="main">
      <Topbar state={renderState} onLogout={logout} />
      <RefiningPipelineHUD state={renderState} clock={clock} act={act} onOpen={()=>setRefiningPanelOpen(true)} />
      <div className={`content ${visiblePage === 'Galaxy' ? 'wideMapContent' : ''}`}>
        <CommandRibbon state={renderState} page={ribbonPageFor(visiblePage, hubTabs)} setPage={guardedSetPage} clock={clock} />
        {visiblePage === 'Galaxy' && <GalaxyHub {...ctx} activeTab={hubTabs.Galaxy || HUB_DEFAULT_TABS.Galaxy} setHubTab={(tab)=>setHubTab('Galaxy', tab)} />}
        {visiblePage === 'Planet' && <PlanetHub {...ctx} activeTab={hubTabs.Planet || HUB_DEFAULT_TABS.Planet} setHubTab={(tab)=>setHubTab('Planet', tab)} />}
        {visiblePage === 'Character' && <CharacterHub {...ctx} activeTab={hubTabs.Character || HUB_DEFAULT_TABS.Character} setHubTab={(tab)=>setHubTab('Character', tab)} onDeleteProfile={deleteProfile} onChangePassword={changePassword} />}
        {visiblePage === 'Market' && <MarketSocialMetaHub {...ctx} activeTab={hubTabs.Market || HUB_DEFAULT_TABS.Market} setHubTab={(tab)=>setHubTab('Market', tab)} />}
      </div>
      <ActionLog log={log} />
    </main>
    <MobileContextActionBar state={renderState} page={visiblePage} setPage={guardedSetPage} />
    <MobileBottomNav page={visiblePage} setPage={guardedSetPage} state={renderState} moreOpen={mobileMoreOpen} setMoreOpen={setMobileMoreOpen} />
    <ToastStack toasts={toasts} dismissToast={dismissToast} />
    <TradeModal trade={(renderState.trade?.trades || []).find(t=>Number(t.id)===Number(tradeModalId)) || (tradeModalId ? renderState.trade?.current : null)} state={renderState} act={act} onClose={()=>setTradeModalId(null)} />
    {globalBattle && <GlobalBattleModal battle={globalBattle} act={act} onClose={()=>setGlobalBattle(null)} />}
    {refiningPanelOpen && <RefiningPanelModal state={renderState} clock={clock} act={act} onClose={()=>setRefiningPanelOpen(false)} />}
    <NovaDialogModal dialog={dialog} onCancel={cancelDialog} onConfirm={confirmDialog} onInputChange={updateDialogInput} />
  </div>;
}


function BrandLockup({size='default'}) {
  const [logoFailed, setLogoFailed] = useState(false);
  return <div className={`brandNova brandNova-${size}`}>
    {!logoFailed
      ? <img src={brandAssets.logo} alt="Nova Frontiers" onError={() => setLogoFailed(true)} />
      : <strong className="brandNovaFallback"><span>Nova</span> Frontiers</strong>}
    <span>Persistent Frontier Command</span>
  </div>;
}

function pageSlug(pageName='dashboard') {
  return String(pageName || 'dashboard').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dashboard';
}

function pageIntel(pageName='Dashboard') {
  const intel = PAGE_INTEL[pageName] || {
    eyebrow:'Frontier Console',
    title:pageName || 'Command',
    deck:'Live tools, pilot state, and frontier operations.',
    accent:SITE_PALETTE_ACCENT,
  };
  return {...intel, accent:SITE_PALETTE_ACCENT};
}

function quickActionForPage(pageName, setPage) {
  if (pageName === 'Galaxy') return { label:'Open Ship Hub', onClick:()=>setPage('Ships & Hangar') };
  if (pageName === 'Planet') return { label:'Open Map', onClick:()=>setPage('Map') };
  if (pageName === 'Character') return { label:'Open Auction', onClick:()=>setPage('Auction') };
  if (pageName === 'Market') return { label:'Open Map', onClick:()=>setPage('Map') };
  if (pageName === 'Map') return { label:'Open Hangar', onClick:()=>setPage('Ships & Hangar') };
  if (pageName === 'Market') return { label:'Open Cargo', onClick:()=>setPage('Inventory') };
  if (pageName === 'Inventory') return { label:'Open Crafting', onClick:()=>setPage('Crafting') };
  if (pageName === 'Ships & Hangar') return { label:'Open Market', onClick:()=>setPage('Market') };
  if (pageName === 'Fight') return { label:'Open Warfront', onClick:()=>setPage('Faction War') };
  if (pageName === 'Dashboard') return { label:'Open Map', onClick:()=>setPage('Map') };
  return { label:'Bridge Overview', onClick:()=>setPage('Dashboard') };
}

function CommandRibbon({state, page, setPage, clock}) {
  const intel = pageIntel(page);
  const p = state.player || {};
  const ship = state.active_ship || {};
  const travel = state.travel_state || {};
  const factionKey = String(state.profile?.factionKey || state.player?.faction_key || state.player?.faction || '').toLowerCase();
  const factionAsset = factionAssets[factionKey] || Object.values(factionAssets).find(f => String(f.name || '').toLowerCase() === factionKey) || null;
  const action = quickActionForPage(page, setPage);
  return <section className="commandRibbon" style={{'--page-accent':intel.accent}}>
    <div className="commandRibbonVisual" aria-hidden="true">
      {factionAsset?.emblem ? <img src={factionAsset.emblem} alt="" /> : <GameImage src="" assetType="ship" category={ship.role || ship.class_name || 'frontier command ship'} alt="" />}
      <i />
    </div>
    <div className="commandRibbonCopy">
      <span>{intel.eyebrow}</span>
      <h1>{intel.title}</h1>
      <p>{intel.deck}</p>
    </div>
    <div className="commandTelemetry">
      <div><span>Location</span><b>{state.location?.name || state.location?.galaxy_name || 'Unknown'}</b></div>
      <div><span>Ship</span><b>{ship.name || 'No active ship'}</b></div>
      <div><span>Credits</span><b>{fmt(p.credits)}</b></div>
      <div><span>Status</span><b>{travel.active ? `${label(travel.mode)} ${clockTimeLeft(travel.arrival_at)}` : `Synced ${new Date(clock).toLocaleTimeString()}`}</b></div>
    </div>
    <div className="commandRibbonActions">
      <button className="primary" onClick={action.onClick}>{action.label}</button>
      {page !== 'Messages' && <button onClick={()=>setPage('Messages')}>Signals</button>}
    </div>
  </section>;
}

function FactionIdentityStrip() {
  return <div className="factionIdentityStrip">
    {Object.values(factionAssets).map(f => <span key={f.key} style={{'--faction-accent':f.color}}>
      <img src={f.emblem} alt="" />
      <b>{f.name}</b>
    </span>)}
  </div>;
}

const factionOnboardingCopy = {
  solar_accord: {
    about: 'Safe lanes. Clean markets. Fleet backing.',
    lore: 'A disciplined coalition of convoy marshals, station courts, and signal beacons that turns dangerous space into mapped, taxed, protected routes.',
    identity: 'Convoy guardians and lawful frontier builders',
    playstyle: 'Defensive logistics, escort contracts, patrol income, and clean-market leverage.',
    bonuses: ['+8% patrol and escort payouts', '+5% lawful market prices', 'Starter systems begin with higher security'],
    debuffs: ['-6% illicit market margins', 'Hostile pirate space escalates faster'],
  },
  iron_meridian: {
    about: 'Heavy hulls. Hard industry. Patient power.',
    lore: 'A foundry-bonded machine polity that measures territory in refinery output, armored tonnage, and the stations it can keep running under fire.',
    identity: 'Industrial siege engineers and armored haulers',
    playstyle: 'Mining, manufacturing, durable ships, repair efficiency, and long-form territory pressure.',
    bonuses: ['+8% mining and refinery yield', '+6% hull repair efficiency', 'Guild industry projects complete faster'],
    debuffs: ['-5% evasion in light ships', 'Diplomacy checks start colder in free ports'],
  },
  umbral_veil: {
    about: 'Risky routes. Sharp scans. Quiet exits.',
    lore: 'A loose intelligence network of salvagers, smugglers, and void-touched scouts that survives by seeing first and leaving clean.',
    identity: 'Recon operators, salvagers, and black-route specialists',
    playstyle: 'Scanning, stealthy routes, salvage, smuggling, and high-risk timing windows.',
    bonuses: ['+9% smuggling and salvage payouts', '+6% scan range in unstable space', 'Lower black-market heat from first offenses'],
    debuffs: ['-7% lawful faction standing gains', 'Security patrols inspect them more often'],
  },
};

function factionCopyFor(faction) {
  const key = String(faction?.code || faction?.key || '').toLowerCase();
  return factionOnboardingCopy[key] || {
    about: faction?.description || faction?.guidance?.youAreChoosing || 'Pick your allies. Accept your enemies.',
    bonuses: faction?.bonuses || ['Balanced starter position'],
    debuffs: faction?.debuffs || ['No special drawbacks reported'],
  };
}

function factionShortLine(faction) {
  const key = String(faction?.code || faction?.key || '').toLowerCase();
  return ({
    solar_accord: 'Safe lanes. Fleet backing.',
    iron_meridian: 'Heavy hulls. Hard industry.',
    umbral_veil: 'Sharp scans. Quiet exits.',
  })[key] || faction?.guidance?.short || factionCopyFor(faction).about;
}

function factionDecisionLine(faction) {
  const key = String(faction?.code || faction?.key || '').toLowerCase();
  return ({
    solar_accord: 'Patrol law, clean markets, convoy allies.',
    iron_meridian: 'Ore, armor, infrastructure.',
    umbral_veil: 'Scouting, salvage, timing.',
  })[key] || factionCopyFor(faction).about;
}

function factionDescriptor(faction) {
  return factionShortLine(faction);
}

function factionPresentationFor(faction) {
  const key = String(faction?.code || faction?.key || '').toLowerCase();
  const copy = factionOnboardingCopy[key] || {};
  const asset = factionAssets[key] || {};
  return {
    lore: copy.lore || faction?.guidance?.youAreChoosing || faction?.description || factionCopyFor(faction).about,
    identity: copy.identity || `${faction?.species || 'Frontier'} doctrine`,
    playstyle: copy.playstyle || factionDecisionLine(faction),
    strengths: faction?.bonuses?.length ? faction.bonuses : (copy.bonuses || ['Balanced starter position']),
    tradeoffs: faction?.debuffs?.length ? faction.debuffs : (copy.debuffs || ['No special drawbacks reported']),
    ship: asset?.ships?.battleship || asset?.ships?.cruiser || asset?.ships?.fighter || '',
    avatar: asset?.avatarOptions?.[0]?.url || '',
  };
}

const REGISTRATION_FALLBACK_FACTIONS = ['solar_accord', 'iron_meridian', 'umbral_veil'].map((code, index) => {
  const asset = factionAssets[code];
  const copy = factionOnboardingCopy[code];
  return {
    id: index + 1,
    code,
    key: code,
    name: asset.name,
    species: asset.species,
    color: asset.color,
    emblem: asset.emblem,
    avatar_options: asset.avatarOptions,
    avatarOptions: asset.avatarOptions,
    description: copy.about,
    guidance: {
      short: {
        solar_accord: 'Safe lanes. Fleet backing.',
        iron_meridian: 'Heavy hulls. Hard industry.',
        umbral_veil: 'Sharp scans. Quiet exits.',
      }[code],
      youAreChoosing: copy.about,
    },
    balance_label: 'Balanced',
    players: 1,
    online_players: 1,
    player_percent: 33.3,
    galaxy_control_percent: 33.3,
    bonuses: copy.bonuses,
    debuffs: copy.debuffs,
  };
});

function listText(value, fallback = 'None reported') {
  if (Array.isArray(value) && value.length) return value.join(' / ');
  if (typeof value === 'string' && value.trim()) return value;
  return fallback;
}

const LANDING_FACTIONS = [
  {
    key: 'solar_accord',
    title: 'Solar Accord',
    label: 'Patrol law and clean trade',
    color: '#ffbf5a',
    shipRole: 'frigate',
    line: 'Safe lanes. Fleet backing.',
  },
  {
    key: 'iron_meridian',
    title: 'Iron Meridian',
    label: 'Foundries and heavy hulls',
    color: '#c9d2d8',
    shipRole: 'battleship',
    line: 'Build slow. Hit hard.',
  },
  {
    key: 'umbral_veil',
    title: 'Umbral Veil',
    label: 'Scouts and shadow routes',
    color: '#b174ff',
    shipRole: 'fighter',
    line: 'See first. Leave quietly.',
  },
];

const LANDING_SECTIONS = [
  {
    key: 'factions',
    eyebrow: 'Alignment',
    title: 'Choose Your Faction',
    accent: '#ffbf5a',
    visual: 'factions',
    lines: [
      'Three powers. Three kinds of trouble.',
      'Pick your allies. Choose your enemies.',
    ],
  },
  {
    key: 'galaxy',
    eyebrow: 'Open World',
    title: 'Explore a Living Galaxy',
    accent: '#58e6ff',
    visual: 'galaxy',
    lines: [
      'Everything moves.',
      "Scan first. Quiet lanes don't stay quiet.",
    ],
  },
  {
    key: 'trade',
    eyebrow: 'Economy',
    title: 'Trade, Craft, and Build Power',
    accent: '#57ffa3',
    visual: 'trade',
    lines: [
      'Move smart. Profit more.',
      'Timing beats cargo space.',
    ],
  },
  {
    key: 'territory',
    eyebrow: 'Warfront',
    title: 'Fight for Territory',
    accent: '#ff744d',
    visual: 'war',
    lines: [
      'Location changes everything.',
      'Pick your fights.',
    ],
  },
  {
    key: 'events',
    eyebrow: 'Live Events',
    title: 'Server Events',
    accent: '#b174ff',
    visual: 'events',
    lines: [
      'The map turns without warning.',
      'Raids. Wormholes. Rare drops.',
    ],
  },
  {
    key: 'history',
    eyebrow: 'Persistence',
    title: 'Your Story Persists',
    accent: '#8cfaff',
    visual: 'history',
    lines: [
      'You leave a mark.',
      "It doesn't reset.",
    ],
  },
];

function LandingScrollSection({ section, index }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true);
    }, { threshold: 0.26, rootMargin: '0px 0px -12% 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <section
    ref={ref}
    className={`landingStorySection ${visible ? 'visible' : ''}`}
    style={{ '--section-accent': section.accent, '--section-index': index }}
  >
    <div className="landingStickyVisual" aria-hidden="true">
      {renderLandingVisual(section)}
    </div>
    <div className="landingStoryCopy">
      <span>{section.eyebrow}</span>
      <h2>{section.title}</h2>
      {section.lines.map(line => <p key={line}>{line}</p>)}
    </div>
  </section>;
}

function renderLandingVisual(section) {
  if (section.visual === 'factions') {
    return <div className="landingFactionVisual">
      {LANDING_FACTIONS.map(faction => {
        const asset = factionAssets[faction.key];
        return <article key={faction.key} style={{ '--faction-accent': faction.color }}>
          <img className="landingFactionEmblem" src={asset?.emblem} alt="" loading="lazy" />
          <GameImage className="landingFactionShip" src={asset?.ships?.[faction.shipRole]} assetType="ship" category={faction.key} hint={`${faction.key} ${faction.shipRole}`} alt="" loading="lazy" />
          <b>{faction.title}</b>
          <small>{faction.label}</small>
          <p>{faction.line}</p>
        </article>;
      })}
    </div>;
  }

  if (section.visual === 'galaxy') {
    return <div className="landingGalaxyVisual">
      <i className="route r1" /><i className="route r2" /><i className="route r3" />
      <span className="planet p1"><GameImage src="" assetType="planet" category="terran" hint="terran trade planet" alt="" loading="lazy" /></span>
      <span className="planet p2"><GameImage src="" assetType="planet" category="ice research" hint="ice research planet" alt="" loading="lazy" /></span>
      <span className="planet p3"><GameImage src="" assetType="planet" category="lava industrial" hint="industrial lava planet" alt="" loading="lazy" /></span>
      <span className="movingShip s1"><GameImage src="" assetType="ship" category="freighter cargo" hint="freighter cargo ship" alt="" loading="lazy" /></span>
      <span className="movingShip s2 hostile"><GameImage src="" assetType="ship" category="pirate interceptor" hint="pirate interceptor" alt="" loading="lazy" /></span>
      <em>Probe ping</em>
    </div>;
  }

  if (section.visual === 'trade') {
    return <div className="landingTradeVisual">
      {['ore blue crystal', 'cargo cache', 'fabricator core', 'shield emitter'].map((hint, idx) => (
        <span key={hint} className={`tradeNode n${idx + 1}`}>
          <GameImage src="" assetType={idx < 2 ? 'material' : 'module'} category={hint} hint={hint} alt="" loading="lazy" />
        </span>
      ))}
      <div className="recipeLine"><b>Hold</b><i /><b>Refine</b><i /><b>Upgrade</b></div>
      <GameImage className="tradeShip" src="" assetType="ship" category="cargo freighter freightline 77" hint="trade freighter" alt="" loading="lazy" />
    </div>;
  }

  if (section.visual === 'war') {
    return <div className="landingWarVisual">
      <span className="border b1" /><span className="border b2" /><span className="border b3" />
      <GameImage className="warShip a" src="" assetType="ship" category="helios solar lancer combat" hint="solar faction fighter" alt="" loading="lazy" />
      <GameImage className="warShip b" src="" assetType="ship" category="varn battleship iron meridian" hint="iron meridian battleship" alt="" loading="lazy" />
      <GameImage className="warShip c" src="" assetType="ship" category="nyx stealth fighter" hint="umbral veil fighter" alt="" loading="lazy" />
      <strong>Contested Orbit</strong>
    </div>;
  }

  if (section.visual === 'events') {
    return <div className="landingEventVisual">
      <span className="wormhole" />
      <GameImage className="alienShip" src="" assetType="ship" category="alien xeno raid" hint="alien raid ship" alt="" loading="lazy" />
      <GameImage className="eventPlanet" src="" assetType="planet" category="singularity anomaly" hint="wormhole anomaly" alt="" loading="lazy" />
      <b>Rare signal detected</b>
    </div>;
  }

  return <div className="landingHistoryVisual">
    <div className="historyArc"><span /><span /><span /><span /></div>
    <div className="leaderboardCard"><b>#07</b><span>Convoy Breaker</span><i>Faction impact rising</i></div>
    <div className="historyLog">
      <span>Founded route</span>
      <span>Won siege</span>
      <span>Recovered relic</span>
    </div>
  </div>;
}

function Login({onLogin, onRegister, onGoogleLogin, onGoogleRegisterStart, onClearGoogle}) {
  const [registerOpen,setRegisterOpen] = useState(false);
  const [u,setU] = useState('');
  const [p,setP] = useState('');
  const [callsign,setCallsign] = useState('');
  const [email,setEmail] = useState('');
  const [selectedFaction,setSelectedFaction] = useState('');
  const [selectedAvatar,setSelectedAvatar] = useState('');
  const [factionBalance,setFactionBalance] = useState(null);
  const [err,setErr] = useState('');
  const [status,setStatus] = useState('');
  const [busy,setBusy] = useState(false);
  const [googleBusy,setGoogleBusy] = useState(false);
  const [pendingGoogle,setPendingGoogle] = useState(null);
  const [googleReady,setGoogleReady] = useState(false);
  const googleButtonRef = useRef(null);
  const registerGoogleButtonRef = useRef(null);

  const factions = factionBalance?.factions?.length ? factionBalance.factions : REGISTRATION_FALLBACK_FACTIONS;
  useEffect(() => {
    let closed = false;
    fetch(`${API}/api/auth/factions`).then(r=>r.ok ? r.json() : null).then(data => {
      if (closed || !data) return;
      setFactionBalance(data);
    }).catch(()=>{});
    return () => { closed = true; };
  }, []);

  useEffect(() => {
    const googleTarget = registerOpen ? registerGoogleButtonRef.current : googleButtonRef.current;
    if (!GOOGLE_CLIENT_ID || !googleReady || !googleTarget || !window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        if (!response?.credential) return;
        await submitGoogle(response.credential);
      },
      auto_select: false
    });
    googleTarget.innerHTML = '';
    window.google.accounts.id.renderButton(googleTarget, { theme:'filled_black', size:'large', text:registerOpen ? 'signup_with' : 'signin_with', shape:'pill', width: registerOpen ? 360 : 320 });
  }, [googleReady, registerOpen, selectedFaction, callsign, pendingGoogle?.token]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    if (window.google?.accounts?.id) { setGoogleReady(true); return; }
    if (document.querySelector('script[data-nova-google-login]')) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.setAttribute('data-nova-google-login', '1');
    script.onload = () => setGoogleReady(true);
    document.head.appendChild(script);
  }, []);

  async function runAuth(fn) {
    setErr('');
    setStatus('');
    setBusy(true);
    try { await fn(); }
    catch(ex) { setErr(String(ex.message || ex).replace(/^\{"detail":"?|"?\}$/g, '')); }
    finally { setBusy(false); }
  }

  async function clearPendingGoogle(showMessage=false) {
    const token = pendingGoogle?.token || '';
    setPendingGoogle(null);
    if (showMessage) setStatus('Google login cleared.');
    if (token || showMessage) await onClearGoogle?.(token);
  }

  const openRegisterModal = async () => {
    setErr('');
    setStatus('');
    setRegisterOpen(true);
  };

  const closeRegisterModal = async () => {
    const token = pendingGoogle?.token || '';
    setPendingGoogle(null);
    setRegisterOpen(false);
    setErr('');
    setStatus('');
    if (token) await onClearGoogle?.(token);
  };

  const submit = async (e) => {
    e.preventDefault();
    await runAuth(async () => {
      if (!u.trim()) throw new Error('Enter your username.');
      if (!p) throw new Error('Enter your password.');
      await onLogin(u.trim(),p);
    });
  };

  const submitRegistration = async (e) => {
    e.preventDefault();
    await runAuth(async () => {
      if (!u.trim()) throw new Error('Choose a username.');
      if (!email.trim()) throw new Error('Enter an email address.');
      if (!pendingGoogle?.token && !p) throw new Error('Enter a password.');
      if (!pendingGoogle?.token && p.length < 6) throw new Error('Password must be at least 6 characters.');
      if (!selectedFaction) throw new Error('Choose a faction to continue.');
      try {
        await onRegister({ username:u.trim(), password:p, callsign:callsign.trim() || u.trim(), email:email.trim(), faction_id:Number(selectedFaction), avatar_id:selectedAvatar, google_registration_token:pendingGoogle?.token || '' });
        setRegisterOpen(false);
      } catch(ex) {
        if (pendingGoogle?.token) await clearPendingGoogle(false);
        throw ex;
      }
    });
  };

  async function submitGoogle(credential) {
    setErr('');
    setStatus('');
    setGoogleBusy(true);
    try {
      if (!registerOpen) {
        await onGoogleLogin(credential);
        return;
      }
      const data = await onGoogleRegisterStart(credential);
      setPendingGoogle({ token:data.google_registration_token, email:data.email || '', displayName:data.display_name || '' });
      if (data.email) setEmail(data.email);
      if (!callsign && data.display_name) setCallsign(data.display_name.slice(0, 32));
      if (!u && data.display_name) setU(data.display_name.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24));
      setStatus(data.message || 'Google account linked. Finish creating your profile.');
    } catch(ex) {
      setErr(String(ex.message || ex).replace(/^\{"detail":"?|"?\}$/g, ''));
      clearGoogleClientState();
    } finally {
      setGoogleBusy(false);
    }
  }

  const selectedFactionData = factions.find(f => String(f.id) === String(selectedFaction)) || null;
  const selectedFactionAvatars = selectedFactionData?.avatar_options || selectedFactionData?.avatarOptions || [];
  useEffect(() => {
    if (!registerOpen || !selectedFactionAvatars.length) return;
    if (!selectedFactionAvatars.some(a => a.id === selectedAvatar)) setSelectedAvatar(selectedFactionAvatars[0].id);
  }, [registerOpen, selectedFactionData?.id, selectedFactionAvatars.length, selectedAvatar]);
  useEffect(() => {
    if (!registerOpen || typeof document === 'undefined') return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeRegisterModal();
    };
    document.body.classList.add('authModalOpen');
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('authModalOpen');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [registerOpen, pendingGoogle?.token]);
  const selectedFactionColor = selectedFactionData?.color || '#35f2ff';
  const selectedFactionPresentation = selectedFactionData ? factionPresentationFor(selectedFactionData) : null;
  return <div className="loginScreen novaLandingScreen authLoginMode">
    <div className="landingStars" aria-hidden="true"><i /><i /><i /></div>

    <main className="landingExperience">
      <section className="registrationHero" aria-labelledby="nova-login-title">
        <div className="registrationWorldPanel">
          <BrandLockup size="landing" />
          <div className="registrationHeroCopy">
            <span>Persistent browser MMO</span>
            <h1 id="nova-login-title">Nova Frontiers</h1>
            <p>Your routes, cargo, claims, and enemies are still out there.</p>
            <div className="landingRoleCards registrationRoleCards" aria-label="Starter skill paths">
              <span><b>Haul</b><small>Move cargo. Read the lane.</small></span>
              <span><b>Salvage</b><small>Find wrecks. Keep what lasts.</small></span>
              <span><b>Fight</b><small>Push borders. Hold ground.</small></span>
            </div>
          </div>
          <div className="registrationCoreArt" aria-label="Nova Frontiers galaxy, factions, trade routes, and wormhole energy">
            <img src={novaFrontiersCore} alt="Cinematic Nova Frontiers galaxy with planets, ships, trade routes, and wormhole energy" loading="eager" fetchPriority="high" />
            <span className="orbitalRing ringOne" />
            <span className="orbitalRing ringTwo" />
            <span className="heroRoute routeOne" />
            <span className="heroRoute routeTwo" />
            <span className="heroParticle particleOne" />
            <span className="heroParticle particleTwo" />
            <span className="heroParticle particleThree" />
          </div>
          <div className="registrationSignalDeck" style={{'--faction-accent': selectedFactionColor}}>
            <div>
              <span>Command briefing</span>
              <b>VX-9 / Echo Frontier</b>
              <small>Your ship is quiet. The world is not.</small>
            </div>
            <ol className="registrationBriefList">
              <li><strong>Border unstable</strong><small>Convoys are getting scanned.</small></li>
              <li><strong>Market open</strong><small>Fuel and alloys are paying.</small></li>
              <li><strong>Relic ping</strong><small>Something woke past patrol range.</small></li>
            </ol>
            <div className="registrationMetricRow" aria-label="World summary">
              <span><b>3</b> factions</span>
              <span><b>Live</b> economy</span>
              <span><b>Persistent</b> wars</span>
            </div>
          </div>
        </div>

        <div className="registrationConsole" aria-label="Account access">
          <div className="registrationConsoleHeader">
            <span>Command access</span>
            <b>Login</b>
          </div>

          <form onSubmit={submit} className="loginForm registrationAuthForm">
            <section className="registrationFormSection registrationAccountSection">
              <div className="registrationFieldGrid">
                <label>
                  <span>Username</span>
                  <input value={u} onChange={e=>setU(e.target.value)} placeholder="username" autoComplete="username" />
                </label>
                <label>
                  <span>Password</span>
                  <input value={p} onChange={e=>setP(e.target.value)} placeholder="password" type="password" autoComplete="current-password" />
                </label>
              </div>
            </section>

            <button className="primary registrationSubmit" disabled={busy || googleBusy}>{busy ? 'Working...' : 'Launch'}</button>
          </form>

          <div className="googleAuthBlock registrationGoogleBlock">
            {GOOGLE_CLIENT_ID ? <div ref={googleButtonRef} className={`googleButtonSlot ${googleBusy ? 'loading' : ''}`} /> : <button type="button" disabled className="googleDisabled">Google unavailable</button>}
            <span>{GOOGLE_CLIENT_ID ? 'Google login only works for already linked pilots.' : 'Google sign-in is not configured.'}</span>
            {googleBusy && <span className="authStatus">Verifying Google...</span>}
            {pendingGoogle && <button type="button" className="linkButton authClearGoogle" onClick={()=>clearPendingGoogle(true)}>Clear Google login</button>}
          </div>
          {status && <div className="authStatus">{status}</div>}
          {err && <div className="error">{err}</div>}
          <p className="authSwitchText">Don't have an account? <a href="#register" onClick={(e)=>{ e.preventDefault(); openRegisterModal(); }}>Register</a></p>
        </div>
      </section>

      <div className="landingScrollCue" aria-hidden="true"><span />Survey the frontier</div>
      {LANDING_SECTIONS.map((section, index) => <LandingScrollSection key={section.key} section={section} index={index} />)}
    </main>
    {registerOpen && <div className="authRegisterModalOverlay" onMouseDown={()=>closeRegisterModal()}>
      <section className="authRegisterModal" role="dialog" aria-modal="true" aria-labelledby="registration-modal-title" onMouseDown={e=>e.stopPropagation()}>
        <header className="authRegisterModalHeader">
          <div>
            <span>Pilot dossier</span>
            <h2 id="registration-modal-title">Register</h2>
            <p>Choose the identity your first signal belongs to.</p>
          </div>
          <button type="button" className="authModalClose" aria-label="Close registration" onClick={()=>closeRegisterModal()}><X size={18}/></button>
        </header>

        <form onSubmit={submitRegistration} className="loginForm registrationAuthForm authModalForm">
          <section className="registrationFormSection registrationAccountSection" aria-labelledby="registration-modal-account-title">
            <div className="registrationSectionHeader">
              <b id="registration-modal-account-title">Account</b>
            </div>
            <div className="registrationFieldGrid">
              <label>
                <span>Username</span>
                <input value={u} onChange={e=>setU(e.target.value)} placeholder="username" autoComplete="username" required />
              </label>
              <label>
                <span>Email</span>
                <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="email" type="email" autoComplete="email" required />
              </label>
              <label>
                <span>Password</span>
                <input value={p} onChange={e=>setP(e.target.value)} placeholder={pendingGoogle ? 'optional with Google' : 'password'} type="password" autoComplete="new-password" required={!pendingGoogle} minLength={pendingGoogle ? undefined : 6} />
              </label>
              <label>
                <span>Callsign</span>
                <input value={callsign} onChange={e=>setCallsign(e.target.value)} placeholder="callsign" autoComplete="nickname" />
              </label>
            </div>
            <div className="googleAuthBlock registrationGoogleBlock authModalGoogle">
              {GOOGLE_CLIENT_ID ? <div ref={registerGoogleButtonRef} className={`googleButtonSlot ${googleBusy ? 'loading' : ''}`} /> : <button type="button" disabled className="googleDisabled">Google unavailable</button>}
              <span>{GOOGLE_CLIENT_ID ? 'Register with Google, then finish the faction dossier below.' : 'Google sign-in is not configured.'}</span>
              {googleBusy && <span className="authStatus">Verifying Google...</span>}
              {pendingGoogle && <button type="button" className="linkButton authClearGoogle" onClick={()=>clearPendingGoogle(true)}>Clear Google login</button>}
            </div>
          </section>

          <section className="registrationFormSection registrationFactionSection" aria-labelledby="registration-modal-faction-title">
            <div className="registrationSectionHeader factionModalIntro">
              <div>
                <b id="registration-modal-faction-title">Choose Your Identity</b>
                <span>Faction choice sets your starting alignment, bonuses, and war context.</span>
              </div>
            </div>
            <div className="factionBalanceGrid registrationFactionGrid cinematicFactionGrid">
              {factions.map(f => {
                const isSelected = String(selectedFaction) === String(f.id);
                const presentation = factionPresentationFor(f);
                const asset = factionAssets[f.code] || factionAssets.solar_accord;
                const balance = Number(f.player_percent || 0);
                return <button key={f.id} type="button" aria-pressed={isSelected} className={`factionChoice cinematicFactionCard ${isSelected ? 'selected locked' : ''}`} onClick={()=>setSelectedFaction(String(f.id))} style={{'--faction-accent':f.color || asset?.color || '#35f2ff'}}>
                  <span className="cinematicFactionMedia">
                    {presentation.ship && <img className="cinematicFactionShip" src={presentation.ship} alt="" loading="lazy" />}
                    <span className="factionChoiceEmblem"><img src={asset?.emblem || f.emblem || factionAssets.solar_accord.emblem} alt="" /></span>
                    <em>{isSelected ? 'Selected' : 'Available'}</em>
                  </span>
                  <span className="factionChoiceTop"><b>{f.name}</b><em>{f.balance_label || 'Open'}</em></span>
                  <strong>{presentation.identity}</strong>
                  <span>{presentation.lore}</span>
                  <small className="factionPlaystyle">{presentation.playstyle}</small>
                  <ul>
                    {presentation.strengths.slice(0,3).map(item => <li key={item}>{item}</li>)}
                  </ul>
                  <i>{balance.toFixed(1)}% population balance</i>
                  <div className="factionBalanceBar"><span style={{width:`${Math.max(4, Math.min(100, balance))}%`}} /></div>
                  <span className="factionChoiceLock">{isSelected ? 'Identity locked' : 'Choose identity'}</span>
                </button>;
              })}
            </div>
          </section>

          {selectedFactionData && selectedFactionPresentation && <section className="registrationFormSection registrationDetailsSection" aria-labelledby="registration-modal-details-title">
            <div className="registrationSectionHeader">
              <b id="registration-modal-details-title">{selectedFactionData.name} Briefing</b>
            </div>
            <div className="factionDecisionPanel registrationDecisionPanel authModalDecision" style={{'--faction-accent':selectedFactionColor}}>
              <div className="factionDecisionHero">
                <img src={factionAssets[selectedFactionData.code]?.emblem || selectedFactionData.emblem || factionAssets.solar_accord.emblem} alt="" />
                <div>
                  <b>{selectedFactionData.name}</b>
                  <span>{selectedFactionPresentation.playstyle}</span>
                </div>
              </div>
              <div className="factionBalanceStats">
                <span><small>Players</small><b>{fmt(selectedFactionData.players || 0)}</b></span>
                <span><small>Online</small><b>{fmt(selectedFactionData.online_players || 0)}</b></span>
                <span><small>Control</small><b>{Number(selectedFactionData.galaxy_control_percent ?? selectedFactionData.control_percent ?? 0).toFixed(1)}%</b></span>
                <span><small>Balance</small><b>{selectedFactionData.balance_label || 'Open'}</b></span>
              </div>
              <div className="factionModalWarning"><AlertTriangle size={16}/><span>Faction choice matters. It affects your allies, hostile borders, starter advantages, and the wars you inherit.</span></div>
            </div>
          </section>}

          {selectedFactionAvatars.length > 0 && <section className="registrationFormSection registrationAvatarPicker" aria-labelledby="registration-modal-avatar-title">
            <div className="registrationSectionHeader">
              <b id="registration-modal-avatar-title">Pilot Portrait</b>
            </div>
            <div className="registrationAvatarGrid">
              {selectedFactionAvatars.slice(0,6).map(avatar => <button key={avatar.id} type="button" className={selectedAvatar === avatar.id ? 'selectedAvatar' : ''} onClick={()=>setSelectedAvatar(avatar.id)}>
                <img src={avatar.url} alt="" loading="lazy" />
                <span>{avatar.label || 'Pilot'}</span>
              </button>)}
            </div>
          </section>}

          {status && <div className="authStatus">{status}</div>}
          {err && <div className="error">{err}</div>}
          <div className="authModalActions">
            <button type="button" className="novaModalSecondary" onClick={()=>closeRegisterModal()}>Cancel</button>
            <button className="primary registrationSubmit" disabled={busy || googleBusy}>{busy ? 'Working...' : 'Create Account'}</button>
          </div>
        </form>
      </section>
    </div>}
  </div>;
}

function syncFeatureHash(pageName) {
  if (typeof window === 'undefined') return;
  const currentHash = window.location.hash.toLowerCase();
  if (currentHash === '#guild' || currentHash === '#leaderboards') {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    window.dispatchEvent(new Event('hashchange'));
  }
}

function Sidebar({page,setPage,state,hubTabs={}}) {
  const selectPage = (nextPage) => {
    setPage(nextPage);
    syncFeatureHash(nextPage);
  };
  const openTutorial = () => {
    window.dispatchEvent(new CustomEvent('nova:tutorial-open'));
  };
  const navDestination = (name) => resolveHubDestination(name, page);
  const activeNavItem = (name) => {
    const dest = navDestination(name);
    if (dest.hub !== page) return false;
    const tab = hubTabs[dest.hub] || HUB_DEFAULT_TABS[dest.hub];
    return tab === dest.tab;
  };
  const isAdmin = !!state.user?.god_mode || String(state.user?.role || '').toLowerCase() === 'admin';
  const visibleNav = nav.filter(([name]) => name !== 'Admin' || isAdmin);
  return <aside className="sidebar">
    <BrandLockup size="sidebar" />
    <div className="pilotCard">
      <div className="avatar profileAvatarSmall"><ProfileAvatar profile={state.profile} size="sm" /></div>
      <div><b>{state.profile?.displayName || state.player.callsign}</b><br/><span>@{state.profile?.username || state.user.username} • Level {state.player.level}</span></div>
    </div>
    <div className="bars">
      <Bar label="XP" value={state.player.xp} max={state.next_level_xp || Math.max(1000, state.player.level*state.player.level*1200)} />
      <small>Next skill point: {fmt(state.xp_needed_next_skill_point ?? Math.max(0, (state.next_level_xp || 0) - (state.player.xp || 0)))} XP</small>
      <Bar label="Health" value={state.player.health} max={state.player.max_health} danger />
      <Bar label="Fuel" value={state.player.fuel} max={state.player.max_fuel} />
      <Bar label="Cargo" value={state.cargo_usage?.total ?? state.player.cargo} max={state.cargo_usage?.max ?? state.player.max_cargo} />
    </div>
    <nav className="navRail">
      <div className="navGroup">
        <strong>Navigation</strong>
        {visibleNav.map(([name, Icon]) => {
          const disabled = name === 'Planet' && planetNavDisabled(state);
          return <button key={name} data-page={name} disabled={disabled} className={activeNavItem(name)?'active':''} onClick={()=>selectPage(name)} title={disabled ? 'Dock at a planet or station to use planet services.' : name}>
            <Icon size={18}/><span>{name}</span>
          </button>;
        })}
      </div>
    </nav>
    <div className="sector">UTC {new Date(state.server_time).toLocaleTimeString()}<br/>Sector VX-9 / ECHO</div>
    <div className="sidebarTutorialDock">
      <button type="button" className="sidebarTutorialButton hasHoverTooltip" data-tooltip="Restart the starter guide." onClick={openTutorial}>
        <Info size={17}/><span>Starter Guide</span>
      </button>
    </div>
  </aside>
}

const MOBILE_PRIMARY_TABS = [
  {label:'Galaxy', page:'Galaxy', pages:['Galaxy'], icon:Globe2},
  {label:'Planet', page:'Planet', pages:['Planet'], icon:Building2},
  {label:'Character', page:'Character', pages:['Character'], icon:UserRound},
  {label:'Market', page:'Market', pages:['Market'], icon:Store},
];

function MobileBottomNav({page,setPage,state,moreOpen,setMoreOpen}) {
  const selectTab = (tab) => {
    setMoreOpen(false);
    setPage(tab.page);
  };
  return <nav className="mobileBottomTabs" aria-label="Primary mobile navigation">
    {MOBILE_PRIMARY_TABS.map(tab => {
      const Icon = tab.icon;
      const active = tab.pages.includes(page);
      const disabled = tab.page === 'Planet' && planetNavDisabled(state);
      return <button key={tab.label} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} disabled={disabled} title={disabled ? 'Dock at a planet or station to use planet services.' : tab.label} onClick={()=>selectTab(tab)}>
        <Icon size={20}/><span>{tab.label}</span>
      </button>;
    })}
  </nav>;
}

function MobileMoreMenu({open,page,setPage,state,onClose}) {
  if (!open) return null;
  const selectPage = (nextPage) => {
    setPage(nextPage);
    onClose();
  };
  const primaryPages = new Set(MOBILE_PRIMARY_TABS.flatMap(t => t.pages));
  return <div className="mobileMoreBackdrop" onMouseDown={onClose}>
    <section className="mobileMoreSheet" onMouseDown={e=>e.stopPropagation()} aria-label="More navigation">
      <header><b>More</b><button aria-label="Close menu" onClick={onClose}><X size={18}/></button></header>
      <div className="mobileMoreGroups">
        {NAV_GROUPS.map(group => <div className="mobileMoreGroup" key={group.label}>
          <strong>{group.label}</strong>
          <div>
            {group.pages.filter(n => !primaryPages.has(n) || n === page).map(n => {
              const Icon = (nav.find(([name]) => name === n) || [n, Home])[1];
              const disabled = n === 'Planet' && planetNavDisabled(state);
              return <button key={n} className={page===n?'active':''} disabled={disabled} title={disabled ? 'Dock at a planet or station to use planet services.' : n} onClick={()=>selectPage(n)}><Icon size={17}/><span>{n}</span></button>;
            })}
          </div>
        </div>)}
      </div>
    </section>
  </div>;
}

function MobileContextActionBar({state,page,setPage}) {
  const action = quickActionForPage(page,setPage);
  const travel = state.travel_state || {};
  const ship = state.active_ship || {};
  const cargoUsed = state.cargo_usage?.total ?? state.player?.cargo ?? 0;
  const cargoMax = state.cargo_usage?.max ?? state.player?.max_cargo ?? 1;
  return <div className="mobileContextActionBar">
    <div>
      <b>{travel.active ? `${label(travel.mode || 'travel')} ${clockTimeLeft(travel.arrival_at)}` : (ship.name || state.location?.name || 'Ready')}</b>
      <span>Fuel {fmt(state.player?.fuel)} - Cargo {fmt(cargoUsed)}/{fmt(cargoMax)}</span>
    </div>
    <button className="primary" onClick={action.onClick}>{action.label}</button>
  </div>;
}

function battleIsComplete(battle) {
  return battle?.status === 'complete' && battle?.outcome && battle.outcome !== 'pending';
}

function battleStatusText(battle) {
  if (!battle) return 'No battle';
  if (!battleIsComplete(battle)) return 'REAL-TIME BATTLE IN PROGRESS';
  if (battle.outcome === 'escaped') return 'ESCAPED';
  return label(battle.outcome);
}

function secondsUntilIso(isoValue) {
  if (!isoValue) return 0;
  const t = new Date(isoValue).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.ceil((t - Date.now()) / 1000));
}

function nextLiveBattleTargetRef(combatants, viewerSide, currentRef, defaultRef='', previousOrder=[]) {
  const opposing = (combatants || []).filter(c => c?.ref && (c.viewSide ? c.viewSide === 'enemy' : c.side !== viewerSide));
  const isLive = c => !c?.defeated && !c?.escaped;
  const liveTargets = opposing.filter(isLive);
  if (!liveTargets.length) return '';
  if (liveTargets.some(c => c.ref === currentRef)) return currentRef;
  const currentIndex = opposing.findIndex(c => c.ref === currentRef);
  if (currentIndex >= 0) {
    const nextInOrder = opposing.slice(currentIndex + 1).concat(opposing.slice(0, currentIndex)).find(isLive);
    if (nextInOrder?.ref) return nextInOrder.ref;
  }
  const previousIndex = (previousOrder || []).findIndex(ref => ref === currentRef);
  if (previousIndex >= 0) {
    const previousNextRefs = previousOrder.slice(previousIndex + 1).concat(previousOrder.slice(0, previousIndex));
    const nextFromPreviousOrder = previousNextRefs.map(ref => liveTargets.find(c => c.ref === ref)).find(Boolean);
    if (nextFromPreviousOrder?.ref) return nextFromPreviousOrder.ref;
  }
  return liveTargets.find(c => c.ref === defaultRef)?.ref || liveTargets[0]?.ref || '';
}

function combatantViewSide(combatant, viewerSide='player') {
  if (combatant?.viewSide === 'friendly' || combatant?.viewSide === 'enemy') return combatant.viewSide;
  return combatant?.side === viewerSide ? 'friendly' : 'enemy';
}

function compareCombatantsForBattle(a, b) {
  const faction = String(a?.factionName || '').localeCompare(String(b?.factionName || ''));
  if (faction) return faction;
  if (!!a?.primary !== !!b?.primary) return a?.primary ? -1 : 1;
  return String(a?.name || a?.shipName || '').localeCompare(String(b?.name || b?.shipName || ''));
}

function RealtimeBattleModal({battle, act, onClose}) {
  const [localBattle, setLocalBattle] = useState(battle);
  const [actionResult, setActionResult] = useState(null);
  const [escapeCooldown, setEscapeCooldown] = useState(0);
  const [selectedTargetRef, setSelectedTargetRef] = useState(battle?.defaultTargetRef || '');
  const [lastManualCombatActionAt, setLastManualCombatActionAt] = useState(() => Date.now());
  const advanceInFlightRef = useRef(false);
  const targetRosterOrderRef = useRef([]);
  const battleId = localBattle?.id;
  const log = localBattle?.log || [];
  const current = log[log.length - 1] || {};
  const your = localBattle?.yourShip || {};
  const enemy = localBattle?.enemyShip || {};
  const playerState = localBattle?.playerState || {};
  const enemyState = localBattle?.enemyState || {};
  const playerHull = current.playerHull ?? playerState.hull ?? your.hull;
  const playerShield = current.playerShield ?? playerState.shield ?? your.shield;
  const enemyHull = current.enemyHull ?? enemyState.hull ?? enemy.hull;
  const enemyShield = current.enemyShield ?? enemyState.shield ?? enemy.shield;
  const complete = battleIsComplete(localBattle);
  const playerLost = complete && localBattle?.winner === 'enemy';
  const enemyLost = complete && localBattle?.winner === 'player';
  const playerActionCooldown = secondsUntilIso(localBattle?.playerActionUntil);
  const escapeDisabled = complete || escapeCooldown > 0 || playerActionCooldown > 0;
  const combatants = localBattle?.combatants || [];
  const viewerRef = localBattle?.viewerRef || '';
  const viewerSide = localBattle?.viewerSide || 'player';
  const targetSignature = localBattle?.combatantsSignature || combatants.map(c => `${c.ref}:${c.viewSide || c.side}:${c.factionKey || ''}:${c.defeated ? 1 : 0}:${c.escaped ? 1 : 0}`).join('|');
  const advancePollMs = combatants.length > 24 ? 3000 : combatants.length > 12 ? 2200 : combatants.length > 6 ? 1500 : 1000;

  useEffect(() => {
    setLocalBattle(battle);
    setActionResult(null);
    setSelectedTargetRef(battle?.defaultTargetRef || '');
    setLastManualCombatActionAt(Date.now());
    targetRosterOrderRef.current = [];
  }, [battle?.id]);
  useEffect(() => {
    if (!localBattle || complete) return;
    const previousOrder = targetRosterOrderRef.current;
    const fallback = nextLiveBattleTargetRef(combatants, viewerSide, selectedTargetRef, localBattle?.defaultTargetRef, previousOrder);
    targetRosterOrderRef.current = combatants.filter(c => c?.ref && c.side !== viewerSide).map(c => c.ref);
    if (fallback && fallback !== selectedTargetRef) setSelectedTargetRef(fallback);
  }, [battleId, complete, targetSignature, viewerSide, localBattle?.defaultTargetRef, selectedTargetRef]);
  useEffect(() => {
    const id = setInterval(() => setEscapeCooldown(secondsUntilIso(localBattle?.nextEscapeAt)), 250);
    return () => clearInterval(id);
  }, [localBattle?.nextEscapeAt]);
  useEffect(() => {
    if (!battleId || complete) return;
    let cancelled = false;
    let timer = null;
    const tick = async () => {
      if (cancelled || advanceInFlightRef.current) return;
      advanceInFlightRef.current = true;
      try {
        const res = await act('advance_combat_battle', { battle_id: battleId }, { silent:true, skipRefresh:true, dedupeKey:`advance:${battleId}` });
        if (!cancelled && res?.result?.battle) setLocalBattle(res.result.battle);
      } finally {
        advanceInFlightRef.current = false;
        if (!cancelled) timer = setTimeout(tick, advancePollMs);
      }
    };
    timer = setTimeout(tick, Math.min(500, advancePollMs));
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [battleId, complete, advancePollMs]);

  async function performCombatAction(action, extra={}, options={}) {
    if (!localBattle || complete) return;
    if (!options.auto) setLastManualCombatActionAt(Date.now());
    const payload = { battle_id: localBattle.id, action, ...extra };
    if (selectedTargetRef) payload.target_ref = selectedTargetRef;
    const res = await act('combat_action', payload, { skipRefresh:true, dedupeKey:`combat:${localBattle.id}` });
    const result = res?.result;
    if (result?.battle) setLocalBattle(result.battle);
    if (result) setActionResult(result);
  }

  // NOVA_AUTO_BATTLE_TOGGLE_V1
  const [autoBattleEnabled, setAutoBattleEnabled] = useState(() => {
    try { return localStorage.getItem('novaAutoBattleEnabled') === '1'; } catch { return false; }
  });
  const autoBattleBusyRef = useRef(false);

  useEffect(() => {
    try { localStorage.setItem('novaAutoBattleEnabled', autoBattleEnabled ? '1' : '0'); } catch {}
  }, [autoBattleEnabled]);

  useEffect(() => {
    if (!localBattle || complete || autoBattleEnabled) return;
    const elapsed = Date.now() - lastManualCombatActionAt;
    const delay = Math.max(0, AUTO_BATTLE_INACTIVITY_MS - elapsed);
    const id = window.setTimeout(() => setAutoBattleEnabled(true), delay);
    return () => window.clearTimeout(id);
  }, [autoBattleEnabled, complete, lastManualCombatActionAt, localBattle?.id]);

  useEffect(() => {
    if (!autoBattleEnabled || !localBattle || complete || autoBattleBusyRef.current) return;
    if (playerActionCooldown > 0) return;
    autoBattleBusyRef.current = true;
    performCombatAction('use_all', {}, { auto:true }).finally(() => {
      window.setTimeout(() => { autoBattleBusyRef.current = false; }, 450);
    });
  }, [autoBattleEnabled, localBattle?.id, localBattle?.updated_at, localBattle?.updatedAt, complete, playerActionCooldown, selectedTargetRef]);

  function toggleAutoBattle() {
    if (autoBattleEnabled) setLastManualCombatActionAt(Date.now());
    setAutoBattleEnabled(v => !v);
  }

  async function attemptEscape() {
    if (escapeDisabled) return;
    const res = await act('attempt_combat_escape', { battle_id: localBattle.id }, { dedupeKey:`escape:${localBattle.id}` });
    const result = res?.result || { escaped:false, message:'Failed to escape, try again in 6 seconds' };
    setActionResult(result);
    if (result.battle) setLocalBattle(result.battle);
    if (result.nextEscapeAt) setEscapeCooldown(secondsUntilIso(result.nextEscapeAt));
    if (result.escaped) onClose();
  }

  return <div className="modalBackdrop battleModalBackdrop globalBattleLock">
    <div className="battleModal" role="dialog" aria-modal="true">
      {complete && <button className="modalClose" onClick={onClose}>Close</button>}
      <div className={`battleScreen realtimeBattleScreen ${complete ? 'completeBattleScreen' : 'activeBattleScreen'}`}>
        {!complete && <div className="battleEnergyStrip battleEnergyStripWithEscape">
          <div className="battleEnergyCenterControls">
            <div className="battleAutoSlot">
              <button
                className={`autoBattleToggle ${autoBattleEnabled ? 'active' : ''}`}
                disabled={complete}
                onClick={toggleAutoBattle}
                data-tooltip={humanHelpText('Automatically fires Use All when your weapons recover. Turns on after 1 minute without manual combat actions.')}
              >
                {autoBattleEnabled ? 'AUTO BATTLE ON' : 'AUTO BATTLE'}
              </button>
            </div>
            <div className="battleEscapeSlot">
              <button className="escapeBtn" disabled={escapeDisabled} onClick={attemptEscape}>
                <span>{escapeCooldown > 0 ? `ESCAPE ${escapeCooldown}s` : 'ATTEMPT ESCAPE'}</span>
                <small>{playerActionCooldown > 0 ? `Recovering ${playerActionCooldown}s` : 'Ready'}</small>
              </button>
            </div>
          </div>
        </div>}

        <BattleStageView
          battle={localBattle}
          current={current}
          complete={complete}
          your={your}
          enemy={enemy}
          playerHull={playerHull}
          playerShield={playerShield}
          enemyHull={enemyHull}
          enemyShield={enemyShield}
          playerLost={playerLost}
          enemyLost={enemyLost}
          playerActionCooldown={playerActionCooldown}
          selectedTargetRef={selectedTargetRef}
          onSelectTarget={setSelectedTargetRef}
          onWeapon={(weapon)=>performCombatAction("weapon", { weapon_id: weapon.id })}
          onUtility={(utility)=>performCombatAction("utility", { utility_id: utility.id })}
          onDefend={()=>performCombatAction("defend")}
          onUseAll={()=>performCombatAction("use_all")}
          log={log}
        />


        {complete && <div className="battleFooter completeBattleFooter">
          <BattleEventLog log={log} />
          <div className="battleRewards">
            <h3>{complete ? 'Battle Complete' : 'Live Battle'}</h3>
            <Stats pairs={{Outcome:battleStatusText(localBattle), Winner:complete ? label(localBattle?.winner) : 'Pending', Credits:complete ? fmt(localBattle?.rewards?.credits || 0) : 'Pending', XP:complete ? fmt(localBattle?.rewards?.xp || 0) : 'Pending', Salvage:localBattle?.rewards?.salvageSite ? `Wreck #${localBattle.rewards.salvageSite.id}` : 'None', Immunity:complete ? `${fmt(localBattle?.postBattleImmunitySeconds || 5)}s` : 'Locked while fighting'}} />
            {complete && enemyLost && <div className="salvageCallout dangerCallout"><b>Target Destroyed</b><span>The losing side is marked out of combat. Post-battle immunity is active.</span></div>}
            {localBattle?.rewards?.defeatedNpcReplacement && <div className="salvageCallout"><b>NPC Destroyed</b><span>Old NPC removed. Replacement spawned {fmt(localBattle.rewards.defeatedNpcReplacement.xpLossPct)}% weaker.</span></div>}
            {localBattle?.rewards?.salvageSite && <div className="salvageCallout"><b>Wreck Generated</b><span>Open-space wreck is now visible on the System Map.</span></div>}
          </div>
        </div>}
      </div>
    </div>
  </div>;
}

function battleEventKey(event) {
  if (!event) return 'idle';
  return [event.round ?? 0, event.actor || 'system', event.action || event.weaponType || 'charge', event.text || '', event.hit ? 'hit' : 'miss'].join('-');
}

function battleEventLabel(event) {
  if (!event?.action && !event?.weaponType) return 'READY';
  if (event.weaponType === 'escape') return event.hit ? 'ESCAPE' : 'ESCAPE FAILED';
  if (event.weaponType === 'utility') return 'UTILITY ACTIVE';
  if (event.action === 'defend') return 'DEFENSIVE MANEUVER';
  if (!event.hit) return 'MISS';
  return `${fmt(event.shieldDamage || 0)} shield / ${fmt(event.hullDamage || 0)} hull`;
}

function liveCombatEffects(effects) {
  return (effects || []).filter(e => secondsUntilIso(e?.expires_at) > 0);
}

function utilityTargetSide(actorSide, utility) {
  const target = String(utility?.target || 'self').toLowerCase();
  if (target === 'self') return actorSide;
  return actorSide === 'player' ? 'enemy' : 'player';
}

function effectCategory(effect) {
  return String(effect?.category || effect?.key || 'effect');
}

function effectRemaining(effect) {
  return secondsUntilIso(effect?.expires_at);
}

function findActiveEffect(effects, side, category) {
  const cat = String(category || '');
  return liveCombatEffects(effects).find(e => String(e?.side) === String(side) && effectCategory(e) === cat) || null;
}

function combatEffectTone(effect) {
  const cat = effectCategory(effect).toLowerCase();
  if (cat.includes('debuff') || cat.includes('down') || cat.includes('jam') || cat.includes('disrupt') || cat.includes('scram')) return 'debuff';
  if (cat.includes('repair') || cat.includes('shield')) return 'repair';
  return 'buff';
}

function combatEffectIcon(effect) {
  const cat = effectCategory(effect).toLowerCase();
  if (cat.includes('repair')) return HeartPulse;
  if (cat.includes('shield') || cat.includes('defense') || cat.includes('armor')) return Shield;
  if (cat.includes('dodge') || cat.includes('evasion')) return ShipWheel;
  if (cat.includes('debuff') || cat.includes('down') || cat.includes('jam') || cat.includes('disrupt') || cat.includes('scram')) return AlertTriangle;
  return Zap;
}

function BattleStageView({battle, current, complete, your, enemy, playerHull, playerShield, enemyHull, enemyShield, playerLost, enemyLost, playerActionCooldown, selectedTargetRef='', onSelectTarget=()=>{}, onWeapon, onUtility, onDefend, onUseAll, log=[]}) {
  const event = current || {};
  const actor = event.actor === 'enemy' ? 'enemy' : event.actor === 'player' ? 'player' : 'system';
  const weaponType = String(event.weaponType || event.action || 'laser').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const eventKey = battleEventKey(event);
  const laneMode = complete ? 'complete' : actor;
  const playerSupport = battle?.playerSupport || [];
  const enemySupport = battle?.enemySupport || [];
  const rawCombatants = battle?.combatants || [];
  const viewerSide = battle?.viewerSide === 'enemy' ? 'enemy' : 'player';
  const {combatants, friendlyCombatants, enemyCombatants} = useMemo(() => {
    const visible = [];
    const friendly = [];
    const enemies = [];
    for (const combatant of rawCombatants) {
      if (combatant?.escaped) continue;
      visible.push(combatant);
      if (combatantViewSide(combatant, viewerSide) === 'friendly') friendly.push(combatant);
      else enemies.push(combatant);
    }
    friendly.sort(compareCombatantsForBattle);
    enemies.sort(compareCombatantsForBattle);
    return {combatants: visible, friendlyCombatants: friendly, enemyCombatants: enemies};
  }, [rawCombatants, viewerSide]);
  const multiBattle = combatants.length > 2 || playerSupport.length > 0 || enemySupport.length > 0;
  const selectedTarget = combatants.find(c => c.ref === selectedTargetRef);
  const enemyRecover = secondsUntilIso(selectedTarget?.actionUntil || battle?.enemyActionUntil);
  return <div className={`battleStage realtimeStage interactiveStage stableBattleStage ${complete ? 'complete' : 'active'}`}>
    <div className="battleArenaRow">
      <div className="playerBattleColumn battleShipOnly">
        <div className="battleShipAnchor playerAnchor">
          {multiBattle ? <CombatantRosterColumn
            side="friendly"
            combatants={friendlyCombatants}
            selectedTargetRef={selectedTargetRef}
            viewerRef={battle?.viewerRef}
            viewerSide="friendly"
            onSelectTarget={onSelectTarget}
          /> : <CombatShipSide title="Your Ship" ship={your} hull={playerHull} shield={playerShield} defeated={playerLost} side="player" effects={battle?.activeEffects || []} />}
        </div>
      </div>
      <div className={`battleLane stableBattleLane ${laneMode}`} aria-live="polite">
        <div className="battleLaneGrid" aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        {!complete && actor !== 'system' && <div key={eventKey} className={`stableProjectile ${actor === 'enemy' ? 'reverse' : ''} ${weaponType || 'laser'} ${event.hit ? 'hit' : 'miss'}`}>
          <i></i>
        </div>}
        {!complete && actor !== 'system' && <div key={`${eventKey}-pulse`} className={`battleImpactPulse ${actor} ${event.hit ? 'hit' : 'miss'}`}></div>}
        {complete && <div className="battleEndedStamp">{battle?.outcome === 'escaped' ? 'ESCAPED' : `${label(battle?.winner)} WINS`}</div>}
        {!complete && <div className={`damageFloater stableDamageFloater ${event.hit ? 'hit' : 'miss'}`}>{battleEventLabel(event)}</div>}
        {multiBattle && !complete && selectedTarget && <div className="battleTargetBadge"><Crosshair size={13} /><span>{selectedTarget.name || selectedTarget.shipName}</span></div>}
      </div>
      <div className="enemyBattleColumn battleShipOnly">
        <div className="battleShipAnchor enemyAnchor">
          {multiBattle ? <CombatantRosterColumn
            side="enemy"
            combatants={enemyCombatants}
            selectedTargetRef={selectedTargetRef}
            viewerRef={battle?.viewerRef}
            viewerSide="friendly"
            onSelectTarget={onSelectTarget}
          /> : <CombatShipSide title={battle?.target?.name || 'Enemy'} ship={enemy} hull={enemyHull} shield={enemyShield} defeated={enemyLost} side="enemy" effects={battle?.activeEffects || []} />}
        </div>
      </div>
    </div>
    {!multiBattle && <BattleSupportBands playerSupport={playerSupport} enemySupport={enemySupport} />}
    {!complete && <div className="battleControlRow">
      <div className="battleControlSlot playerControlSlot">
        {!complete && <BattleActionDeck
          battle={battle}
          actionCooldown={playerActionCooldown}
          selectedTargetRef={selectedTargetRef}
          viewerEffectKey={battle?.viewerEffectKey || battle?.viewerSide || 'player'}
          onWeapon={onWeapon}
          onUtility={onUtility}
          onDefend={onDefend}
          onUseAll={onUseAll}
          activeEffects={battle?.activeEffects || []}
        />}
      </div>
      <div className="battleControlSlot battleHintSlot">
        <BattleEventLog log={log} compact title="Live Battle" />
      </div>
      <div className="battleControlSlot enemyControlSlot">
        <div className="enemyIntentPanel">
          <b>{selectedTarget?.name || 'Target'}</b>
          <span>{enemyRecover > 0 ? `Recovering ${enemyRecover}s` : 'Ready to act'}</span>
        </div>
      </div>
    </div>}
  </div>
}

function CombatantRosterColumn({side, combatants=[], selectedTargetRef='', viewerRef='', viewerSide='player', onSelectTarget=()=>{}}) {
  return <div className={`combatantRosterColumn ${side}`}>
    <div className="combatantRosterHeader"><b>{side === 'friendly' || side === viewerSide ? 'Your Faction' : 'Opposing Factions'}</b><span>{fmt(combatants.length)}</span></div>
    <div className="combatantRosterScroll">
      {combatants.map(c => <CombatantBattleCard
        key={c.ref}
        combatant={c}
        selected={c.ref === selectedTargetRef}
        isViewer={c.ref === viewerRef || c.isYou}
        selectable={combatantViewSide(c, viewerSide) !== 'friendly' && !c.defeated}
        onSelect={()=>onSelectTarget(c.ref)}
      />)}
    </div>
  </div>;
}

function CombatantBattleCard({combatant, selected=false, isViewer=false, selectable=false, onSelect=()=>{}}) {
  const hMax = Math.max(1, Number(combatant?.maxHull || combatant?.hull || 1));
  const sMax = Math.max(1, Number(combatant?.maxShield || combatant?.shield || 1));
  const liveHull = Math.max(0, Math.min(hMax, Number(combatant?.hull || 0)));
  const liveShield = Math.max(0, Math.min(sMax, Number(combatant?.shield || 0)));
  return <button
    type="button"
    className={`combatantBattleCard ${combatant?.viewSide || combatant?.side || 'neutral'} ${selected ? 'selectedTarget' : ''} ${isViewer ? 'you' : ''} ${combatant?.defeated ? 'defeated' : ''}`}
    style={{'--combatant-faction-color': combatant?.factionColor || undefined}}
    disabled={!selectable}
    onClick={selectable ? onSelect : undefined}
  >
    <div className="combatantCardName"><b>{combatant?.name || combatant?.shipName || 'Combatant'}</b>{isViewer && <span>You</span>}</div>
    <div className="combatantCardFaction">{combatant?.factionName || 'Unaligned'}</div>
    <div className="combatantCardVitals">
      <MiniMeter label="Shield" value={liveShield} max={sMax} />
      <MiniMeter label="Hull HP" value={liveHull} max={hMax} danger={liveHull < hMax * 0.35} />
      <CombatantEffectRack effects={combatant?.effects || []} />
    </div>
  </button>;
}

function CombatantEffectRack({effects=[]}) {
  const scoped = liveCombatEffects(effects);
  return <div className="combatantEffectRack">
    {scoped.length ? scoped.slice(0, 4).map((e,i)=><CombatEffectBadge key={`${effectCategory(e)}-${i}`} effect={e} />) : <span className="effectEmpty">None</span>}
  </div>;
}

function BattleSupportBands({playerSupport=[], enemySupport=[]}) {
  if (!playerSupport.length && !enemySupport.length) return null;
  const supportLabel = p => p?.name || p?.ship?.name || 'Support';
  return <div className="battleSupportBands">
    <div className="battleSupportBand player">
      <b>Player side</b>
      {playerSupport.length ? playerSupport.map((p,i)=><span key={p.ref || i}>{supportLabel(p)}</span>) : <em>No support</em>}
    </div>
    <div className="battleSupportBand enemy">
      <b>Enemy side</b>
      {enemySupport.length ? enemySupport.map((p,i)=><span key={p.ref || i}>{supportLabel(p)}</span>) : <em>No support</em>}
    </div>
  </div>;
}

function battleLogMarker(e) {
  if (e?.weaponType === 'escape') return 'ESC';
  if (e?.weaponType === 'utility') return 'UTIL';
  if (e?.action === 'defend') return 'DEF';
  return `R${e?.round ?? '-'}`;
}

function BattleEventLog({log=[], compact=false, title}) {
  const visible = (log || []).slice(compact ? -7 : -14).reverse();
  return <div className={`battleLogPanel ${compact ? 'compact' : ''}`}>
    {title && <div className="battleLogTitle"><b>{title}</b><span>{fmt((log || []).length)} actions</span></div>}
    <div className="battleLog">
      {visible.length === 0 && <div className="systemLog"><b>SYS</b><span>Waiting for combat telemetry.</span></div>}
      {visible.map((e,i)=><div key={`${e.round ?? 'x'}-${i}-${e.action || ''}-${e.text || ''}`} className={e.actor === 'player' ? 'playerLog' : e.actor === 'enemy' ? 'enemyLog' : 'systemLog'}><b>{battleLogMarker(e)}</b><span>{e.text}</span></div>)}
    </div>
  </div>
}

function BattleActionDeck({battle, actionCooldown, selectedTargetRef='', viewerEffectKey='player', onWeapon, onUtility, onDefend, onUseAll, activeEffects=[]}) {
  const weapons = battle?.playerWeapons || battle?.yourShip?.weapons || [];
  const utilities = battle?.playerUtilities || battle?.yourShip?.utilities || [];
  const locked = actionCooldown > 0;
  const liveEffects = liveCombatEffects(activeEffects);
  const activeForKey = (key, category) => findActiveEffect(liveEffects, key, category) || liveEffects.find(e => effectCategory(e) === String(category || '') && (!key || String(e?.side) === String(key))) || null;
  const activeDefense = activeForKey(viewerEffectKey, 'self_defense_buff');
  const defenseRemaining = activeDefense ? effectRemaining(activeDefense) : 0;
  return <div className="battleActionDeck">
    <div className="actionDeckHeader"><b>Actions</b><span>{locked ? `Recovering ${actionCooldown}s` : 'Ready'}</span></div>
    <div className="weaponButtonGrid">
      {weapons.map((w,i)=>{
        const disabled = locked;
        return <button key={w.id || i} className={`combatActionBtn weapon ${disabled ? 'disabled' : ''}`} disabled={disabled} onClick={()=>onWeapon(w)}>
          <span>{w.name || `Weapon ${i+1}`}</span>
          <small>{locked ? `Recovering ${actionCooldown}s` : 'Ready'}</small>
        </button>
      })}
    </div>
    <div className="specialActionRow">
      <button className={`combatActionBtn defend ${locked || defenseRemaining > 0 ? 'disabled activeLocked' : ''}`} disabled={locked || defenseRemaining > 0} onClick={onDefend}>
        <span>Defend</span><small>{defenseRemaining > 0 ? `Active ${defenseRemaining}s` : '+15% DEF/Dodge'}</small>
      </button>
      <button className={`combatActionBtn useAll ${locked || !weapons.length ? 'disabled' : ''}`} disabled={locked || !weapons.length} onClick={onUseAll}>
        <span>Use All</span><small>{locked ? `Recovering ${actionCooldown}s` : 'All weapons'}</small>
      </button>
    </div>
    <div className="utilityButtonGrid">
      {utilities.map((u,i)=>{
        const targetKey = String(u?.target || 'self').toLowerCase() === 'self' ? viewerEffectKey : selectedTargetRef;
        const active = activeForKey(targetKey, u.category || u.key || 'utility');
        const remaining = active ? effectRemaining(active) : 0;
        const disabled = locked || remaining > 0;
        const status = remaining > 0 ? `Active ${remaining}s` : 'Ready';
        return <button key={u.id || i} data-tooltip={humanHelpText(u.desc || `${u.name || 'Utility'} changes the fight for a short time. Watch the timer before trying to use it again.`)} className={`combatActionBtn utility hasHoverTooltip ${disabled ? 'disabled' : ''} ${remaining > 0 ? 'activeLocked' : ''}`} disabled={disabled} onClick={()=>onUtility(u)}>
          <span>{u.name || `Utility ${i+1}`}</span>
          <small>{status} • {label(u.category || u.key || 'utility')}</small>
        </button>
      })}
    </div>
  </div>
}

function CombatEffectRack({effects, side}) {
  const scoped = liveCombatEffects(effects).filter(e => String(e?.side) === String(side));
  return <div className="shipEffectRack">
    <div className="shipEffectRackTitle">Active Effects</div>
    <div className="shipEffectRackBody">
      {scoped.length ? scoped.map((e,i)=><CombatEffectBadge key={`${side}-${effectCategory(e)}-${i}`} effect={e} />) : <span className="effectEmpty">None</span>}
    </div>
  </div>
}

function CombatEffectBadge({effect}) {
  const Icon = combatEffectIcon(effect);
  const tone = combatEffectTone(effect);
  return <span className={`combatEffectBadge hasHoverTooltip ${tone}`} tabIndex={0} data-tooltip={humanHelpText(effect?.desc || effect?.name || label(effectCategory(effect)))}>
    <Icon size={12} />
    <b>{effect?.name || label(effectCategory(effect))}</b>
    <em>{effectRemaining(effect)}s</em>
  </span>
}


function GlobalBattleModal({battle, act, onClose}) {
  return <RealtimeBattleModal battle={battle} act={act} onClose={onClose} />;
}

function Topbar({state,onLogout}) {
  const p = state.player, ship = state.active_ship || {}, travel = state.travel_state || {};
  return <header className="topbar">
    <div className="identityStat"><ProfileAvatar profile={state.profile} size="sm" /><span>{state.profile?.displayName || state.player.callsign}<small>@{state.profile?.username || state.user.username}</small></span></div>
    <div className="stat"><Coins/> Credits <b>{fmt(p.credits)}</b></div>
    <div className={`stat ${state.phase_expansion?.fuelStatus?.empty ? 'dangerStat' : state.phase_expansion?.fuelStatus?.low ? 'warningStat' : ''}`}><Fuel/> Fuel <b>{fmt(p.fuel)} / {fmt(p.max_fuel)}</b>{state.phase_expansion?.fuelStatus?.message && <small>{state.phase_expansion.fuelStatus.message}</small>}</div>
    <div className="stat"><Package/> Cargo <b>{fmt(state.cargo_usage?.total ?? p.cargo)} / {fmt(state.cargo_usage?.max ?? p.max_cargo)}</b></div>
    <div className="stat"><Brain/> Skill Points <b>{fmt(p.skill_points)}</b></div>
    <div className="stat"><Shield/> Ship <b>{ship.name || 'None'}</b></div>
    {travel.active && <div className="stat travelTop"><Clock/> {label(travel.mode)} Travel <b>{travel.destination_galaxy_name || travel.destination_planet_name} • {clockTimeLeft(travel.arrival_at)}</b></div>}
    {state.user.god_mode && <div className="god">GOD MODE</div>}
    <button className="topbarLogout" onClick={onLogout}>Logout</button>
  </header>
}

function HubTabs({tabs, activeTab, setHubTab}) {
  return <div className="hubTabs" role="tablist">
    {tabs.map(tab => {
      const Icon = tab.icon || Layers;
      return <button key={tab.key} role="tab" aria-selected={activeTab === tab.key} className={activeTab === tab.key ? 'active' : ''} onClick={()=>setHubTab(tab.key)}>
        <Icon size={16}/><span>{tab.label}</span>
      </button>;
    })}
  </div>;
}

function HubFrame({tabs, activeTab, setHubTab, children}) {
  return <section className="hubFrame">
    <div className="hubBody">{children}</div>
  </section>;
}

const GALAXY_HUB_TABS = [
  {key:'navigation', label:'Navigation', icon:Globe2},
  {key:'overview', label:'Command', icon:Home},
  {key:'events', label:'Events', icon:CalendarDays},
  {key:'combat', label:'Combat', icon:Swords},
];

function GalaxyHub(props) {
  const {activeTab, setHubTab} = props;
  return <HubFrame tabs={GALAXY_HUB_TABS} activeTab={activeTab} setHubTab={setHubTab}>
    {activeTab === 'navigation' && <StarMap {...props} />}
    {activeTab === 'overview' && <Dashboard {...props} />}
    {activeTab === 'events' && <ServerCalendar {...props} />}
    {activeTab === 'combat' && <Fight {...props} />}
  </HubFrame>;
}

const PLANET_HUB_TABS = [
  {key:'overview', label:'Overview', icon:Building2},
  {key:'goods', label:'NPC Goods Market', icon:Store},
  {key:'industry', label:'Refining/Crafting', icon:Factory},
  {key:'storage', label:'Storage / Bases', icon:Package},
];

function PlanetHub(props) {
  const {activeTab, setHubTab, state} = props;
  if (planetNavDisabled(state)) {
    return <HubFrame tabs={PLANET_HUB_TABS} activeTab={activeTab} setHubTab={setHubTab}>
      <Panel title="Planet Unavailable While Undocked" help="Planet interaction, Sell Inventory, and the NPC Goods Market become active only while docked. Use Map for flight, local-space navigation, and interactions while undocked.">
        <TravelStatus state={state} clock={props.clock} />
      </Panel>
    </HubFrame>;
  }
  return <HubFrame tabs={PLANET_HUB_TABS} activeTab={activeTab} setHubTab={setHubTab}>
    {activeTab === 'overview' && <PlanetControl {...props} />}
    {activeTab === 'goods' && <Market {...props} initialTab="goods" planetMode />}
    {activeTab === 'industry' && <div className="hubSplitStack"><Industry {...props} /><Crafting {...props} /></div>}
    {activeTab === 'storage' && <div className="hubSplitStack"><Market {...props} initialTab="storage" planetMode /><Properties {...props} /></div>}
  </HubFrame>;
}

const CHARACTER_HUB_TABS = [
  {key:'character', label:'Character', icon:UserRound},
  {key:'ship', label:'Ship / Cargo', icon:Rocket},
  {key:'skills', label:'Skills', icon:Brain},
  {key:'effects', label:'Effects / Recovery', icon:HeartPulse},
];

function CharacterHub(props) {
  const {activeTab, setHubTab, onDeleteProfile, onChangePassword} = props;
  return <HubFrame tabs={CHARACTER_HUB_TABS} activeTab={activeTab} setHubTab={setHubTab}>
    {activeTab === 'character' && <Profile {...props} onDeleteProfile={onDeleteProfile} onChangePassword={onChangePassword} />}
    {activeTab === 'ship' && <div className="hubSplitStack"><Ships {...props} /><Inventory {...props} /></div>}
    {activeTab === 'skills' && <Skills {...props} />}
    {activeTab === 'effects' && <Medical {...props} />}
  </HubFrame>;
}

const MARKET_META_HUB_TABS = [
  {key:'guilds', label:'Guilds / War', icon:Shield},
  {key:'auction', label:'Auction', icon:Store},
  {key:'events', label:'Events', icon:CalendarDays},
  {key:'social', label:'Social', icon:Users},
  {key:'forum', label:'Forum', icon:MessageCircle},
  {key:'messages', label:'Messages', icon:Mail},
  {key:'admin', label:'Admin', icon:Settings},
  {key:'leaderboards', label:'Leaderboards', icon:Trophy},
];

function MarketSocialMetaHub(props) {
  const {activeTab, setHubTab, state} = props;
  const isAdmin = !!state.user?.god_mode || String(state.user?.role || '').toLowerCase() === 'admin';
  const tabs = isAdmin ? MARKET_META_HUB_TABS : MARKET_META_HUB_TABS.filter(t => t.key !== 'admin');
  const safeTab = tabs.some(t => t.key === activeTab) ? activeTab : 'auction';
  return <HubFrame tabs={tabs} activeTab={safeTab} setHubTab={setHubTab}>
    {safeTab === 'guilds' && <div className="hubSplitStack"><Guild {...props} /><FactionWar {...props} /><Warfare {...props} /></div>}
    {safeTab === 'auction' && <Market {...props} initialTab="auction" />}
    {safeTab === 'events' && <ServerCalendar {...props} eventOnly />}
    {safeTab === 'social' && <div className="hubSplitStack"><Chat {...props} /><Party {...props} /><Social {...props} /></div>}
    {safeTab === 'forum' && <SuggestionsForum {...props} />}
    {safeTab === 'messages' && <Messages {...props} />}
    {safeTab === 'admin' && isAdmin && <Admin {...props} />}
    {safeTab === 'leaderboards' && <Leaderboards {...props} />}
  </HubFrame>;
}

function Dashboard({state,act,setPage,clock,token}) {
  const p = state.player;
  const currentGalaxy = state.galaxies.find(g => g.id === state.location?.galaxy_id) || {};
  const currentGalaxyId = state.location?.galaxy_id ?? currentGalaxy.id;
  const currentLocations = state.planets.filter(pl => pl.galaxy_id === state.location?.galaxy_id);
  const basicOps = state.operations.filter(o =>
    o.galaxy_id === state.location?.galaxy_id &&
    o.operation_tier === 'basic'
  ).slice(0, 5);
  const sectorActivity = (state.npc_activity || []).filter(a => a.galaxy_id === state.location?.galaxy_id).slice(0, 10);
  const sim = state.simulation || {};
  const [securityDetails, setSecurityDetails] = useState({status:'idle', galaxy:null, alerts:[]});
  const currentPlayerId = state.player?.player_id ?? state.player?.id ?? state.current_player?.player_id ?? state.user?.player_id ?? state.user?.id;

  useEffect(() => {
    if (!currentGalaxyId) {
      setSecurityDetails({status:'idle', galaxy:null, alerts:[]});
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const params = new URLSearchParams({galaxy_id:String(currentGalaxyId)});
    if (currentPlayerId != null) params.set('player_id', String(currentPlayerId));
    setSecurityDetails(prev => ({...prev, status:'loading'}));
    fetch(`${API}/api/security/state?${params.toString()}`, {
      signal: controller.signal,
      headers: token ? {Authorization:`Bearer ${token}`} : {}
    })
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.detail || data?.error || `Request failed ${res.status}`);
        return data;
      })
      .then(data => {
        if (cancelled) return;
        const galaxy = (data.galaxies || []).find(g => String(g.galaxy_id) === String(currentGalaxyId)) || (data.galaxies || [])[0] || null;
        setSecurityDetails({status:'ready', galaxy, alerts:data.alerts || []});
      })
      .catch(err => {
        if (cancelled || err?.name === 'AbortError') return;
        setSecurityDetails({status:'error', galaxy:null, alerts:[], message:String(err.message || err)});
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [currentGalaxyId, currentPlayerId, token]);

  const galaxySecurity = securityDetails.galaxy;
  const displaySecurityLevel = galaxySecurity?.security_level ?? currentGalaxy.security_avg ?? state.location?.security_level ?? 0;
  const patrolText = securityDetails.status === 'loading'
    ? 'Loading'
    : galaxySecurity ? `${fmt(galaxySecurity.patrol_count || 0)}${galaxySecurity.patrol_bonus ? ` +${fmt(galaxySecurity.patrol_bonus)}` : ''}` : 'None';
  const turretText = securityDetails.status === 'loading'
    ? 'Loading'
    : galaxySecurity ? `${fmt(galaxySecurity.turret_count || 0)} x${fmt(galaxySecurity.turret_multiplier || 1)}` : 'None';

  return <Grid>
    <Panel title="Current Details" help="Your current galaxy and stop live here, including local safety, stability, defense, and galaxy security forces.">
      <div className="currentGalaxyCard">
        <div className={`galaxy ${currentGalaxy.color || 'blue'}`}>
          <GameImage className="currentGalaxyArt" src={currentGalaxy.image_url} assetType="galaxy" category={`${currentGalaxy.name || ''} ${currentGalaxy.sector || ''}`} alt={currentGalaxy.name || state.location.galaxy_name || 'Current galaxy'} />
          <h3>{currentGalaxy.name || state.location.galaxy_name}</h3>
          <p>{currentGalaxy.sector || state.location.galaxy_code}</p>
          <small>Current location: {state.location.name}</small>
        </div>
        <div className="currentDetailsStack">
          <Stats pairs={{
            Security:displaySecurityLevel,
            Stability:state.location?.stability_level || 0,
            Customs:state.location?.customs_rating || 0,
            Pirates:state.location?.pirate_activity || 0,
            Market:state.location?.market_activity || 0,
            Defense:state.location?.defense_strength || 0
          }} />
          <div className={`currentSecurityInline ${galaxySecurity?.war_active ? 'war' : ''}`}>
            <div>
              <b>Galaxy Security</b>
              <span>{galaxySecurity?.owner_faction || currentGalaxy.faction_name || 'Contested'}</span>
            </div>
            <em>SEC {fmt(displaySecurityLevel)}</em>
            <small>Turrets {turretText} / Patrols {patrolText}{galaxySecurity?.war_active ? ' / WAR' : ''}</small>
          </div>
        </div>
        <Stats pairs={{Locations:currentLocations.length, Stations:currentLocations.filter(x=>x.type==='station').length, Planets:currentLocations.filter(x=>x.type!=='station').length, Sector:currentGalaxy.sector || '—'}} />
      </div>
      <div className="tagCloud">{currentLocations.map(pl=><span key={pl.id}>{pl.name}</span>)}</div>
      <div className="currentGalaxyActions"><button onClick={()=>setPage('Map')}>Open Galaxy Map</button><button onClick={()=>setPage('Map')}>Open System Map</button></div>
    </Panel>

    <TravelStatus state={state} clock={clock} />
    <ShipStatusPanel state={state} />
    <MarketPressure state={state} />

    <Panel title="Planet Stats" help="Current planet/station conditions. NPC ticks can slowly move market activity, security, stability, and pirate pressure.">
      <Stats pairs={{
        Population:fmt(state.npc_summary?.population||0),
        Traffic:state.location?.npc_activity || 0,
        Security:state.location?.security_level || 0,
        Stability:state.location?.stability_level || 0,
        Customs:state.location?.customs_rating || 0,
        Pirates:state.location?.pirate_activity || 0,
        Market:state.location?.market_activity || 0,
        Lawfulness:state.location?.lawfulness || 0,
        Defense:state.location?.defense_strength || 0
      }} />
      <div className="tagCloud">{(state.npc_summary?.skills||[]).slice(0,8).map(c=><span key={c.skill}>{label(c.skill)}: {c.count}</span>)}</div>
    </Panel>

    <Panel title="Planet Control" help="Local control affects prices, mission risk, illegal trade risk, crafting bonuses, and travel danger.">
      <Stats pairs={{
        Controller:state.planet_control?.effects?.controller_label || label(state.location?.controller_type || 'npc'),
        Economy:label(state.location?.economy_type || 'balanced'),
        Influence:state.location?.player_influence || 0,
        Conflict:state.location?.conflict_level || 0,
        Tax:`${state.planet_control?.effects?.tax_rate_pct ?? 0}%`,
        IllegalRisk:state.planet_control?.effects?.illegal_risk || 0,
        TravelDanger:state.planet_control?.effects?.travel_danger || 0,
        CraftingBonus:`${state.planet_control?.effects?.crafting_bonus ?? 0}%`
      }} />
      <div className="controlQuickActions">{(state.planet_control?.actions || []).slice(0,3).map(a=><button key={a.key} onClick={()=>act('planet_control_action',{action_key:a.key})}>{a.name}</button>)}</div>
      <button onClick={()=>setPage('Planet Control')}>Open Planet Control</button>
    </Panel>

    <Panel title="Locations" help="Only locations inside the current galaxy are shown here. Use the Galaxies map for cross-galaxy movement.">
      <div className="routeList">{currentLocations.map(pl => <div key={pl.id}>
        <span>{state.location.name} → {pl.name}</span>
        {pl.id === state.location.id ? <button disabled>Current</button> : <button onClick={()=>act('travel',{planet_id:pl.id})}>Travel</button>}
      </div>)}</div>
    </Panel>

    <Panel title="Active Ship" help="Ship loss is not permanent character death. Insurance pays part of the loss and the permanent starter ship is always usable.">
      <ShipCard ship={state.active_ship}/><div className="moduleRow">{state.modules.filter(m=>m.equipped).slice(0,8).map(m=><span key={m.id}>{m.name}</span>)}</div>
      <button onClick={()=>setPage('Ships & Hangar')}>Manage Ship</button>
    </Panel>

    <Panel title="Local Goods" help="Current location prices for NPC goods.">
      <TwoCols leftTitle="Goods" rightTitle="Supply" left={state.market.filter(m=>m.legal).slice(0,5)} right={[]} />
      <button onClick={()=>setPage('Planet')}>View NPC Goods Market</button>
    </Panel>

    <Panel title="Local Planet Contracts" help="Planet-side/station-side missions. Each mission levels separately for each planet; higher local mission level takes slightly longer but pays much better.">
      <PlanetMissionContracts state={state} act={act} compact />
      <button onClick={()=>setPage('Map')}>Open Mission Map Screen</button>
    </Panel>

    <Panel title="PvE Operations" help="Dashboard operations are limited to basic credit/XP work. Bosses, raids, wars, and galaxy-scale content stay off this quick panel.">
      <h3 className="panelSubhead">Basic Work</h3>
      <div className="opList detailed">{basicOps.map(o=><OperationRow key={o.code} item={o} actionLabel="Run" onRun={()=>act('pve_operation',{code:o.code})} />)}</div>
    </Panel>

    <Panel title="Recommended Next Actions" help="Sorted from current skill, skills, ship power, and local planet conditions.">
      <div className="opList detailed">{(state.recommended_actions || []).filter(r=>r.kind !== 'skill').slice(0,5).map(r=><OperationRow key={`${r.kind}-${r.code}`} item={r} actionLabel="Run" onRun={()=>act('pve_operation', {code:r.code})} />)}</div>
    </Panel>

    <Panel title="Recent Sector Activity" help="Server-side NPC simulation events from planets in your current galaxy.">
      <div className="simulationMeta">
        <span>Tick: {sim.balance?.tick_minutes || '—'} min</span>
        <span>Last actions: {sim.last_action_count ?? 0}</span>
        <span>Last tick: {sim.last_tick_at ? new Date(sim.last_tick_at).toLocaleTimeString() : 'pending'}</span>
      </div>
      <EnhancedEventFeed events={sectorActivity} />
    </Panel>

    <Panel title="Medical & Recovery" help="Hospital time exists after ship destruction or serious injury. Surgery payments reduce time but never below 10 minutes.">
      <div className="hugeTimer">{p.hospital_until ? timeLeft(p.hospital_until) : 'Clear'}</div>
      <button onClick={()=>act('hospital_expedite',{minutes:30})}>Expedite Surgery</button>
    </Panel>
  </Grid>
}



function Profile({state,act,onDeleteProfile,onChangePassword}) {
  const profile = state.profile || {};
  const avatars = state.avatar_options || [];
  const achievements = state.achievements || profile.achievements || {loops:[], unlockedBadges:[], passiveBuffs:{}};
  const [tab,setTab] = useState('overview');
  const [form,setForm] = useState({username:profile.username || '', displayName:profile.displayName || '', bio:profile.bio || '', avatarId:profile.avatarId || 'default', selectedBadgeCode:profile.selectedBadgeCode || ''});
  const [passwordForm,setPasswordForm] = useState({oldPassword:'', newPassword:'', confirmPassword:''});
  const [passwordBusy,setPasswordBusy] = useState(false);
  const [passwordError,setPasswordError] = useState('');
  const [passwordStatus,setPasswordStatus] = useState('');
  const [deleteOpen,setDeleteOpen] = useState(false);
  const [deleteText,setDeleteText] = useState('');
  const [deleteBusy,setDeleteBusy] = useState(false);
  const [deleteError,setDeleteError] = useState('');
  useEffect(()=>{ setForm({username:profile.username || '', displayName:profile.displayName || '', bio:profile.bio || '', avatarId:profile.avatarId || 'default', selectedBadgeCode:profile.selectedBadgeCode || ''}); }, [profile.username, profile.displayName, profile.bio, profile.avatarId, profile.selectedBadgeCode]);
  const selected = avatars.find(a=>a.id===form.avatarId) || avatars[0] || {url:'/assets/avatars/default.svg', label:'Default Pilot'};
  const save = () => act('update_profile', form);
  const submitPasswordChange = async (event) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordStatus('');
    const oldPassword = passwordForm.oldPassword;
    const newPassword = passwordForm.newPassword;
    const confirmPassword = passwordForm.confirmPassword;
    if (!oldPassword) {
      setPasswordError('Enter your old password.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    setPasswordBusy(true);
    try {
      const result = await onChangePassword?.({old_password:oldPassword, new_password:newPassword, confirm_password:confirmPassword});
      setPasswordForm({oldPassword:'', newPassword:'', confirmPassword:''});
      setPasswordStatus(result?.message || 'Password updated.');
    } catch (ex) {
      setPasswordError(String(ex.message || ex));
    } finally {
      setPasswordBusy(false);
    }
  };
  const stats = profile.stats || {};
  const topLoops = [...(achievements.loops || [])].sort((a,b)=>(b.tierUnlocked-a.tierUnlocked)||(b.progress-a.progress)).slice(0,8);
  const badgeOptions = achievements.unlockedBadges || [];
  return <Page title="Profile" sub="Pilot identity, public profile, stats, achievement badges, and passive tier-8 bonuses.">
    <div className="profileLayout">
      <Panel title="Pilot Card" help="Your selected achievement badge appears on the lower-right of your profile image in chat, sidebar, and public profile views.">
        <div className="profileHero">
          <ProfileAvatar profile={{...profile, avatarUrl:selected.url, selectedBadgeCode:form.selectedBadgeCode, selectedBadgeUrl:form.selectedBadgeCode}} size="lg" />
          <div>
            <h3>{form.displayName || profile.displayName || 'Nova Pilot'}</h3>
            <span>@{form.username || profile.username}</span>
            <p>{form.bio || 'No status message set.'}</p>
          </div>
        </div>
        <Stats pairs={{Level:state.player.level, XP:stats.xp || state.player.xp, Credits:stats.credits || state.player.credits, Galaxy:profile.homeGalaxy || '—', Location:profile.currentLocation || '—', Skill:profile.currentJob?.name || '—', Ship:profile.currentShip?.name || profile.currentShip?.template_name || '—'}} />
      </Panel>

      <Panel title="Edit Profile">
        <div className="profileForm">
          <label>Username<input value={form.username} maxLength={24} onChange={e=>setForm(f=>({...f, username:e.target.value}))} /></label>
          <label>Display Name<input value={form.displayName} maxLength={32} onChange={e=>setForm(f=>({...f, displayName:e.target.value}))} /></label>
          <label>Status / Bio<textarea value={form.bio} maxLength={180} onChange={e=>setForm(f=>({...f, bio:e.target.value}))} placeholder="Short pilot status" /></label>
          <button className="primary" onClick={save}><Save size={16}/> Save Profile</button>
        </div>
      </Panel>
      <Panel title="Change Password">
        <form className="profileForm passwordChangeForm" onSubmit={submitPasswordChange}>
          <label>Old Password<input value={passwordForm.oldPassword} type="password" autoComplete="current-password" onChange={e=>setPasswordForm(f=>({...f, oldPassword:e.target.value}))} /></label>
          <label>New Password<input value={passwordForm.newPassword} type="password" autoComplete="new-password" minLength={6} onChange={e=>setPasswordForm(f=>({...f, newPassword:e.target.value}))} /></label>
          <label>Confirm New Password<input value={passwordForm.confirmPassword} type="password" autoComplete="new-password" minLength={6} onChange={e=>setPasswordForm(f=>({...f, confirmPassword:e.target.value}))} /></label>
          {passwordError && <div className="error">{passwordError}</div>}
          {passwordStatus && <div className="ok passwordChangeStatus">{passwordStatus}</div>}
          <button type="submit" className="primary" disabled={passwordBusy}><Lock size={16}/> {passwordBusy ? 'Updating...' : 'Update Password'}</button>
        </form>
      </Panel>
      <Panel title="Danger Zone">
        <div className="profileDangerZone">
          <div><b>Delete This Profile</b><span>Permanent account, progress, inventory, ships, and login deletion.</span></div>
          <button type="button" className="dangerBtn deleteProfileButton" onClick={()=>{ setDeleteOpen(true); setDeleteText(''); setDeleteError(''); }}><AlertTriangle size={16}/> Delete This Profile</button>
        </div>
      </Panel>
    </div>

    <div className="tabBar profileTabs">
      {['overview','achievements','badges','avatars'].map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{label(t)}</button>)}
    </div>

    {tab === 'overview' && <Grid>
      <Panel title="Skill Stats">
        <Stats pairs={{Travel:stats.travelEvents || 0, Combat:stats.combatEvents || 0, Mining:stats.miningEvents || 0, Salvage:stats.salvageEvents || 0, Exploration:stats.explorationEvents || 0, Crafting:stats.craftingEvents || 0, ShipPower:stats.shipPower || 0, Cargo:stats.cargo || 0}} />
      </Panel>
      <Panel title="Top Achievements">
        <div className="achievementTopList">{topLoops.map(a=><div key={a.loopKey}><AchievementBadge badge={a.badgeUrl} size="sm"/><b>{a.name}</b><span>Tier {a.tierUnlocked || 0} • {fmt(a.progress)} / {fmt(a.nextTarget)}</span><Progress value={a.percentToNext || 0}/></div>)}</div>
      </Panel>
      <Panel title="Tier 8 Passive Buffs">
        <div className="buffGrid">{Object.entries(achievements.passiveBuffs || {}).map(([k,v])=><span key={k}>{label(k)} <b>{typeof v === 'number' ? `${(v*100).toFixed(2)}%` : String(v)}</b></span>)}{!Object.keys(achievements.passiveBuffs || {}).length && <p className="muted">No tier-8 passive buffs unlocked yet.</p>}</div>
      </Panel>
    </Grid>}

    {tab === 'achievements' && <Panel title="Game Loop Achievements" help="Each loop has 8 tiers. Tier 7 is tuned as a long active-play goal; Tier 8 is a deeper 8-month-style chase and unlocks a small relevant passive.">
      <div className="achievementGrid">{(achievements.loops || []).map(a=><div key={a.loopKey} className={`achievementLoopCard tier${a.tierUnlocked || 0}`}>
        <div className="achievementLoopHead"><AchievementBadge badge={a.badgeUrl} size="md"/><div><b>{a.name}</b><span>{a.summary}</span></div><em>T{a.tierUnlocked || 0}/8</em></div>
        <Progress value={a.percentToNext || 0}/>
        <small>{fmt(a.progress)} / {fmt(a.nextTarget)} actions toward next tier</small>
        <div className="badgeRow">{a.badges.map(b=><AchievementBadge key={b.code} badge={b} size="tiny" locked={!b.unlocked}/>)}</div>
        <small>Tier 8 passive: {Object.entries(a.tier8PassiveBuff || {}).map(([k,v])=>`${label(k)} ${(Number(v)*100).toFixed(2)}%`).join(', ') || 'none'}</small>
      </div>)}</div>
    </Panel>}

    {tab === 'badges' && <Panel title="Showcase Badge" help="Pick one unlocked achievement badge. It overlays the lower-right of your profile image.">
      <div className="badgePicker">
        <button className={!form.selectedBadgeCode ? 'selectedBadgeChoice' : ''} onClick={()=>setForm(f=>({...f, selectedBadgeCode:''}))}>No badge</button>
        {badgeOptions.map(b=><button key={b.code} className={form.selectedBadgeCode===b.code?'selectedBadgeChoice':''} onClick={()=>setForm(f=>({...f, selectedBadgeCode:b.code}))}><AchievementBadge badge={b} size="sm"/><span>{b.name} T{b.tier}</span></button>)}
      </div>
      <button className="primary" onClick={save}>Save Badge</button>
    </Panel>}

    {tab === 'avatars' && <Panel title="Avatar Selection" help="Your faction controls this roster. Each faction has 12 sheet-sourced portraits, and the backend rejects cross-faction avatar ids.">
      <div className="avatarGrid">
        {avatars.map(a=><button key={a.id} className={form.avatarId===a.id?'selectedAvatar':''} onClick={()=>setForm(f=>({...f, avatarId:a.id}))}>
          <GameImage src={a.url} assetType="avatar" category={a.id} hint={a.id} alt={a.label} />
          <span>{a.label}</span>
        </button>)}
      </div>
    </Panel>}
    {deleteOpen && <div className="modalBackdrop profileDeleteBackdrop" onMouseDown={()=>!deleteBusy && setDeleteOpen(false)}>
      <div className="publicProfileModal deleteProfileModal" onMouseDown={e=>e.stopPropagation()}>
        <button type="button" className="modalX" disabled={deleteBusy} onClick={()=>setDeleteOpen(false)}>x</button>
        <div className="deleteProfileHeader"><AlertTriangle size={28}/><div><h2>Delete This Profile</h2><span>This cannot be undone.</span></div></div>
        <p>This permanently deletes your Nova Frontiers profile, progress, inventory, ships, faction history, and login access. This cannot be undone.</p>
        <label className="deleteConfirmField">Type DELETE<input value={deleteText} onChange={e=>setDeleteText(e.target.value)} autoComplete="off" /></label>
        {deleteError && <div className="error">{deleteError}</div>}
        <div className="buttonRow">
          <button type="button" disabled={deleteBusy} onClick={()=>setDeleteOpen(false)}>Cancel</button>
          <button type="button" className="dangerBtn" disabled={deleteBusy || deleteText !== 'DELETE'} onClick={async()=>{
            setDeleteBusy(true);
            setDeleteError('');
            try { await onDeleteProfile?.(deleteText); }
            catch(ex) { setDeleteError(String(ex.message || ex)); setDeleteBusy(false); }
          }}>{deleteBusy ? 'Deleting...' : 'Permanently Delete'}</button>
        </div>
      </div>
    </div>}
  </Page>;
}

function SuggestionsForum({state, token}) {
  const [scope,setScope] = useState('all');
  const [status,setStatus] = useState('open');
  const [sort,setSort] = useState('most_voted');
  const [search,setSearch] = useState('');
  const [query,setQuery] = useState('');
  const [suggestions,setSuggestions] = useState([]);
  const [isAdmin,setIsAdmin] = useState(!!state.user?.god_mode || String(state.user?.role || '').toLowerCase() === 'admin');
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [composer,setComposer] = useState({title:'', body:''});
  const [commentDrafts,setCommentDrafts] = useState({});
  const [expanded,setExpanded] = useState({});
  const [submitting,setSubmitting] = useState(false);
  const authHeaders = useMemo(() => ({
    'Content-Type':'application/json',
    Authorization:`Bearer ${token}`,
  }), [token]);
  const statusOptions = ['open','planned','in_progress','closed','rejected','duplicate'];
  const reactionOptions = [
    ['thumbs_up','👍'],
    ['heart','💗'],
    ['party','🎉'],
    ['thinking','🤔'],
    ['rocket','🚀'],
  ];
  const replaceSuggestion = (next) => {
    if (!next?.id) return;
    setSuggestions(list => list.map(s => Number(s.id) === Number(next.id) ? next : s));
  };
  const loadSuggestions = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({scope, status, sort, search:query});
      const res = await fetch(`${API}/api/suggestions?${params.toString()}`, {headers:{Authorization:`Bearer ${token}`}});
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Failed to load suggestions');
      setSuggestions(data.suggestions || []);
      setIsAdmin(!!data.isAdmin);
    } catch (ex) {
      setError(String(ex.message || ex));
    } finally {
      setLoading(false);
    }
  }, [token, scope, status, sort, query]);
  useEffect(() => { loadSuggestions(); }, [loadSuggestions]);
  const submitSuggestion = async (e) => {
    e.preventDefault();
    if (!composer.title.trim() || !composer.body.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/suggestions`, {method:'POST', headers:authHeaders, body:JSON.stringify(composer)});
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Failed to submit suggestion');
      setComposer({title:'', body:''});
      setSuggestions(list => [data.suggestion, ...list.filter(s => Number(s.id) !== Number(data.suggestion?.id))]);
    } catch (ex) {
      setError(String(ex.message || ex));
    } finally {
      setSubmitting(false);
    }
  };
  const suggestionAction = async (id, path, body, method='POST') => {
    setError('');
    try {
      const res = await fetch(`${API}/api/suggestions/${id}/${path}`, {method, headers:authHeaders, body:JSON.stringify(body)});
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Suggestion action failed');
      replaceSuggestion(data.suggestion);
      return data.suggestion;
    } catch (ex) {
      setError(String(ex.message || ex));
      return null;
    }
  };
  const vote = (s, value) => suggestionAction(s.id, 'vote', {value: Number(s.myVote) === value ? 0 : value});
  const react = (s, reaction) => suggestionAction(s.id, 'react', {reaction});
  const updateStatus = (s, nextStatus) => suggestionAction(s.id, 'status', {status: nextStatus}, 'PATCH');
  const addComment = async (s) => {
    const body = String(commentDrafts[s.id] || '').trim();
    if (!body) return;
    const next = await suggestionAction(s.id, 'comments', {body});
    if (next) setCommentDrafts(d => ({...d, [s.id]:''}));
  };
  const submitSearch = (e) => {
    e.preventDefault();
    setQuery(search.trim());
  };
  const age = (value) => {
    const ms = Date.now() - new Date(value || Date.now()).getTime();
    if (!Number.isFinite(ms) || ms < 60000) return 'just now';
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 48) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 60) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  };
  return <Page title="Suggestions" sub="Player-submitted ideas with voting, comments, and admin-only status tracking.">
    <section className="suggestionsBoard">
      <div className="suggestionsToolbar">
        <div className="suggestionsScopeTabs" role="tablist" aria-label="Suggestion views">
          <button className={scope==='all'?'active':''} onClick={()=>setScope('all')}>All</button>
          <button className={scope==='mine'?'active':''} onClick={()=>setScope('mine')}>Mine</button>
          <button className={scope==='top'?'active':''} onClick={()=>{ setScope('top'); setSort('top_rated'); }}>Top Rated</button>
        </div>
        <form className="suggestionsSearch" onSubmit={submitSearch}>
          <Search size={17}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search suggestions..." />
        </form>
        <div className="suggestionsFilters">
          <label><Filter size={14}/> Status<select value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="open">Open</option>
            <option value="all">All</option>
            {statusOptions.filter(x=>x !== 'open').map(x=><option key={x} value={x}>{label(x)}</option>)}
          </select></label>
          <label>Sort<select value={sort} onChange={e=>setSort(e.target.value)}>
            <option value="most_voted">Most Voted</option>
            <option value="recent">Newest</option>
            <option value="most_discussed">Most Discussed</option>
          </select></label>
        </div>
      </div>

      <Panel title="Submit Suggestion">
        <form className="suggestionComposer" onSubmit={submitSuggestion}>
          <input value={composer.title} maxLength={140} onChange={e=>setComposer(f=>({...f, title:e.target.value}))} placeholder="Suggestion title" />
          <textarea value={composer.body} maxLength={4000} onChange={e=>setComposer(f=>({...f, body:e.target.value}))} placeholder="Describe the problem, idea, or improvement..." />
          <button className="primary" disabled={submitting || !composer.title.trim() || !composer.body.trim()}><Plus size={16}/>{submitting ? 'Posting...' : 'Post Suggestion'}</button>
        </form>
      </Panel>

      {error && <div className="error suggestionError">{error}</div>}
      {loading && <div className="suggestionEmpty">Loading suggestions...</div>}
      {!loading && !suggestions.length && <div className="suggestionEmpty">No suggestions match this view yet.</div>}
      <div className="suggestionList">
        {suggestions.map(s => {
          const isExpanded = !!expanded[s.id];
          const body = s.body || '';
          const needsTrim = body.length > 260;
          const visibleBody = !needsTrim || isExpanded ? body : `${body.slice(0, 260).trim()}...`;
          return <article key={s.id} className={`suggestionCard status-${s.status}`}>
            <div className="suggestionVoteRail">
              <button className={s.myVote > 0 ? 'active' : ''} onClick={()=>vote(s, 1)} title="Upvote"><ArrowUp size={18}/></button>
              <b>{fmt(s.voteScore)}</b>
              <button className={s.myVote < 0 ? 'active' : ''} onClick={()=>vote(s, -1)} title="Downvote"><ArrowDown size={18}/></button>
            </div>
            <div className="suggestionMain">
              <header className="suggestionHeader">
                <ProfileAvatar profile={s.author} size="sm" />
                <div>
                  <h3>{s.title}</h3>
                  <span>{s.author?.displayName || 'Pilot'} <small>{age(s.createdAt)}</small></span>
                </div>
                <em className={`suggestionStatus status-${s.status}`}>{label(s.status)}</em>
              </header>
              <p className="suggestionBody">{visibleBody}</p>
              {needsTrim && <button className="suggestionReadMore" onClick={()=>setExpanded(v=>({...v, [s.id]:!isExpanded}))}>{isExpanded ? 'Show less' : 'Read more'}</button>}
              <div className="suggestionMetaRow">
                <div className="suggestionReactions">
                  {reactionOptions.map(([key, icon]) => <button key={key} className={(s.myReactions || []).includes(key) ? 'active' : ''} onClick={()=>react(s, key)}>{icon} <span>{fmt((s.reactions || {})[key] || 0)}</span></button>)}
                </div>
                <span className="suggestionCommentCount"><MessageCircle size={14}/>{fmt(s.commentsCount || 0)}</span>
                {isAdmin && <label className="suggestionAdminStatus">Admin Status<select value={s.status} onChange={e=>updateStatus(s, e.target.value)}>
                  {statusOptions.map(x=><option key={x} value={x}>{label(x)}</option>)}
                </select></label>}
              </div>
              <div className="suggestionComments">
                {(s.comments || []).map(c => <div key={c.id} className="suggestionComment">
                  <ProfileAvatar profile={c.author} size="tiny" />
                  <div><b>{c.author?.displayName || 'Pilot'}</b><p>{c.body}</p><small>{age(c.createdAt)}</small></div>
                </div>)}
                <div className="suggestionCommentComposer">
                  <input value={commentDrafts[s.id] || ''} maxLength={1200} onChange={e=>setCommentDrafts(d=>({...d, [s.id]:e.target.value}))} placeholder="Add a comment..." />
                  <button onClick={()=>addComment(s)} disabled={!String(commentDrafts[s.id] || '').trim()}><Send size={15}/> Reply</button>
                </div>
              </div>
            </div>
          </article>;
        })}
      </div>
    </section>
  </Page>;
}

function Chat({state,act,setPage,setTradeModalId}) {
  const [message,setMessage] = useState('');
  const [profileModal,setProfileModal] = useState(null);
  const messages = state.chat_messages || [];
  const profiles = state.public_profiles || [];
  const send = (e) => {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;
    act('send_chat_message', {message:text});
    setMessage('');
  };
  const openProfile = (m) => {
    const p = findPublicProfile(profiles, m);
    if (p) setProfileModal(p);
  };
  return <Page title="Local Chat" sub="Chat identity uses your selected profile image, badge, and display name.">
    <div className="chatLayout">
      <Panel title="Pilot Identity">
        <div className="chatIdentity"><ProfileAvatar profile={state.profile} size="md" /><div><b>{state.profile?.displayName || state.player.callsign}</b><span>@{state.profile?.username || state.user.username}</span><small>{state.profile?.bio || 'No public status.'}</small></div></div>
        <button onClick={()=>setPage('Profile')}>Edit Profile</button>
      </Panel>
      <Panel title="Sector Channel" help="Click a pilot image/name to view their public profile. Wealth and private strength stats stay hidden.">
        <div className="chatFeed">
          {messages.length === 0 && <div className="emptyChat">No messages yet.</div>}
          {messages.map(m=><div key={m.id} className={`chatMessage ${m.isCurrentUser?'mine':''} ${m.senderType || 'player'}`}>
            <ProfileAvatar profile={{avatarUrl:m.avatarUrl, selectedBadgeCode:m.selectedBadgeCode, selectedBadgeUrl:m.selectedBadgeUrl, displayName:m.senderName}} size="sm" onClick={()=>openProfile(m)} />
            <div>
              <button className="chatNameButton" onClick={()=>openProfile(m)}><b>{m.senderName}<em>{label(m.senderType || 'player')}</em></b></button>
              <p>{m.message}</p>
              <small>{m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}</small>
            </div>
          </div>)}
        </div>
        <form className="chatComposer" onSubmit={send}>
          <input value={message} maxLength={420} onChange={e=>setMessage(e.target.value)} placeholder="Send a sector message" />
          <button className="primary"><Send size={16}/> Send</button>
        </form>
      </Panel>
    </div>
    <PublicProfileModal profile={profileModal} act={act} setPage={setPage} setTradeModalId={setTradeModalId} onClose={()=>setProfileModal(null)} />
  </Page>;
}



function Party({state,act}) {
  const party = state.party || {members:[], incomingInvites:[], outgoingInvites:[], maxMembers:5, sharedXpPct:25};
  const [query,setQuery] = useState('');
  const selfId = Number(state.player?.id || 0);
  const members = party.members || [];
  const memberIds = new Set(members.map(m=>Number(m.playerId)));
  const candidates = (state.public_profiles || [])
    .filter(p=>Number(p.playerId) && Number(p.playerId) !== selfId && !memberIds.has(Number(p.playerId)))
    .filter(p=>`${p.displayName || ''} ${p.username || ''}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 20);
  const hpPct = (ship) => Math.max(0, Math.min(100, Number(ship?.hull || 0) / Math.max(1, Number(ship?.maxHull || 1)) * 100));
  const shieldPct = (ship) => Math.max(0, Math.min(100, Number(ship?.shield || 0) / Math.max(1, Number(ship?.maxShield || 1)) * 100));
  return <Page title="Party" sub={`Max ${party.maxMembers || 5} members. Shared radar. Party members cannot attack each other. Members receive ${party.sharedXpPct || 25}% bonus XP from each other's gains.`}>
    <Grid>
      <Panel title="Current Party">
        {!party.active && <p className="muted">No active party. Inviting someone creates one with you as leader.</p>}
        <div className="partyMemberList">
          {members.map(m=><div key={m.playerId} className={`partyMemberCard ${m.isLeader ? 'leader' : ''}`}>
            <ProfileAvatar profile={{avatarUrl:m.avatarUrl, displayName:m.displayName}} size="sm" />
            <div className="partyMemberMain">
              <b>{m.displayName || m.username}{m.isLeader ? ' • Leader' : ''}</b>
              <span>Level {m.level || 1} • {m.position?.galaxy_name || 'Unknown space'} • {m.position?.location_name || 'Open space'}</span>
              <div className="miniBars"><i><b style={{width:`${shieldPct(m.ship)}%`}} /></i><i><b style={{width:`${hpPct(m.ship)}%`}} /></i></div>
            </div>
            <div className="partyMemberActions">
              {party.isLeader && Number(m.playerId) !== selfId && <button onClick={()=>act('party_transfer_leader',{playerId:m.playerId})}>Leader</button>}
              {party.isLeader && Number(m.playerId) !== selfId && <button className="danger" onClick={()=>act('party_remove_member',{playerId:m.playerId})}>Remove</button>}
            </div>
          </div>)}
        </div>
        {party.active && <button className="danger" onClick={()=>act('party_leave',{})}>Leave Party</button>}
      </Panel>
      <Panel title="Invites">
        <h4>Incoming</h4>
        <div className="inviteList">
          {(party.incomingInvites || []).map(i=><div key={i.id} className="inviteRow"><span>{i.inviter_callsign || i.inviter_username || 'Pilot'} invited you</span><button className="primary" onClick={()=>act('party_accept_invite',{inviteId:i.id})}>Accept</button><button onClick={()=>act('party_decline_invite',{inviteId:i.id})}>Deny</button></div>)}
          {!(party.incomingInvites || []).length && <p className="muted">No incoming invites.</p>}
        </div>
        <h4>Outgoing</h4>
        <div className="inviteList">
          {(party.outgoingInvites || []).map(i=><div key={i.id} className="inviteRow"><span>Pending: {i.invitee_callsign || i.invitee_username || 'Pilot'}</span></div>)}
          {!(party.outgoingInvites || []).length && <p className="muted">No outgoing invites.</p>}
        </div>
      </Panel>
      <Panel title="Find Pilots">
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search player name" />
        <div className="partySearchResults">
          {candidates.map(p=><div key={p.playerId} className="partySearchRow">
            <ProfileAvatar profile={p} size="sm" />
            <div><b>{p.displayName || p.username}</b><span>@{p.username} • Level {p.stats?.level || 1}</span></div>
            <button className="primary" disabled={members.length >= (party.maxMembers || 5)} onClick={()=>act('party_invite',{playerId:p.playerId})}>Invite</button>
          </div>)}
          {!candidates.length && <p className="muted">No matching pilots.</p>}
        </div>
      </Panel>
    </Grid>
  </Page>;
}


function ToastStack({toasts,dismissToast}) {
  if (!toasts?.length) return null;
  return <div className="toastStack">{toasts.map(t=><button key={t.key} className={`gameToast ${t.type || ''}`} onClick={()=>{ dismissToast(t.key); t.onClick?.(); }}>
    <b>{t.message}</b>
    <span>{t.actionLabel || 'Open'}</span>
  </button>)}</div>;
}

function Social({state,act,setTradeModalId}) {
  const social = state.social || {friends:[], blocked:[], candidates:[], incomingFriendRequests:[], outgoingFriendRequests:[]};
  const [query,setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const people = (social.candidates || []).filter(p => !q || `${p.displayName || ''} ${p.username || ''}`.toLowerCase().includes(q)).slice(0,40);
  const personRow = (p, mode='search') => <div key={`${mode}-${p.playerId}`} className={`socialPersonRow ${p.online ? 'online' : 'offline'}`}>
    <ProfileAvatar profile={p} size="sm" />
    <div className="socialPersonMain"><b>{p.displayName || p.username}</b><span>@{p.username} • {p.online ? 'Online' : p.lastSeenLabel || 'Offline'}</span></div>
    <div className="socialPersonActions">
      {p.incomingRequestId && <button className="primary" onClick={()=>act('social_accept_friend',{requestId:p.incomingRequestId})}>Accept</button>}
      {p.incomingRequestId && <button onClick={()=>act('social_decline_friend',{requestId:p.incomingRequestId})}>Deny</button>}
      {!p.isFriend && !p.outgoingRequestId && !p.incomingRequestId && !p.isBlocked && !p.blockedYou && <button onClick={()=>act('social_friend_request',{playerId:p.playerId})}>Add Friend</button>}
      {p.outgoingRequestId && <button disabled>Requested</button>}
      {p.isFriend && <button onClick={()=>act('social_remove_friend',{playerId:p.playerId})}>Remove Friend</button>}
      {!p.isBlocked && <button onClick={()=>act('party_invite',{playerId:p.playerId})}>Party</button>}
      {!p.isBlocked && <button onClick={()=>act('trade_invite',{playerId:p.playerId})}>Trade</button>}
      {p.isBlocked ? <button onClick={()=>act('social_unblock_player',{playerId:p.playerId})}>Unblock</button> : <button className="danger" onClick={()=>act('social_block_player',{playerId:p.playerId})}>Block</button>}
    </div>
  </div>;
  return <Page title="Social" sub="Manage friends and blocked pilots. Friend online notifications are toasts only; invites and requests also appear in Messages.">
    <Grid>
      <Panel title="Friend Requests">
        {(social.incomingFriendRequests || []).map(r=><div key={r.id} className="inviteRow"><span>{r.displayName || r.username || 'Pilot'} wants to be friends.</span><button className="primary" onClick={()=>act('social_accept_friend',{requestId:r.id})}>Accept</button><button onClick={()=>act('social_decline_friend',{requestId:r.id})}>Deny</button></div>)}
        {!(social.incomingFriendRequests || []).length && <p className="muted">No incoming friend requests.</p>}
        <h4>Outgoing</h4>
        {(social.outgoingFriendRequests || []).map(r=><div key={r.id} className="inviteRow"><span>Pending: {r.displayName || r.username || 'Pilot'}</span></div>)}
        {!(social.outgoingFriendRequests || []).length && <p className="muted">No outgoing friend requests.</p>}
      </Panel>
      <Panel title="Friends">
        <div className="socialList">{(social.friends || []).map(p=>personRow(p,'friend'))}</div>
        {!(social.friends || []).length && <p className="muted">No friends yet.</p>}
      </Panel>
      <Panel title="Block List">
        <div className="socialList">{(social.blocked || []).map(p=>personRow(p,'block'))}</div>
        {!(social.blocked || []).length && <p className="muted">No blocked pilots.</p>}
      </Panel>
      <Panel title="Find / Add People">
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search pilots" />
        <div className="socialList">{people.map(p=>personRow(p,'search'))}</div>
      </Panel>
    </Grid>
  </Page>;
}

function TradeModal({trade,state,act,onClose}) {
  const [gold,setGold] = useState('0');
  const [qty,setQty] = useState({});
  useEffect(()=>{ if (trade?.left) setGold(String(trade.left.gold || 0)); }, [trade?.id, trade?.left?.gold]);
  if (!trade) return null;
  const inventory = state.trade?.inventory || state.inventory_summary || [];
  const addItem = (item) => act('trade_add_item',{tradeId:trade.id,itemCode:item.item_code,qty:Number(qty[item.item_code] || 1)});
  const side = (title, data, mine=false) => <div className={`tradeSide ${mine ? 'mine' : 'theirs'} ${data.locked ? 'locked' : ''}`}>
    <div className="tradeSideHeader"><ProfileAvatar profile={data.player} size="sm" /><div><b>{title}</b><span>{data.player?.displayName || data.player?.username || 'Pilot'}</span></div></div>
    <div className="tradeGoldBox"><Coins size={16}/><b>{fmt(data.gold)}</b><span>Credits offered</span></div>
    <div className="tradeItemGrid">{(data.items || []).map(it=><div key={it.tradeItemId || it.item_code} className="tradeItemCard">
      <ItemVisual item={it} size="item" />
      <b>{it.name || it.item_code}</b><span>Qty {fmt(it.qty)}</span>
      <details><summary>Inspect</summary><small>{it.description || it.category || 'No item description.'}</small><Stats pairs={{Value:it.base_value || 0, Mass:it.mass || 0, Rarity:it.rarity || 'common', Tier:it.current_tier || it.tier || 1}} /></details>
      {mine && !data.locked && <button onClick={()=>act('trade_remove_item',{tradeId:trade.id,tradeItemId:it.tradeItemId})}>Remove</button>}
    </div>)}</div>
    <div className="tradeStatusRow"><span>{data.locked ? 'Locked' : 'Unlocked'}</span><span>{data.approved ? 'Approved' : 'Not approved'}</span></div>
  </div>;
  return <div className="modalBackdrop tradeModalBackdrop" onMouseDown={onClose}>
    <div className="tradeModal" onMouseDown={e=>e.stopPropagation()}>
      <button className="modalX" onClick={onClose}>×</button>
      <h2>Player Trade</h2>
      {trade.status === 'pending' && <div className="tradePendingBox">
        {trade.isIncomingPending ? <><p>{trade.right?.player?.displayName || 'Pilot'} wants to trade.</p><button className="primary" onClick={()=>act('trade_accept',{tradeId:trade.id})}>Accept Trade</button><button onClick={()=>act('trade_decline',{tradeId:trade.id})}>Decline</button></> : <><p>Waiting for {trade.right?.player?.displayName || 'pilot'} to accept.</p><button onClick={()=>act('trade_cancel',{tradeId:trade.id})}>Cancel Request</button></>}
      </div>}
      {trade.status === 'active' && <>
        <div className="tradeBoard">{side('Yours', trade.left, true)}{side('Theirs', trade.right, false)}</div>
        <div className="tradeControls">
          <Panel title="Your Offer Controls">
            <div className="tradeGoldInput"><input type="number" min="0" value={gold} onChange={e=>setGold(e.target.value)} disabled={trade.left.locked} /><button disabled={trade.left.locked} onClick={()=>act('trade_set_gold',{tradeId:trade.id,amount:Number(gold||0)})}>Set Credits</button></div>
            <div className="tradeInventoryGrid">{inventory.filter(i=>Number(i.available_qty ?? i.qty ?? 0)>0).slice(0,80).map(i=><div key={i.item_code} className="tradeInventoryItem"><ItemVisual item={i} size="item"/><b>{i.name}</b><span>Avail {fmt(i.available_qty ?? i.qty ?? 0)}</span><input type="number" min="1" max={Number(i.available_qty ?? i.qty ?? 1)} value={qty[i.item_code] || 1} onChange={e=>setQty(v=>({...v,[i.item_code]:e.target.value}))} disabled={trade.left.locked}/><button disabled={trade.left.locked} onClick={()=>addItem(i)}>Add</button></div>)}</div>
          </Panel>
          <Panel title="Finalize">
            <div className="tradeFinalizeButtons">
              {trade.left.locked ? <button onClick={()=>act('trade_unlock',{tradeId:trade.id})}>Unlock Your Side</button> : <button onClick={()=>act('trade_lock',{tradeId:trade.id})}>Lock Your Side</button>}
              <button className="primary" disabled={!trade.left.locked || trade.left.approved} onClick={()=>act('trade_approve',{tradeId:trade.id})}>Approve Trade</button>
              <button className="danger" onClick={()=>act('trade_cancel',{tradeId:trade.id})}>Cancel Trade</button>
            </div>
            <p className="muted">Both sides must lock, then approve. Any item or credit change resets approval.</p>
          </Panel>
        </div>
      </>}
    </div>
  </div>;
}

function StarMap({state,act,clock,mapFocus,autoExploreMode='',autoExploreLastMode='pirate',autoExploreStatus='',onToggleAutoExploreMode=null,dialogs}) {
  const travel = state.travel_state || {};
  const travelMode = String(travel.mode || '').toLowerCase();
  const routePhase = String(travel.route_phase || '').toLowerCase();
  const preferredMode = travel.active && (travelMode === 'galaxy' || (travelMode === 'galaxy_route' && routePhase !== 'wait')) ? 'galaxy' : travel.open_space && travel.open_space_map_type === 'galaxy' ? 'galaxy' : 'system';
  const [mode,setMode] = useState(preferredMode);
  const [viewGalaxyId,setViewGalaxyId] = useState(null);
  useEffect(() => { setMode(preferredMode); if (preferredMode === 'galaxy') setViewGalaxyId(null); }, [preferredMode, state.location?.planet_id, state.location?.galaxy_id]);
  useEffect(() => {
    if (mapFocus?.kind !== 'server_event') return;
    const currentGalaxy = Number(state.location?.galaxy_id || state.system_map?.current_galaxy_id || 0);
    const targetGalaxy = Number(mapFocus.targetGalaxyId || 0);
    const requestedMap = String(mapFocus.mapType || '').toLowerCase();
    if (requestedMap === 'galaxy') {
      setViewGalaxyId(null);
      setMode('galaxy');
      return;
    }
    setMode('system');
    setViewGalaxyId(targetGalaxy && targetGalaxy !== currentGalaxy ? targetGalaxy : null);
  }, [mapFocus?.nonce, state.location?.galaxy_id, state.system_map?.current_galaxy_id]);
  const viewGalaxy = (node) => { setViewGalaxyId(Number(node?.id || node?.galaxy_id || node?.galaxyId || 0)); setMode('system'); };
  const mapModeProps = {mapMode:mode, onMapModeChange:setMode, onViewGalaxy:viewGalaxy, mapFocus};
  const currentGalaxyId = Number(state.location?.galaxy_id || state.system_map?.current_galaxy_id || 0);
  return <div>
    {mode === 'galaxy' ? <Galaxies state={state} act={act} clock={clock} {...mapModeProps} /> : (viewGalaxyId && viewGalaxyId !== currentGalaxyId ? <RemoteSystemMap state={state} act={act} clock={clock} galaxyId={viewGalaxyId} onBack={()=>setViewGalaxyId(null)} {...mapModeProps} /> : <SystemMap state={state} act={act} clock={clock} dialogs={dialogs} autoExploreMode={autoExploreMode} autoExploreLastMode={autoExploreLastMode} autoExploreStatus={autoExploreStatus} onToggleAutoExploreMode={onToggleAutoExploreMode} {...mapModeProps} />)}
  </div>
}


function MapOperationPanel({state, clock}) {
  const op = state.map_operation;
  if (!op || op.status !== 'active') return null;
  return <div className="mapOperationBanner"><b>{label(op.operation_type || 'operation')} active</b><span>{op.message || 'Working on map objective.'}</span><small>{op.ends_at ? `ETA ${clockTimeLeft(op.ends_at)}` : ''}</small></div>;
}

function Galaxies({state,act,clock,mapMode,onMapModeChange,onViewGalaxy,mapFocus}) {
  const map = state.galaxy_map || {nodes:[], lanes:[]};
  const travel = state.travel_state || {};
  return <Page title="Map — Galaxy View" sub="Galaxy travel uses gate lanes only. Select any destination galaxy and autopilot follows the connected gate path.">
    <TravelStatus state={state} clock={clock} />
    <CargoOperationPanel state={state} act={act} />
    <Panel title="Galaxy Map" help="Nodes summarize security, market activity, conflict, influence, and known locations across each galaxy.">
      <MapView state={state} type="galaxy" map={map} travel={travel}
        onTravel={(node)=>act('galaxy_travel',{galaxy_id:node.id})}
        onGoHere={null}
        onCancelTravel={()=>act('cancel_travel',{})}
        onScanArea={(pos)=>act('scan_area',{...pos,map_type:'galaxy'})}
        onScanObject={(target)=>act('scan_object',{...target,map_type:'galaxy'})}
        onIntercept={(ship)=>act('intercept_traveler',{target_ref:ship.combatTargetRef || ship.id,x_pct:ship.x_pct,y_pct:ship.y_pct,label:ship.name || ship.label || ship.ship_name,map_type:'galaxy'})}
        onResolveIntercept={()=>act('resolve_intercept_now',{})}
        onScanSite={(site)=>act('scan_exploration_site',{site_id:site.explorationSiteId || site.id})}
        onInvestigate={(site)=>act('investigate_exploration_site',{site_id:site.explorationSiteId || site.id})}
        onPilotTrade={(p)=>act('trade_invite',{playerId:p.playerId})}
        onPilotParty={(p)=>act('party_invite',{playerId:p.playerId})}
        onPilotBlock={(p)=>act('social_block_player',{playerId:p.playerId})}
        onGatheringMinigame={(event,payload)=>act(event === 'bonus' ? 'earn_gathering_minigame_bonus' : 'gathering_minigame_presence', payload, {silent:true, skipRefresh:true})}
currentId={map.current_galaxy_id} clock={clock} mapMode={mapMode} onMapModeChange={onMapModeChange} onViewGalaxy={onViewGalaxy} focusTarget={mapFocus} party={state.party} publicProfiles={state.public_profiles || []} missionCooldown={state.planet_missions?.cooldown || null} />
      <div className="routeLegend"><span className="solid">Visited route</span><span className="dash">Available route</span><span className="activeLine">Active travel</span><span>Ship marker follows backend timestamp progress.</span></div>
    </Panel>
    <div className="cards3">{map.nodes.map(g => <Panel key={g.id} title={g.name}>
      <div className="nodeHeader"><div className="itemVisual ship"><GameImage src={g.image_url} assetType="galaxy" category={`${g.name || ''} ${g.sector || ''} ${g.faction_name || ''}`} alt={g.name || 'Galaxy'} /></div><div><b>{g.sector}</b><span>{g.faction_name || 'Neutral'} control • {g.capturable ? 'Capturable' : 'Home safe'} • Center value {fmt(g.center_value || 0)}</span></div></div>
      <Stats pairs={{Locations:g.planet_count, Gates:g.gate_count, SecurityAvg:g.security_avg, Market:g.market_activity_avg, Conflict:g.conflict_avg, Bonus:`${g.control_bonus_pct||0}%`}} />
      <div className="galaxyCardButtons"><button onClick={()=>onViewGalaxy?.(g)}>View</button>{g.current ? <button disabled>Current Galaxy</button> : <button disabled={travel.active} onClick={()=>act('galaxy_travel',{galaxy_id:g.id})}>Jump via Gate</button>}</div>
      <small className="muted">{g.declare_reason || 'Planet wars happen from Planet View. Galaxy flips after all planets are controlled.'}</small>
    </Panel>)}</div>
  </Page>
}

function SystemMap({state,act,clock,mapMode,onMapModeChange,onViewGalaxy,mapFocus,autoExploreMode='',autoExploreLastMode='pirate',autoExploreStatus='',onToggleAutoExploreMode=null,dialogs}) {
  const map = state.system_map || {nodes:[], lanes:[]};
  const travel = state.travel_state || {};
  const activeMission = state.planet_missions?.active;
  if (activeMission) {
    return <Page title="Map — Mission View" sub="You are away from the ship on a planet mission. The map returns after completion or cancellation.">
      <MissionScreen state={state} act={act} clock={clock} dialogs={dialogs} />
    </Page>;
  }
  return <Page title="Map — System View" sub="Planet view shows planets, uninhabitable planets, resources, traffic, and galaxy gates leading to adjacent galaxies.">
    <TravelStatus state={state} clock={clock} />
    <CargoOperationPanel state={state} act={act} />
    <MapOperationPanel state={state} clock={clock} />
    <Panel title={`${state.location?.galaxy_name || 'Current Galaxy'} Map`} help="Planet nodes expose security, stability, faction control, market strength, operation count, and route danger.">
      <MapView state={state} type="system" map={map} travel={travel}
        onTravel={(node)=>node.kind === 'gate' ? act('galaxy_travel',{galaxy_id:node.target_galaxy_id}) : act('travel',{planet_id:node.id,dock:true})}
        onGoHere={(pos)=>act('go_here',{...pos,map_type:'system'})}
        onCancelTravel={()=>act('cancel_travel',{})}
        onScanArea={(pos)=>act('scan_area',{...pos,map_type:'system'})}
        onScanObject={(target)=>act('scan_object',{...target,map_type:'system'})}
        onIntercept={(ship)=>act('intercept_traveler',{target_ref:ship.combatTargetRef || ship.id,x_pct:ship.x_pct,y_pct:ship.y_pct,label:ship.name || ship.label || ship.ship_name,map_type:'system'})}
        onResolveIntercept={()=>act('resolve_intercept_now',{})}
        onMine={(site)=>act('mine_ore_site',{site_id:site.siteId || site.id})}
        onSalvage={(site)=>act('salvage_site',{site_id:site.salvageSiteId || site.id})}
        onScanSite={(site)=>act('scan_exploration_site',{site_id:site.explorationSiteId || site.id})}
        onInvestigate={(site)=>act('investigate_exploration_site',{site_id:site.explorationSiteId || site.id})}
        onEnterPirateStation={(station)=>act('enter_pirate_station',{station_id:station.stationId || station.id})}
        onPlaceBase={async (pos)=>{
          const name = await dialogs.textInput('Name this private base.', 'Private Base', {title:'Build Private Base', inputLabel:'Base name'});
          act('place_player_base',{...pos,map_type:'system',name:name || 'Private Base'});
        }}
        onAdminSpawn={(payload)=>act('admin_spawn_map_objects', payload)}
        onDockBase={(base)=>act('dock_player_base',{base_id:base.baseId || base.id})}
        onMissionTravel={(node,mission)=>act('start_planet_mission_travel',{planet_id:node.id,mission_key:mission.key})}
        onPilotTrade={(p)=>act('trade_invite',{playerId:p.playerId})}
        onPilotParty={(p)=>act('party_invite',{playerId:p.playerId})}
        onPilotBlock={(p)=>act('social_block_player',{playerId:p.playerId})}
        onGatheringMinigame={(event,payload)=>act(event === 'bonus' ? 'earn_gathering_minigame_bonus' : 'gathering_minigame_presence', payload, {silent:true, skipRefresh:true})}
currentId={map.current_planet_id} clock={clock} mapMode={mapMode} onMapModeChange={onMapModeChange} onViewGalaxy={onViewGalaxy} focusTarget={mapFocus} party={state.party} publicProfiles={state.public_profiles || []} missionCooldown={state.planet_missions?.cooldown || null} autoExploreMode={autoExploreMode} autoExploreLastMode={autoExploreLastMode} autoExploreStatus={autoExploreStatus} onToggleAutoExploreMode={onToggleAutoExploreMode} />
      <div className="routeLegend"><span className="solid">Visited local route</span><span className="dash">Available local route</span><span className="activeLine">Active local travel</span></div>
    </Panel>
  </Page>
}


function localPointForPlanet(p) {
  const x = Math.max(7, Math.min(93, 50 + Number(p?.x || 0) / 2.3));
  const y = Math.max(8, Math.min(92, 50 + Number(p?.y || 0) / 2.3));
  return {x_pct:Math.max(2, Math.min(98, (x - 50) * 1.45 + 50)), y_pct:Math.max(2, Math.min(98, (y - 50) * 1.45 + 50))};
}

function RemoteSystemMap({state,act,clock,galaxyId,onBack,mapMode,onMapModeChange,onViewGalaxy,mapFocus}) {
  const galaxy = (state.galaxies || []).find(g=>Number(g.id) === Number(galaxyId)) || {};
  const planets = (state.planets || []).filter(p=>Number(p.galaxy_id) === Number(galaxyId));
  const partyMembers = (state.party?.members || []).filter(m=>Number(m.position?.galaxy_id) === Number(galaxyId));
  const nodes = planets.map(p=>({
    ...p,
    id:p.id,
    kind:p.kind || (String(p.type || '').toLowerCase().includes('gate') ? 'gate' : 'planet'),
    name:p.name,
    current:false,
    faction_color:p.faction_color || p.color,
    image_url:p.image_url,
    ...localPointForPlanet(p)
  }));
  const traffic = partyMembers.map(m=>({
    id:`party:${m.playerId}`,
    kind:'player',
    partyMember:true,
    friendly:true,
    attackable:false,
    name:m.displayName || m.username || 'Party Member',
    playerId:m.playerId,
    avatarId:m.avatarId,
    image_url:m.ship?.imageUrl,
    x_pct:Number(m.position?.system_x_pct || 50),
    y_pct:Number(m.position?.system_y_pct || 50),
    hull:m.ship?.hull,
    maxHull:m.ship?.maxHull,
    shield:m.ship?.shield,
    maxShield:m.ship?.maxShield,
    label:'Party member radar relay'
  }));
  const map = {nodes, lanes:[], traffic, current_galaxy_id:Number(galaxyId), remote:true, summary:{radar_range_pct:partyMembers.length ? 22 : 0, radar_center_x_pct:partyMembers[0]?.position?.system_x_pct || 50, radar_center_y_pct:partyMembers[0]?.position?.system_y_pct || 50}};
  return <Page title={`Map — ${galaxy.name || 'Remote Galaxy'} View`} sub="Remote local view shows planets only unless a party member provides radar coverage there.">
    <button onClick={onBack}>Back to Current Galaxy</button>
    <Panel title={`${galaxy.name || 'Remote Galaxy'} Map`} help="You are not physically here. Party members act as radar relays.">
      <MapView state={state} type="system" map={map} travel={{}} onTravel={()=>{}} onGoHere={()=>{}} onCancelTravel={()=>{}} onScanArea={()=>{}} onIntercept={()=>{}} onResolveIntercept={()=>{}} onPilotTrade={(p)=>act('trade_invite',{playerId:p.playerId})} onPilotParty={(p)=>act('party_invite',{playerId:p.playerId})} onPilotBlock={(p)=>act('social_block_player',{playerId:p.playerId})} currentId={null} clock={clock} mapMode={mapMode} onMapModeChange={onMapModeChange} onViewGalaxy={onViewGalaxy} focusTarget={mapFocus} party={state.party} publicProfiles={state.public_profiles || []} missionCooldown={null} />
    </Panel>
  </Page>;
}


function ServerCalendar({state,act,clock,setPage,openServerEventOnMap,dialogs,eventOnly=false}) {
  const phase = state.phase_expansion || {};
  const [tab,setTab] = useState('events');
  const events = useMemo(
    () => ((phase.serverEvents?.length ? phase.serverEvents : state.server_events?.upcoming) || []).map(normalizeServerEvent),
    [phase.serverEvents, state.server_events?.upcoming]
  );
  const active = events.filter(e => e.status === 'active');
  const warning = events.filter(e => e.status === 'warning');
  const scheduled = events.filter(e => e.status === 'scheduled').slice(0,20);
  const contracts = phase.contracts || [];
  const activeContracts = phase.activeContracts || [];
  const fuel = phase.fuelStatus || state.fuel_status || {};
  const artifacts = phase.artifacts || [];
  const blips = phase.scanBlips || [];
  const ladder = phase.eventLadder || [];
  const settings = phase.settings || {};
  const bounties = phase.bounties || [];
  const derelicts = phase.derelicts || [];
  const derelictRuns = phase.derelictRuns || [];
  const wormholeRows = phase.wormholeControl || [];
  const refineryJobs = phase.refineryJobs || [];
  const lock = phase.activeShipLock;
  const bonuses = phase.artifactBonuses || {};
  const eventTypes = ['alien_raid','wormhole_control','convoy_breakthrough','mining_surge','derelict_armada','warfront_surge'];

  const launchProbe = async () => {
    const x = Number(await dialogs.textInput('Probe X percent', '50', {title:'Launch Probe', inputLabel:'X percent'})) || 50;
    const y = Number(await dialogs.textInput('Probe Y percent', '50', {title:'Launch Probe', inputLabel:'Y percent'})) || 50;
    act('scan_area', {map_type:'system', x_pct:x, y_pct:y});
  };
  const contribute = async () => {
    const item_code = await dialogs.textInput('Material/item code to contribute', 'scrap', {title:'War Supply Contribution', inputLabel:'Item code'});
    const qty = Number(await dialogs.textInput('Quantity', '10', {title:'War Supply Contribution', inputLabel:'Quantity'})) || 10;
    act('contribute_war_supply', {item_code:item_code || 'scrap', qty});
  };
  const createBounty = async () => {
    const target_player_id = Number(await dialogs.textInput('Target player ID', '2', {title:'Create Player Bounty', inputLabel:'Target player ID'})) || 0;
    const reward = Number(await dialogs.textInput('Reward credits', '10000', {title:'Create Player Bounty', inputLabel:'Reward credits'})) || 10000;
    if (target_player_id) act('create_player_bounty', {target_player_id, reward});
  };
  const refine = async () => {
    const input_code = await dialogs.textInput('Raw ore/material code', 'ore', {title:'Start Refinery Job', inputLabel:'Input code'});
    const qty = Number(await dialogs.textInput('Quantity', '10', {title:'Start Refinery Job', inputLabel:'Quantity'})) || 10;
    act('start_refinery_job', {input_code:input_code || 'ore', qty});
  };

  if (eventOnly) {
    return <Page title="Events" sub="Server and scheduled events only.">
      <Panel title="Active / Starting Soon">
        {[...active, ...warning].map(e=><ServerEventRow key={e.id} event={e} onOpenMap={openServerEventOnMap} />)}
        {![...active,...warning].length && <p className="muted">No active event or two-hour warning currently.</p>}
      </Panel>
      <Panel title="Upcoming Event Calendar">
        <div className="eventGrid">{scheduled.map(e=><ServerEventCard key={e.id} event={e} />)}</div>
      </Panel>
    </Page>;
  }

  return <Page title="Server Calendar" sub="Server events, bounties, wormholes, derelicts, artifacts, refining, contracts, fuel, and weekly event ladder.">
    <div className="phaseHeroGrid">
      <Panel title="Fuel Status" help="Fuel affects movement only. At 0 fuel, emergency power halves speed and jump gates are blocked.">
        <Stats pairs={{Fuel:`${fmt(fuel.fuel ?? state.player.fuel)} / ${fmt(fuel.maxFuel ?? state.player.max_fuel)}`, Percent:`${fmt(fuel.pct ?? 0)}%`, Status:fuel.empty?'Emergency Power':fuel.low?'Low Fuel':'Nominal', JumpGate:fuel.jumpGateBlocked?'Blocked':'Ready'}} />
        {fuel.message && <div className={fuel.empty ? 'warningLine danger' : 'warningLine'}><AlertTriangle size={16}/>{fuel.message}</div>}
        <div className="buttonRow"><button onClick={()=>act('buy_fuel_service',{amount:25})}>Buy 25 Fuel</button><button onClick={()=>act('buy_fuel_service',{amount:100})}>Fill Fuel</button></div>
      </Panel>
      <Panel title="Event Snapshot">
        <Stats pairs={{Active:active.length, StartingSoon:warning.length, Scheduled:scheduled.length, TradeGoods:phase.tradeGoodCount || 0, DerelictSites:derelicts.length, Bounties:bounties.length}} />
        {lock && <div className="warningLine danger"><AlertTriangle size={16}/>Bounty lock active on {lock.ship_name || 'current ship'} until {clockTimeLeft(lock.expires_at)}. Ship/equipment swapping is blocked.</div>}
        <div className="buttonRow"><button onClick={()=>setTab('events')}>Events</button><button onClick={()=>setTab('bounties')}>Bounties</button><button onClick={()=>setTab('exploration')}>Exploration</button></div>
      </Panel>
      <Panel title="Weekly Ladder">
        {(ladder || []).slice(0,5).map((l,i)=><div className="itemLine" key={`${l.player_id}-${l.week_key}`}><b>#{i+1} {l.callsign}</b><span>{fmt(l.score)} score • {l.week_key}</span></div>)}
        {!ladder.length && <p className="muted">No event score yet this week.</p>}
      </Panel>
    </div>

    <div className="tabBar">
      <button className={tab==='events'?'active':''} onClick={()=>setTab('events')}>Events</button>
      <button className={tab==='contracts'?'active':''} onClick={()=>setTab('contracts')}>Enemy Contracts</button>
      <button className={tab==='bounties'?'active':''} onClick={()=>setTab('bounties')}>Bounty Board</button>
      <button className={tab==='wormhole'?'active':''} onClick={()=>setTab('wormhole')}>Wormhole Control</button>
      <button className={tab==='exploration'?'active':''} onClick={()=>setTab('exploration')}>Probes / Derelicts / Artifacts</button>
      <button className={tab==='industry'?'active':''} onClick={()=>setTab('industry')}>Refining</button>
      <button className={tab==='war'?'active':''} onClick={()=>setTab('war')}>War Supply</button>
      {state.user.god_mode && <button className={tab==='admin'?'active':''} onClick={()=>setTab('admin')}>Admin Events</button>}
    </div>

    {tab === 'events' && <>
      <Panel title="Active / Starting Soon">
        {[...active, ...warning].map(e=><ServerEventRow key={e.id} event={e} onOpenMap={openServerEventOnMap} />)}
        {![...active,...warning].length && <p className="muted">No active event or two-hour warning currently.</p>}
      </Panel>
      <Panel title="Upcoming Event Calendar">
        <div className="eventGrid">{scheduled.map(e=><ServerEventCard key={e.id} event={e} />)}</div>
      </Panel>
    </>}

    {tab === 'contracts' && <>
      <Panel title="Active Contracts" help="Enemy-territory cargo and escort contracts complete only when docked at the destination. Escort NPCs detach on completion, abandon, failure, destruction, or timer expiry.">
        <table><thead><tr><th>Type</th><th>Destination</th><th>Due</th><th>Reward</th><th></th></tr></thead><tbody>
          {activeContracts.map(c=><tr key={c.id}><td>{label(c.contract_type)}</td><td>{c.destination_name}</td><td>{clockTimeLeft(c.due_at)}</td><td>{fmt(c.reward_credits)} cr / {fmt(c.reward_xp)} XP</td><td><button onClick={()=>act('complete_phase_contract',{player_contract_id:c.id})}>Complete</button><button onClick={()=>act('abandon_phase_contract',{player_contract_id:c.id})}>Abandon</button></td></tr>)}
          {!activeContracts.length && <tr><td colSpan="5">No active phase contracts.</td></tr>}
        </tbody></table>
      </Panel>
      <Panel title="Local Enemy-Territory Contracts">
        <table><thead><tr><th>Contract</th><th>Route</th><th>Difficulty</th><th>Cargo</th><th>Reward</th><th></th></tr></thead><tbody>
          {contracts.map(c=><tr key={c.id}><td><b>{label(c.contract_type)}</b><br/><small>Planet rep +{fmt(c.reputation_xp)}</small></td><td>{c.origin_name} → <b>{c.destination_name}</b><br/><small>{c.origin_galaxy_name} → {c.destination_galaxy_name}</small></td><td>{fmt(c.difficulty)}</td><td>{fmt(c.qty)} {c.cargo_name}</td><td>{fmt(c.reward_credits)} cr<br/><small>{fmt(c.reward_xp)} XP</small></td><td><button onClick={()=>act('accept_phase_contract',{contract_id:c.id})}>Accept</button></td></tr>)}
          {!contracts.length && <tr><td colSpan="6">No local contracts at this planet.</td></tr>}
        </tbody></table>
      </Panel>
      <Panel title="Planet Reputation">
        <div className="feedList compactFeed">{(phase.planetReputation || []).map(r=><div key={`${r.planet_id}`}><b>{r.planet_name}</b><span>{r.galaxy_name} • Level {r.level} • {fmt(r.xp)} XP • {fmt(r.completed_contracts)} completed</span></div>)}</div>
      </Panel>
    </>}

    {tab === 'bounties' && <>
      <Panel title="Bounty Board" help="NPC bounties are server controlled and limited to one per galaxy. Player bounties cost reward plus a 10% fee. Last-seen data updates every 30 minutes.">
        <div className="buttonRow"><button onClick={createBounty}>Create Player Bounty</button>{lock && <button className="dangerBtn" onClick={()=>act('clear_my_crime_bounty')}>Pay / Clear Crime Bounty</button>}</div>
        <table><thead><tr><th>Target</th><th>Type</th><th>Reward</th><th>Last Seen</th><th>Status</th><th></th></tr></thead><tbody>
          {bounties.map(b=><tr key={b.id}><td><b>{b.target_name}</b><br/><small>{b.metadata?.reason || b.galaxy_name || 'Server bounty'}</small></td><td>{label(b.bounty_type)}</td><td>{fmt(b.reward)} cr</td><td>{b.last_seen_galaxy_name || b.galaxy_name || 'Unknown'}<br/><small>updated {fmt(b.lastSeenAgeMinutes || 0)} min ago</small></td><td>{label(b.status)}</td><td>{b.status==='open' && <button onClick={()=>act('accept_phase_bounty',{bounty_id:b.id})}>Accept</button>}{b.bounty_type==='npc' && <button onClick={()=>act('claim_phase_bounty',{bounty_id:b.id})}>Claim NPC</button>}</td></tr>)}
          {!bounties.length && <tr><td colSpan="6">No active bounties.</td></tr>}
        </tbody></table>
      </Panel>
    </>}

    {tab === 'wormhole' && <>
      <Panel title="Wormhole Control" help="Weekly event. Join the control ring, build capture time, and unlock a 48-hour reward wormhole when your faction wins.">
        {phase.activeWormholeEvent ? <ServerEventCard event={normalizeServerEvent(phase.activeWormholeEvent)} /> : <p className="muted">No active Wormhole Control event.</p>}
        <div className="buttonRow"><button onClick={()=>act('join_wormhole_control')}>Join Control Ring</button><button onClick={()=>act('tick_wormhole_control')}>Hold / Tick Control</button></div>
        <table><thead><tr><th>Faction</th><th>Pilot</th><th>Control Time</th><th>Status</th><th>Reward</th></tr></thead><tbody>
          {wormholeRows.map(w=><tr key={w.id}><td>{w.faction_name || w.faction_id || 'Faction'}</td><td>{w.callsign || 'Pilot'}</td><td>{fmt(w.control_seconds)}s</td><td>{label(w.status)}</td><td>{w.reward_expires_at ? clockTimeLeft(w.reward_expires_at) : '-'}</td></tr>)}
          {!wormholeRows.length && <tr><td colSpan="5">No control participation yet.</td></tr>}
        </tbody></table>
      </Panel>
    </>}

    {tab === 'exploration' && <>
      <Panel title="Probe Launcher" help="Send probes outside radar to create 30-second category blips. Object scans still use scanner/counter-scanner math clamped between 20% and 80% certainty.">
        <div className="buttonRow"><button onClick={launchProbe}>Launch Probe</button><button onClick={()=>setPage?.('Map')}>Open Map</button></div>
        <div className="blipGrid">{blips.map(b=><div className={`blipCard ${b.category}`} key={b.id}><b>{label(b.category)} Blip</b><span>{fmt(b.x_pct)}%, {fmt(b.y_pct)}%</span><small>Expires {clockTimeLeft(b.expires_at)}</small></div>)}</div>
      </Panel>
      <Panel title="Derelict Sites" help="Derelicts are scan/discovery objects. Exploration is shorter than planet exploration and pays about 85% of comparable rewards.">
        <table><thead><tr><th>Derelict</th><th>Location</th><th>Tier</th><th>Background</th><th></th></tr></thead><tbody>
          {derelicts.map(d=><tr key={d.id}><td><b>{d.name}</b><br/><small>{d.rewards?.artifactChancePct || 0}% artifact chance</small></td><td>{d.planet_name || d.galaxy_name}</td><td>{fmt(d.tier)}</td><td>{d.background_key}</td><td><button onClick={()=>act('start_derelict_exploration',{site_id:d.id})}>Explore</button></td></tr>)}
          {!derelicts.length && <tr><td colSpan="5">No active derelicts visible.</td></tr>}
        </tbody></table>
        {!!derelictRuns.length && <div className="feedList compactFeed">{derelictRuns.map(r=><div key={r.id}><b>{r.site_name}</b><span>{fmt(r.remainingSeconds)}s remaining</span><button onClick={()=>act('complete_derelict_exploration',{run_id:r.id})}>Complete</button></div>)}</div>}
      </Panel>
      <Panel title="Artifacts" help="Artifacts are planet-stored unless carried/equipped. Unidentified carried artifacts are lost if the ship is destroyed. Identified artifacts can be mounted to active ships.">
        {!!Object.keys(bonuses).length && <div className="phaseBonusBar">{Object.entries(bonuses).map(([k,v])=><span key={k}>{label(k)} +{v}%</span>)}</div>}
        <table><thead><tr><th>Artifact</th><th>Type</th><th>Tier</th><th>Status</th><th></th></tr></thead><tbody>
          {artifacts.map(a=><tr key={a.id}><td><b>{a.name}</b><br/><small>{label(a.rarity)}</small></td><td>{label(a.artifact_type)}</td><td><TierBadge item={{current_tier:a.tier,max_tier:8,tier_display:{label:`T${a.tier}`}}}/></td><td>{a.identified?'Identified':label(a.status)} {a.identifyRemainingSeconds ? `• ${fmt(a.identifyRemainingSeconds)}s` : ''}</td><td>{!a.identified && a.status!=='identifying' && <button onClick={()=>act('start_artifact_identification',{artifact_id:a.id})}>Identify</button>}{!a.identified && a.status==='identifying' && <button onClick={()=>act('collect_identified_artifact',{artifact_id:a.id})}>Collect</button>}{a.identified && a.status!=='equipped' && <button onClick={()=>act('equip_artifact',{artifact_id:a.id})}>Equip</button>}{a.identified && a.status==='equipped' && <button onClick={()=>act('unequip_artifact',{artifact_id:a.id})}>Unequip</button>}</td></tr>)}
          {!artifacts.length && <tr><td colSpan="5">No local/player artifacts visible.</td></tr>}
        </tbody></table>
      </Panel>
    </>}

    {tab === 'industry' && <>
      <Panel title="Station Refining" help="Mining produces raw ore. Refining converts raw ore/materials into crafting materials at stations/inhabitable planets.">
        <div className="buttonRow"><button onClick={refine}>Start Refining Job</button></div>
        <table><thead><tr><th>Input</th><th>Output</th><th>Status</th><th>Complete</th></tr></thead><tbody>
          {refineryJobs.map(j=><tr key={j.id}><td>{fmt(j.input_qty)} {label(j.input_code)}</td><td>{fmt(j.output_qty)} {label(j.output_code)}</td><td>{label(j.status)}</td><td>{j.status==='active' ? clockTimeLeft(j.complete_at) : j.completed_at}</td></tr>)}
          {!refineryJobs.length && <tr><td colSpan="4">No refining jobs yet.</td></tr>}
        </tbody></table>
      </Panel>
    </>}

    {tab === 'war' && <>
      <Panel title="Faction War Supply" help="Supply contributions are per border/frontline galaxy. Higher contribution levels unlock small frontline bonuses.">
        <div className="buttonRow"><button onClick={contribute}>Contribute Material</button></div>
        <table><thead><tr><th>Galaxy</th><th>Contribution</th><th>Supply Level</th><th>Bonus</th></tr></thead><tbody>
          {(phase.warSupply || []).map(w=><tr key={`${w.galaxy_id}-${w.faction_id}`}><td>{w.galaxy_name}</td><td>{fmt(w.contribution_value)}</td><td>{fmt(w.supplyLevel)} / 5</td><td>{w.supplyLevel >= 2 ? '+ attack/defense pressure' : '+5% attack pressure'}</td></tr>)}
          {!(phase.warSupply || []).length && <tr><td colSpan="4">No war supply contributions yet.</td></tr>}
        </tbody></table>
      </Panel>
    </>}

    {tab === 'admin' && state.user.god_mode && <>
      <Panel title="Admin Server Event Controls">
        <div className="buttonRow"><button onClick={()=>act('admin_generate_server_events')}>Generate Calendar</button>{eventTypes.map(t=><button key={t} onClick={()=>act('admin_trigger_server_event',{event_type:t})}>Trigger {label(t)}</button>)}<button onClick={()=>act('admin_spawn_npc_bounty')}>Refresh NPC Bounties</button></div>
      </Panel>
      <Panel title="Admin World Spacing Controls" help="Regenerates positions only. Preserves planet/galaxy names, ownership, stations, and content.">
        <Stats pairs={{PlanetMultiplier:settings.planet_spacing_multiplier || 3, GalaxyMultiplier:settings.galaxy_spacing_multiplier || 3, MinPlanetGap:settings.minimum_planet_gap || 18, MinGalaxyGap:settings.minimum_galaxy_gap || 16}} />
        <button className="dangerBtn" onClick={()=>act('admin_regenerate_phase_layout',{})}>Regenerate Planet/Galaxy Layout</button>
      </Panel>
    </>}
  </Page>
}


function ServerEventRow({event,onOpenMap}) {
  return <div className={`serverEventRow ${event.status}`}><b>{onOpenMap ? <button type="button" className="eventNameLink" onClick={()=>onOpenMap(event)}>{event.name}</button> : event.name}</b><span>{label(event.status)} • starts {new Date(event.starts_at).toLocaleString()} • ends {new Date(event.ends_at).toLocaleString()}</span><small>{Object.entries(event.location || {}).map(([k,v])=>`${label(k)}: ${Array.isArray(v)?v.join(', '):v}`).join(' • ')}</small></div>
}

function ServerEventCard({event}) {
  return <div className={`serverEventCard ${event.event_type}`}><b>{event.name}</b><span>{new Date(event.starts_at).toLocaleString()}</span><small>{label(event.schedule_type)} • {label(event.status)}</small><p>{event.rewards?.rareEquipment ? 'Rare equipment chance. ' : ''}{event.rewards?.artifactChance ? 'Artifact chance. ' : ''}{event.rewards?.fuelVouchers ? 'Fuel vouchers. ' : ''}</p></div>
}

function Market({state,act,dialogs,initialTab='goods',planetMode=false}) {
  const [tab,setTab] = useState(initialTab || 'goods');
  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);
  const [category,setCategory] = useState('all');
  const [query,setQuery] = useState('');
  const [listingQuery,setListingQuery] = useState('');
  const [listingGalaxy,setListingGalaxy] = useState('all');
  const [listingCategory,setListingCategory] = useState('all');
  const [storageQuery,setStorageQuery] = useState('');
  const [storageGalaxy,setStorageGalaxy] = useState('all');
  const [storagePlanet,setStoragePlanet] = useState('all');
  const [depositQuery,setDepositQuery] = useState('');
  const [depositCategory,setDepositCategory] = useState('all');
  const goods = state.market.filter(m=>m.legal);
  const inventory = state.inventory_summary || [];
  const categories = [['all','All'], ...Object.entries(state.inventory_categories || {})];
  const sellable = inventory.filter(i => i.sellable !== false && i.available_qty > 0 && (category === 'all' || i.category === category) && `${i.name} ${i.item_code} ${i.category_label}`.toLowerCase().includes(query.toLowerCase()));
  const sellItem = (item, qty) => {
    const safeQty = Math.max(1, Math.min(qty, item.available_qty || item.qty || 1));
    if (item.source === 'cargo_hold' && item.commodity_id) act('sell_commodity',{commodity_id:item.commodity_id,qty:safeQty});
    else act('sell_inventory_item',{item_code:item.item_code,qty:safeQty});
  };
  const listItem = async (item, defaultQty=1) => {
    const maxQty = Math.max(1, item.available_qty || item.qty || 1);
    const qty = Math.max(1, Math.min(maxQty, Number(await dialogs.textInput(`Quantity to list for ${item.name}`, String(Math.min(defaultQty, maxQty)), {title:'Create Market Listing', inputLabel:'Quantity'})) || 1));
    const base = Number(item.base_value || item.avg_cost || 100);
    const unitPrice = Math.max(1, Number(await dialogs.textInput('Unit price', String(base), {title:'Create Market Listing', inputLabel:'Unit price'})) || base);
    const payload = { source:item.source || 'inventory', item_code:item.item_code, commodity_id:item.commodity_id, module_id:item.id, id:item.id, qty, unit_price:unitPrice };
    act('create_player_listing', payload);
  };
  const storeItem = async (item, defaultQty=1) => {
    if (storageInOpenSpace) return;
    const maxQty = Math.max(1, item.available_qty || item.qty || 1);
    const qty = Math.max(1, Math.min(maxQty, Number(await dialogs.textInput(`Quantity to store at current planet for ${item.name}`, String(Math.min(defaultQty, maxQty)), {title:'Store Item', inputLabel:'Quantity'})) || 1));
    const payload = { source:item.source || 'inventory', item_code:item.item_code, commodity_id:item.commodity_id, module_id:item.id, id:item.id, qty };
    act('store_item', payload);
  };
  const buyListing = (listing, qty=1) => {
    const safeQty = Math.max(1, Math.min(qty, listing.remaining_qty || 1));
    act('buy_player_listing', {listing_id:listing.id, qty:safeQty});
  };
  const withdrawStorage = async (item, defaultQty=1) => {
    if (storageInOpenSpace || !item.can_modify) return;
    const qty = Math.max(1, Math.min(Number(item.qty || 1), Number(await dialogs.textInput(`Quantity to withdraw from ${item.planet_name}`, String(Math.min(defaultQty, item.qty || 1)), {title:'Withdraw Storage', inputLabel:'Quantity'})) || 1));
    act('withdraw_storage_item', {storage_id:item.id, qty});
  };

  const playerMarket = state.player_market || {active:[], history:[], balance:{}, scope:{}, galaxies:[], rules:{}};
  const storage = state.player_storage || {stored:[], depositCandidates:[], galaxies:[], scope:{}, rules:{}};
  const storageInOpenSpace = !!(state.travel_state?.open_space || storage.rules?.inOpenSpace);
  const currentGalaxyId = Number(playerMarket.scope?.galaxy_id || storage.scope?.galaxy_id || 0);
  const marketGalaxies = playerMarket.galaxies || [];
  const listingCategories = useMemo(() => ['all', ...Array.from(new Set((playerMarket.active || []).map(x=>x.category).filter(Boolean))).sort()], [playerMarket.active]);
  const storageGalaxies = useMemo(() => ['all', ...Array.from(new Map((storage.stored || []).map(x=>[String(x.galaxy_id), x.galaxy_name || `Galaxy ${x.galaxy_id}`])).entries())], [storage.stored]);
  const storagePlanets = useMemo(() => ['all', ...Array.from(new Map((storage.stored || []).map(x=>[String(x.planet_id), x.planet_name || `Planet ${x.planet_id}`])).entries())], [storage.stored]);
  const filteredListings = useMemo(() => {
    const q = listingQuery.trim().toLowerCase();
    return (playerMarket.active || []).filter(l => {
      if (listingGalaxy !== 'all' && String(l.galaxy_id) !== String(listingGalaxy)) return false;
      if (listingCategory !== 'all' && l.category !== listingCategory) return false;
      if (!q) return true;
      return `${l.item_name || ''} ${l.item_code || ''} ${l.seller_name || ''} ${l.planet_name || ''} ${l.galaxy_name || ''} ${l.category || ''}`.toLowerCase().includes(q);
    });
  }, [playerMarket.active, listingQuery, listingGalaxy, listingCategory]);
  const filteredStorage = useMemo(() => {
    const q = storageQuery.trim().toLowerCase();
    return (storage.stored || []).filter(s => {
      if (storageGalaxy !== 'all' && String(s.galaxy_id) !== String(storageGalaxy)) return false;
      if (storagePlanet !== 'all' && String(s.planet_id) !== String(storagePlanet)) return false;
      if (!q) return true;
      return `${s.item_name || ''} ${s.item_code || ''} ${s.planet_name || ''} ${s.galaxy_name || ''} ${s.category || ''}`.toLowerCase().includes(q);
    });
  }, [storage.stored, storageQuery, storageGalaxy, storagePlanet]);
  const depositCandidates = (storage.depositCandidates || []).filter(i => i.sellable !== false && (depositCategory === 'all' || i.category === depositCategory) && `${i.name} ${i.item_code} ${i.category_label}`.toLowerCase().includes(depositQuery.toLowerCase()));

  const tabs = planetMode ? ['goods', 'sell', 'storage'] : ['auction', 'activity'];
  return <Page title={planetMode ? "NPC Goods Market" : "Auction"} sub={planetMode ? "Docked station goods, Sell Inventory, and planet storage. Auction stays global in the left navigation." : "Global player listings. Purchases are delivered to storage on the listing planet."}>
    <div className="tabBar">
      {tabs.includes('goods') && <button className={tab==='goods'?'active':''} onClick={()=>setTab('goods')}>Goods</button>}
      {tabs.includes('sell') && <button className={tab==='sell'?'active':''} onClick={()=>setTab('sell')}>Sell Inventory</button>}
      {tabs.includes('auction') && <button className={tab==='auction'?'active':''} onClick={()=>setTab('auction')}>Auction</button>}
      {tabs.includes('storage') && <button className={tab==='storage'?'active':''} onClick={()=>setTab('storage')}>Planet Storage</button>}
      {tabs.includes('activity') && <button className={tab==='activity'?'active':''} onClick={()=>setTab('activity')}>Market Activity</button>}
    </div>

    <JailHeatPanel state={state} act={act} />
    <CargoOperationPanel state={state} act={act} />

    {tab === 'goods' && <>
      <Panel title="Cargo Usage" help="Buying market goods uses backend cargo capacity checks. Trade goods are for station markets and cannot be exploited through player-market listing.">
        <Stats pairs={{Used:state.cargo_usage?.total ?? state.player.cargo, Free:state.cargo_usage?.free ?? Math.max(0,state.player.max_cargo-state.player.cargo), Max:state.cargo_usage?.max ?? state.player.max_cargo, MarketCargo:state.cargo_usage?.market_mass ?? 0, Inventory:state.cargo_usage?.inventory_mass ?? 0, Modules:state.cargo_usage?.module_mass ?? 0, Pending:state.cargo_usage?.pending_mass ?? 0}} />
        <Progress value={((state.cargo_usage?.total ?? state.player.cargo) / Math.max(1, state.cargo_usage?.max ?? state.player.max_cargo))*100} danger={state.cargo_usage?.over_capacity} />
        {state.cargo_usage?.over_capacity && <div className="warningLine"><AlertTriangle size={16}/> Cargo exceeds current ship capacity. Sell, craft, or swap to a larger ship.</div>}
      </Panel>
      <MarketPressure state={state} />
    </>}

    {tab === 'goods' && <Panel title="Goods" help="Station goods are NPC market cargo. Same-galaxy arbitrage is intentionally low; cross-galaxy routes are the profit layer."><MarketTable rows={goods} act={act} /></Panel>}

    {tab === 'sell' && <>
      <Panel title="Inventory Filters">
        <div className="inventoryToolbar">
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search inventory" />
          <div className="chipRow">{categories.map(([key,name])=><button key={key} className={category===key?'active':''} onClick={()=>setCategory(key)}>{name}</button>)}</div>
        </div>
      </Panel>
      <Panel title="Sell Inventory" help="Selling items restocks the local market with no risk. Use Auction from the left navigation for global player listings.">
        <table><thead><tr><th>Item</th><th>Category</th><th>Status</th><th>Qty</th><th>Mass</th><th>Value</th><th>Risk</th><th></th></tr></thead><tbody>
          {sellable.map(i=><tr key={`${i.source}-${i.id}-${i.item_code}`}>
            <td><div className="itemNameCell"><ItemVisual item={i} /><div><b>{i.name}</b><br/><small>{i.description || i.item_code}</small></div></div></td>
            <td>{i.category_label || label(i.category)}</td>
            <td className={i.legal?'ok':'bad'}>{i.legal?'Goods':'Restricted'} • {label(i.rarity || 'common')} <TierBadge item={i}/></td>
            <td>{fmt(i.available_qty)}</td>
            <td>{fmt(i.cargo_mass)}</td>
            <td>{fmt(i.market_sell_estimate?.unit || i.base_value)}</td>
            <td>{i.legal ? <span className="safeTrade">No risk</span> : <span className="heatText">{label(i.illegal_risk?.level || 'risk')} • {fmt(i.illegal_risk?.score || 0)}%</span>}</td>
            <td><button disabled={state.heat_jail?.jailed} onClick={()=>sellItem(i,1)}>Sell 1</button><button disabled={state.heat_jail?.jailed} onClick={()=>sellItem(i,Math.min(5,i.available_qty || i.qty))}>Sell 5</button><button onClick={()=>listItem(i,1)}>List 1</button><button onClick={()=>listItem(i,Math.min(5,i.available_qty || i.qty))}>List Qty</button><button onClick={()=>storeItem(i,1)}>Store</button></td>
          </tr>)}
        </tbody></table>
      </Panel>
    </>}

    {tab === 'auction' && <>
      <Panel title="Auction Rules">
        <div className="rulesExplainer compactRules">
          <p className="rulesLead">Auction listings are visible and purchasable globally. Purchased items are delivered to storage on the planet where the seller listed them.</p>
        </div>
        <Stats pairs={{CurrentGalaxy:playerMarket.scope?.galaxy_name || 'Unknown', CurrentPlanet:playerMarket.scope?.planet_name || state.location?.name, ActiveListings:playerMarket.active.length, ListingFee:`${Math.round((playerMarket.balance?.listing_fee_rate || 0)*1000)/10}%`, SaleFee:`${Math.round((playerMarket.balance?.sale_fee_rate || 0)*1000)/10}%`}} />
        <div className="marketScopeNotice">Delivery planet is fixed by the listing origin, not your current location.</div>
      </Panel>
      <Panel title="Search Auction Listings">
        <div className="inventoryToolbar galaxyMarketFilters">
          <input value={listingQuery} onChange={e=>setListingQuery(e.target.value)} placeholder="Search item, seller, planet, galaxy..." />
          <select value={listingGalaxy} onChange={e=>setListingGalaxy(e.target.value)}>
            <option value="all">All galaxies</option>
            {marketGalaxies.map(g=><option key={g.id} value={g.id}>{g.name}{Number(g.id)===currentGalaxyId ? ' (current)' : ''}</option>)}
          </select>
          <select value={listingCategory} onChange={e=>setListingCategory(e.target.value)}>
            {listingCategories.map(c=><option key={c} value={c}>{label(c)}</option>)}
          </select>
        </div>
      </Panel>
      <Panel title="Active Auction Listings">
        <table><thead><tr><th>Item</th><th>Seller</th><th>Galaxy / Planet</th><th>Status</th><th>Qty</th><th>Unit</th><th>Total</th><th></th></tr></thead><tbody>
          {filteredListings.map(l=><tr key={l.id} >
            <td><div className="itemNameCell"><ItemVisual item={l} /><div><b>{l.item_name}</b><br/><small>{l.description || l.item_code}</small></div></div></td>
            <td>{l.seller_name}<br/><small>{l.own_listing ? 'Your listing' : 'Auction listing'}</small></td>
            <td><b>{l.galaxy_name || 'Unknown Galaxy'}</b><br/><small>{l.planet_name || 'Unknown origin'} delivery</small></td>
            <td className={l.legal?'ok':'bad'}>{l.legal?'Goods':'Restricted'} • {label(l.category)} • {label(l.rarity || 'common')} <TierBadge item={l}/></td>
            <td>{fmt(l.remaining_qty)} / {fmt(l.qty)}</td>
            <td>{fmt(l.unit_price)}</td>
            <td>{fmt((l.remaining_qty || 0) * (l.unit_price || 0))}</td>
            <td>{l.own_listing ? <button onClick={()=>act('cancel_player_listing',{listing_id:l.id})}>Cancel</button> : <><button onClick={()=>buyListing(l,1)}>Buy 1</button><button onClick={()=>buyListing(l,Math.min(5,l.remaining_qty || 1))}>Buy 5</button><button onClick={()=>buyListing(l,l.remaining_qty || 1)}>Buy All</button></>}</td>
          </tr>)}
          {!filteredListings.length && <tr><td colSpan="8">No auction listings match the current filters.</td></tr>}
        </tbody></table>
      </Panel>
      <Panel title="My Listing History">
        <div className="feedList compactFeed">{(playerMarket.history || []).slice(0,30).map(l=><div key={l.id}><b>{label(l.status)}: {l.item_name}</b><span>{fmt(l.remaining_qty)} / {fmt(l.qty)} left • {fmt(l.unit_price)} each • {l.seller_name}</span><small>{l.galaxy_name || 'Unknown Galaxy'} • {l.planet_name || 'Unknown'} • {new Date(l.created_at).toLocaleString()}</small></div>)}</div>
      </Panel>
    </>}

    {tab === 'storage' && <>
      <Panel title="Planet Storage Rules">
        <div className="rulesExplainer compactRules">
          <p className="rulesLead">Storage is visible everywhere for planning, but the cargo door only opens where the items physically are. Travel to that planet to deposit or withdraw.</p>
        </div>
        <Stats pairs={{CurrentGalaxy:storage.scope?.galaxy_name || 'Unknown', CurrentPlanet:storage.scope?.planet_name || state.location?.name, StoredStacks:(storage.stored || []).length, StoredQty:(storage.stored || []).reduce((a,b)=>a+Number(b.qty||0),0), LocalStacks:(storage.stored || []).filter(x=>x.can_modify).length}} />
        <div className="marketScopeNotice">Travel to another planet to access that planet’s storage. Remote storage stays visible for planning.</div>
      </Panel>
      <Panel title="Search Stored Items">
        <div className="inventoryToolbar galaxyMarketFilters">
          <input value={storageQuery} onChange={e=>setStorageQuery(e.target.value)} placeholder="Search stored item, planet, galaxy..." />
          <select value={storageGalaxy} onChange={e=>setStorageGalaxy(e.target.value)}>
            <option value="all">All galaxies</option>
            {storageGalaxies.filter(x=>x!=='all').map(([id,name])=><option key={id} value={id}>{name}{Number(id)===Number(storage.scope?.galaxy_id) ? ' (current)' : ''}</option>)}
          </select>
          <select value={storagePlanet} onChange={e=>setStoragePlanet(e.target.value)}>
            <option value="all">All planets</option>
            {storagePlanets.filter(x=>x!=='all').map(([id,name])=><option key={id} value={id}>{name}{Number(id)===Number(storage.scope?.planet_id) ? ' (current)' : ''}</option>)}
          </select>
        </div>
      </Panel>
      <Panel title="Stored Items">
        <table><thead><tr><th>Item</th><th>Galaxy / Planet</th><th>Status</th><th>Qty</th><th>Mass</th><th>Value</th><th></th></tr></thead><tbody>
          {filteredStorage.map(s=><tr key={s.id} className={!s.can_modify ? 'rowMuted remoteMarketRow' : ''}>
            <td><div className="itemNameCell"><ItemVisual item={s} /><div><b>{s.item_name}</b><br/><small>{s.description || s.item_code}</small></div></div></td>
            <td><b>{s.galaxy_name}</b><br/><small>{s.planet_name} {s.can_modify ? '• accessible here' : '• remote view only'}</small></td>
            <td className={s.legal?'ok':'bad'}>{s.legal?'Legal':'Illegal'} • {label(s.category)} • {label(s.rarity || 'common')} <TierBadge item={s}/></td>
            <td>{fmt(s.qty)}</td>
            <td>{fmt(Number(s.mass || 1) * Number(s.qty || 0))}</td>
            <td>{fmt(s.base_value)}</td>
            <td><button disabled={storageInOpenSpace || !s.can_modify} className="hasHoverTooltip" data-tooltip={storageInOpenSpace ? 'Dock before withdrawing storage.' : !s.can_modify ? 'Travel to this planet before withdrawing this item.' : ''} onClick={()=>withdrawStorage(s,1)}>Withdraw</button><button disabled={storageInOpenSpace || !s.can_modify} onClick={()=>withdrawStorage(s,Math.min(5,s.qty || 1))}>Withdraw 5</button></td>
          </tr>)}
          {!filteredStorage.length && <tr><td colSpan="7">No stored items match the current filters.</td></tr>}
        </tbody></table>
      </Panel>
      <Panel title={`Deposit At Current Planet: ${storage.scope?.planet_name || state.location?.name || ''}`}>
        <div className="inventoryToolbar">
          <input value={depositQuery} onChange={e=>setDepositQuery(e.target.value)} placeholder="Search inventory to store..." />
          <div className="chipRow">{categories.map(([key,name])=><button key={key} className={depositCategory===key?'active':''} onClick={()=>setDepositCategory(key)}>{name}</button>)}</div>
        </div>
        <table><thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Mass</th><th>Value</th><th></th></tr></thead><tbody>
          {depositCandidates.slice(0,80).map(i=><tr key={`deposit-${i.source}-${i.id}-${i.item_code}`}>
            <td><div className="itemNameCell"><ItemVisual item={i} /><div><b>{i.name}</b><br/><small>{i.description || i.item_code}</small></div></div></td>
            <td>{i.category_label || label(i.category)} <TierBadge item={i}/></td>
            <td>{fmt(i.available_qty || i.qty)}</td>
            <td>{fmt(i.cargo_mass)}</td>
            <td>{fmt(i.base_value || i.avg_cost || 0)}</td>
            <td><button disabled={storageInOpenSpace} className="hasHoverTooltip" data-tooltip={storageInOpenSpace ? 'Dock before storing cargo.' : ''} onClick={()=>storeItem(i,1)}>Store 1</button><button disabled={storageInOpenSpace} onClick={()=>storeItem(i,Math.min(5,i.available_qty || i.qty || 1))}>Store Qty</button></td>
          </tr>)}
          {!depositCandidates.length && <tr><td colSpan="6">No inventory matches the current deposit filters.</td></tr>}
        </tbody></table>
      </Panel>
    </>}

    {tab === 'activity' && <>
      <Panel title="Recent Player Transactions">
        {(state.market_transactions || []).slice(0,20).map(t=><div className="itemLine" key={t.id}><b>{label(t.action)}: {t.item_name}</b><span>{fmt(t.qty)} @ {fmt(t.unit_price)} • Net {fmt(t.net)} • Fee {fmt(t.fee)} • {t.planet_name}</span></div>)}
      </Panel>
      <Panel title="Price Movement" help="Player buying depletes supply and raises demand. Player selling restocks local markets and reduces demand. System restock slowly replenishes depleted stock.">{(state.market_history || []).slice(0,20).map(h=><div className="itemLine" key={h.id}><b>{h.commodity_name}</b><span>{label(h.source)} • Supply {h.supply_delta > 0 ? '+' : ''}{h.supply_delta} • Demand {h.demand_delta > 0 ? '+' : ''}{h.demand_delta} • Buy {fmt(h.buy_price)} • Sell {fmt(h.sell_price)} • {h.planet_name}</span></div>)}</Panel>
    </>}
  </Page>
}


function MarketTable({rows,act,illegal}) {
  const heat = rows?.[0]?.illicitRisk?.heat;
  return <table><thead><tr><th>Commodity</th><th>Type</th><th>Pressure</th><th>Stock</th><th>Demand</th><th>Trend</th><th>Buy</th><th>Sell</th><th>Risk</th><th></th></tr></thead><tbody>{rows.map(m=>{
    const stockPct = Number(m.stockPct ?? Math.round(((m.supply || 0) / 130) * 100));
    const out = !!m.outOfStock || Number(m.supply || 0) <= 0;
    const risk = m.illicitRisk || {};
    const cooldown = risk.blockedReason;
    return <tr key={m.commodity_id} className={out?'rowMuted':''}>
      <td><div className="itemNameCell"><ItemVisual item={m} /><div><b>{m.name}</b><br/><small>{m.description}</small></div></div></td>
      <td className={m.legal?'ok':'bad'}>{m.legal?'Goods':'Restricted'} • {label(m.category)} <TierBadge item={m}/></td>
      <td><PressureBadge item={m}/></td>
      <td><Progress value={stockPct}/><small>{out ? 'Out of Stock • 0%' : `${stockPct}% • ${label(m.supplyRating)}`}</small></td>
      <td><Progress value={m.demand}/><small>{m.demand}% • {label(m.demandRating)}</small></td>
      <td>{trendIcon(m.priceTrend)} {label(m.priceTrend || 'flat')}<br/><small>{label(m.scarcityLevel)}</small></td>
      <td>{fmt(m.buy_price)}</td><td>{fmt(m.sell_price)}</td>
      <td>{m.legal ? <span className="safeTrade">No risk</span> : <span className="heatText">{fmt(risk.caughtChance)}% caught<br/><small>{label(risk.severity)} • jail {fmt(risk.jailMinutesMin)}-{fmt(risk.jailMinutesMax)}m</small></span>}</td>
      <td><button disabled={out || !!cooldown} className="hasHoverTooltip" data-tooltip={out ? 'This market is out of stock right now.' : cooldown ? `Market loading is still busy: ${cooldown}` : ''} onClick={()=>act('buy_commodity',{commodity_id:m.commodity_id,qty:1})}>Buy 1</button><button disabled={out || !!cooldown} className="hasHoverTooltip" data-tooltip={out ? 'This market is out of stock right now.' : cooldown ? `Market loading is still busy: ${cooldown}` : ''} onClick={()=>act('buy_commodity',{commodity_id:m.commodity_id,qty:5})}>Buy 5</button>{!illegal && <button disabled={out} onClick={()=>act('buy_commodity',{commodity_id:m.commodity_id,qty:25})}>Buy 25</button>}</td>
    </tr>})}</tbody></table>
}

function JailHeatPanel({state,act}) {
  const h = state.heat_jail || {};
  if (!h || (h.heat === 0 && !h.jailed && !h.illegalActionCooldownUntil)) return null;
  return <Panel title="Heat / Jail Status" help="Heat is created only by restricted activity. Goods trade never raises heat. Heat decays slowly server-side.">
    <div className={`jailHeatPanel ${h.jailed ? 'jailed' : ''}`}>
      <div className="heatBlock"><b>Heat</b><Progress value={h.heat || 0} danger={(h.heat||0)>=40}/><span>{fmt(h.heat)} / 100 • {label(h.heatLevel || 'cold')}</span></div>
      {h.illegalActionCooldownUntil && <div className="cooldownBlock"><b>Restricted Cooldown</b><span>{clockTimeLeft(h.illegalActionCooldownUntil)} remaining</span></div>}
      {h.jailed && <div className="jailBlock"><b>JAILED</b><span>{h.jailReason}</span><small>{h.jailLocation} • {label(h.jailSeverity)} • {clockTimeLeft(h.jailedUntil)} remaining</small><div className="buttonRow"><button disabled={!h.bribe?.available} onClick={()=>act('attempt_bribe')}>Bribe {fmt(h.bribe?.cost || 0)}</button><button disabled={!h.breakout?.available} onClick={()=>act('attempt_breakout')}>Breakout {fmt(h.breakout?.chance || 0)}%</button></div>{h.breakoutCooldownUntil && <small>Breakout cooldown: {clockTimeLeft(h.breakoutCooldownUntil)}</small>}</div>}
    </div>
  </Panel>;
}

function PressureBadge({item}) {
  return <span className={`pressureBadge ${item.legal ? 'legal' : 'illegal'}`}>{fmt(item.pressureScore)} • {label(item.scarcityLevel || 'balanced')}</span>
}

function Inventory({state,act,dialogs}) {
  const [category,setCategory] = useState('all');
  const [query,setQuery] = useState('');
  const [sort,setSort] = useState('value');
  const [filter,setFilter] = useState('all');
  const [selected,setSelected] = useState(null);
  const [cargoQuery,setCargoQuery] = useState('');
  const [cargoPlanet,setCargoPlanet] = useState('all');
  const [cargoCategory,setCargoCategory] = useState('all');
  const [cargoDepositQuery,setCargoDepositQuery] = useState('');
  const [cargoDepositCategory,setCargoDepositCategory] = useState('all');
  const categories = [['all','All'], ...Object.entries(state.inventory_categories || {})];
  const inventoryItems = state.inventory_summary || [];
  const storage = state.player_storage || {stored:[], depositCandidates:[], scope:{}, rules:{}};
  const inOpenSpace = !!(state.travel_state?.open_space || storage.rules?.inOpenSpace);
  const currentCargoPlanetId = String(storage.scope?.planet_id || state.location?.id || state.location?.planet_id || '');
  const currentCargoPlanetName = storage.scope?.planet_name || state.location?.name || 'Current station';
  useEffect(() => {
    setCargoPlanet(inOpenSpace ? 'all' : (currentCargoPlanetId || 'all'));
  }, [inOpenSpace, currentCargoPlanetId]);
  const cargoPlanets = useMemo(() => {
    const planetMap = new Map();
    if (currentCargoPlanetId) planetMap.set(currentCargoPlanetId, `${currentCargoPlanetName} (current)`);
    (storage.stored || []).forEach(s => {
      const id = String(s.planet_id || '');
      if (!id) return;
      const suffix = id === currentCargoPlanetId && !inOpenSpace ? ' (current)' : '';
      planetMap.set(id, `${s.planet_name || `Planet ${id}`}${suffix}`);
    });
    return [['all', 'All planets'], ...Array.from(planetMap.entries())];
  }, [storage.stored, currentCargoPlanetId, currentCargoPlanetName, inOpenSpace]);
  const filteredPlanetCargo = useMemo(() => {
    const q = cargoQuery.trim().toLowerCase();
    return (storage.stored || []).filter(s => {
      if (cargoPlanet !== 'all' && String(s.planet_id) !== String(cargoPlanet)) return false;
      if (cargoCategory !== 'all' && s.category !== cargoCategory) return false;
      if (!q) return true;
      return `${s.item_name || ''} ${s.item_code || ''} ${s.planet_name || ''} ${s.galaxy_name || ''} ${s.category || ''}`.toLowerCase().includes(q);
    });
  }, [storage.stored, cargoPlanet, cargoCategory, cargoQuery]);
  const filteredItems = inventoryItems
    .filter(i => category === 'all' || i.category === category)
    .filter(i => `${i.name} ${i.item_code} ${i.category_label} ${i.subcategory || ''}`.toLowerCase().includes(query.toLowerCase()))
    .filter(i => filter === 'all' ||
      (filter === 'legal' && i.legal) ||
      (filter === 'illegal' && !i.legal) ||
      (filter === 'usable' && i.usable) ||
      (filter === 'sellable' && i.sellable) ||
      (filter === 'equippable' && i.equippable) ||
      (filter === 'crafting' && i.craftable_material) ||
      (filter === 'reserved' && (i.reserved_qty || 0) > 0)
    )
    .sort((a,b) => {
      if (sort === 'qty') return (b.available_qty||0)-(a.available_qty||0);
      if (sort === 'mass') return (b.cargo_mass||0)-(a.cargo_mass||0);
      if (sort === 'rarity') return (b.rarity_rank||0)-(a.rarity_rank||0) || (b.total_value||0)-(a.total_value||0);
      if (sort === 'name') return String(a.name).localeCompare(String(b.name));
      if (sort === 'category') return String(a.category_label).localeCompare(String(b.category_label)) || String(a.name).localeCompare(String(b.name));
      return (b.total_value||b.base_value||0)-(a.total_value||a.base_value||0);
    });
  const totals = inventoryItems.reduce((a,i)=>{
    a.items += 1; a.units += Number(i.qty || 0); a.reserved += Number(i.reserved_qty || 0); a.value += Number(i.total_value || ((i.base_value || 0) * (i.qty || 0)));
    if (!i.legal) a.illegal += Number(i.qty || 0);
    return a;
  }, {items:0, units:0, reserved:0, value:0, illegal:0});
  const sellItem = (item, qty) => {
    const safeQty = Math.max(1, Math.min(qty, item.available_qty || item.qty || 1));
    if (item.source === 'cargo_hold' && item.commodity_id) act('sell_commodity',{commodity_id:item.commodity_id,qty:safeQty});
    else act('sell_inventory_item',{item_code:item.item_code,qty:safeQty});
  };
  const listItem = async (item) => {
    const maxQty = Math.max(1, item.available_qty || item.qty || 1);
    const qty = Math.max(1, Math.min(maxQty, Number(await dialogs.textInput(`Quantity to list for ${item.name}`, '1', {title:'Create Market Listing', inputLabel:'Quantity'})) || 1));
    const base = Number(item.market_sell_estimate?.unit || item.base_value || item.avg_cost || 100);
    const unitPrice = Math.max(1, Number(await dialogs.textInput('Unit price', String(base), {title:'Create Market Listing', inputLabel:'Unit price'})) || base);
    act('create_player_listing', { source:item.source || 'inventory', item_code:item.item_code, commodity_id:item.commodity_id, module_id:item.id, id:item.id, qty, unit_price:unitPrice });
  };
  const storeItem = async (item, defaultQty=1) => {
    if (inOpenSpace) return;
    const maxQty = Math.max(1, item.available_qty || item.qty || 1);
    const qty = Math.max(1, Math.min(maxQty, Number(await dialogs.textInput(`Quantity to store at ${currentCargoPlanetName} for ${item.name}`, String(Math.min(defaultQty, maxQty)), {title:'Store Item', inputLabel:'Quantity'})) || 1));
    act('store_item', { source:item.source || 'inventory', item_code:item.item_code, commodity_id:item.commodity_id, module_id:item.id, id:item.id, qty });
  };
  const withdrawCargo = async (item, defaultQty=1) => {
    if (inOpenSpace || !item.can_modify) return;
    const qty = Math.max(1, Math.min(Number(item.qty || 1), Number(await dialogs.textInput(`Quantity to withdraw from ${item.planet_name}`, String(Math.min(defaultQty, item.qty || 1)), {title:'Withdraw Storage', inputLabel:'Quantity'})) || 1));
    act('withdraw_storage_item', {storage_id:item.id, qty});
  };
  const canUse = (i) => i.usable && (i.available_qty || 0) > 0 && i.source !== 'cargo_hold';
  const canEquip = (i) => i.equippable && (i.available_qty || 0) > 0 && i.source === 'inventory';
  const cargoPct = state.cargo_usage?.pct ?? (((state.cargo_usage?.total || 0) / Math.max(1, state.cargo_usage?.max || 1))*100);
  const cargoTotals = (storage.stored || []).reduce((a,s)=>{
    a.stacks += 1; a.units += Number(s.qty || 0); a.mass += Number(s.mass || 1) * Number(s.qty || 0);
    if (s.can_modify) a.local += 1;
    return a;
  }, {stacks:0, units:0, mass:0, local:0});
  const storageCategories = ['all', ...Array.from(new Set((storage.stored || []).map(s=>s.category).filter(Boolean))).sort()];
  const depositCargoCandidates = (storage.depositCandidates || [])
    .filter(i => i.sellable !== false && (cargoDepositCategory === 'all' || i.category === cargoDepositCategory) && `${i.name} ${i.item_code} ${i.category_label}`.toLowerCase().includes(cargoDepositQuery.toLowerCase()))
    .slice(0, 80);
  return <Page title="Inventory" sub="Unified cargo, loose inventory, materials, modules, consumables, restricted goods, market listing readiness, and item inspection.">
    <Panel title="Cargo Capacity">
      <Stats pairs={{Used:state.cargo_usage?.total ?? 0, Free:state.cargo_usage?.free ?? 0, Max:state.cargo_usage?.max ?? 0, Full:`${Math.round(cargoPct)}%`, Value:totals.value, Reserved:totals.reserved}} />
      <Progress value={cargoPct} danger={state.cargo_usage?.over_capacity || cargoPct >= 95} />
      {(state.cargo_usage?.warnings || []).map(w=><div className="warningLine" key={w}><AlertTriangle size={16}/> {label(w)}</div>)}
    </Panel>

    <Panel title="Cargo Across Your Planets" help="Planet cargo is visible everywhere for planning. Deposits and withdrawals only work while docked at the cargo's planet or station.">
      <Stats pairs={{View: cargoPlanet === 'all' ? 'All planets' : (cargoPlanets.find(([id])=>String(id)===String(cargoPlanet))?.[1] || 'Selected'), StoredStacks:cargoTotals.stacks, StoredQty:cargoTotals.units, StoredMass:Math.round(cargoTotals.mass * 10) / 10, LocalStacks:cargoTotals.local}} />
      <div className="inventoryToolbar galaxyMarketFilters">
        <input value={cargoQuery} onChange={e=>setCargoQuery(e.target.value)} placeholder="Search planet cargo, station, galaxy..." />
        <select value={cargoPlanet} onChange={e=>setCargoPlanet(e.target.value)}>
          {cargoPlanets.map(([id,name])=><option key={id} value={id}>{name}</option>)}
        </select>
        <select value={cargoCategory} onChange={e=>setCargoCategory(e.target.value)}>
          {storageCategories.map(c=><option key={c} value={c}>{label(c)}</option>)}
        </select>
      </div>
      <div className="marketScopeNotice">{inOpenSpace ? 'You are in open space, so the cargo view defaults to all planets. Dock before moving anything.' : `Docked at ${currentCargoPlanetName}. Local cargo can be moved; remote cargo is view-only.`}</div>
      <table><thead><tr><th>Item</th><th>Galaxy / Planet</th><th>Status</th><th>Qty</th><th>Mass</th><th>Value</th><th></th></tr></thead><tbody>
        {filteredPlanetCargo.map(s=><tr key={`planet-cargo-${s.id}`} className={!s.can_modify ? 'rowMuted remoteMarketRow' : ''}>
          <td><div className="itemNameCell"><ItemVisual item={s} /><div><b>{s.item_name}</b><br/><small>{s.description || s.item_code}</small></div></div></td>
          <td><b>{s.galaxy_name}</b><br/><small>{s.planet_name} {s.can_modify ? 'accessible here' : 'remote view only'}</small></td>
          <td className={s.legal?'ok':'bad'}>{s.legal?'Legal':'Illegal'} &bull; {label(s.category)} &bull; {label(s.rarity || 'common')} <TierBadge item={s}/></td>
          <td>{fmt(s.qty)}</td>
          <td>{fmt(Number(s.mass || 1) * Number(s.qty || 0))}</td>
          <td>{fmt(s.base_value)}</td>
          <td><button disabled={inOpenSpace || !s.can_modify} className="hasHoverTooltip" data-tooltip={inOpenSpace ? 'Dock before withdrawing cargo.' : !s.can_modify ? 'Travel to this planet or station before withdrawing this cargo.' : ''} onClick={()=>withdrawCargo(s,1)}>Withdraw</button><button disabled={inOpenSpace || !s.can_modify} onClick={()=>withdrawCargo(s,Math.min(5,s.qty || 1))}>Withdraw 5</button></td>
        </tr>)}
        {!filteredPlanetCargo.length && <tr><td colSpan="7">No planet cargo matches the current filters.</td></tr>}
      </tbody></table>
      <div className="inventoryToolbar">
        <input value={cargoDepositQuery} onChange={e=>setCargoDepositQuery(e.target.value)} placeholder={inOpenSpace ? 'Dock to store carried cargo' : `Search carried cargo to store at ${currentCargoPlanetName}`} />
        <div className="chipRow">{categories.map(([key,name])=><button key={key} className={cargoDepositCategory===key?'active':''} onClick={()=>setCargoDepositCategory(key)}>{name}</button>)}</div>
      </div>
      <table><thead><tr><th>Carried Item</th><th>Category</th><th>Qty</th><th>Mass</th><th>Value</th><th></th></tr></thead><tbody>
        {depositCargoCandidates.map(i=><tr key={`cargo-deposit-${i.source}-${i.id}-${i.item_code}`}>
          <td><div className="itemNameCell"><ItemVisual item={i} /><div><b>{i.name}</b><br/><small>{i.description || i.item_code}</small></div></div></td>
          <td>{i.category_label || label(i.category)} <TierBadge item={i}/></td>
          <td>{fmt(i.available_qty || i.qty)}</td>
          <td>{fmt(i.cargo_mass)}</td>
          <td>{fmt(i.base_value || i.avg_cost || 0)}</td>
          <td><button disabled={inOpenSpace} className="hasHoverTooltip" data-tooltip={inOpenSpace ? 'Dock before storing carried cargo.' : ''} onClick={()=>storeItem(i,1)}>Store 1</button><button disabled={inOpenSpace} onClick={()=>storeItem(i,Math.min(5,i.available_qty || i.qty || 1))}>Store Qty</button></td>
        </tr>)}
        {!depositCargoCandidates.length && <tr><td colSpan="6">No carried cargo matches the current storage filters.</td></tr>}
      </tbody></table>
    </Panel>

    <Panel title="Inventory Controls">
      <div className="inventoryToolbar advancedInventoryToolbar">
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search item, category, code, subcategory" />
        <div className="chipRow">{categories.map(([key,name])=><button key={key} className={category===key?'active':''} onClick={()=>setCategory(key)}>{name}</button>)}</div>
        <div className="inventorySelectRow">
          <select value={sort} onChange={e=>setSort(e.target.value)}>
            <option value="value">Sort by total value</option><option value="name">Sort by name</option><option value="category">Sort by category</option><option value="rarity">Sort by rarity</option><option value="qty">Sort by quantity</option><option value="mass">Sort by cargo mass</option>
          </select>
          <select value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="all">All statuses</option><option value="legal">Legal only</option><option value="illegal">Illegal only</option><option value="usable">Usable</option><option value="sellable">Sellable</option><option value="equippable">Equippable</option><option value="crafting">Crafting materials</option><option value="reserved">Reserved/listed</option>
          </select>
        </div>
      </div>
    </Panel>

    <div className="inventoryLayout">
      <div className="inventoryCardGrid deepInventoryGrid">{filteredItems.map(i=><div className={`inventoryCard ${i.legal ? '' : 'illegalItem'} rarity-${i.rarity || 'common'} ${selected?.item_code===i.item_code && selected?.source===i.source ? 'selectedInventoryCard' : ''}`} key={`${i.source}-${i.id}-${i.item_code}`}>
        <ItemVisual item={i} />
        <div className="inventoryCardMain"><b>{i.name}</b><span>{i.category_label || label(i.category)} • {label(i.subcategory || i.item_type)} • {label(i.rarity || 'common')} <TierBadge item={i}/></span><p>{i.description || i.item_code}</p></div>
        <div className="inventoryStats"><small>Avail</small><b>{fmt(i.available_qty)}</b></div>
        <div className="inventoryStats"><small>Mass</small><b>{fmt(i.cargo_mass)}</b></div>
        <div className="inventoryStats"><small>Value</small><b>{fmt(i.total_value || i.base_value)}</b></div>
        <div className="inventoryFlags"><span className={i.legal?'ok':'bad'}>{i.legal?'Goods':'Restricted'}</span><span className={`rarityBadge ${i.rarity || 'common'}`}>{label(i.rarity || 'common')}</span><TierBadge item={i}/><span>{i.source}</span>{i.reserved_qty > 0 && <span className="warn">Reserved {fmt(i.reserved_qty)}</span>}{i.used_in_recipe_count > 0 && <span>Used in {i.used_in_recipe_count} recipes</span>}</div>
        <div className="actions inventoryActions">
          <button onClick={()=>setSelected(i)}>Inspect</button>
          {i.sellable && <button disabled={(i.available_qty||0)<=0} onClick={()=>sellItem(i,1)}>Sell 1</button>}
          {i.sellable && <button disabled={(i.available_qty||0)<=0} onClick={()=>sellItem(i,Math.min(5,i.available_qty || i.qty))}>Sell 5</button>}
          {i.allowed_actions?.includes('list') && <button disabled={(i.available_qty||0)<=0} onClick={()=>listItem(i)}>List</button>}
          {canUse(i) && <button onClick={()=>act('use_inventory_item',{item_code:i.item_code,qty:1})}>Use</button>}
          {canEquip(i) && <button onClick={()=>act('equip_inventory_item',{item_code:i.item_code})}>Equip</button>}
          {i.tier_upgrade?.can_upgrade && <button onClick={()=>act('upgrade_inventory_item',{item_code:i.item_code})}>Upgrade</button>}
          {i.salvage_preview && <button onClick={async ()=>{
            const confirmed = await dialogs.critical(`Salvage ${i.name}? This permanently converts the item into materials.`, {
              title:'Salvage Item',
              eyebrow:'Permanent inventory action',
              confirmLabel:'Salvage',
              confirmationPhrase:'SALVAGE',
              inputLabel:'Type SALVAGE to confirm'
            });
            if (confirmed) act('salvage_inventory_item',{item_code:i.item_code,qty:1});
          }}>Salvage</button>}
        </div>
      </div>)}</div>
      <InventoryDetails item={selected || filteredItems[0]} act={act} sellItem={sellItem} listItem={listItem} dialogs={dialogs} />
    </div>
    {!filteredItems.length && <Panel title="Empty Inventory"><p className="muted">No items match the current filters.</p></Panel>}
  </Page>;
}

function InventoryDetails({item, act, sellItem, listItem, dialogs}) {
  if (!item) return <Panel title="Item Details"><p className="muted">Select an item to inspect cargo, market, crafting, legality, and action status.</p></Panel>;
  const risk = item.illegal_risk || {};
  return <Panel title="Item Details" help="Inspection uses backend-resolved item data, not frontend-only guesses.">
    <div className={`inventoryDetailPanel rarity-${item.rarity || 'common'} ${item.legal ? '' : 'illegalItem'}`}>
      <ItemVisual item={item} size="lg" />
      <div><h3>{item.name}</h3><p>{item.description || item.item_code}</p></div>
      <Stats pairs={{Owned:item.qty, Available:item.available_qty, Reserved:item.reserved_qty || 0, Tier:`T${item.current_tier ?? item.tier ?? 1}/${item.max_tier ?? '—'}`, UnitValue:item.unit_value ?? item.base_value, TotalValue:item.total_value, Cargo:item.cargo_mass}} />
      <div className="inventoryFlags detailFlags"><span>{item.category_label || label(item.category)}</span><span>{label(item.subcategory || item.item_type)}</span><span className={`rarityBadge ${item.rarity || 'common'}`}>{label(item.rarity || 'common')}</span><TierBadge item={item}/><span className={item.legal?'ok':'bad'}>{item.legal?'Legal':'Illegal'}</span>{item.cargo_exempt ? <span>Cargo Exempt</span> : null}</div>
      {!item.legal && <div className="warningLine"><AlertTriangle size={16}/> {risk.message || 'Restricted goods risk depends on current security.'} Risk score {fmt(risk.score || 0)}</div>}
      <div className="detailGrid">
        <div><b>Market estimate</b><span>Unit {fmt(item.market_sell_estimate?.unit)} • Net all {fmt(item.market_sell_estimate?.net)} • Fee {fmt(item.market_sell_estimate?.fee)}</span></div>
        <div><b>Tier upgrade</b><span>{item.tier_upgrade?.can_upgrade ? `Next T${item.tier_upgrade.next_tier} • ${fmt(item.tier_upgrade.credits)} Cr • ${Math.round((item.tier_upgrade.success_odds || 0)*100)}%` : (item.tier_upgrade?.reason || 'Not upgradeable')}</span></div>
        <div><b>Salvage output</b><span>{item.salvage_preview ? `${fmt(item.salvage_preview.scrap)} scrap + ${(item.salvage_preview.materials || []).map(m=>`${m.qty}x ${m.name}`).join(', ')}` : 'Not salvageable'}</span></div>
        <div><b>Allowed actions</b><span>{(item.allowed_actions || []).join(', ') || 'None'}</span></div>
        <div><b>Blocked reasons</b><span>{(item.blocked_action_reasons || []).join(', ') || 'None'}</span></div>
        <div><b>Acquired</b><span>{item.acquired_at ? new Date(item.acquired_at).toLocaleString() : 'Unknown'}</span></div>
      </div>
      {!!item.crafting_usage?.length && <div className="recipeUseList"><b>Crafting usage</b>{item.crafting_usage.slice(0,6).map(r=><span key={r.code}>{r.name}: needs {fmt(r.required)}</span>)}</div>}
      <div className="actions inventoryActions detailActions">
        {item.sellable && <button disabled={(item.available_qty||0)<=0} onClick={()=>sellItem(item,1)}>Sell 1</button>}
        {item.allowed_actions?.includes('list') && <button disabled={(item.available_qty||0)<=0} onClick={()=>listItem(item)}>List on Market</button>}
        {item.usable && <button disabled={(item.available_qty||0)<=0 || item.source==='cargo_hold'} onClick={()=>act('use_inventory_item',{item_code:item.item_code,qty:1})}>Use</button>}
        {item.equippable && <button disabled={(item.available_qty||0)<=0 || item.source!=='inventory'} onClick={()=>act('equip_inventory_item',{item_code:item.item_code})}>Equip</button>}
        {item.tier_upgrade?.can_upgrade && <button onClick={()=>act('upgrade_inventory_item',{item_code:item.item_code})}>Upgrade Tier</button>}
        {item.salvage_preview && <button onClick={async ()=>{
          const confirmed = await dialogs.critical(`Salvage ${item.name}? This permanently converts the item into materials.`, {
            title:'Salvage Item',
            eyebrow:'Permanent inventory action',
            confirmLabel:'Salvage',
            confirmationPhrase:'SALVAGE',
            inputLabel:'Type SALVAGE to confirm'
          });
          if (confirmed) act('salvage_inventory_item',{item_code:item.item_code,qty:1});
        }}>Salvage</button>}
      </div>
    </div>
  </Panel>
}


function Guild({state,act}) {
  const skills = ['fleet_logistics','supply_lines','siege_weaponry','trade_influence','smuggling_network','mercenary_command','planetary_governance','industrial_efficiency','recon_operations','defensive_grid','recruitment','black_ops','orbital_command','resource_cartels','deep_storage','elite_contracts','tax_optimization','law_enforcement'];
  return <Page title="Guild Command" sub="Guilds earn respect from wars, control, missions, and activity. Respect unlocks a large guild skill tree with small useful buffs.">
    <Panel title={state.guild ? `Guild: ${state.guild.name}` : 'No Guild'}><Stats pairs={state.guild ? {Respect:state.guild.respect,Treasury:state.guild.treasury,Tag:state.guild.tag} : {}}/><button onClick={()=>act('create_guild',{name:'New Frontier Guild'})}>Create Guild</button><button onClick={()=>act('donate_guild',{credits:100000})}>Donate 100k</button></Panel>
    <div className="skillGrid">{skills.map(k=><button key={k} onClick={()=>act('guild_skill',{skill_key:k})}><b>{label(k)}</b><small>Small member buff. Costs respect.</small></button>)}</div>
  </Page>
}


function WarfrontPanels({state,act,clock}) {
  const wars = state.planet_wars || state.galaxy_wars || [];
  const resolved = state.resolved_planet_wars || state.resolved_galaxy_wars || [];
  const factions = state.factions || [];
  const mapNodes = state.galaxy_map?.nodes || [];
  const planets = state.system_map?.nodes?.filter(n => n.kind === 'planet') || state.planets || [];
  const currentFaction = state.player_faction || {};
  const guild = state.guild || {};
  return <>
    <div className="cards3">
      <Panel title="Your Side" help="This is the flag you fight under. Guild declarations pull the whole attacker and defender factions into the planet war.">
        <div className="nodeHeader"><ItemVisual item={{name:currentFaction.name || 'Faction', category:currentFaction.color || 'faction'}} /><div><b>{currentFaction.name || 'Unassigned'}</b><span>{guild.name ? `${guild.name} guild` : 'No guild'} • planet wars use whole-faction attacker/defender sides.</span></div></div>
        <Stats pairs={{GuildXP:guild.xp || 0, GuildRespect:guild.respect || 0, Treasury:guild.treasury || 0, ActiveWars:wars.filter(w=>w.status==='active').length, UpcomingWars:wars.filter(w=>w.status==='declared').length}} />
      </Panel>
      <Panel title="Faction Balance" help="Galaxy count is the scoreboard. Planet count tells you where the next real pressure points are.">
        <div className="factionStack">{factions.map(f => {
          const galaxyCount = mapNodes.filter(g=>g.faction_id===f.id).length;
          const planetCount = (state.planets || []).filter(p=>p.faction_id===f.id).length;
          return <div key={f.id} className="factionLine"><b>{f.name}</b><Progress value={galaxyCount*8}/><span>{galaxyCount} galaxies / {planetCount} planets</span>{f.id===currentFaction.id && <em>You</em>}</div>
        })}</div>
      </Panel>
      <Panel title="Rules">
        <div className="rulesExplainer factionWarRules">
          <p className="rulesLead">Faction war is intentionally slower than a normal fight. A guild does not flip a galaxy by pressing one button; it has to pick a planet, pay for the war, give both sides time to show up, and then win the objective in open space.</p>
          <div className="rulesGrid">
            <div><b>Declare</b><span>A guild needs the member count and treasury to declare on a single planet. The war belongs to the attacking and defending factions, not only the declaring guild.</span></div>
            <div><b>Stage</b><span>The capture ring opens after the declaration timer. Use that time to travel, repair, refuel, stock supplies, and bring the right ship instead of arriving half-ready.</span></div>
            <div><b>Capture</b><span>Only the two war factions score inside the ring. Hold it uncontested for the full capture window to take the planet.</span></div>
            <div><b>Flip</b><span>A galaxy changes hands only after one faction controls every planet inside it. One planet win matters, but the campaign is the real prize.</span></div>
          </div>
        </div>
      </Panel>
    </div>

    <Panel title="Ongoing / Upcoming Planet Wars" help="This is the travel board. Declared wars show when the ring opens; active wars show whether someone is already holding it.">
      <div className="warGrid">{wars.map(w => {
        const active = w.status === 'active';
        const opensIn = clockTimeLeft(w.opens_at);
        const holdLeft = w.capture_started_at ? clockTimeLeft(new Date(new Date(w.capture_started_at).getTime()+5*60*1000).toISOString()) : 'Not holding';
        return <div className={`warCard galaxyWarCard ${active ? 'activeWar' : ''}`} key={w.id}>
          <b>{w.planet_name}</b>
          <span>{w.attacking_faction_name} vs {w.defending_faction_name || 'Neutral'} • {label(w.status)}</span>
          <small>Declared by {w.declaring_guild_name} • {w.galaxy_name}</small>
          <small>{active ? `Capture hold: ${holdLeft}` : `Opens: ${opensIn}`}</small>
          <small>Declare cost {fmt(w.declare_cost || 0)} • Galaxy flips only after all planets fall</small>
          <button onClick={()=>act('navigate_to_planet_war',{war_id:w.id})}>Navigate To</button>
        </div>
      })}{!wars.length && <p className="muted">No active or upcoming planet wars.</p>}</div>
    </Panel>

    <Panel title="Local Planet War Targets" help="Disabled planets are not broken. The backend is telling you what still blocks the declaration: treasury, guild size, faction rules, or cooldowns.">
      <div className="cards3">{planets.filter(p=>p.kind === 'planet' || p.galaxy_id).map(p => <div className="miniGalaxyCard" key={p.id}>
        <b>{p.name}</b><span>{p.faction_name || 'Neutral'} control • Defense {p.defense_strength || 0}</span>
        <small>{p.can_declare_planet_war ? `Cost ${fmt(p.declare_cost || 0)}` : (p.declare_reason || 'Unavailable')}</small>
        <button disabled={!p.can_declare_planet_war} onClick={()=>act('declare_planet_war',{planet_id:p.id})}>Declare Planet War</button>
      </div>)}</div>
    </Panel>

    <Panel title="Resolved Planet Wars">
      <div className="feedList compactFeed">{resolved.map(w=><div key={w.id}><b>{w.planet_name}</b><span>Winner: {w.winner_faction_name || 'Unknown'} • {w.galaxy_name}</span><small>{w.resolved_at ? new Date(w.resolved_at).toLocaleString() : ''}</small></div>)}</div>
    </Panel>
  </>
}


function FactionWar({state,act,clock}) {
  return <Page title="Faction War" sub="Guild wars start on planets; galaxy control is earned planet by planet.">
    <WarfrontPanels state={state} act={act} clock={clock} />
  </Page>;
}


function Warfare({state,act,clock}) {
  return <Page title="Warfare" sub="Read the war map before you commit ships, treasury, and travel time. Warfare is about preparation, staging, and holding objectives long enough for your faction to matter.">
    <DescriptionBlock
      eyebrow="Strategy Layer"
      title="How Warfare Fits Together"
      lead="Warfare is the command view for long fights. A normal combat target is one battle; a war is a campaign where guild resources, faction ownership, travel timing, ship readiness, and capture windows all stack together."
      points={[
        ['Pick the Front', 'Wars are declared on planets. The planet decides where pilots travel, who can score, and what the local defender is protecting.'],
        ['Stage Before the Ring Opens', 'Repair, refuel, load supplies, and bring the ship that matches the job. Arriving early and ready is usually stronger than arriving fast and empty.'],
        ['Hold the Objective', 'Active wars are won by presence and control, not by a single damage roll. If the other side contests the ring, the capture clock becomes the whole fight.'],
        ['Think in Campaigns', 'A planet win is progress. A galaxy win takes every planet in that galaxy, so the best target is often the one that opens the next clean path.'],
      ]}
    />
    <WarfrontPanels state={state} act={act} clock={clock} />
  </Page>;
}


function PlanetControl({state,act}) {
  const pc = state.planet_control || {effects:{}, actions:[], events:[]};
  const tc = state.territory_control || {};
  const supply = tc.supply || {};
  const planet = pc.planet || state.location || {};
  const effects = pc.effects || {};
  return <Page title="Planet Control" sub="Local influence, faction control, security, stability, taxes, conflict, and economy modifiers for the current planet or station.">
    <PlanetControlVisual state={state} />
    <div className="cards3">
      <Panel title="Current Control">
        <Stats pairs={{
          Planet:planet.name,
          Controller:effects.controller_label || label(planet.controller_type || 'npc'),
          Economy:label(planet.economy_type || 'balanced'),
          Influence:planet.player_influence || 0,
          Security:planet.security_level || 0,
          Stability:planet.stability_level || 0,
          Conflict:planet.conflict_level || 0,
          Pirates:planet.pirate_activity || 0,
          Market:planet.market_activity || 0,
          Production:planet.production_bonus || 0,
          MarketMod:planet.market_modifier || 0,
          Tax:`${effects.tax_rate_pct ?? 0}%`
        }} />
      </Panel>
      <Panel title="Control Effects">
        <Stats pairs={{
          IllegalRisk:effects.illegal_risk,
          TravelDanger:effects.travel_danger,
          CraftingBonus:`${effects.crafting_bonus ?? 0}%`,
          LegalPricePressure:effects.legal_price_pressure,
          ProductionSupplyBonus:effects.production_supply_bonus
        }} />
        <p className="mutedBlock">{effects.mission_effect}</p>
      </Panel>
      <Panel title="Faction Position">
        <div className="influenceStack">
          <InfluenceBar label="Player Influence" value={planet.player_influence || 0} />
          <InfluenceBar label="Territory Pressure" value={(tc.influence || [])[0]?.amount || 0} danger={tc.status === 'war'} />
          <InfluenceBar label="Security" value={planet.security_level || 0} />
          <InfluenceBar label="Stability" value={planet.stability_level || 0} />
          <InfluenceBar label="Conflict" value={planet.conflict_level || 0} danger />
          <InfluenceBar label="Pirate Pressure" value={planet.pirate_activity || 0} danger />
        </div>
      </Panel>
    </div>

    <Panel title="War Supply">
      <div className="warSupplyHead">
        <Stats pairs={{
          Territory:label(tc.status || 'secure'),
          SupplyTier:supply.label || 'Unstocked',
          SupplyPoints:supply.points || 0,
          ZoneBuff:Object.entries(supply.buff || {}).map(([k,v])=>`${label(k)} ${v}`).join(', ') || 'None'
        }} />
      </div>
      <div className="warSupplyGrid">{(supply.items || []).length ? (supply.items || []).map(item => {
        const qty = Math.max(1, Math.min(5, Number(item.available_qty || 0)));
        return <button key={item.item_code} className="warSupplyCard" disabled={!supply.eligible || qty <= 0} onClick={()=>act('territory_supply_delivery',{item_code:item.item_code, qty})}>
          <b>{item.name}</b>
          <span>{fmt(item.available_qty)} ready • {fmt(item.points_each)} pts each</span>
          <small>Deliver {fmt(qty)}</small>
        </button>
      }) : <div className="mutedBlock">{supply.eligible ? 'No eligible raw, refined, or salvage materials are available.' : 'Supply delivery opens on faction-owned planets inside contested or war territory.'}</div>}</div>
    </Panel>

    <Panel title="Control Actions" help="Actions are small nudges. Job-matched actions gain extra influence while fuel and credit costs still matter.">
      <div className="controlActionGrid">{(pc.actions || []).map(a=><div className={`controlActionCard ${a.job_bonus?'matchedControl':''}`} key={a.key}>
        <div><b>{a.name}</b><em>{a.job_bonus ? 'Skill Bonus' : 'Neutral'}</em></div>
        <p>{a.desc}</p>
        <span>Fuel {fmt(a.fuel)} - Credits {fmt(a.credits)} - Influence +{fmt(a.influence_preview)}</span>
        <small>Security {signed(a.security)} • Stability {signed(a.stability)} • Pirates {signed(a.pirates)} • Market {signed(a.market)} • Conflict {signed(a.conflict)}</small>
        <button onClick={()=>act('planet_control_action',{action_key:a.key})}>Run Action</button>
      </div>)}</div>
    </Panel>

    <Panel title="Recent Control Events">
      <div className="feedList compactFeed">{(pc.events || []).map(e=><div key={e.id}>
        <b>{e.action_name}</b>
        <span>{e.message}</span>
        <small>{e.actor} • Influence {signed(e.influence_delta)} • {new Date(e.created_at).toLocaleString()}</small>
      </div>)}</div>
    </Panel>
  </Page>
}

function InfluenceBar({label,value,danger}) {
  return <div className="influenceBar"><span>{label}</span><i><b className={danger?'danger':''} style={{width:`${Math.max(0,Math.min(100,Number(value)||0))}%`}} /></i><em>{fmt(value)}</em></div>
}

function Contracts({state,act}) {
  const [tab,setTab] = useState('recommended');
  const currentGalaxyOps = state.operations.filter(o => o.galaxy_id === state.location?.galaxy_id);
  const basic = currentGalaxyOps.filter(o => o.operation_tier === 'basic');
  const advanced = currentGalaxyOps.filter(o => o.operation_tier !== 'basic');
  const recommended = state.recommended_actions || [];
  return <Page title="Operations Hub" sub="PvE now uses skill rank, skill levels, ship power, fuel cost, local security, stability, pirate pressure, and job fit.">
    <div className="tabBar">
      <button className={tab==='recommended'?'active':''} onClick={()=>setTab('recommended')}>Recommended</button>
      <button className={tab==='basic'?'active':''} onClick={()=>setTab('basic')}>Basic Work</button>
      <button className={tab==='advanced'?'active':''} onClick={()=>setTab('advanced')}>Advanced</button>
      <button className={tab==='bounties'?'active':''} onClick={()=>setTab('bounties')}>Bounties</button>
    </div>

    {tab === 'recommended' && <Panel title="Recommended Action Queue" help="High fit does not mean no risk. It means your current build is better suited for the action.">
      <div className="opList detailed">{recommended.map(r=><OperationRow key={`${r.kind}-${r.code}`} item={r} actionLabel={r.kind === 'skill' ? 'Run Job' : 'Run'} onRun={()=>act(r.kind === 'skill' ? 'skill_task' : 'pve_operation', r.kind === 'skill' ? {task_key:r.code} : {code:r.code})} />)}</div>
    </Panel>}

    {tab === 'basic' && <Panel title="Basic Contracts & XP Work" help="Available to all players. Lower reward, higher success rate.">
      <div className="opList detailed">{basic.map(o=><OperationRow key={o.code} item={o} actionLabel="Run" onRun={()=>act('pve_operation',{code:o.code})} />)}</div>
    </Panel>}

    {tab === 'advanced' && <Panel title="Advanced Operations" help="Better rewards. Lower success rate unless your ship, skills, and current job fit the operation.">
      <div className="opList detailed">{advanced.map(o=><OperationRow key={o.code} item={o} actionLabel="Accept" onRun={()=>act('pve_operation',{code:o.code})} />)}</div>
    </Panel>}

    {tab === 'bounties' && <Panel title="Bounties">
      <div className="opList detailed">{state.bounties.map(b=><div className="operationCard" key={b.id}>
        <div className="operationMain"><b>{b.name}</b><p>{b.planet_name} fugitive contract.</p><span>Threat {b.threat} • Reward {fmt(b.reward)} Cr • Combat/scanning skill fit</span></div>
        <button onClick={()=>act('accept_bounty',{bounty_id:b.id})}>Hunt</button>
      </div>)}</div>
    </Panel>}
  </Page>
}

function Industry({state,act}) {
  const sites = state.salvage_sites || [];
  return <Page title="Refining/Crafting" sub="Fresh combat wrecks are the primary salvage source. Refining and crafting share one production loop.">
    <Panel title="Fresh Combat Wrecks" help="These are defeated ships in the current area. Player battles, PvE combat, PvP, and occasional NPC-vs-NPC fights can populate this list. Zero available wrecks is valid if the area has been cleaned out.">
      {sites.length ? <div className="salvageSiteGrid">{sites.map(site=><div className="salvageSiteCard" key={site.id}>
        <GameImage src={site.image_url} assetType="ship" category={site.ship_role} alt={site.ship_name} />
        <div>
          <h3>{site.ship_name}</h3>
          <p>{label(site.source_type)} • {label(site.ship_role)} • T{site.ship_tier} • Difficulty {site.difficulty}</p>
          <div className="tagCloud">{Object.entries(site.materials || {}).map(([k,v])=><span key={k}>{label(k)} x{fmt(v)}</span>)}</div>
          <small>Value {fmt(site.salvage_value)} - Source {site.source_name}</small>
          <button onClick={()=>act('salvage_site',{site_id:site.id})}>Salvage Wreck</button>
        </div>
      </div>)}</div> : <div className="emptyState">No salvageable combat wrecks in this area. New wrecks can appear from player combat, PvE fights, PvP, or occasional NPC skirmishes.</div>}
    </Panel>
  </Page>
}

function isRefiningRecipe(recipe) {
  const category = String(recipe?.category || '').toLowerCase();
  const outputCategory = String(recipe?.output_preview?.category || recipe?.output?.category || '').toLowerCase();
  return !!recipe?.requires_refinery || category.includes('refining') || category.includes('refined') || outputCategory === 'refined_materials';
}

function isRefiningJob(job) {
  return job?.job_kind === 'refining' || isRefiningRecipe(job?.recipe_snapshot || {});
}

function recipeState(recipe) {
  if (recipe?.capability_state) return recipe.capability_state;
  if (recipe?.can_craft) return 'CRAFTABLE';
  if ((recipe?.missing_materials || recipe?.missing || []).length) return 'MISSING_MATERIALS';
  return 'LOCKED';
}

function recipeStateLabel(stateKey) {
  return stateKey === 'CRAFTABLE' ? 'Craftable' : stateKey === 'MISSING_MATERIALS' ? 'Missing Materials' : 'Locked';
}

function recipeTierClass(recipeOrItem) {
  const tier = Number(recipeOrItem?.recipe_tier ?? recipeOrItem?.output_tier ?? recipeOrItem?.current_tier ?? recipeOrItem?.tier ?? 1);
  return `tierColor${Math.max(1, Math.min(5, tier))}`;
}

function jobProgress(job, clock) {
  const started = new Date(job?.started_at).getTime();
  const ends = new Date(job?.completes_at).getTime();
  const total = Math.max(1, ends - started);
  if (!Number.isFinite(started) || !Number.isFinite(ends)) return Number(job?.progress_pct || 0);
  return Math.max(0, Math.min(100, ((clock - started) / total) * 100));
}

function RefiningPipelineHUD({state, clock, act, onOpen}) {
  const jobs = (state?.crafting_queue || []).filter(isRefiningJob);
  const active = jobs.filter(j => j.status === 'active');
  const complete = jobs.filter(j => j.status === 'complete' || j.status === 'completed');
  const visibleJobs = [...active, ...complete].slice(0,5);
  if (!visibleJobs.length) return <button className="refiningHud empty" onClick={onOpen}><Factory size={16}/><span><b>Refining Pipeline</b><small>No active jobs</small></span></button>;
  return <section className="refiningHud" onClick={onOpen}>
    <header><Factory size={16}/><b>Refining Pipeline</b><span>{active.length} active / {complete.length} ready</span></header>
    <div className="refiningHudJobs">
      {visibleJobs.map(job => {
        const pct = job.status === 'active' ? jobProgress(job, clock) : 100;
        const out = job.output || job.output_preview || {name:job.recipe_name};
        return <div key={job.id} className={`refiningHudJob ${job.status} ${recipeTierClass(out)}`}>
          <ItemVisual item={out} size="xs"/>
          <span><b>{job.recipe_name}</b><small>{job.location_name || 'Remote pipeline'} • {job.status === 'active' ? `${Math.round(pct)}% • ${clockTimeLeft(job.completes_at)}` : 'Complete'}</small><Progress value={pct}/></span>
          {(job.status === 'complete' || job.status === 'completed') && <button onClick={(e)=>{ e.stopPropagation(); act('claim_crafting'); }}>Collect</button>}
        </div>;
      })}
    </div>
  </section>;
}

function RefiningPanelModal({state, clock, act, onClose}) {
  return <div className="modalBackdrop refiningModalBackdrop" onMouseDown={onClose}>
    <section className="refiningModal" onMouseDown={e=>e.stopPropagation()}>
      <button className="modalX" onClick={onClose}>x</button>
      <RefiningControlSurface state={state} act={act} clock={clock} modal />
    </section>
  </div>;
}

function RefiningControlSurface({state, act, clock, modal=false}) {
  const recipes = (state.crafting_recipes || []).filter(isRefiningRecipe);
  const jobs = (state.crafting_queue || []).filter(isRefiningJob);
  const activeJobs = jobs.filter(j => j.status === 'active');
  const [tier,setTier] = useState('all');
  const [category,setCategory] = useState('all');
  const [selectedCode,setSelectedCode] = useState('');
  const [targetCode,setTargetCode] = useState('');
  const selected = recipes.find(r => r.code === selectedCode) || recipes[0] || {};
  const shown = recipes.filter(r => (tier === 'all' || String(r.recipe_tier || r.output_tier || 1) === tier) && (category === 'all' || String(r.category || '') === category));
  const cats = ['all', ...Array.from(new Set(recipes.map(r=>r.category).filter(Boolean)))];
  const tiers = ['all', ...Array.from(new Set(recipes.map(r=>String(r.recipe_tier || r.output_tier || 1))))].sort((a,b)=>a==='all'?-1:b==='all'?1:Number(a)-Number(b));
  const best = [...recipes].filter(r=>r.can_craft).sort((a,b)=>(Number(b.recipe_tier||0)-Number(a.recipe_tier||0)) || ((Number((b.output_preview||b.output||{}).base_value||0)-Number(b.effective_credits||b.credits||0)) - (Number((a.output_preview||a.output||{}).base_value||0)-Number(a.effective_credits||a.credits||0))))[0];
  useEffect(() => { if (!selectedCode && recipes[0]) setSelectedCode(recipes[0].code); }, [recipes.length, selectedCode]);
  const projectTarget = targetCode ? (state.crafting_recipes || []).find(r => r.code === targetCode) : null;
  return <div className={`refiningSurface ${modal ? 'modalSurface' : ''}`}>
    <div className="refiningSurfaceHead">
      <div><span>Global Production</span><h2>Refining Pipeline</h2></div>
      <div className="buttonRow"><button disabled={!best} onClick={()=>best && act('craft_recipe',{recipe_code:best.code})}>Auto-Fill Best</button><button onClick={()=>act('claim_crafting')}>Collect Complete</button></div>
    </div>
    <div className="refiningColumns">
      <Panel title="Available Recipes">
        <div className="refiningFilters">
          <select value={tier} onChange={e=>setTier(e.target.value)}>{tiers.map(t=><option key={t} value={t}>{t === 'all' ? 'All tiers' : `Tier ${t}`}</option>)}</select>
          <select value={category} onChange={e=>setCategory(e.target.value)}>{cats.map(c=><option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}</select>
        </div>
        <div className="refiningRecipeList">{shown.map(recipe => <RefiningRecipeButton key={recipe.code} recipe={recipe} active={selected.code===recipe.code} onClick={()=>setSelectedCode(recipe.code)} />)}</div>
      </Panel>
      <Panel title="Selected Recipe Breakdown">
        <RefiningRecipeDetail recipe={selected} act={act} />
        <div className="projectMode">
          <b>Project Mode</b>
          <select value={targetCode} onChange={e=>setTargetCode(e.target.value)}>
            <option value="">Select target item</option>
            {(state.crafting_recipes || []).map(r=><option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
          {projectTarget && <ProjectTree recipe={projectTarget} recipes={state.crafting_recipes || []} inventory={state.inventory_summary || state.inventory || []} />}
        </div>
      </Panel>
      <Panel title="Active Jobs Queue">
        <div className="refiningQueueMeta"><span>Slots <b>{activeJobs.length} / {selected.refining_queue_slots || recipes[0]?.refining_queue_slots || 2}</b></span><span>Queue reorder unlocks with advanced industry training.</span></div>
        <div className="refiningQueueList">{jobs.length ? jobs.map(job=><RefiningQueueCard key={job.id} job={job} clock={clock} act={act} />) : <div className="emptyState">No refining jobs running.</div>}</div>
      </Panel>
    </div>
  </div>;
}

function RefiningRecipeButton({recipe, active, onClick}) {
  const stateKey = recipeState(recipe);
  const out = recipe.output_preview || recipe.output || {};
  const missingText = (recipe.missing_materials || recipe.missing || []).map(m => `${label(m.item_code)} -${fmt(m.deficit || Math.max(0, Number(m.required||0)-Number(m.available||0)))}`).join(', ');
  return <button className={`refiningRecipeButton ${active ? 'active' : ''} ${stateKey.toLowerCase()} ${recipeTierClass(recipe)}`} onClick={onClick}>
    <ItemVisual item={out} size="sm"/>
    <span><b>{recipe.name}</b><small>{recipeStateLabel(stateKey)} • {recipe.craft_time_label || secondsLabel(recipe.craft_time_seconds)} • Yield {fmt(recipe.yield_range?.min || out.qty || 1)}-{fmt(recipe.yield_range?.max || out.qty || 1)}</small>{missingText && <em>{missingText}</em>}</span>
  </button>;
}

function RefiningRecipeDetail({recipe, act}) {
  if (!recipe?.code) return <div className="emptyState">Select a recipe.</div>;
  const out = recipe.output_preview || recipe.output || {};
  const stateKey = recipeState(recipe);
  return <div className={`refiningRecipeDetail ${stateKey.toLowerCase()}`}>
    <div className="selectedRecipeHero">
      <ItemVisual item={out} size="ship"/>
      <div><b>{out.name || recipe.name}</b><span>{recipeStateLabel(stateKey)} • Output {fmt(recipe.yield_range?.min || out.qty || 1)}-{fmt(recipe.yield_range?.max || out.qty || 1)}</span><small>Station tier {fmt(recipe.required_station_tier || 0)} required • {recipe.current_station_tier ? `T${recipe.current_station_tier} available` : recipe.requires_refinery ? 'No refinery here' : 'No station required'}</small></div>
    </div>
    <div className="recipeReqs refiningReqs">
      {(recipe.inputs || []).map(i => {
        const deficit = Math.max(0, Number(i.required || 0) - Number(i.available || 0));
        return <div key={i.item_code} className={i.met ? 'met' : 'missing'} data-tooltip={!i.met ? `Need ${fmt(deficit)} more ${i.name || label(i.item_code)}` : ''}><span>{i.name}{i.required_tier ? ` • T${i.required_tier}+` : ''}</span><b>{fmt(i.available)} / {fmt(i.required)}</b></div>;
      })}
    </div>
    {!!(recipe.locked_reasons || []).length && <div className="refiningLocks">{recipe.locked_reasons.map((r,i)=><span key={i}>{r.message || r}</span>)}</div>}
    {!!(recipe.blockers || []).length && <div className="blockerLine">{recipe.blockers.join(' • ')}</div>}
    <button className={recipe.can_craft ? 'primary' : ''} disabled={!recipe.can_craft} onClick={()=>act('craft_recipe',{recipe_code:recipe.code})}>{recipe.can_craft ? 'Start Refining' : recipeStateLabel(stateKey)}</button>
  </div>;
}

function RefiningQueueCard({job, clock, act}) {
  const pct = job.status === 'active' ? jobProgress(job, clock) : 100;
  const out = job.output || job.output_preview || {name:job.recipe_name};
  return <div className={`refiningQueueCard ${job.status} ${recipeTierClass(out)}`}>
    <ItemVisual item={out} size="sm"/>
    <div><b>{job.recipe_name}</b><span>{job.location_name || 'Remote pipeline'} • {job.status === 'active' ? `${Math.round(pct)}% • ${clockTimeLeft(job.completes_at)}` : label(job.status)}</span><Progress value={pct}/><small>Total {job.total_label || secondsLabel(job.total_seconds)} • Cancel loses part of inputs</small></div>
    {job.status === 'active' ? <button onClick={()=>act('cancel_crafting',{job_id:job.id})}>Cancel</button> : (job.status === 'complete' || job.status === 'completed') ? <button onClick={()=>act('claim_crafting')}>Collect</button> : null}
  </div>;
}

function ProjectTree({recipe, recipes, inventory}) {
  const inv = Object.fromEntries((inventory || []).map(i => [i.item_code || i.code, Number(i.available_qty ?? i.qty ?? 0)]));
  const byOutput = Object.fromEntries((recipes || []).map(r => [((r.output_preview || r.output || {}).item_code || (r.output_preview || r.output || {}).module_code), r]).filter(([k])=>k));
  const renderNeed = (code, qty, depth=0) => {
    const maker = byOutput[code];
    const have = inv[code] || 0;
    const missing = Math.max(0, Number(qty || 0) - have);
    return <div className={`projectNeed depth${Math.min(depth,3)} ${missing ? 'missing' : 'met'}`} key={`${code}-${depth}`}>
      <span>{label(code)}</span><b>{fmt(have)} / {fmt(qty)}</b>
      {missing > 0 && <em>Missing {fmt(missing)}</em>}
      {maker && depth < 3 && <div>{(maker.inputs || []).map(i=>renderNeed(i.item_code, i.required * Math.max(1, missing || 1), depth + 1))}</div>}
    </div>;
  };
  return <div className="projectTree"><b>{recipe.name}</b>{(recipe.inputs || []).map(i=>renderNeed(i.item_code, i.required, 0))}</div>;
}

function Crafting({state,act,clock}) {
  const [category,setCategory] = useState('all');
  const [query,setQuery] = useState('');
  const recipes = state.crafting_recipes || [];
  const queue = state.crafting_queue || [];
  const activeJobs = queue.filter(j => j.status === 'active');
  const establishments = state.establishments || [];
  const refineryOnline = establishments.some(e => (e.service_type || '').toLowerCase() === 'refinery');
  const categories = ['all', ...Array.from(new Set(recipes.map(r=>r.category))).filter(Boolean)];
  const shown = recipes.filter(r =>
    (category === 'all' || r.category === category) &&
    `${r.name} ${r.description} ${r.code} ${r.category}`.toLowerCase().includes(query.toLowerCase())
  );
  const inputs = (state.inventory_summary || state.inventory || []).filter(i =>
    ['raw_materials','crafting_materials','refined_materials','goods','illicit_goods','consumables'].includes(i.category) ||
    ['material','component','food','medical','contraband','booster','consumable','refined','chemical','ore'].includes(i.item_type)
  );
  return <Page title="Crafting & Fabrication" sub="Crafting is timed. Raw ore now feeds refinery recipes first, then refined outputs feed higher-end manufacturing. Materials and credits are committed up front.">
    <Panel title="Crafting Controls" help="Timed crafting jobs persist through refresh. Completed jobs auto-resolve on state refresh or when you press Claim Completed. Ore refining recipes require refinery access at the current planet or station.">
      <div className="inventoryToolbar">
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search recipes" />
        <div className="chipRow">{categories.map(c=><button key={c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{c === 'all' ? 'All' : c}</button>)}</div>
        <button onClick={()=>act('claim_crafting')}>Claim Completed</button>
      </div>
      <div className="craftTimingSummary">
        <span>Active jobs <b>{fmt(activeJobs.length)}</b></span>
        <span>Queue max <b>{fmt(state.game_tuning?.groups?.find(g=>g.key==='CRAFTING_BALANCE')?.value?.max_active_jobs || 6)}</b></span>
        <span>Refinery <b>{refineryOnline ? 'Available' : 'Offline'}</b></span>
        <span>Fastest item <b>5s/unit</b></span>
        <span>Legendary capitals <b>2d–4d</b></span>
      </div>
    </Panel>

    <RefiningControlSurface state={state} act={act} clock={clock} />

    <CraftingQueue queue={queue} act={act} clock={clock} />

    <div className="recipeGrid">
      {shown.map(r=><RecipeCard key={r.code} recipe={r} act={act} />)}
      {!shown.length && <Panel title="No Recipes"><p className="muted">No recipes match the current filter.</p></Panel>}
    </div>

    <div className="cards2">
      <Panel title="Production Inputs" help="Market cargo and loose inventory both count toward recipe requirements. Raw ore appears here so it can be routed into refinery recipes.">
        <div className="feedList compactFeed">{inputs.slice(0,40).map(i=><div className="feedVisual" key={`${i.source || 'inv'}-${i.id}-${i.item_code}`}><ItemVisual item={i} size="sm"/><div><b>{i.name}</b><span>x{fmt(i.available_qty ?? i.qty)} • {i.legal ? 'Legal' : 'Illegal'} • {i.category_label || label(i.category || i.item_type)}</span><small>{i.source || 'inventory'} • Mass {fmt(i.cargo_mass ?? (i.mass * i.qty))}</small></div></div>)}</div>
      </Panel>
      <Panel title="Crafting History">
        <div className="feedList compactFeed">{(state.crafting_history || []).slice(0,20).map(h=>{
          const output = jsonSafe(h.output_json, {});
          return <div key={h.id}><b>{label(h.outcome)}: {h.recipe_name}</b><span>{output.name || output.item_code || output.kind || 'Output'} x{output.qty || output.scrap || 1}</span><small>XP {fmt(h.xp_reward)} - Credits {fmt(h.credits_spent)} - {new Date(h.created_at).toLocaleString()}</small></div>
        })}</div>
      </Panel>
    </div>
  </Page>
}

function CraftingQueue({queue, act, clock}) {
  const active = (queue || []).filter(j => j.status === 'active');
  const recent = (queue || []).filter(j => j.status !== 'active').slice(0,8);
  if (!active.length && !recent.length) return null;
  return <Panel title="Fabrication Queue" help="Active jobs finish on backend timestamps. Long projects keep running while you are away.">
    <div className="craftQueueGrid">
      {active.map(j => {
        const started = new Date(j.started_at).getTime();
        const ends = new Date(j.completes_at).getTime();
        const total = Math.max(1, ends - started);
        const remainingMs = Math.max(0, ends - clock);
        const pct = Math.max(0, Math.min(100, ((clock - started) / total) * 100));
        return <div className="craftJob activeCraftJob" key={j.id}>
          <ItemVisual item={j.output_preview || {name:j.recipe_name, category:'crafting'}} size="sm"/>
          <div>
            <b>{j.recipe_name}</b>
            <span>{Math.round(pct)}% • {clockTimeLeft(j.completes_at)} remaining</span>
            <small>Total {j.total_label || secondsLabel(j.total_seconds)} • Odds {Math.round((j.success_odds || 0)*100)}%</small>
            <Progress value={pct}/>
          </div>
          <button onClick={()=>act('cancel_crafting',{job_id:j.id})}>Cancel</button>
        </div>
      })}
      {recent.map(j => <div className={`craftJob ${j.status}`} key={j.id}>
        <ItemVisual item={j.output || j.output_preview || {name:j.recipe_name, category:'crafting'}} size="sm"/>
        <div><b>{label(j.status)}: {j.recipe_name}</b><span>{j.message || j.outcome || 'Complete'}</span><small>{j.completed_at ? new Date(j.completed_at).toLocaleString() : ''}</small></div>
      </div>)}
    </div>
  </Panel>;
}

function secondsLabel(seconds) {
  const s = Math.max(0, Number(seconds || 0));
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.ceil(s/60)}m`;
  if (s < 86400) return `${(s/3600).toFixed(s < 36000 ? 1 : 0)}h`;
  return `${(s/86400).toFixed(s < 864000 ? 1 : 0)}d`;
}

function RecipeCard({recipe, act}) {
  const out = recipe.output_preview || recipe.output || {};
  const blockers = recipe.blockers || [];
  const missingMaterials = recipe.missing_materials || [];
  const lockedReasons = recipe.locked_reasons || [];
  const clarityState = recipeState(recipe);
  const success = Math.round((recipe.success_odds || 0) * 100);
  const owned = !!recipe.owned_recipe;
  const unlimited = !!recipe.recipe_unlimited;
  const charges = recipe.recipe_uses_remaining;
  const locked = !owned;
  return <section className={`recipeCard ${recipe.can_craft ? 'readyRecipe' : 'blockedRecipe'} ${locked ? 'lockedRecipe' : ''} capability-${clarityState}`}>
    <div className="recipeHead">
      <div><b>{recipe.name}</b><span>{recipe.category} <TierBadge item={{current_tier:recipe.recipe_tier, max_tier:7, tier_display:recipe.tier_display}} /></span></div>
      <em className={`capabilityPill ${clarityState}`}>{recipeStateLabel(clarityState)}</em>
    </div>
    <p>{recipe.description}</p>
    <div className="recipeMeta">
      <span>Rank <b>{recipe.recipe_rank_name || 'Basic'}</b></span>
      <span>Credits {fmt(recipe.effective_credits ?? recipe.credits)}</span>
      <span>Time {recipe.craft_time_label || secondsLabel(recipe.craft_time_seconds || recipe.craft_seconds || recipe.craft_minutes*60)}</span>
      <span>XP {fmt(recipe.xp_reward)}</span>
      <span>Odds <b>{success}%</b></span>
      {recipe.requires_refinery && <span>Refinery {recipe.refinery_available ? 'online' : 'required'}</span>}
      {recipe.yield_range && <span>Yield <b>{fmt(recipe.yield_range.min)}-{fmt(recipe.yield_range.max)}</b></span>}
      {recipe.discount_pct > 0 && <span>Discount {recipe.discount_pct}%</span>}
    </div>
    <div className="recipeOwnershipRow">
      <span className={`recipeLicenseChip ${unlimited ? 'unlimited' : owned ? 'owned' : 'missing'}`}>
        {unlimited ? 'Unlimited recipe' : owned ? `Recipe copies: ${fmt(charges)}` : 'Recipe copy required'}
      </span>
      {recipe.set_name ? <span className="recipeSetChip">{recipe.set_name}{out.set_loop ? ` • ${out.set_loop}` : ""}</span> : null}
    </div>
    <div className="recipeReqs">
      {(recipe.inputs || []).map(i=><div key={i.item_code} className={i.met?'met':'missing'}>
        <span>{i.name}{i.required_tier ? ` • T${i.required_tier}+` : ''}</span><b>{fmt(i.available)} / {fmt(i.required)}{i.tier !== undefined ? ` • T${i.tier}` : ''}</b>
      </div>)}
    </div>
    <div className="outputPreview visualOutput">
      <ItemVisual item={out} />
      <div>
        <span>Output</span>
        <b>{out.name || out.item_code || out.module_code}</b>
        <small>{out.kind === 'module' ? `${label(out.slot_type || 'module')} module` : `${fmt(out.qty)}x • ${out.legal === 0 ? 'Illegal' : 'Legal'} • ${label(out.rarity || out.category || '')}`} <TierBadge item={out}/></small>
        {recipe.set_name ? <small className="recipeSetText">Set bonus eligible: {recipe.set_name}{out.set_loop ? ` • ${out.set_loop}` : ""}</small> : null}
      </div>
    </div>
    {blockers.length > 0 && <div className="blockerLine">{blockers.join(' • ')}</div>}
    {missingMaterials.length > 0 && <div className="blockerLine warningBlocker">Missing: {missingMaterials.map(m=>`${label(m.item_code)} ${fmt(m.missing)}`).join(' - ')}</div>}
    {lockedReasons.length > 0 && <div className="blockerLine lockedBlocker">{lockedReasons.join(' - ')}</div>}
    <button disabled={!recipe.can_craft} onClick={()=>act('craft_recipe',{recipe_code:recipe.code})}>{recipe.can_craft ? `Start Craft (${recipe.craft_time_label || secondsLabel(recipe.craft_time_seconds)})` : locked ? 'Recipe Not Owned' : recipeStateLabel(clarityState)}</button>
  </section>
}

function ProgressIcon({name, size=18}) {
  const map = {
    pickaxe: Factory, hammer: Hammer, coins: Coins, store: Store, package: Package, swords: Swords,
    crosshair: Crosshair, wrench: Hammer, globe: Globe2, radar: Info, factory: Factory, shield: Shield,
    mask: AlertTriangle, unlock: Shield, rocket: Rocket, building: Building2, heart: HeartPulse, mail: Mail,
    briefcase: Briefcase
  };
  const Icon = map[name] || Brain;
  return <Icon size={size}/>;
}

function Jobs({state,act}) {
  const [selected,setSelected] = useState((state.jobs.find(j=>j.active) || state.jobs[0] || {}).code);
  const active = state.jobs.find(j=>j.active);
  const selectedJob = state.jobs.find(j=>j.code===selected) || active || state.jobs[0] || {};
  const req = selectedJob.next_requirement || jsonSafe(selectedJob.next_req_json,{});
  const metrics = jsonSafe(selectedJob.metrics_json,{});
  const tasks = (selectedJob.tasks_json ? jsonSafe(selectedJob.tasks_json,[]) : []).slice(0,4);
  const skillTasks = state.skill_tasks || [];
  return <Page title="Deprecated Work" sub="Skills do not lock gameplay. Anyone can mine, craft, trade, fight, smuggle, salvage, explore, or jailbreak. XP is universal; your build comes from skill point allocation.">
    <div className="cards3">
      <Panel title="Active Skill">
        {active ? <div className={`skillSpotlight ${active.style || ''}`}>
          <div className="skillIcon"><ProgressIcon name={active.icon}/></div>
          <div>
            <b>{active.name}</b>
            <span>{active.rank_title || `Rank ${active.rank}`} • Rank {active.rank} • Rank score {fmt(active.xp)}</span>
            <p>{active.recommended_loop}</p>
          </div>
        </div> : <p>No active skill selected.</p>}
      </Panel>
      <Panel title="Next Rank">
        {active ? <Stats pairs={{
          Next:req.next_rank || '—',
          RankScoreNeeded:req.xp_needed ?? '—',
          [label(req.primary_metric || 'Primary')]:req.primary_needed ?? '—',
          [label(req.value_metric || 'Value')]:req.value_needed ?? '—'
        }} /> : <p>Select a skill.</p>}
        {active && <Bar label="Skill Rank Progress" value={active.progress_pct || 0} max={100}/>}
      </Panel>
      <Panel title="Skill Rule">
        <div className="infoStack">
          <div><b>Open actions</b><span>Non-skill actions stay available.</span></div>
          <div><b>Skill bonus</b><span>Matching actions get better rewards and odds.</span></div>
          <div><b>Universal XP</b><span>All valid actions feed the same character XP pool.</span></div>
        </div>
      </Panel>
    </div>

    <Panel title="Skill-Specific Actions">
      <div className="opList detailed">{skillTasks.length ? skillTasks.map(task=><OperationRow key={task.key} item={task} actionLabel="Run Skill Job" onRun={()=>act('skill_task',{task_key:task.key})} />) : <p>No active skill jobs. Set an active skill below.</p>}</div>
    </Panel>

    <div className="jobsLayout">
      <Panel title="Unavailable">
        <div className="skillGrid">{state.jobs.map(j=><button key={j.code} className={`skillTile ${j.active?'activeSkillCard':''} ${selected===j.code?'selected':''}`} onClick={()=>setSelected(j.code)}>
          <ProgressIcon name={j.icon}/>
          <b>{j.name}</b>
          <span>{j.rank_title || `Rank ${j.rank}`} • {j.risk_profile || j.side}</span>
          <Bar label="XP" value={j.progress_pct || 0} max={100}/>
        </button>)}</div>
      </Panel>

      <Panel title={`${selectedJob.name || 'Skill'} Details`}>
        <div className="skillDetailHeader">
          <div className="skillIcon large"><ProgressIcon name={selectedJob.icon} size={26}/></div>
          <div><b>{selectedJob.name}</b><span>{selectedJob.rank_title || `Rank ${selectedJob.rank || 1}`} • {selectedJob.risk_profile}</span><p>{selectedJob.description}</p></div>
        </div>
        <div className="tagCloud">
          {(selectedJob.preferred_skills || []).map(x=><span key={x}>Skill: {label(x)}</span>)}
          {(selectedJob.preferred_ships || []).map(x=><span key={x}>Ship: {x}</span>)}
          {(selectedJob.skill_actions || []).map(x=><span key={x}>Action: {label(x)}</span>)}
        </div>
        <div className="bonusGrid">
          <div><b>Current Job Bonuses</b>{(selectedJob.current_bonuses || []).map((b,i)=><span key={i}>{b}</span>)}</div>
          <div><b>Next Rank Bonuses</b>{(selectedJob.next_rank_bonuses || []).map((b,i)=><span key={i}>{b}</span>)}</div>
          <div><b>Metrics</b>{Object.entries(metrics).map(([k,v])=><span key={k}>{label(k)}: {fmt(v)}</span>)}{Object.keys(metrics).length===0 && <span>No metrics yet.</span>}</div>
        </div>
        <Panel title="Skill Task Preview">
          <div className="miniStack">{tasks.map(t=><button key={t.key} onClick={()=>selectedJob.active ? act('skill_task',{task_key:t.key}) : null} disabled={!selectedJob.active}><b>{t.name}</b><small>{t.desc || t.description}</small></button>)}</div>
        </Panel>
        <button disabled={selectedJob.active} onClick={()=>act('switch_job',{job_code:selectedJob.code})}>{selectedJob.active ? 'Current Skill' : 'Set Active Skill'}</button>
      </Panel>
    </div>
  </Page>
}

function SpecializationTree({state, token, refreshState}) {
  const skills = state.specialization || {};
  const trees = skills.trees || [];
  const [selectedTree, setSelectedTree] = useState(trees[0]?.key || 'combat');
  const [busyNode, setBusyNode] = useState('');
  const [status, setStatus] = useState('');
  const current = trees.find(t => t.key === selectedTree) || trees[0] || {};
  const spend = async (nodeKey) => {
    if (!token || !nodeKey) return;
    setBusyNode(nodeKey);
    setStatus('');
    try {
      const res = await fetch(`${API}/api/progression/spend`, {method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body:JSON.stringify({node_key:nodeKey, ranks:1})});
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.detail || 'Spend failed');
      setStatus(data.message || 'SP spent.');
      await refreshState?.({silent:true, force:true, maps:false, skipDuringAction:false});
    } catch (err) {
      setStatus(err.message || 'Spend failed');
    } finally {
      setBusyNode('');
    }
  };
  const respec = async () => {
    if (!token) return;
    setBusyNode('respec');
    setStatus('');
    try {
      const res = await fetch(`${API}/api/progression/respec`, {method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body:JSON.stringify({})});
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.detail || 'Respec failed');
      setStatus(data.message || 'Respec complete.');
      await refreshState?.({silent:true, force:true, maps:false, skipDuringAction:false});
    } catch (err) {
      setStatus(err.message || 'Respec failed');
    } finally {
      setBusyNode('');
    }
  };
  return <Panel title="Role Specialization" help="Server-enforced allocation tree. Ship tier requirements, one-T4 limit, respec costs, and module role compatibility are enforced by the backend.">
    <div className="specializationShell">
      <div className="specializationSummary">
        <Stats pairs={{TotalSP:skills.totalSP || 0, UnspentSP:skills.unspentSP || 0, SpentSP:skills.spentSP || 0, Respec:skills.respec?.firstFree ? 'First Free' : `${fmt(skills.respec?.nextCost || 0)} Cr`}} />
        {!!skills.wouldCreateInvalidT4Warning && <div className="jailBanner"><AlertTriangle size={16}/>Only one tree can remain at T4.</div>}
        {status && <div className={`skillsStatus ${status.toLowerCase().includes('failed') || status.toLowerCase().includes('requires') || status.toLowerCase().includes('not enough') ? 'bad' : ''}`}>{status}</div>}
      </div>
      <div className="specializationTabs">
        {trees.map(t => <button key={t.key} className={selectedTree===t.key?'active':''} onClick={()=>setSelectedTree(t.key)}>
          <b>{t.name}</b><span>{t.allocationPct || 0}% / T{t.tier || 1}</span>
        </button>)}
      </div>
      <div className="specializationTreeDetail">
        <div className="specializationTreeHead">
          <div><b>{current.name || 'Tree'}</b><span>{current.purpose}</span></div>
          <button disabled={busyNode === 'respec'} onClick={respec}>{busyNode === 'respec' ? 'Working...' : `Respec ${skills.respec?.firstFree ? 'Free' : fmt(skills.respec?.nextCost || 0)}`}</button>
        </div>
        {current.lowInvestmentActive && <div className="warningStack">{(current.lowInvestmentPenalties || []).map(x=><span key={x}><AlertTriangle size={14}/>{x}</span>)}</div>}
        <div className="specializationBranches">
          {(current.branches || []).map(branch => <section className="specializationBranch" key={branch.key}>
            <div className="branchHeader"><b>{branch.name}</b><span>{branch.keystoneName}</span></div>
            <small>{branch.keystoneDescription}</small>
            <div className="tagCloud">{(branch.bonuses || []).map(b=><span key={b}>{b}</span>)}</div>
            <div className="skillsNodeGrid">{(branch.nodes || []).map(node => <button key={node.key} className={`skillsNode ${node.isKeystone ? 'keystone' : ''}`} disabled={!node.canRank || !!busyNode} onClick={()=>spend(node.key)}>
              <b>{node.name}</b>
              <span>Rank {fmt(node.rank)} / {fmt(node.maxRank)} {node.isKeystone ? 'Keystone' : ''}</span>
              <small>{node.description}</small>
              <em>{busyNode === node.key ? 'Spending...' : node.canRank ? `Spend ${fmt(node.spCost)} SP` : 'Locked or maxed'}</em>
            </button>)}</div>
          </section>)}
        </div>
      </div>
      <div className="specializationFooter">
        {(skills.explanations || []).map(x=><span key={x}>{x}</span>)}
      </div>
    </div>
  </Panel>;
}

function Skills({state,act,token,refreshState}) {
  const [cat,setCat] = useState('All');
  const [q,setQ] = useState('');
  const skills = state.skills || [];
  const cats = ['All', ...Array.from(new Set(skills.map(s=>s.category).filter(Boolean)))];
  const filtered = skills.filter(s => (cat==='All' || s.category===cat) && (`${s.name} ${s.description} ${(s.affects||[]).join(' ')} ${(s.trained_by||[]).join(' ')}`.toLowerCase().includes(q.toLowerCase())));
  const strongest = [...skills].sort((a,b)=>(b.level||0)-(a.level||0)).slice(0,5);
  const selected = filtered[0] || skills[0] || {};
  const tierLimits = state.skill_tree_limits?.tiers || {};
  return <Page title="Skill Tree Progress" sub="XP is universal. Skill points from the character XP pool define your Combat, Industry, Market, and Exploration build.">
    <SpecializationTree state={state} token={token} refreshState={refreshState} />
    <div className="cards3">
      <Panel title="Strongest Skills">
        <div className="skillTopList">{strongest.map(s=><div key={s.key}><ProgressIcon name={s.icon}/><b>{s.name}</b><span>Lv {s.level} • {s.progress_pct}%</span></div>)}</div>
      </Panel>
      <Panel title="Skill Search">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search skills, bonuses, trained by..." />
        <div className="tabs">{cats.map(c=><button key={c} className={cat===c?'active':''} onClick={()=>setCat(c)}>{c}</button>)}</div>
      </Panel>
      <Panel title="Skill Point Pool">
        <div className="infoStack">
          <div><b>Available</b><span>{fmt(state.player.skill_points)} skill points</span></div>
          <div><b>Current XP</b><span>{fmt(state.player.xp)} / {fmt(state.next_level_xp)} XP</span></div>
          <div><b>Next skill point</b><span>{fmt(state.xp_needed_next_skill_point)} XP needed</span></div>
        </div>
      </Panel>
    </div>
    <Panel title="Tree Investment Limits">
      <div className="adminHintGrid">
        {[1,2,3,4].map(t=><div key={t}><b>Tier {t}{t===4 ? '+' : ''}</b><span>Up to {fmt(tierLimits[t]?.maxTrees || (t===1?4:t===2?3:t===3?2:1))} tree{(tierLimits[t]?.maxTrees || 1) === 1 ? '' : 's'}: {(tierLimits[t]?.activeTrees || []).join(', ') || 'none yet'}</span></div>)}
      </div>
    </Panel>

    <div className="skillsLayout">
      <Panel title="Skill Cards">
        <div className="skillGrid">{filtered.map(s=><div key={s.key} className={`skillCard ${s.category?.toLowerCase() || ''}`}>
          <div className="skillCardHead"><ProgressIcon name={s.icon}/><div><b>{s.name}</b><span>{s.category} • Level {s.level}/{s.max_level}</span></div></div>
          <p>{s.summary}</p>
          <Bar label="Skill Tree Progress" value={s.progress_pct || 0} max={100}/>
          <small>{s.blocked_reason || `Next level costs ${fmt(s.skill_point_cost)} skill point(s).`}</small>
          <button disabled={!s.can_unlock} onClick={()=>act('unlock_skill',{skill_key:s.key})}>{s.can_unlock ? 'Spend Skill Point' : 'Locked'}</button>
          <details>
            <summary>What it does</summary>
            <p>{s.description}</p>
            <b>Current effects</b>{(s.current_effects || []).map((x,i)=><span className="detailPill" key={i}>{x}</span>)}
          </details>
        </div>)}</div>
      </Panel>

      <Panel title={`${selected.name || 'Skill'} Detail`}>
        <div className="skillDetailHeader">
          <div className="skillIcon large"><ProgressIcon name={selected.icon} size={26}/></div>
          <div><b>{selected.name}</b><span>{selected.category} • Level {selected.level}</span><p>{selected.description}</p></div>
        </div>
        <Bar label="Current Level Progress" value={selected.progress_pct || 0} max={100}/>
        <div className="bonusGrid">
          <div><b>XP Sources</b>{(selected.trained_by || []).map((x,i)=><span key={i}>{x}</span>)}</div>
          <div><b>Affects</b>{(selected.affects || []).map((x,i)=><span key={i}>{x}</span>)}</div>
          <div><b>Passive Bonuses</b>{(selected.passive_bonuses || []).map((x,i)=><span key={i}>{x}</span>)}</div>
          <div><b>Current Effects</b>{(selected.current_effects || []).map((x,i)=><span key={i}>{x}</span>)}</div>
        </div>
      </Panel>
    </div>
  </Page>
}

function Properties({state,act,dialogs}) {
  const [tab,setTab] = useState('base');
  const [researchQ,setResearchQ] = useState('');
  const [buildingQ,setBuildingQ] = useState('');
  const baseState = state.base_state || {research:{projects:[]}, buildings:[], placement:{}, summary:{}};
  const base = baseState.base;
  const research = baseState.research || {projects:[]};
  const buildings = baseState.buildings || [];
  const filteredResearch = (research.projects || []).filter(r => `${r.name} ${r.category} ${r.description}`.toLowerCase().includes(researchQ.toLowerCase()));
  const filteredBuildings = buildings.filter(b => `${b.name} ${b.category} ${b.description} ${b.bonus}`.toLowerCase().includes(buildingQ.toLowerCase()));
  const activeResearch = (research.projects || []).find(r=>r.status==='researching');
  const activeBuilding = buildings.find(b=>b.status==='building');
  return <Page title="Properties, Research & Bases" sub="Mid-game private bases. Research costs credits/time; construction costs more credits/time. One private base per player. Other players cannot dock or attack it.">
    <div className="tabs"><button className={tab==='base'?'active':''} onClick={()=>setTab('base')}>Private Base</button><button className={tab==='research'?'active':''} onClick={()=>setTab('research')}>Research</button><button className={tab==='buildings'?'active':''} onClick={()=>setTab('buildings')}>Buildings</button><button className={tab==='property'?'active':''} onClick={()=>setTab('property')}>Old Properties</button></div>

    {tab === 'base' && <>
      <div className="cards3">
        <Panel title="Private Base Status" help="Build from a blank point on the System Map. Clearance requires two icon-spaces from planets, stations, nodes, pirate bases, and other bases.">
          {base ? <div className="baseStatusCard"><b>{base.name}</b><span>{base.galaxy_name} • anchored near {base.anchor_planet_name || 'open space'} • {Number(base.x_pct).toFixed(1)} / {Number(base.y_pct).toFixed(1)}</span><button onClick={()=>act('collect_base_output')}>Collect Passive Output</button></div> : <div className="baseStatusCard"><b>No Base Built</b><span>Open the System Map, click an empty area, then use Build Base Here. Placement cost: {fmt(baseState.placement?.cost || 2500000)} credits.</span><button onClick={async ()=>{
            const name = await dialogs.textInput('Name this emergency private base.', 'Private Base', {title:'Emergency Base Placement', inputLabel:'Base name'});
            act('place_player_base',{x_pct:50,y_pct:50,map_type:'system',name:name || 'Private Base'});
          }}>Emergency Place Near Center</button></div>}
        </Panel>
        <Panel title="Long-Term Completion"><Stats pairs={{Research:`${fmt(baseState.summary?.research_complete || 0)} / ${fmt(baseState.summary?.research_total || 0)}`, Buildings:`${fmt(baseState.summary?.complete_buildings || 0)} / ${fmt(baseState.summary?.total_buildings || 0)}`, Clearance:`${baseState.placement?.clearance_spaces || 2} spaces`, Rule:'One base only'}} /></Panel>
        <Panel title="Active Work">{activeResearch ? <div className="itemLine"><b>{activeResearch.name}</b><span>Researching • {clockTimeLeft(activeResearch.complete_at)}</span></div> : <p className="muted">No active research.</p>}{activeBuilding ? <div className="itemLine"><b>{activeBuilding.name}</b><span>Building • {clockTimeLeft(activeBuilding.complete_at)}</span></div> : <p className="muted">No active construction.</p>}</Panel>
      </div>
      <Panel title="Why Build A Base"><div className="adminHintGrid"><div><b>No combat power spike</b><span>Buildings focus on passive materials, convenience, and long-tail economy.</span></div><div><b>Research first</b><span>Every building requires its matching research project before construction.</span></div><div><b>Private docking</b><span>You can dock at your own base. Other players cannot dock or attack.</span></div><div><b>Grindy max-out path</b><span>Maxing research and construction takes hundreds of real-time days and heavy credits.</span></div></div></Panel>
    </>}

    {tab === 'research' && <>
      <Panel title="Research Projects" help="One research project at a time. Research only costs credits and time; it unlocks matching base construction."><div className="inventoryToolbar"><input value={researchQ} onChange={e=>setResearchQ(e.target.value)} placeholder="Search research..." /></div><div className="baseTechGrid">{filteredResearch.map(r=><div className={`baseTechCard ${r.status}`} key={r.code}><div><b>{r.name}</b><span>{r.category} • T{r.tier} • {fmt(r.cost)} credits • {fmt(Math.round(r.hours/24*10)/10)} days</span></div><p>{r.description}</p>{r.status==='researching' && <Progress value={Math.max(0, 100 - (r.remaining_seconds / Math.max(1, r.hours*3600))*100)} />}{r.status==='complete' ? <button disabled>Complete</button> : r.status==='researching' ? <button disabled>{clockTimeLeft(r.complete_at)}</button> : <button disabled={!r.can_start} onClick={()=>act('start_base_research',{research_code:r.code})}>Purchase + Research</button>}</div>)}</div></Panel>
    </>}

    {tab === 'buildings' && <>
      <Panel title="Base Buildings" help="One construction project at a time. Buildings are private and provide slow passive outputs or small quality-of-life bonuses."><div className="inventoryToolbar"><input value={buildingQ} onChange={e=>setBuildingQ(e.target.value)} placeholder="Search buildings, outputs, bonuses..." /></div><div className="baseTechGrid">{filteredBuildings.map(b=><div className={`baseTechCard ${b.status}`} key={b.code}><div><b>{b.name}</b><span>{b.category} • T{b.tier} • {fmt(b.cost)} credits • {fmt(Math.round(b.hours/24*10)/10)} days</span></div><p>{b.description}</p><small>{b.bonus} • Passive: {fmt(b.passive_qty_per_day)} {label(b.passive_item_code)} / day</small>{b.status==='building' && <Progress value={Math.max(0, 100 - (b.remaining_seconds / Math.max(1, b.hours*3600))*100)} />}{b.status==='complete' ? <button disabled>Built</button> : b.status==='building' ? <button disabled>{clockTimeLeft(b.complete_at)}</button> : b.status==='locked' ? <button disabled>Research Required</button> : <button disabled={!b.can_build} onClick={()=>act('start_base_building',{building_code:b.code})}>Purchase + Build</button>}</div>)}</div></Panel>
    </>}

    {tab === 'property' && <>
      <Panel title="My Properties"><button onClick={()=>act('collect_property_income')}>Collect Income</button>{state.properties.map(p=><div className="itemLine" key={p.id}><b>{p.name}</b><span>{p.planet_name} • Lv {p.level} • +{fmt(p.income*p.level)}/hr</span><button onClick={()=>act('upgrade_property',{property_id:p.id})}>Upgrade</button></div>)}</Panel>
      <Panel title="Property Marketplace">{state.property_templates.map(p=><div className="itemLine" key={p.code}><b>{p.name}</b><span>{p.type} • {fmt(p.base_price)} Cr • Storage {p.storage}</span><button onClick={()=>act('buy_property',{code:p.code})}>Buy</button></div>)}</Panel>
      <Panel title="Local Establishments">{state.establishments.map(e=><div className="itemLine" key={e.id}><b>{e.name}</b><span>{e.service_type} • Price {fmt(e.price)}</span></div>)}</Panel>
    </>}
  </Page>
}


function Medical({state,act}) {
  return <Page title="Medical Bay" sub="No permanent death. Serious defeat causes hospital time; ship can be lost. Payments speed surgery but minimum hospital time is 10 minutes.">
    <div className="cards3"><Panel title="Current Injury Status"><div className="hugeTimer">{state.player.hospital_until ? timeLeft(state.player.hospital_until) : 'No Injury'}</div><p>Minimum hospital time: 10 minutes.</p></Panel><Panel title="Expedite Surgery"><button onClick={()=>act('hospital_expedite',{minutes:10})}>-10 Minutes</button><button onClick={()=>act('hospital_expedite',{minutes:30})}>-30 Minutes</button><button onClick={()=>act('hospital_expedite',{minutes:60})}>-1 Hour</button></Panel><Panel title="Money Sinks"><div className="opList">{['Ship part repairs','Module durability repairs','Fuel refills','Insurance premiums','Hospital surgery acceleration','Property upgrades','Crafting fees','Guild war costs'].map(x=><div key={x}>{x}<span>Economy sink</span></div>)}</div></Panel></div>
    <Panel title="Recent Money Sinks">{(state.money_sinks || []).map(s=><div className="itemLine" key={s.id}><b>{label(s.sink_type)}</b><span>{fmt(s.amount)} Cr • {s.description}</span></div>)}</Panel>
  </Page>
}



function Fight({state, act, loading}) {
  const fight = state.fight || {};
  const targets = fight.targets || [];
  const [selectedId, setSelectedId] = useState(targets[0]?.id || null);
  const [kindFilter, setKindFilter] = useState('all');
  const [battle, setBattle] = useState(fight.latestBattle || null);
  const [showBattleModal, setShowBattleModal] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [escapeResult, setEscapeResult] = useState(null);
  const selected = targets.find(t => t.id === selectedId) || targets[0] || null;
  const battleBlockedReason = fight.blockedReason || (!selected?.attackable ? (selected?.blockedReason || 'Target unavailable') : null);
  const filtered = targets.filter(t => kindFilter === 'all' || t.kind === kindFilter || String(t.role || '').toLowerCase().includes(kindFilter));
  const log = battle?.log || [];
  const visibleLog = log.slice(0, activeIndex + 1);
  const current = log[Math.min(activeIndex, Math.max(0, log.length - 1))] || {};
  const your = battle?.yourShip || fight.activeShip || {};
  const enemy = battle?.enemyShip || selected?.ship || {};
  const playerHull = current.playerHull ?? your.hull;
  const playerShield = current.playerShield ?? your.shield;
  const enemyHull = current.enemyHull ?? enemy.hull;
  const enemyShield = current.enemyShield ?? enemy.shield;

  useEffect(() => {
    setSelectedId(prev => prev || targets[0]?.id || null);
  }, [targets.length]);

  useEffect(() => {
    if (!battle?.log?.length) return;
    setActiveIndex(0);
    setEscapeResult(null);
  }, [battle?.id]);

  useEffect(() => {
    if (!battle?.log?.length) return;
    if (activeIndex >= battle.log.length - 1) return;
    const delay = Number(battle.actionDelayMs || battle.balance?.round_ms || 3000);
    const id = setTimeout(() => setActiveIndex(i => Math.min(i + 1, battle.log.length - 1)), delay);
    return () => clearTimeout(id);
  }, [battle, activeIndex]);

  async function launchCombat(mode='attack') {
    if (!selected) return;
    const res = await act('start_combat', { target_ref: selected.id, mode });
    if (res?.result?.battle) {
      setBattle(res.result.battle);
      setActiveIndex(0);
      setEscapeResult(null);
      setShowBattleModal(true);
    }
  }

  async function attemptEscape() {
    if (!battle || activeIndex >= Math.max(0, log.length - 1)) return;
    const res = await act('attempt_combat_escape', { battle_id: battle.id });
    const escaped = !!res?.result?.escaped;
    setEscapeResult(res?.result || { escaped:false, message:'Failed to escape, try again in 6 seconds' });
    if (escaped) {
      setShowBattleModal(false);
    }
  }

  return <Page title="Fight" sub="Same-location PvE/PvP combat. Ship loadout, combat skills, skill, legality, heat, and rewards all matter.">
    <div className="fightTop">
      <Panel title="Current Combat Zone" help="Combat targets are limited to your current planet or station. Travel and jail block combat.">
        <Stats pairs={{
          Location: state.location?.name,
          Security: fight.locationRules?.security ?? state.location?.security_level,
          Lawfulness: fight.locationRules?.lawfulness ?? state.location?.lawfulness,
          Targets: targets.length,
          Status: fight.blockedReason || 'Combat ready'
        }} />
        <p className="muted">{fight.locationRules?.summary}</p>
        {fight.blockedReason && <div className="jailBanner"><AlertTriangle size={16}/>{fight.blockedReason}</div>}
      </Panel>
      <Panel title="Active Ship" help="Your fitted weapons, shields, armor, scanners, engines, and skills affect battle outcome.">
        <div className="combatShipMini">
          <GameImage src="" assetType="ship" category={fight.activeShip?.role || state?.active_ship?.role || state?.active_ship?.class_name || state?.active_ship?.name} alt="Active ship" />
          <div>
            <h3>{fight.activeShip?.name || state?.active_ship?.name}</h3>
            <p>{label(fight.activeShip?.role || state?.active_ship?.role || 'ship')} • Combat {fmt(fight.activeShip?.combatRating || state.ship_power)}</p>
            <div className="tagCloud">{(fight.activeShip?.weapons || []).slice(0,4).map(w=><span key={w.name}>{w.name}</span>)}</div>
          </div>
        </div>
      </Panel>
    </div>

    <div className="fightLayout">
      <Panel title="Nearby Targets" help="NPCs and players shown here are at your current location only. Legal targets are safer; unlawful attacks can raise heat and cause jail.">
        <div className="chipRow">
          {['all','npc','player','pirate','mercenary','trader','security','smuggler'].map(x=><button key={x} className={kindFilter===x?'active':''} onClick={()=>setKindFilter(x)}>{label(x)}</button>)}
        </div>
        <div className="targetGrid">
          {filtered.length ? filtered.map(t => <button key={t.id} className={`targetCard ${selected?.id===t.id ? 'selected' : ''} ${t.legal?.criminal ? 'criminal' : ''}`} onClick={()=>setSelectedId(t.id)}>
            <GameImage src="" assetType="ship" category={t.role || t.kind || t.name} alt={t.name} />
            <b>{t.name}</b>
            <span>{label(t.kind)} • {label(t.role)} • Lv {t.level || '—'}</span>
            <small>Power {fmt(t.power || t.ship?.combatRating)} • {t.danger}</small>
            <em className={t.legal?.criminal ? 'dangerTag' : 'okTag'}>{t.legal?.label || 'Legal target'}</em>
          </button>) : <div className="emptyState">No combat targets currently registered at this location.</div>}
        </div>
      </Panel>

      <Panel title="Selected Target / Combat Preview" help="Preview explains legality, danger, rewards, and ship-vs-ship context before battle.">
        {selected ? <div className="targetDetail">
          <div className="combatVersus compact">
            <CombatShipSide title="Your Ship" ship={fight.activeShip} hull={fight.activeShip?.hull} shield={fight.activeShip?.shield} />
            <div className="versusCore"><Swords/><b>VS</b><span>{selected.legal?.state?.toUpperCase()}</span></div>
            <CombatShipSide title="Target" ship={selected.ship} hull={selected.ship?.hull} shield={selected.ship?.shield} />
          </div>
          {selected.legal?.criminal && <div className="jailBanner"><AlertTriangle size={16}/>Unlawful attack. Heat gain {selected.legal?.heatGain || 0}. Jail risk applies if caught or defeated.</div>}
          <Stats pairs={{
            Target:selected.name,
            Role:label(selected.role),
            Danger:selected.danger,
            Reward:fmt(selected.rewardEstimate),
            Tier:`T${selected.rewardProfile?.tier || selected.ship?.tier || 1}`,
            Difficulty:selected.rewardProfile?.difficulty || '—',
            LootChance:selected.rewardProfile?.lootChance ? `${Math.round(selected.rewardProfile.lootChance*100)}%` : '—',
            Legality:selected.legal?.label,
            EnemyCombat:fmt(selected.ship?.combatRating),
            YourCombat:fmt(fight.activeShip?.combatRating)
          }} />
          {battleBlockedReason && <div className="jailBanner"><AlertTriangle size={16}/>{battleBlockedReason}</div>}
          <div className="fightActions">
            <button className="primary" disabled={loading || !!battleBlockedReason} onClick={()=>launchCombat('attack')}>{battleBlockedReason || 'Start Battle'}</button>
            {selected.kind === 'player' && <button disabled={loading || !!battleBlockedReason} onClick={()=>launchCombat('duel')}>Challenge Duel</button>}
          </div>
        </div> : <div className="emptyState">Select a target.</div>}
      </Panel>
    </div>

    <Panel title="Battle Screen" help="Battles open in a modal overlay. Server resolves the battle; the modal replays it at a readable pace.">
      {battle ? <div className="battleLaunchPanel">
        <div><b>{battle.summary || 'Latest battle ready'}</b><span>{battleStatusText(battle)} • {fmt(battle.rounds)} rounds • Rewards {battleIsComplete(battle) ? fmt(battle.rewards?.credits || 0) : 'pending'} Cr</span></div>
        <button className="primary" onClick={()=>setShowBattleModal(true)}>Open Battle Screen</button>
      </div> : <div className="emptyState">Select a target and start a fight. The battle replay opens in a modal.</div>}
    </Panel>

    {battle && showBattleModal && <RealtimeBattleModal battle={battle} act={act} onClose={()=>setShowBattleModal(false)} />}

    <Panel title="Recent Battle History">
      <div className="historyList">{(fight.recentBattles || []).map(b=><div key={b.id} className="itemLine"><b>{b.target_name}</b><span>{label(b.outcome)} • {label(b.legal_state)} • {b.summary}</span></div>)}</div>
    </Panel>
  </Page>
}

function CombatShipSide({title, ship, hull, shield, defeated=false, side="neutral", effects=[]}) {
  const safeShip = ship || {};
  const hMax = Math.max(1, Number(safeShip.hull || safeShip.maxHull || hull || 1));
  const sMax = Math.max(1, Number(safeShip.shield || safeShip.maxShield || shield || 1));
  const liveHull = Math.max(0, Math.min(hMax, Number(hull ?? safeShip.currentHull ?? safeShip.hull ?? hMax)));
  const liveShield = Math.max(0, Math.min(sMax, Number(shield ?? safeShip.currentShield ?? safeShip.shield ?? sMax)));
  const shipName = safeShip.name || safeShip.template_name || title || "Unknown Ship";
  const shipHint = safeShip.role || safeShip.class || safeShip.class_name || safeShip.template_name || safeShip.name || side || "ship";
  return <div className={`combatShipSide ${side} ${defeated ? "defeated" : ""}`}>
    <h3>{title}</h3>
    <div className="battleShipImageFrame"><GameImage src="" assetType="ship" category={shipHint} alt={shipName} /></div>
    <b>{shipName}</b>
    <small>{label(safeShip.role || safeShip.class || "ship")} • Combat {fmt(safeShip.combatRating || 0)}</small>
    <div className="combatShipVitals">
      <MiniMeter label="Shield" value={liveShield} max={sMax} />
      <MiniMeter label="Hull HP" value={liveHull} max={hMax} danger={liveHull < hMax * 0.35} />
      <CombatEffectRack effects={effects} side={side} />
    </div>
  </div>
}


function Ships({state, act, loading}) {
  const h = state.hangar || {};
  const [selectedShipId, setSelectedShipId] = useState(h.activeShipId || h.activeShip?.id || null);
  const [shipFilter, setShipFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('compatible');
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const active = h.activeShip || state.active_ship || {};
  const owned = h.ownedShips || state.ships || [];
  const selected = owned.find(x => x.id === selectedShipId) || active || owned[0] || {};
  const availableShips = h.availableShips || state.ship_templates || [];
  const modules = h.availableModules || (state.modules || []).filter(m => !m.equipped);
  const equipped = h.equippedModules || (state.modules || []).filter(m => m.equipped);
  const activeSlots = active.slots || [];
  const selectedSlot = activeSlots.find(x => x.slotId === selectedSlotId) || null;
  const slotTypes = h.compatibilityInfo?.slotTypes || ['weapon','mining','shield','armor','engine','cargo','scanner','stealth','utility','repair','fuel','energy'];
  const selectedStats = selected.derived_stats || h.derivedStats || {};
  const activeStats = active.derived_stats || h.derivedStats || {};
  const activeInsurance = active.insurance || {};
  const filteredShips = owned.filter(ship => shipFilter === 'all' || String(ship.role || ship.class_name || '').toLowerCase().includes(shipFilter));
  const filteredModules = modules.filter(m => {
    const slotMatch = selectedSlot ? (m.compatibleSlotIds || []).includes(selectedSlot.slotId) : true;
    if (!slotMatch) return false;
    if (moduleFilter === 'all') return true;
    if (moduleFilter === 'compatible') return !!m.compatible;
    const compat = (m.compatibleSlotTypes || [m.slot_type || 'utility']).map(x=>String(x).toLowerCase());
    return compat.includes(moduleFilter) || String(m.slot_type || '').toLowerCase() === moduleFilter;
  });
  const compareRows = ['hull','shield','armor','cargo_capacity','fuel_capacity','drive_speed','combat_rating','mining_efficiency','scan_strength','stealth'];
  const statHelp = h.statHelp || {};
  const shipRequirementText = (ship) => {
    const req = ship?.specialization_eligibility;
    if (!req) return '';
    if (!req.requirements?.length) return 'T1 role ship: no tree requirement';
    return req.requirements.map(r => `${label(r.tree)} ${fmt(r.havePct)}% / ${fmt(r.requiredPct)}%`).join(' + ');
  };
  return <Page title="Ships & Hangar" sub="Active ship, owned ships, ship market, modules, slots, compatibility, stats, repairs, and gameplay impact.">
    <div className="hangarHero">
      <div className="hangarHeroImage"><GameImage src="" assetType="ship" category={active.role || active.class_name || active.template_name || active.name} alt={active.name || 'Active ship'} /></div>
      <div>
        <div className="eyebrow">Active Ship</div>
        <h2>{active.name || 'No Active Ship'}</h2>
        <p>{active.class_name || active.template_name || 'Unknown class'} • {label(active.role || 'general')} • Size {active.speed_profile?.size_class || active.size_class || 'M'} • Mass {fmt(active.speed_profile?.mass || active.mass || 0)} • Map speed {fmt(active.speed_profile?.effective_map_speed || active.drive_speed || 0)} • <TierBadge item={active} /> • Insurance {activeInsurance.coveragePct ?? 15}%</p>
        <div className="tagCloud">{(activeStats.best_for || []).map(x=><span key={x}>Best: {x}</span>)}{(activeStats.weaknesses || []).map(x=><span className="dangerTag" key={x}>Weak: {x}</span>)}</div>
        <div className="hangarActions">
          <button onClick={()=>act('repair_refuel')} disabled={loading || !active.id}>Repair / Refuel / Recharge</button>
          <button onClick={()=>act('launch_starter_ship')} disabled={loading}>Launch Starter</button>
        </div>
      </div>
      <div className="hangarMeters">
        <MiniMeter label="Hull" value={active.hull} max={active.max_hull} />
        <MiniMeter label="Shield" value={active.shield} max={active.max_shield} />
        <MiniMeter label="Cargo" value={h.cargoSummary?.total} max={h.cargoSummary?.max} danger={h.cargoSummary?.pct >= 80} />
        <MiniMeter label="Fuel" value={h.fuelSummary?.value ?? state.player.fuel} max={h.fuelSummary?.max ?? state.player.max_fuel} />
      </div>
    </div>

    {!!(h.warnings || []).length && <div className="warningStack hangarWarnings">{h.warnings.map(w=><span key={w}><AlertTriangle size={14}/>{w}</span>)}</div>}

    <div className="hangarLayout">
      <Panel title="Owned Ships / Hangar Bay" help="Activating a lower-cargo ship is blocked if your cargo will not fit. Active ship controls travel, cargo, PvE, mining, combat, exploration, and smuggling modifiers.">
        <div className="chipRow">
          {['all','combat','cargo','trade','mining','exploration','salvage'].map(x=><button key={x} className={shipFilter===x?'active':''} onClick={()=>setShipFilter(x)}>{label(x)}</button>)}
        </div>
        <div className="hangarShipGrid">
          {filteredShips.map(ship => <button key={ship.id} className={`hangarShipCard ${ship.active ? 'active' : ''} ${selected.id===ship.id ? 'selected' : ''}`} onClick={()=>setSelectedShipId(ship.id)}>
            <GameImage src="" assetType="ship" category={ship.role || ship.class_name || ship.template_name || ship.name} alt={ship.name} />
            <b>{ship.name}</b>
            <span>{ship.class_name || ship.template_name} • {label(ship.role || 'ship')} • Size {ship.speed_profile?.size_class || ship.size_class || 'M'}</span>
            <small><TierBadge item={ship} /> Hull {fmt(ship.max_hull)} • Cargo {fmt(ship.derived_stats?.cargo_capacity ?? ship.cargo_capacity)} • Speed {fmt(ship.speed_profile?.effective_map_speed || ship.drive_speed)}</small>
            <small className="insuranceMini">Insurance {ship.insurance?.coveragePct ?? 15}% • Payout {fmt(ship.insurance?.estimatedPayout || 0)}</small>
            <small className={`shipReqLine ${ship.specialization_eligibility?.eligible === false ? 'blocked' : ''}`}>{shipRequirementText(ship)}</small>
            {ship.active ? <em>ACTIVE</em> : <em>{ship.activation_blocked_reason || 'READY'}</em>}
          </button>)}
        </div>
      </Panel>

      <Panel title="Selected Ship Details" help="Stat comparison shows selected ship vs active ship. Deltas help decide whether to activate or buy upgrades.">
        <div className="selectedShipDetail">
          <div className="shipDetailImage"><GameImage src="" assetType="ship" category={selected.role || selected.class_name || selected.template_name || selected.name} alt={selected.name || 'Ship'} /></div>
          <div>
            <h3>{selected.name || 'No ship selected'}</h3>
            <p>{selected.class_name || selected.template_name} • {label(selected.role || 'general')} • Size {selected.speed_profile?.size_class || selected.size_class || 'M'} • Mass {fmt(selected.speed_profile?.mass || selected.mass || 0)} • Map speed {fmt(selected.speed_profile?.effective_map_speed || selected.drive_speed || 0)} • <TierBadge item={selected} /></p>
            <div className="tagCloud">{(selectedStats.best_for || []).map(x=><span key={x}>{x}</span>)}</div>
            {shipRequirementText(selected) && <div className={`shipReqLine detail ${selected.specialization_eligibility?.eligible === false ? 'blocked' : ''}`}>{shipRequirementText(selected)}</div>}
          </div>
        </div>
        <InsuranceBox ship={selected} act={act} loading={loading} />
        <div className="statCompare">
          {compareRows.map(k=><div key={k} className="hasHoverTooltip" tabIndex={0} data-tooltip={humanHelpText(statHelp[k] || `This compares ${label(k)} on the selected ship against your active ship.`)}>
            <span>{label(k)}</span>
            <b>{fmt(selectedStats[k] ?? selected[k])}</b>
            <em className={deltaClass((selectedStats[k] ?? selected[k]) - (activeStats[k] ?? active[k]))}>{signedNumber((selectedStats[k] ?? selected[k]) - (activeStats[k] ?? active[k]))}</em>
          </div>)}
        </div>
        <div className="slotGrid">
          {(selected.slots || []).map(slot=><div key={slot.slotId} className={slot.installedItem ? 'occupied' : ''}>
            <b>{slot.slotLabel}</b><span>{label(slot.slotType)} • {label(slot.sizeLimit)}</span>
          </div>)}
          <div><b>Power</b><span>{fmt(selectedStats.module_power_used || 0)} / {fmt(selectedStats.module_power_capacity || 0)}</span></div>
        </div>
        <button onClick={()=>act('set_active_ship',{ship_id:selected.id})} disabled={loading || !selected.id || selected.active || !!selected.activation_blocked_reason}>
          {selected.active ? 'Already Active' : selected.activation_blocked_reason || 'Set Active Ship'}
        </button>
      </Panel>
    </div>

    <Panel title="Active Ship Loadout" help="Click a slot to filter storage to equipment that can fit there. Empty slots are valid; different ships have different fitting identities.">
      <div className="loadoutSummary">
        <div><b>Slots</b><span>{active.slot_summary?.occupied || activeSlots.filter(x=>x.installedItem).length} / {active.slot_summary?.total || activeSlots.length}</span></div>
        <div><b>Power</b><span>{fmt(activeStats.module_power_used || 0)} / {fmt(activeStats.module_power_capacity || 0)}</span></div>
        <div><b>Selected</b><span>{selectedSlot ? selectedSlot.slotLabel : 'None'}</span></div>
      </div>
      <div className="shipSlotGrid">
        {activeSlots.length ? activeSlots.map(slot => <button key={slot.slotId} className={`shipSlotCard ${slot.installedItem ? 'occupied' : 'empty'} ${selectedSlotId === slot.slotId ? 'selected' : ''}`} onClick={()=>setSelectedSlotId(selectedSlotId === slot.slotId ? null : slot.slotId)}>
          <div className="slotIcon">{slotIcon(slot.slotType)}</div>
          <div>
            <b>{slot.slotLabel}</b>
            <span>{label(slot.slotType)} • {label(slot.sizeLimit)}</span>
            <small>Accepts {(slot.acceptedCategories || []).map(label).join(', ')}</small>
          </div>
          {slot.installedItem ? <div className="slotInstalled"><ItemVisual item={slot.installedItem} size="sm"/><em>{slot.installedItem.name}</em></div> : <em className="slotEmpty">Empty</em>}
        </button>) : <div className="emptyState">No loadout slots found for this ship. Backend fallback should provide at least one utility slot.</div>}
      </div>
    </Panel>

    <Panel title="Installed Equipment" help="Equipped modules affect derived stats. Equipped items cannot be sold/listed/crafted until removed.">
      <div className="equipmentGrid">
        {equipped.length ? equipped.map(m=><EquipmentCard key={m.id} item={m} actionLabel="Remove" onAction={()=>act('unequip_module',{module_id:m.id})} />) : <div className="emptyState">No equipment installed on the active ship.</div>}
      </div>
    </Panel>

    <Panel title="Module Storage / Install" help={h.compatibilityInfo?.powerRule || 'Compatibility is enforced by slot, tier, power, and ownership rules.'}>
      <div className="chipRow">
        {['compatible','all',...slotTypes].map(x=><button key={x} className={moduleFilter===x?'active':''} onClick={()=>setModuleFilter(x)}>{label(x)}</button>)}
      </div>
      <div className="equipmentGrid">
        {filteredModules.length ? filteredModules.map(m=><EquipmentCard key={m.id} item={m} actionLabel="Install" blocked={(m.blocked_reasons || []).join('; ')} onAction={()=>act('equip_module',{module_id:m.id, ship_id:active.id, slot_id:selectedSlotId || (m.compatibleSlotIds || [])[0]})} />) : <div className="emptyState">No stored modules match this filter.</div>}
      </div>
    </Panel>

    <Panel title="Ship Market" help="Available ships show requirements, role, tier, price, and purchase availability. Duplicate classes are blocked for normal players.">
      <div className="shipMarketGrid">
        {availableShips.map(ship=><div className={`marketShipCard ${ship.owned ? 'owned' : ''}`} key={ship.code}>
          <GameImage src="" assetType="ship" category={ship.role || ship.class_name || ship.template_name || ship.name} alt={ship.name} />
          <div>
            <h3>{ship.name}</h3>
            <p>{ship.class_name} • {label(ship.role)} • <TierBadge item={ship} /></p>
            <Stats pairs={{Price:ship.price, Hull:ship.hull, Shield:ship.shield, Armor:ship.armor, Cargo:ship.cargo_capacity, Fuel:ship.fuel_capacity, Drive:ship.drive_speed}} />
            <div className={`shipReqLine detail ${ship.specialization_eligibility?.eligible === false ? 'blocked' : ''}`}>{shipRequirementText(ship)}</div>
            <button onClick={()=>act('buy_ship',{code:ship.code})} disabled={loading || ship.owned || !ship.can_buy}>{ship.owned ? 'Owned' : ship.blocked_reason || 'Buy Ship'}</button>
          </div>
        </div>)}
      </div>
    </Panel>
  </Page>;
}

function InsuranceBox({ship, act, loading}) {
  const ins = ship?.insurance || {};
  const options = ins.options || [];
  if (!ship?.id) return <div className="insuranceBox"><b>Insurance</b><span>No ship selected.</span></div>;
  return <div className="insuranceBox">
    <div className="insuranceHeader">
      <div>
        <b>Insurance</b>
        <span>{ins.label || 'Default Coverage'} • {ins.coveragePct ?? 15}% coverage • Estimated payout {fmt(ins.estimatedPayout || 0)}</span>
      </div>
      <div className="insuranceValue">
        <span>Insured Value</span>
        <b>{fmt(ins.shipValue || 0)}</b>
        <small>Ship {fmt(ins.marketValue || 0)} + material gold equivalent {fmt(ins.materialValue || 0)}</small>
      </div>
    </div>
    <div className="insuranceOptions">
      {options.map(opt => <button key={opt.key} className={opt.active ? 'active' : ''} disabled={loading || opt.active || !opt.buyable || ins.starterBlocked} onClick={()=>act('insure_ship',{ship_id:ship.id,tier:opt.key})}>
        <b>{opt.label}</b>
        <span>{opt.coveragePct}% payout • Cost {fmt(opt.cost || 0)}</span>
        <small>{opt.active ? 'Current policy' : `Pays ${fmt(opt.payout || 0)} credits on loss`}</small>
      </button>)}
    </div>
    <div className="guidePillLine insuranceGuide"><InfoTip label="Insurance" text="Insurance only pays credits. Cargo, modules, and salvage are not covered, and PvP losses use an anti-abuse payout multiplier." /></div>
  </div>
}

function slotIcon(type) {
  const map = {weapon:'✦', mining:'⛏', shield:'⬡', armor:'▣', engine:'➤', cargo:'▤', scanner:'⌖', stealth:'◈', utility:'◇', repair:'✚', fuel:'◌', energy:'ϟ', special:'◆'};
  return map[type] || '◇';
}

function ScanBlipIcon({type}) {
  const key = String(type || 'contact').toLowerCase();
  const Icon = key.includes('hostile') ? Crosshair
    : key.includes('ship') ? Rocket
    : key.includes('ore') ? Hammer
    : key.includes('salvage') ? Package
    : key.includes('station') || key.includes('base') ? Building2
    : key.includes('event') ? CalendarDays
    : key.includes('exploration') || key.includes('signal') ? Search
    : Shield;
  return <Icon size={18} strokeWidth={2.4} />;
}

function MiniMeter({label,value,max,danger}) {
  const pct = Math.max(0, Math.min(100, (Number(value || 0) / Math.max(1, Number(max || 1))) * 100));
  return <div className={`miniMeter ${danger ? 'danger' : ''}`}><span>{label}</span><Progress value={pct} danger={danger}/><b>{fmt(value)} / {fmt(max)}</b></div>
}

function EquipmentCard({item, actionLabel, onAction, blocked}) {
  const stats = item.stats || item.stat_preview || {};
  return <div className={`equipmentCard ${blocked ? 'blocked' : ''}`}>
    <ItemVisual item={item} size="lg" />
    <div>
      <h3>{item.name}</h3>
      <p>{label(item.equipmentType || item.slot_type || item.category)} • <TierBadge item={item} /> <span className="rarityBadge">{label(item.rarity || 'common')}</span></p>
      <div className="moduleStats">{Object.entries(stats).slice(0,5).map(([k,v])=><span key={k}>{label(k)} {signedNumber(v)}</span>)}</div>
      <small>Power {fmt(item.power_usage || 0)} • Size {label(item.sizeClass || 'light')} • Fits {(item.compatibleSlotTypes || [item.slot_type]).map(label).join(', ')} • Durability {fmt(item.durability ?? 100)}%</small>
      {blocked && <em className="blockedReason">{blocked}</em>}
    </div>
    <button onClick={onAction} disabled={!!blocked}>{blocked || actionLabel}</button>
  </div>
}

function signedNumber(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x) || x === 0) return '0';
  return `${x > 0 ? '+' : ''}${Number.isInteger(x) ? x : x.toFixed(2)}`;
}

function deltaClass(n) {
  const x = Number(n || 0);
  return x > 0 ? 'positive' : x < 0 ? 'negative' : '';
}

function eventMeta(e) {
  if (!e?.meta_json) return e?.meta || {};
  try { return typeof e.meta_json === 'string' ? JSON.parse(e.meta_json) : e.meta_json; } catch { return {}; }
}

const FORUM_BOARDS = [
  {key:'general', label:'General', deck:'Game talk, notices, help, and server chatter.'},
  {key:'off-topic', label:'Off Topic', deck:'Everything that does not need a flight plan.'},
];

function forumSeed() {
  const now = Date.now();
  return [
    {
      id:'seed-bug-bounty',
      board:'general',
      title:'Bug Bounty',
      author:'Nova Ops',
      role:'Admin',
      createdAt:new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
      lastActivity:new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      pinned:true,
      locked:false,
      complete:false,
      votes:5,
      views:91,
      tags:['bugs','rewards'],
      body:'Post reproducible bugs here with steps, screenshots, and your pilot name. Confirmed reports earn credits and forum rep.',
      replies:[
        {id:'seed-r1', author:'Josh', role:'Pilot', createdAt:new Date(now - 4 * 60 * 60 * 1000).toISOString(), body:'Found a market display edge case after selling a full cargo hold. Adding notes tonight.', votes:1},
      ],
    },
    {
      id:'seed-dice',
      board:'general',
      title:'Nova Dice Game (Intro)',
      author:'Jamie',
      role:'Moderator',
      createdAt:new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
      lastActivity:new Date(now - 30 * 60 * 1000).toISOString(),
      pinned:true,
      locked:false,
      complete:false,
      votes:4,
      views:74,
      tags:['event','casino'],
      body:'A lightweight forum dice game for station downtime. Reply with your wager and a number from 1-6.',
      replies:[],
    },
    {
      id:'seed-welcome',
      board:'general',
      title:'Welcome to Nova Frontiers Forums',
      author:'Josh',
      role:'Admin',
      createdAt:new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
      lastActivity:new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      pinned:true,
      locked:false,
      complete:false,
      votes:3,
      views:43,
      tags:['welcome'],
      body:'Use General for mechanics, trades, crews, questions, and server announcements. Keep spoilers marked and keep faction salt readable.',
      replies:[],
    },
    {
      id:'seed-complete',
      board:'general',
      title:'Nova Frontiers Dice',
      author:'Jamie',
      role:'Moderator',
      createdAt:new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
      lastActivity:new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
      pinned:false,
      locked:true,
      complete:true,
      votes:0,
      views:147,
      tags:['complete'],
      body:'The first dice event has paid out. Archive kept for results and receipts.',
      replies:[
        {id:'seed-r2', author:'Nova Ops', role:'Admin', createdAt:new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(), body:'Complete. Payouts delivered.', votes:2},
      ],
    },
    {
      id:'seed-update',
      board:'general',
      title:'Update 1.1.7',
      author:'Mr_Wednesday',
      role:'Developer',
      createdAt:new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
      lastActivity:new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
      pinned:false,
      locked:false,
      complete:false,
      votes:2,
      views:62,
      tags:['patch'],
      body:'Patch thread for balance notes, small UI fixes, and reports from live testing.',
      replies:[
        {id:'seed-r3', author:'Reclaimer', role:'Pilot', createdAt:new Date(now - 13 * 24 * 60 * 60 * 1000).toISOString(), body:'The new hangar detail view is much easier to scan.', votes:1},
        {id:'seed-r4', author:'Varn Relay', role:'Pilot', createdAt:new Date(now - 12 * 24 * 60 * 60 * 1000).toISOString(), body:'Fuel warnings are showing up correctly on my route now.', votes:1},
        {id:'seed-r5', author:'Kite', role:'Pilot', createdAt:new Date(now - 11 * 24 * 60 * 60 * 1000).toISOString(), body:'Can confirm the repair timer looks fixed.', votes:0},
        {id:'seed-r6', author:'Mira', role:'Pilot', createdAt:new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(), body:'Market restock feels steadier.', votes:0},
        {id:'seed-r7', author:'Ash', role:'Pilot', createdAt:new Date(now - 9 * 24 * 60 * 60 * 1000).toISOString(), body:'No regression on cargo listings here.', votes:0},
        {id:'seed-r8', author:'Mr_Wednesday', role:'Developer', createdAt:new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(), body:'Thanks, keeping this open for one more pass.', votes:1},
      ],
    },
    {
      id:'seed-off-topic',
      board:'off-topic',
      title:'Station Lounge',
      author:'Helios Courier',
      role:'Pilot',
      createdAt:new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      lastActivity:new Date(now - 90 * 60 * 1000).toISOString(),
      pinned:false,
      locked:false,
      complete:false,
      votes:1,
      views:28,
      tags:['lounge'],
      body:'Off-duty chatter goes here. Screenshots, builds, music, victory laps, and mild nonsense.',
      replies:[],
    },
  ];
}

function loadForumThreads() {
  if (typeof window === 'undefined') return forumSeed();
  try {
    const parsed = JSON.parse(localStorage.getItem('nova_forum_threads') || 'null');
    return Array.isArray(parsed) && parsed.length ? parsed : forumSeed();
  } catch {
    return forumSeed();
  }
}

function forumTimeAgo(value) {
  const ms = Date.now() - new Date(value || Date.now()).getTime();
  const min = Math.max(1, Math.floor(ms / 60000));
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 14) return `${day} day${day === 1 ? '' : 's'} ago`;
  const wk = Math.floor(day / 7);
  return `${wk} week${wk === 1 ? '' : 's'} ago`;
}

function Forum({state}) {
  const isAdmin = !!state.user?.god_mode || String(state.user?.role || '').toLowerCase() === 'admin';
  const authorName = state.profile?.displayName || state.player?.callsign || state.user?.username || 'Pilot';
  const authorRole = isAdmin ? 'Admin' : 'Pilot';
  const [threads,setThreads] = useState(loadForumThreads);
  const [activeBoard,setActiveBoard] = useState('general');
  const [selectedThreadId,setSelectedThreadId] = useState('');
  const [query,setQuery] = useState('');
  const [sort,setSort] = useState('latest');
  const [composerOpen,setComposerOpen] = useState(false);
  const [draft,setDraft] = useState({title:'', body:'', tags:''});
  const [replyDraft,setReplyDraft] = useState('');
  const [adminTitle,setAdminTitle] = useState('');
  const selectedThread = threads.find(t => t.id === selectedThreadId) || null;

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('nova_forum_threads', JSON.stringify(threads));
  }, [threads]);

  useEffect(() => {
    if (selectedThread) setAdminTitle(selectedThread.title || '');
  }, [selectedThread?.id, selectedThread?.title]);

  const visibleThreads = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = threads.filter(t => t.board === activeBoard && (!q ||
      String(t.title || '').toLowerCase().includes(q) ||
      String(t.body || '').toLowerCase().includes(q) ||
      (t.tags || []).some(tag => String(tag).toLowerCase().includes(q))
    ));
    const sorted = [...filtered].sort((a,b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      if (sort === 'popular') return Number(b.votes || 0) - Number(a.votes || 0) || Number(b.views || 0) - Number(a.views || 0);
      if (sort === 'unanswered') return (a.replies || []).length - (b.replies || []).length || new Date(b.lastActivity) - new Date(a.lastActivity);
      return new Date(b.lastActivity || b.createdAt) - new Date(a.lastActivity || a.createdAt);
    });
    return sorted;
  }, [threads, activeBoard, query, sort]);

  const boardCounts = useMemo(() => Object.fromEntries(FORUM_BOARDS.map(board => [
    board.key,
    threads.filter(t => t.board === board.key).length,
  ])), [threads]);

  const updateThread = useCallback((id, updater) => {
    setThreads(prev => prev.map(t => t.id === id ? (typeof updater === 'function' ? updater(t) : {...t, ...updater}) : t));
  }, []);

  const openThread = (thread) => {
    setSelectedThreadId(thread.id);
    updateThread(thread.id, t => ({...t, views:Number(t.views || 0) + 1}));
  };

  const createThread = () => {
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (!title || !body) return;
    const now = new Date().toISOString();
    const tags = draft.tags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 4);
    const thread = {
      id:uid(),
      board:activeBoard,
      title,
      body,
      tags,
      author:authorName,
      role:authorRole,
      createdAt:now,
      lastActivity:now,
      pinned:false,
      locked:false,
      complete:false,
      votes:0,
      views:0,
      replies:[],
    };
    setThreads(prev => [thread, ...prev]);
    setDraft({title:'', body:'', tags:''});
    setComposerOpen(false);
    setSelectedThreadId(thread.id);
  };

  const addReply = () => {
    const body = replyDraft.trim();
    if (!selectedThread || selectedThread.locked || !body) return;
    const now = new Date().toISOString();
    updateThread(selectedThread.id, t => ({
      ...t,
      lastActivity:now,
      replies:[...(t.replies || []), {id:uid(), author:authorName, role:authorRole, createdAt:now, body, votes:0}],
    }));
    setReplyDraft('');
  };

  const voteThread = (id, delta) => updateThread(id, t => ({...t, votes:Number(t.votes || 0) + delta}));
  const voteReply = (replyId, delta) => {
    if (!selectedThread) return;
    updateThread(selectedThread.id, t => ({
      ...t,
      replies:(t.replies || []).map(r => r.id === replyId ? {...r, votes:Number(r.votes || 0) + delta} : r),
    }));
  };

  const adminDelete = (id) => {
    setThreads(prev => prev.filter(t => t.id !== id));
    if (selectedThreadId === id) setSelectedThreadId('');
  };

  const adminApplyTitle = () => {
    if (selectedThread && adminTitle.trim()) updateThread(selectedThread.id, {title:adminTitle.trim()});
  };

  return <Page title="Forum" sub="Threaded boards with replies, pinned topics, votes, search, board tabs, and admin moderation controls.">
    <div className="forumShell">
      <section className="forumMain">
        <div className="forumBoardTabs">
          {FORUM_BOARDS.map(board => <button key={board.key} className={activeBoard === board.key ? 'active' : ''} onClick={()=>{ setActiveBoard(board.key); setSelectedThreadId(''); }}>
            {board.label}<span>{fmt(boardCounts[board.key] || 0)}</span>
          </button>)}
        </div>

        {!selectedThread && <Panel title="Discussions">
          <div className="forumToolbar">
            <label className="forumSearch"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search threads" /></label>
            <select value={sort} onChange={e=>setSort(e.target.value)} aria-label="Sort forum threads">
              <option value="latest">Latest activity</option>
              <option value="popular">Most popular</option>
              <option value="unanswered">Unanswered</option>
            </select>
            <button className="primary forumNewThread" onClick={()=>setComposerOpen(v=>!v)}><Plus size={16}/>New Thread</button>
          </div>
          {composerOpen && <div className="forumComposer">
            <input value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))} placeholder="Thread title" />
            <textarea value={draft.body} onChange={e=>setDraft(d=>({...d,body:e.target.value}))} placeholder="What do you want to discuss?" />
            <input value={draft.tags} onChange={e=>setDraft(d=>({...d,tags:e.target.value}))} placeholder="Tags, comma separated" />
            <div className="forumComposerActions"><button onClick={createThread}>Post Thread</button><button onClick={()=>setComposerOpen(false)}>Cancel</button></div>
          </div>}
          <div className="forumThreadList">
            {visibleThreads.map(thread => <div key={thread.id} className={`forumThreadRow ${thread.pinned ? 'pinned' : ''} ${thread.locked ? 'locked' : ''}`}>
              <button className="forumThreadOpen" onClick={()=>openThread(thread)}>
                <span className="forumThreadIcon">{thread.pinned ? <Pin size={15}/> : thread.locked ? <Lock size={15}/> : <MessageCircle size={15}/>}</span>
                <span className="forumThreadText">
                  <b>{thread.title}{thread.complete && <em>Complete</em>}</b>
                  <small>{thread.author} - {forumTimeAgo(thread.createdAt)} - {(thread.replies || []).length} replies - <Eye size={12}/> {fmt(thread.views || 0)}</small>
                </span>
                <span className="forumScore"><ArrowUp size={13}/>{signed(thread.votes || 0)}</span>
              </button>
              {isAdmin && <div className="forumInlineAdmin">
                <button onClick={()=>updateThread(thread.id, t => ({...t, pinned:!t.pinned}))}>{thread.pinned ? 'Unpin' : 'Pin'}</button>
                <button onClick={()=>updateThread(thread.id, t => ({...t, locked:!t.locked}))}>{thread.locked ? 'Unlock' : 'Lock'}</button>
              </div>}
            </div>)}
            {!visibleThreads.length && <div className="forumEmpty">No matching threads yet.</div>}
          </div>
        </Panel>}

        {selectedThread && <Panel title={selectedThread.title}>
          <div className="forumDetailHead">
            <button onClick={()=>setSelectedThreadId('')}>Back</button>
            <div>
              <span>{selectedThread.author} - {forumTimeAgo(selectedThread.createdAt)} - {label(selectedThread.board)}</span>
              <div className="forumTagRow">
                {selectedThread.pinned && <em><Pin size={12}/>Pinned</em>}
                {selectedThread.locked && <em><Lock size={12}/>Locked</em>}
                {selectedThread.complete && <em>Complete</em>}
                {(selectedThread.tags || []).map(tag => <em key={tag}>{tag}</em>)}
              </div>
            </div>
            <div className="forumVoteBox">
              <button aria-label="Upvote thread" onClick={()=>voteThread(selectedThread.id, 1)}><ArrowUp size={15}/></button>
              <b>{signed(selectedThread.votes || 0)}</b>
              <button aria-label="Downvote thread" onClick={()=>voteThread(selectedThread.id, -1)}><ArrowDown size={15}/></button>
            </div>
          </div>
          <article className="forumPost">
            <div className="forumAuthor"><ProfileAvatar profile={state.profile} size="sm" /><b>{selectedThread.author}</b><span>{selectedThread.role || 'Pilot'}</span></div>
            <p>{selectedThread.body}</p>
          </article>
          <div className="forumReplies">
            {(selectedThread.replies || []).map(reply => <article className="forumReply" key={reply.id}>
              <div className="forumAuthor"><ProfileAvatar profile={{displayName:reply.author}} size="sm" /><b>{reply.author}</b><span>{reply.role || 'Pilot'}</span><small>{forumTimeAgo(reply.createdAt)}</small></div>
              <p>{reply.body}</p>
              <div className="forumReplyVote"><button onClick={()=>voteReply(reply.id, 1)}><ArrowUp size={13}/></button><b>{signed(reply.votes || 0)}</b><button onClick={()=>voteReply(reply.id, -1)}><ArrowDown size={13}/></button></div>
            </article>)}
          </div>
          {selectedThread.locked ? <div className="forumEmpty">This thread is locked.</div> : <div className="forumComposer replyComposer">
            <textarea value={replyDraft} onChange={e=>setReplyDraft(e.target.value)} placeholder="Write a reply" />
            <div className="forumComposerActions"><button onClick={addReply}><Send size={15}/>Reply</button></div>
          </div>}
        </Panel>}
      </section>

      <aside className="forumSide">
        <Panel title="Board Stats">
          <div className="forumStats">
            <span>Threads <b>{fmt(threads.length)}</b></span>
            <span>Replies <b>{fmt(threads.reduce((sum,t)=>sum + (t.replies || []).length, 0))}</b></span>
            <span>Pinned <b>{fmt(threads.filter(t => t.pinned).length)}</b></span>
            <span>Locked <b>{fmt(threads.filter(t => t.locked).length)}</b></span>
          </div>
        </Panel>

        {selectedThread && isAdmin && <Panel title="Admin Controls">
          <div className="forumAdminPanel">
            <label>Title<input value={adminTitle} onChange={e=>setAdminTitle(e.target.value)} /></label>
            <button onClick={adminApplyTitle}>Save Title</button>
            <label>Board<select value={selectedThread.board} onChange={e=>updateThread(selectedThread.id, {board:e.target.value})}>{FORUM_BOARDS.map(board => <option key={board.key} value={board.key}>{board.label}</option>)}</select></label>
            <button onClick={()=>updateThread(selectedThread.id, t => ({...t, pinned:!t.pinned}))}>{selectedThread.pinned ? 'Unpin Thread' : 'Pin Thread'}</button>
            <button onClick={()=>updateThread(selectedThread.id, t => ({...t, locked:!t.locked}))}>{selectedThread.locked ? 'Unlock Thread' : 'Lock Thread'}</button>
            <button onClick={()=>updateThread(selectedThread.id, t => ({...t, complete:!t.complete, locked:t.complete ? t.locked : true}))}>{selectedThread.complete ? 'Reopen Complete' : 'Mark Complete'}</button>
            <button className="dangerBtn" onClick={()=>adminDelete(selectedThread.id)}>Delete Thread</button>
          </div>
        </Panel>}

        {isAdmin && !selectedThread && <Panel title="Admin Queue">
          <div className="forumAdminQueue">
            {threads.filter(t => !t.locked).slice(0,5).map(t => <button key={t.id} onClick={()=>openThread(t)}><b>{t.title}</b><span>{fmt((t.replies || []).length)} replies - {signed(t.votes || 0)}</span></button>)}
          </div>
        </Panel>}
      </aside>
    </div>
  </Page>;
}

function Messages({state,setPage,setTradeModalId,openServerEventOnMap}) {
  const serverEventLookup = useMemo(() => {
    const events = [
      ...(state.server_events?.upcoming || []),
      ...(state.server_events?.active || []),
      ...(state.phase_expansion?.serverEvents || [])
    ];
    return new Map(events.map(e => {
      const ev = normalizeServerEvent(e);
      return [String(ev.id), ev];
    }));
  }, [state.server_events?.upcoming, state.server_events?.active, state.phase_expansion?.serverEvents]);
  const actionButton = (e) => {
    const meta = eventMeta(e);
    if (meta.action === 'party') return <button onClick={()=>setPage('Party')}>Open Party</button>;
    if (meta.action === 'trade' && meta.tradeId) return <button onClick={()=>setTradeModalId(Number(meta.tradeId))}>Open Trade</button>;
    if (meta.action === 'social' || meta.actionType === 'friend_request') return <button onClick={()=>setPage('Social')}>Open Social</button>;
    return null;
  };
  const eventMessage = (e) => {
    if (e.category !== 'server_event' || !openServerEventOnMap) return e.message;
    const meta = eventMeta(e);
    const match = String(e.message || '').match(/^Event\s+(.+?)\s+(begins in 2 hours|has started)$/i);
    if (!match) return e.message;
    const linked = serverEventLookup.get(String(meta.eventId)) || normalizeServerEvent({
      id: meta.eventId,
      event_type: meta.eventType,
      name: match[1],
      status: meta.status,
    });
    return <>
      <button type="button" className="eventNameLink" onClick={()=>openServerEventOnMap({...linked, name:match[1]})}>{match[1]}</button>
      {` ${match[2]}`}
    </>;
  };
  return <Page title="Messages" sub="Actionable messages and filtered player-relevant events.">
    <Panel title="System Events Log">
      {(state.events || []).map(e=><div className="event actionableEvent" key={e.id}><b>{e.category}</b><span>{eventMessage(e)}</span><small>{new Date(e.created_at).toLocaleString()}</small>{actionButton(e)}</div>)}
      <button onClick={()=>setPage('Chat')}>Open Chat</button>
    </Panel>
  </Page>;
}
function Leaderboards({state}) { return <Page title="Leaderboards"><Panel title="Guilds">{state.guilds.map((g,i)=><div className="itemLine" key={g.id}><b>#{i+1} {g.name}</b><span>Respect {fmt(g.respect)} • Treasury {fmt(g.treasury)}</span></div>)}</Panel><Panel title="Planet Control">{state.planets.map(p=><div className="itemLine" key={p.id}><b>{p.name}</b><span>{label(p.controller_type)} • Influence {fmt(p.player_influence || 0)} • Conflict {fmt(p.conflict_level || 0)} • {label(p.economy_type || 'balanced')}</span></div>)}</Panel></Page> }
function Admin({state,act,token}) {
  const tuning = state.game_tuning || {};
  const groups = tuning.groups || [];
  const adminConsole = state.admin_console || {actors:[], actions:[]};
  const [adminTab,setAdminTab] = useState('console');
  const [selectedKey,setSelectedKey] = useState(groups[0]?.key || 'WORLD_PROGRESSION_BALANCE');
  const selected = groups.find(g => g.key === selectedKey) || groups[0];
  const worldConfig = groups.find(g => g.key === 'WORLD_PROGRESSION_BALANCE');
  const serverConfig = groups.find(g => g.key === 'WORLD_SERVER_BALANCE');
  const missionConfig = groups.find(g => g.key === 'WORLD_MISSION_BALANCE');
  const skillsConfig = groups.find(g => g.key === 'PROGRESSION_BALANCE');
  const ecosystemConfig = groups.find(g => g.key === 'ECOSYSTEM_BALANCE');
  const economyConfig = groups.find(g => g.key === 'ECONOMY_BALANCE');
  const craftingConfig = groups.find(g => g.key === 'CRAFTING_BALANCE');
  const playerMarketConfig = groups.find(g => g.key === 'PLAYER_MARKET_BALANCE');
  const pveConfig = groups.find(g => g.key === 'PVE_BALANCE');
  const tierConfig = groups.find(g => g.key === 'TIER_BALANCE');
  const skillXpConfig = groups.find(g => g.key === 'SKILL_XP_BALANCE');
  const [draft,setDraft] = useState('');
  const [jsonError,setJsonError] = useState('');

  useEffect(() => {
    if (selected) {
      setDraft(JSON.stringify(selected.value || {}, null, 2));
      setJsonError('');
    }
  }, [selected?.key, selected?.updated_at, selected?.changed]);

  const saveConfig = async () => {
    try {
      const value = JSON.parse(draft || '{}');
      if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Top-level JSON must be an object.');
      setJsonError('');
      await act('admin_save_game_config', {key:selected.key, value});
    } catch (ex) {
      setJsonError(ex.message);
    }
  };

  const resetConfig = async () => {
    setJsonError('');
    await act('admin_reset_game_config', {key:selected.key});
  };

  const resetAll = async () => {
    setJsonError('');
    await act('admin_reset_all_game_configs', {});
  };

  const refreshAdminTables = async () => {
    await act('admin_refresh_console', {});
  };

  const saveWorldConfig = async (value) => {
    await act('admin_save_game_config', {key:'WORLD_PROGRESSION_BALANCE', value});
  };

  const saveServerConfig = async (value) => {
    await act('admin_save_game_config', {key:'WORLD_SERVER_BALANCE', value});
  };

  const saveMissionConfig = async (value) => {
    await act('admin_save_game_config', {key:'WORLD_MISSION_BALANCE', value});
  };

  const saveEconomyConfigGroup = async (key, value) => {
    await act('admin_save_game_config', {key, value});
  };

  return <Page title="Admin Game Tuning">
    <Panel title="Runtime Balance Controls" help="Godmode/dev admin only. Values persist in SQLite game_settings and apply immediately without rebuilding. Edit JSON carefully.">
      <div className="adminHeroGrid">
        <div><b>Live tuning</b><span>NPC life, radar, traffic, ticks, economy, combat, crafting, travel, cargo, and skills variables.</span></div>
        <div><b>Refresh</b><span>{fmt(tuning.client_runtime?.state_refresh_seconds || 10)}s client state polling</span></div>
        <div><b>Groups</b><span>{fmt(groups.length)} editable config groups</span></div>
      </div>
      <div className="buttonRow">
        <button onClick={()=>act('admin_godmode')}>Refresh God Mode</button>
        <button onClick={()=>act('spawn_npcs')}>Spawn NPC Bounties + Tick</button>
        <button onClick={()=>act('simulate_npc_tick')}>Force NPC Human-Sim Tick</button>
        <button onClick={()=>act('repair_refuel')}>Repair/Refuel</button>
        <button onClick={()=>act('launch_starter_ship')}>Launch Starter</button>
        <button className="dangerBtn" onClick={resetAll}>Reset All Tuning Overrides</button>
      </div>
      <div className="adminTabBar">
        <button className={adminTab==='console'?'active':''} onClick={()=>setAdminTab('console')}>Actors + Action Log</button>
        <button className={adminTab==='world'?'active':''} onClick={()=>setAdminTab('world')}>World Skills</button>
        <button className={adminTab==='server'?'active':''} onClick={()=>setAdminTab('server')}>Server World Control</button>
        <button className={adminTab==='missions'?'active':''} onClick={()=>setAdminTab('missions')}>Planet Missions</button>
        <button className={adminTab==='economy'?'active':''} onClick={()=>setAdminTab('economy')}>Economy Balance</button>
        <button className={adminTab==='security'?'active':''} onClick={()=>setAdminTab('security')}>Security</button>
        <button className={adminTab==='tuning'?'active':''} onClick={()=>setAdminTab('tuning')}>Raw Tuning JSON</button>
      </div>
    </Panel>

    {adminTab === 'console' && <AdminConsoleTables actors={adminConsole.actors || []} actions={adminConsole.actions || []} onRefresh={refreshAdminTables} />}

    {adminTab === 'world' && <AdminWorldSkillsTab
      group={worldConfig}
      onSave={saveWorldConfig}
      onApply={()=>act('admin_apply_world_skills', {})}
    />}

    {adminTab === 'server' && <AdminServerWorldControlTab
      group={serverConfig}
      onSave={saveServerConfig}
      onRun={()=>act('admin_run_world_server_check', {})}
    />}

    {adminTab === 'missions' && <AdminMissionControlTab
      group={missionConfig}
      state={state}
      onSave={saveMissionConfig}
      onApply={()=>act('admin_apply_planet_mission_balance', {})}
    />}

    {adminTab === 'economy' && <AdminEconomyBalanceTab
      state={state}
      groups={{
        PROGRESSION_BALANCE: skillsConfig,
        ECOSYSTEM_BALANCE: ecosystemConfig,
        ECONOMY_BALANCE: economyConfig,
        CRAFTING_BALANCE: craftingConfig,
        PLAYER_MARKET_BALANCE: playerMarketConfig,
        PVE_BALANCE: pveConfig,
        TIER_BALANCE: tierConfig,
        SKILL_XP_BALANCE: skillXpConfig,
        WORLD_MISSION_BALANCE: missionConfig,
      }}
      onSave={saveEconomyConfigGroup}
      onRecalc={()=>act('admin_recalculate_economy', {})}
    />}

    {adminTab === 'security' && <AdminSecurityTab state={state} token={token} />}

    {adminTab === 'tuning' && <>
      <div className="adminTuningLayout">
        <Panel title="Config Groups" help="Changed groups have a LIVE OVERRIDE badge. Defaults stay in code; overrides live in DB.">
          <div className="adminConfigList">
            {groups.map(g => <button key={g.key} className={selected?.key===g.key ? 'active' : ''} onClick={()=>setSelectedKey(g.key)}>
              <b>{g.key}</b>
              <span>{g.description}</span>
              <small>{g.changed ? `LIVE OVERRIDE • ${g.updated_by || ''}` : 'default'}</small>
            </button>)}
          </div>
        </Panel>

        <Panel title={selected?.key || 'Game Config'} help={selected?.description || 'Select a group.'}>
          {selected ? <div className="adminJsonEditor">
            <div className="adminConfigMeta">
              <span>Status <b>{selected.changed ? 'Live Override' : 'Default'}</b></span>
              <span>Updated <b>{selected.updated_at ? new Date(selected.updated_at).toLocaleString() : 'Never'}</b></span>
              <span>By <b>{selected.updated_by || 'System'}</b></span>
            </div>
            <textarea value={draft} onChange={e=>setDraft(e.target.value)} spellCheck={false} />
            {jsonError && <div className="error">{jsonError}</div>}
            <div className="buttonRow">
              <button className="primary" onClick={saveConfig}>Save JSON Override</button>
              <button onClick={()=>setDraft(JSON.stringify(selected.default || {}, null, 2))}>Load Defaults Into Editor</button>
              <button onClick={()=>setDraft(JSON.stringify(selected.value || {}, null, 2))}>Reload Current</button>
              <button className="dangerBtn" onClick={resetConfig}>Delete Override / Reset Group</button>
            </div>
            <details className="defaultConfigPreview">
              <summary>Default JSON</summary>
              <pre>{JSON.stringify(selected.default || {}, null, 2)}</pre>
            </details>
          </div> : <p>No game tuning config loaded.</p>}
        </Panel>
      </div>

      <AdminNpcSpawnTuningPanel serverGroup={serverConfig} worldGroup={worldConfig} onSaveGroup={saveEconomyConfigGroup} />

      <Panel title="NPC Life Quick Targets">
        <div className="adminHintGrid">
          <div><b>World skills</b><code>WORLD_PROGRESSION_BALANCE</code><span>Galaxy expansion, planets per galaxy, resource bands, and NPC level bands.</span></div>
          <div><b>NPC objective behavior</b><code>NPC_OBJECTIVE_BALANCE</code><span>Adjust role weights, bad/good thresholds, radar contact bonuses, and search behavior.</span></div>
          <div><b>Radar ranges</b><code>RADAR_BALANCE</code><span>Adjust base/final radar ranges, tier scaling, NPC role radar ranges.</span></div>
          <div><b>Map traffic / ore / sites</b><code>OPEN_WORLD_BALANCE</code><span>Adjust NPC traffic count, ore/site counts, map timers, open-world behavior.</span></div>
          <div><b>Server/NPC ticks</b><code>SIMULATION_BALANCE / NPC_MARKET_BALANCE</code><span>Adjust simulation cadence, market restock, NPC economy and arbitrage behavior.</span></div>
        </div>
      </Panel>

      <Panel title="Recent NPC Actions">{(state.npc_activity || []).slice(0,20).map(a=><div className="itemLine" key={a.id}><b>{label(a.action_type)}</b><span>{a.message}</span></div>)}</Panel>
      <Panel title="Local NPC Roster">{(state.npc_agents||[]).slice(0,35).map(n=><div className="itemLine" key={n.id}><b>{n.name}</b><span>{label(n.skill_code || n.role)} • Rank {n.job_rank} • Lvl {n.level} • {n.ship_class} • {n.disposition}</span></div>)}</Panel>
      <Panel title="Accounts"><code>jon / K3ri223!</code><code>cleo / i$G@y</code><code>jeff / i$G@y</code></Panel>
    </>}
  </Page>
}

function AdminSecurityTab({state, token}) {
  const initial = state.security_state || {galaxies:[], settings:{}, alerts:[]};
  const [securityState,setSecurityState] = useState(initial);
  const [draft,setDraft] = useState({...initial.settings});
  const [status,setStatus] = useState('');
  const [busy,setBusy] = useState(false);
  const playerId = state?.player?.id;

  useEffect(() => {
    setSecurityState(initial);
    setDraft({...initial.settings});
  }, [state?.security_state?.server_time, state?.security_state?.galaxies?.length]);

  const fields = [
    {key:'turrets_at_security_one', label:'Turrets at SEC 1.0', type:'int', min:0, max:24, step:1},
    {key:'patrols_at_security_one', label:'Patrols at SEC 1.0', type:'int', min:0, max:40, step:1},
    {key:'turret_respawn_min_seconds', label:'Turret respawn min seconds', type:'int', min:60, max:14400, step:60},
    {key:'turret_respawn_max_seconds', label:'Turret respawn max seconds', type:'int', min:60, max:14400, step:60},
    {key:'patrol_respawn_min_seconds', label:'Patrol respawn min seconds', type:'int', min:30, max:7200, step:30},
    {key:'patrol_respawn_max_seconds', label:'Patrol respawn max seconds', type:'int', min:30, max:7200, step:30},
    {key:'turret_escalation_quiet_seconds', label:'Turret quiet reset seconds', type:'int', min:60, max:21600, step:60},
    {key:'patrol_escalation_quiet_seconds', label:'Patrol quiet reset seconds', type:'int', min:60, max:21600, step:60},
    {key:'turret_range_multiplier', label:'Turret range multiplier', type:'float', min:0.5, max:10, step:0.25},
    {key:'max_turret_multiplier', label:'Max turret multiplier', type:'int', min:1, max:32, step:1},
    {key:'turrets_min_per_gate', label:'Min turrets per gate', type:'int', min:1, max:8, step:1},
    {key:'max_patrol_bonus', label:'Max patrol bonus', type:'int', min:0, max:24, step:1},
    {key:'zero_security_center_galaxies', label:'Zero-security center galaxies', type:'int', min:0, max:12, step:1},
  ];

  const headers = token ? {Authorization:`Bearer ${token}`} : {};
  const postSecurity = async (payload) => {
    const res = await fetch(`${API}/api/admin/security/settings`, {
      method:'POST',
      headers:{'Content-Type':'application/json', ...headers},
      body:JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    const next = await res.json();
    setSecurityState(next);
    setDraft({...next.settings});
    return next;
  };

  const refreshSecurity = async () => {
    setBusy(true);
    setStatus('');
    try {
      const suffix = playerId ? `?player_id=${encodeURIComponent(playerId)}` : '';
      const res = await fetch(`${API}/api/security/state${suffix}`, {headers});
      if (!res.ok) throw new Error(await res.text());
      const next = await res.json();
      setSecurityState(next);
      setDraft({...next.settings});
      setStatus('Security state refreshed.');
    } catch (ex) {
      setStatus(ex.message || 'Refresh failed.');
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    setBusy(true);
    setStatus('');
    try {
      const payload = {};
      fields.forEach(f => {
        const raw = draft[f.key];
        if (raw === '' || raw == null) return;
        const n = Number(raw);
        if (Number.isFinite(n)) payload[f.key] = f.type === 'float' ? n : Math.round(n);
      });
      await postSecurity(payload);
      setStatus('Security settings saved.');
    } catch (ex) {
      setStatus(ex.message || 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const setWar = async (galaxyId, active) => {
    setBusy(true);
    setStatus('');
    try {
      await postSecurity({set_war_galaxy_id:String(galaxyId), set_war_active:!!active});
      setStatus(active ? 'War flag enabled.' : 'War flag cleared.');
    } catch (ex) {
      setStatus(ex.message || 'War update failed.');
    } finally {
      setBusy(false);
    }
  };

  const galaxies = securityState.galaxies || [];
  const totalTurrets = galaxies.reduce((sum,g)=>sum + Number(g.turret_count || 0), 0);
  const totalPatrols = galaxies.reduce((sum,g)=>sum + Number(g.patrol_count || 0), 0);
  const warCount = galaxies.filter(g=>g.war_active).length;

  return <>
    <Panel title="Security Defense Grid">
      <div className="securityAdminSummary">
        <div><Shield size={18}/><b>{fmt(totalTurrets)}</b><span>Turrets online</span></div>
        <div><Crosshair size={18}/><b>{fmt(totalPatrols)}</b><span>Patrols online</span></div>
        <div><Swords size={18}/><b>{fmt(warCount)}</b><span>War-flagged galaxies</span></div>
      </div>
      <div className="securityAdminFields">
        {fields.map(f => <label key={f.key}>
          <span>{f.label}</span>
          <input type="number" min={f.min} max={f.max} step={f.step} value={draft[f.key] ?? ''} onChange={e=>setDraft(v=>({...v, [f.key]:e.target.value}))} />
        </label>)}
      </div>
      {status && <div className="adminStatusLine">{status}</div>}
      <div className="buttonRow">
        <button className="primary" disabled={busy} onClick={saveSettings}><Save size={14}/> Save Security Settings</button>
        <button disabled={busy} onClick={refreshSecurity}>Refresh Security State</button>
      </div>
    </Panel>

    <Panel title="Galaxy Security State">
      <div className="adminTableWrap securityGalaxyTableWrap">
        <table>
          <thead><tr><th>Galaxy</th><th>SEC</th><th>Owner</th><th>Turrets</th><th>Patrols</th><th>Escalation</th><th>War</th></tr></thead>
          <tbody>
            {galaxies.map(g => <tr key={g.galaxy_id}>
              <td>{g.galaxy_id}</td>
              <td>{Number(g.security_level || 0).toFixed(2)}</td>
              <td>{g.owner_faction || 'contested'}</td>
              <td>{fmt(g.turret_count)} x {fmt(g.turret_multiplier || 1)}</td>
              <td>{fmt(g.patrol_count)} +{fmt(g.patrol_bonus || 0)}</td>
              <td>{g.war_active ? 'paused by war' : 'active'}</td>
              <td><button disabled={busy} className={g.war_active ? 'dangerBtn' : ''} onClick={()=>setWar(g.galaxy_id, !g.war_active)}>{g.war_active ? 'Clear War' : 'Set War'}</button></td>
            </tr>)}
            {!galaxies.length && <tr><td colSpan="7">No security galaxies loaded.</td></tr>}
          </tbody>
        </table>
      </div>
    </Panel>
  </>;
}

function AdminWorldSkillsTab({group,onSave,onApply}) {
  const current = group?.value || group?.default || {};
  const [draft,setDraft] = useState(JSON.stringify(current, null, 2));
  const [error,setError] = useState('');
  useEffect(() => {
    setDraft(JSON.stringify(group?.value || group?.default || {}, null, 2));
    setError('');
  }, [group?.updated_at, group?.changed]);

  const parsed = useMemo(() => {
    try { return JSON.parse(draft || '{}'); } catch { return current || {}; }
  }, [draft, current]);
  const bands = parsed?.bands || [];

  const save = async () => {
    try {
      const value = JSON.parse(draft || '{}');
      setError('');
      await onSave(value);
    } catch (ex) {
      setError(ex.message);
    }
  };

  return <div className="adminConsoleStack">
    <Panel title="World Skills Control" help="Controls galaxy count, planets per galaxy, faction balance, resource tier distribution, and NPC level bands from each faction home toward center space.">
      <div className="adminHeroGrid">
        <div><b>Target planets / galaxy</b><span>{fmt(parsed.target_planets_per_galaxy || 8)}</span></div>
        <div><b>Galaxy multiplier</b><span>{fmt(parsed.target_galaxy_multiplier || 1.5)}x</span></div>
        <div><b>Faction expansion</b><span>{fmt(parsed.extra_galaxies_per_faction || 2)} extra per faction</span></div>
      </div>
      <div className="buttonRow">
        <button className="primary" onClick={save}>Save World Skills JSON</button>
        <button onClick={onApply}>Apply Expansion + Regenerate Resource Nodes</button>
        <button onClick={()=>setDraft(JSON.stringify(group?.default || {}, null, 2))}>Load Defaults</button>
      </div>
      {error && <div className="error">{error}</div>}
    </Panel>

    <Panel title="Distance Bands">
      <div className="adminTableWrap">
        <table className="adminDataTable">
          <thead><tr><th>Band</th><th>Distance From Home Toward Center</th><th>Tier Weights</th><th>NPC / Pirate Level</th></tr></thead>
          <tbody>
            {bands.map(b => <tr key={b.key || b.name}>
              <td><b>{b.name || b.key}</b><small>{b.key}</small></td>
              <td>{fmt(Math.round(Number(b.min_progress || 0)*100))}% - {fmt(Math.round(Number(b.max_progress || 0)*100))}%</td>
              <td>{Object.entries(b.tier_weights || {}).map(([k,v]) => <span className="adminTierWeight" key={k}>T{k}: {v}%</span>)}</td>
              <td>{fmt(b.npc_level_min)} - {fmt(b.npc_level_max)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </Panel>

    <Panel title="Raw World Skills JSON">
      <div className="adminJsonEditor">
        <textarea value={draft} onChange={e=>setDraft(e.target.value)} spellCheck={false} />
      </div>
    </Panel>
  </div>
}


function AdminNpcSpawnTuningPanel({serverGroup, worldGroup, onSaveGroup}) {
  const serverValue = serverGroup?.value || serverGroup?.default || {};
  const worldValue = worldGroup?.value || worldGroup?.default || {};
  const [spawnDraft,setSpawnDraft] = useState(JSON.stringify(serverValue.npc_gameplay_loop_spawn_weights || {}, null, 2));
  const [levelDraft,setLevelDraft] = useState(JSON.stringify(worldValue.per_galaxy_npc_level_ranges || {}, null, 2));
  const [error,setError] = useState('');
  useEffect(() => {
    setSpawnDraft(JSON.stringify((serverGroup?.value || serverGroup?.default || {}).npc_gameplay_loop_spawn_weights || {}, null, 2));
    setLevelDraft(JSON.stringify((worldGroup?.value || worldGroup?.default || {}).per_galaxy_npc_level_ranges || {}, null, 2));
    setError('');
  }, [serverGroup?.updated_at, serverGroup?.changed, worldGroup?.updated_at, worldGroup?.changed]);

  const saveSpawn = async () => {
    try {
      const weights = JSON.parse(spawnDraft || '{}');
      setError('');
      await onSaveGroup('WORLD_SERVER_BALANCE', {...serverValue, npc_gameplay_loop_spawn_weights:weights});
    } catch (ex) { setError(ex.message); }
  };
  const saveLevels = async () => {
    try {
      const ranges = JSON.parse(levelDraft || '{}');
      setError('');
      await onSaveGroup('WORLD_PROGRESSION_BALANCE', {...worldValue, per_galaxy_npc_level_ranges:ranges});
    } catch (ex) { setError(ex.message); }
  };

  return <Panel title="NPC Spawn Mix + Galaxy Level Ranges" help="Admin shortcut for the two knobs that matter most: gameplay-loop spawn mix and optional per-galaxy NPC level overrides.">
    <div className="adminSplitEditors">
      <div className="adminJsonEditor compactEditor">
        <b>Gameplay loop spawn weights</b>
        <span>Higher number means more spawned NPCs for that loop. Patrol counts are separate and unchanged.</span>
        <textarea value={spawnDraft} onChange={e=>setSpawnDraft(e.target.value)} spellCheck={false} />
        <button className="primary" onClick={saveSpawn}>Save Spawn Mix</button>
      </div>
      <div className="adminJsonEditor compactEditor">
        <b>Per-galaxy NPC level overrides</b>
        <span>Use galaxy code/name/id keys. Example: {`{ "helios": { "min": 1, "max": 8 } }`}</span>
        <textarea value={levelDraft} onChange={e=>setLevelDraft(e.target.value)} spellCheck={false} />
        <button className="primary" onClick={saveLevels}>Save Level Ranges</button>
      </div>
    </div>
    {error && <div className="error">{error}</div>}
  </Panel>;
}

const MISSION_SCENE_VARIANTS = {
  survey: [
    ['Aqua Ridge', 'Clear scans over blue atmospheric shelves.', '#7fd8ff', '#4f95d2', '#274872', '#2d243a', '#64f4ff'],
    ['Amber Dune', 'Warm survey light with drifting dust lanes.', '#ffd08b', '#d99c62', '#705870', '#32273c', '#ffcf8b'],
    ['Crystal Shelf', 'Reflective cold shelf cut by mineral spires.', '#a8f5ff', '#76bcec', '#526eaa', '#29284c', '#a8fff3'],
    ['Emerald Canyon', 'Deep canyon route under soft green auroras.', '#92f4c9', '#4ebf9f', '#386a7b', '#232846', '#78ffc2'],
    ['Moss Mesa', 'Biology scans across mossy mesa flats.', '#b2f5a3', '#64bf82', '#436f62', '#29364a', '#b0ff85'],
    ['Pearl Marsh', 'Wetlands shimmer around quiet sensor posts.', '#d6fff3', '#85c9b6', '#59757d', '#273144', '#b6ffee'],
    ['Violet Steppe', 'Wide steppe broken by violet mineral veins.', '#d6bcff', '#8d8bd6', '#5a5d98', '#2e2948', '#c7a8ff'],
    ['Tin Grassland', 'Metallic grass ripples around survey stakes.', '#e7f7d4', '#9ebb93', '#667e72', '#2f3442', '#d4ffa1'],
    ['Copper Basin', 'Oxidized basin with low amber haze.', '#f0c36e', '#b7784d', '#665564', '#2f2535', '#ffc16c'],
    ['Blue Salt Flats', 'Flat salt crust under a pale blue horizon.', '#d8fbff', '#8ecbe4', '#7a8aa9', '#31354d', '#b9f6ff'],
    ['Spore Valley', 'Survey flags in a valley of glowing spores.', '#b7ffca', '#6cb88a', '#4c6d72', '#263248', '#9effaa'],
    ['Ruby Outcrop', 'Red outcrops with clean scanner visibility.', '#ffb0a4', '#c56d72', '#744867', '#2e253b', '#ff8a8a'],
    ['Cloudglass Plain', 'Pale plains under glassy high clouds.', '#effbff', '#9ed0e4', '#687fa4', '#2b3149', '#d8ffff'],
    ['Jade Basin', 'Jade basin route with quiet life signs.', '#b7ffd4', '#62be9e', '#47757d', '#273044', '#7fffd0'],
    ['Magenta Ravine', 'Ravine walls glow with magenta strata.', '#ffb7f2', '#bd7fc2', '#66508a', '#2d2845', '#ff9ee8'],
    ['Ivory Crater', 'Old crater floor with bright mineral dust.', '#fff1c7', '#c7ac80', '#77706d', '#302d3b', '#ffe3a2'],
    ['Azure Prairie', 'Open prairie under a rich azure sky.', '#8bdfff', '#579bd0', '#3c648c', '#25304b', '#74e6ff'],
    ['Lichen Shelf', 'Slow-growing lichen carpets a high shelf.', '#cbffaa', '#7abe75', '#557166', '#283244', '#c2ff74'],
    ['Glassgrass Vale', 'Translucent grass throws thin scanner echoes.', '#c7fffa', '#86c9c6', '#5a7f8b', '#283245', '#9effee'],
    ['Silver Fen', 'Silver reeds mark a quiet fen crossing.', '#e4f2ff', '#a8bfd3', '#6f8198', '#2c3447', '#d5f6ff'],
  ].map(([accent, subtitle, sky, horizon, mid, ground, glow], i) => ({className:`survey-v${i}`, accent, subtitle, sky, horizon, mid, ground, glow})),
  salvage: [
    ['Wreck Yard', 'Collapsed plating fields and neon scrap glints.', '#c7d1ea', '#828fb7', '#4c516a', '#291f2a', '#7df3ff'],
    ['Rust Flats', 'Industrial salvage lane under orange haze.', '#ffbe7a', '#ce7f4d', '#6a4e58', '#251d26', '#ff9d57'],
    ['Debris Trench', 'Hard-shadow trench with derelict silhouettes.', '#97c6d9', '#648fa1', '#43485b', '#261f2b', '#8ee7ff'],
    ['Relay Grave', 'Signal-torn salvage stretch with sparks overhead.', '#d0d6ff', '#7c7fb4', '#40395f', '#211d2d', '#b5a4ff'],
    ['Copper Heap', 'Old copper heaps under a smoky horizon.', '#f5b46d', '#a96c4e', '#5d4b55', '#2d211f', '#ffb35f'],
    ['Broken Array', 'Sensor pylons jut from a quiet scrap field.', '#b8d8ee', '#6e93a8', '#4c5262', '#242530', '#9dfcff'],
    ['Hull Orchard', 'Ship ribs stand like trees in dusty soil.', '#c9e0d4', '#8fa58e', '#60675f', '#282727', '#b6ffd7'],
    ['Iridescent Junkline', 'Oil-slick wreckage shines in shifting light.', '#e1c7ff', '#9784c1', '#5b5772', '#292638', '#d7a8ff'],
    ['Blackbox Hollow', 'Dark hollow marked by blinking recorders.', '#9fb7d1', '#61728c', '#45455c', '#1f1d28', '#72d7ff'],
    ['Amber Scrapyard', 'Amber fog pools around salvage tags.', '#ffd68f', '#c98b59', '#76615f', '#2d252b', '#ffc247'],
    ['Frosted Wreck', 'Ice-glazed hull plates creak in the wind.', '#d8f7ff', '#91bdd6', '#5e728f', '#252c3d', '#c0f7ff'],
    ['Wiregrass Lot', 'Cables snake through wild alien grass.', '#c1f0ab', '#89ae7d', '#65705e', '#242b2c', '#a5ff83'],
    ['Ash Hangar', 'Ash dunes bury a shattered hangar deck.', '#d0c7bd', '#8a8078', '#54515b', '#25232b', '#ffd28a'],
    ['Cobalt Scrap Run', 'Blue scrap shards line a salvage run.', '#a9daff', '#6897bd', '#485b78', '#222739', '#76d8ff'],
    ['Radar Cemetery', 'Dead radar dishes hum in the far ground.', '#b7c4d8', '#727f9c', '#4a5069', '#222431', '#a6c7ff'],
    ['Redline Depot', 'A burnt depot glows under red warning haze.', '#ff9c8a', '#b85d55', '#704254', '#291c25', '#ff6f72'],
    ['Foam Alloy Beach', 'Light alloy foam drifts across a pale shore.', '#e7f1ff', '#a9c3d5', '#6c7b8d', '#28303b', '#d8ffff'],
    ['Violet Battery Field', 'Spent battery towers leak violet light.', '#d8b7ff', '#8d70bd', '#574c7b', '#282238', '#ca91ff'],
    ['Green Circuit Bog', 'Circuit boards sink into green wetland.', '#c1ffbc', '#72ad78', '#52695f', '#242d2e', '#91ff9d'],
    ['Titan Plateaus', 'Huge armor plates form tiered plateaus.', '#bcc5d1', '#858b98', '#555765', '#24242e', '#f0f6ff'],
  ].map(([accent, subtitle, sky, horizon, mid, ground, glow], i) => ({className:`salvage-v${i}`, accent, subtitle, sky, horizon, mid, ground, glow})),
  hazard: [
    ['Storm Basin', 'Blue electric stormfront and volatile ridgelines.', '#88d4ff', '#3d9ae6', '#2f4888', '#251d3a', '#58d8ff'],
    ['Toxic Bloom', 'Green hazard fog rolling through cracked rock.', '#b9ff9b', '#5ec46f', '#355e4c', '#241f34', '#a5ff70'],
    ['Inferno Shelf', 'Lava-lit hazard shelf with hard red glare.', '#ffb787', '#ff7b59', '#863347', '#291b24', '#ff5b45'],
    ['Ion Frost', 'Frozen hazard plain rippling with ion arcs.', '#d7f1ff', '#8bc0ff', '#5667b0', '#271f3c', '#b8f3ff'],
    ['Acid Mire', 'Acid pools spit beneath low yellow clouds.', '#f2ff80', '#a7c25e', '#59684d', '#26252e', '#e9ff58'],
    ['Magnetar Dust', 'Charged dust curls around exposed ore.', '#ffb6d5', '#b470a0', '#5f4a7c', '#282138', '#ff8ed3'],
    ['Cinder Field', 'Cinders drift over cracked black ground.', '#ff9868', '#c24f45', '#66394a', '#24191f', '#ff6a3d'],
    ['Cryo Vent Path', 'White vapor vents flash-freeze the trail.', '#f0fbff', '#9ed4f2', '#6983a4', '#273044', '#d8ffff'],
    ['Static Jungle', 'Alien growth crackles with static charge.', '#b6ffb7', '#55b483', '#3f6870', '#232b3c', '#8dffb0'],
    ['Mercury Flats', 'Silver liquid veins mirror the sky.', '#e8f4ff', '#a8b8ca', '#677382', '#2d3038', '#f4ffff'],
    ['Sulfur Canyon', 'Sulfur fumes stain the canyon yellow.', '#ffe58a', '#bf9c4f', '#746148', '#2d252b', '#ffd04f'],
    ['Plasma Bog', 'Plasma bubbles break through black mud.', '#8afff4', '#4db8c3', '#3b6374', '#222939', '#63fff0'],
    ['Radiant Badlands', 'Radiation haze bends over red badlands.', '#ffcf7e', '#d36a55', '#804554', '#2a1d25', '#ffc857'],
    ['Shard Storm', 'Glass shards whip through violet weather.', '#ddc0ff', '#9680ce', '#5b5890', '#27233a', '#caa7ff'],
    ['Black Ice Run', 'Dark ice reflects brief hazard flares.', '#bceaff', '#709ac5', '#465b88', '#20243a', '#9fe7ff'],
    ['Spore Furnace', 'Fungal vents glow with hot orange spores.', '#ffc993', '#cc7c5b', '#726256', '#28232b', '#ffae63'],
    ['Grav Rift', 'Gravity bends the terrain into dark arcs.', '#b6c7ff', '#7679b6', '#4b4678', '#211f35', '#a4b4ff'],
    ['Salt Lightning', 'Lightning crawls across white salt crust.', '#f7ffe4', '#a8d4d2', '#6f86a0', '#283044', '#eaffff'],
    ['Red Fog Hollow', 'Red fog hides the lower trail.', '#ff9ca4', '#b95e73', '#694761', '#281d2d', '#ff7f8d'],
    ['Void Ash Pass', 'Cold ash falls from a blackened sky.', '#b3bfd0', '#73798b', '#4f5061', '#20202a', '#d2dbff'],
  ].map(([accent, subtitle, sky, horizon, mid, ground, glow], i) => ({className:`hazard-v${i}`, accent, subtitle, sky, horizon, mid, ground, glow})),
};

function missionHash(value='') {
  const str = String(value || '0');
  let out = 0;
  for (let i = 0; i < str.length; i += 1) out = ((out << 5) - out) + str.charCodeAt(i);
  return Math.abs(out);
}

const MISSION_PIXEL_PALETTE = {
  K:'#10131d', O:'#1e2633', W:'#f2fbff', X:'#ffffff',
  a:'#8a6d4a', b:'#5d4939', c:'#c7a26a', d:'#3e342d',
  e:'#7f8894', f:'#c8d2da', g:'#4c5968', h:'#2e3746',
  i:'#6be28f', j:'#32895a', k:'#b6ff8c', l:'#234b37',
  m:'#68d8ff', n:'#2b88b5', o:'#b7f6ff', p:'#1d4c70',
  q:'#ff8b52', r:'#9f3c36', s:'#ffc15f', t:'#55272a',
  u:'#b879ff', v:'#7141a7', y:'#f4d06f', z:'#6a4e24',
  A:'#78ffd4', B:'#159d84', C:'#314c4f', D:'#c7fff0',
  E:'#ff6fa1', F:'#8d2a54', G:'#d9ff5f', H:'#6d8f29',
  I:'#d4f0ff', J:'#7ba7d0', L:'#46325f', M:'#8e6d58',
  N:'#f2e6b0', P:'#403a32',
};

const sprite = (rows, family = 'terrain') => ({rows, family});

const MISSION_PIXEL_SPRITES = {
  rock_basalt: sprite([
    '................',
    '................',
    '......hhhh......',
    '....hhggggh.....',
    '...hggfeeggh....',
    '..hggfeeeeggh...',
    '..hgggfeegghh...',
    '.hgggggghhhh....',
    '.hggghhggghh....',
    '..hggghhhhhh....',
    '...hhhhhh.......',
    '................',
  ]),
  rock_amber: sprite([
    '................',
    '......cccc......',
    '....ccaacc......',
    '...caNNacca.....',
    '..caaNaaaac.....',
    '..caaaaccaa.....',
    '.caaacccbaa.....',
    '.cabbbbaabb.....',
    '..bbbbbbbd......',
    '................',
  ]),
  crystal_blue: sprite([
    '................',
    '.......o........',
    '......omo.......',
    '.....ommmo......',
    '....ommmno......',
    '...ommmnno......',
    '..ommmnnnp......',
    '...opnnnp.......',
    '....pppp........',
    '................',
  ]),
  crystal_violet: sprite([
    '................',
    '.......D........',
    '......uDu.......',
    '.....uDDDu......',
    '....uDDvDu......',
    '...uDDvvvu......',
    '..uDDvvvL.......',
    '...uLLL.........',
    '....LL..........',
    '................',
  ]),
  mountain_far: sprite([
    '................',
    '........f.......',
    '.......fef......',
    '......fegef.....',
    '.....fegggef....',
    '....fegggghef...',
    '...fegghggghef..',
    '..fggghhhggghef.',
    '.fggghhhhhggghef',
    'hhhhhhhhhhhhhhhh',
  ], 'large'),
  mountain_rust: sprite([
    '................',
    '.......s........',
    '......scs.......',
    '.....scccs......',
    '....sccrccs.....',
    '...sccrrcccs....',
    '..sccrrrrcccs...',
    '.sccrrtttrcccs..',
    'tttttttttttttt..',
  ], 'large'),
  grass_tuft: sprite([
    '................',
    '................',
    '................',
    '......i.........',
    '...i..ij..k.....',
    '..ij.ijj.ij.....',
    '.ijjjjjjijj.....',
    '..jjljjjjl......',
    '...l..l.l.......',
  ], 'life'),
  grass_glass: sprite([
    '................',
    '................',
    '......D.........',
    '..A...DA..o.....',
    '..AD.ADA.Ao.....',
    '.ADDDADDDDo.....',
    '..BBDBBBBD......',
    '...C..C.C.......',
  ], 'life'),
  fungus_spore: sprite([
    '................',
    '....uu....EE....',
    '...uDDu..EyyE...',
    '....BB....FF....',
    '....BB....FF....',
    '..jjBBjjFFjj....',
    '.jjjjjjjjjjj....',
    '..llllll........',
  ], 'life'),
  bug_mite: sprite([
    '................',
    '................',
    '.....GGGG.......',
    '...GHHXXHG......',
    '..GHGGHHGGH.....',
    '.l.GHHHHHG.l....',
    '..l.GG..GG.l....',
    '................',
  ], 'life'),
  bug_skitter: sprite([
    '................',
    '................',
    '....AA..AA......',
    '..AABBBBBBAA....',
    '.C.BDXXDDB.C....',
    '..CBBBBBBC......',
    '.C..B..B..C.....',
    '................',
  ], 'life'),
  alien_eye: sprite([
    '................',
    '................',
    '.....AAAA.......',
    '...AABBDDAA.....',
    '..ABBXDDXBBA....',
    '..ABBDDDDBBA....',
    '...ABBBBBBA.....',
    '.CC.AA..AA.CC...',
    '..C........C....',
  ], 'alien'),
  alien_tripod: sprite([
    '................',
    '......uuuu......',
    '....uDDXXDu.....',
    '...uDDDDDDu.....',
    '....vDDDDv......',
    '.....vDDv.......',
    '....v.v.v.......',
    '...v..v..v......',
    '..v.......v.....',
  ], 'alien'),
  explorer_suit: sprite([
    '................',
    '......XXXX......',
    '.....XmmmnX.....',
    '.....XpppnX.....',
    '......hhhh......',
    '....ffhhhhff....',
    '...fhhhmnhhhf...',
    '...fhhhmnhhhf...',
    '....hhhmnhhh....',
    '....hhhnnhhh....',
    '....ggh..hgg....',
    '...ggg....ggg...',
    '...gg......gg...',
    '................',
  ], 'pilot'),
  lava_vent: sprite([
    '................',
    '......ss........',
    '.....sXXs.......',
    '......qr........',
    '....qqrrqq......',
    '...qrrttrrq.....',
    '..qrrttttrrq....',
    '.ttttPPPPttt....',
    '................',
  ], 'hazard'),
  toxic_vent: sprite([
    '................',
    '.....GG.G.......',
    '...G..G..G......',
    '......HH........',
    '....HHHHHH......',
    '...HllHHllH.....',
    '..HllllllHHH....',
    '..llllllll......',
  ], 'hazard'),
  scrap_plate: sprite([
    '................',
    '..eeeeeeee......',
    '.egggffgge.....',
    '..eghhhgge......',
    '....eeggeeee....',
    '......eegggge...',
    '...OOO..eeeee...',
    '..O...O.........',
  ], 'scrap'),
  radar_dish: sprite([
    '................',
    '......ffff......',
    '....ffIJIff.....',
    '...fIJJJJIf.....',
    '....ffJJf.......',
    '......ff........',
    '.....eeee.......',
    '....eeggge......',
    '...eeeeeeee.....',
  ], 'scrap'),
  crater_plate: sprite([
    '................',
    '................',
    '....PPPPPP......',
    '..PPMMMMMMPP....',
    '.PMNNNNNNMMP....',
    '.PMNPPPPNMMP....',
    '..PMMMMMMP......',
    '....PPPP........',
  ]),
};

function PixelSprite({name, label: spriteLabel}) {
  const art = MISSION_PIXEL_SPRITES[name] || MISSION_PIXEL_SPRITES.rock_basalt;
  const rows = art.rows || [];
  const cells = rows.flatMap(row => row.padEnd(16, '.').slice(0, 16).split(''));
  return <span className={`pixelSprite pixelSprite-${art.family || 'terrain'}`} aria-label={spriteLabel || name} title={spriteLabel || name}>
    <span className="pixelSpriteGrid" style={{gridTemplateColumns:'repeat(16, 1fr)', gridTemplateRows:`repeat(${rows.length}, 1fr)`}}>
      {cells.map((cell, i) => <i key={i} style={{backgroundColor:cell === '.' ? 'transparent' : (MISSION_PIXEL_PALETTE[cell] || cell)}} />)}
    </span>
  </span>;
}

function MissionExplorerSprite({label: spriteLabel}) {
  return <span className="missionExplorerPixel" aria-label={spriteLabel || 'Explorer'}>
    <PixelSprite name="explorer_suit" label="Explorer suit" />
  </span>;
}

function MissionPixelBackdrop({theme}) {
  const isHazard = theme?.key === 'hazard';
  const isSalvage = theme?.key === 'salvage';
  const spriteName = isHazard ? 'crystal_violet' : isSalvage ? 'radar_dish' : 'mountain_far';
  return <div className="missionPixelBackdrop" aria-hidden="true">
    <PixelSprite name={spriteName} label={theme?.accent || 'Mission backdrop'} />
  </div>;
}

const MISSION_SCENERY_CATALOG = [
  {name:'Basalt Boulder', sprite:'rock_basalt', tags:['rock','moon','mining','lava','hazard']},
  {name:'Amber Stone', sprite:'rock_amber', tags:['rock','desert','survey','salvage']},
  {name:'Blue Crystal', sprite:'crystal_blue', tags:['crystal','ice','research','survey','mining']},
  {name:'Violet Shard', sprite:'crystal_violet', tags:['crystal','anomaly','nebula','hazard','survey']},
  {name:'Far Mountain', sprite:'mountain_far', tags:['mountain','terran','frontier','survey']},
  {name:'Rust Mountain', sprite:'mountain_rust', tags:['mountain','desert','industrial','salvage','lava']},
  {name:'Grass Tuft', sprite:'grass_tuft', tags:['grass','terran','agri','survey']},
  {name:'Glass Grass', sprite:'grass_glass', tags:['grass','ice','anomaly','research','survey']},
  {name:'Spore Cap', sprite:'fungus_spore', tags:['grass','terran','hazard','anomaly']},
  {name:'Green Mite', sprite:'bug_mite', tags:['bug','terran','agri','survey']},
  {name:'Glass Skitter', sprite:'bug_skitter', tags:['bug','ice','research','hazard']},
  {name:'Lava Vent', sprite:'lava_vent', tags:['vent','lava','military','industrial','hazard']},
  {name:'Toxic Vent', sprite:'toxic_vent', tags:['vent','hazard','anomaly','gas']},
  {name:'Scrap Plate', sprite:'scrap_plate', tags:['scrap','salvage','industrial','frontier']},
  {name:'Radar Dish', sprite:'radar_dish', tags:['scrap','salvage','research','survey']},
  {name:'Crater Plate', sprite:'crater_plate', tags:['rock','moon','frontier','mining']},
];

const MISSION_ALIEN_CATALOG = [
  {name:'Burrow Eye', sprite:'alien_eye', tags:['alien','hazard','anomaly','survey']},
  {name:'Tripod Drifter', sprite:'alien_tripod', tags:['alien','salvage','frontier','ice']},
  {name:'Glass Skitter', sprite:'bug_skitter', tags:['alien','bug','research','ice']},
  {name:'Moss Hopper', sprite:'bug_mite', tags:['alien','bug','terran','agri']},
];

function missionThemeStyle(theme) {
  return {
    '--mission-sky': theme.sky,
    '--mission-horizon': theme.horizon,
    '--mission-mid': theme.mid,
    '--mission-ground': theme.ground,
    '--mission-glow': theme.glow,
  };
}

function missionThemeFor(mission) {
  const type = String(mission?.mission_key || mission?.missionKey || 'survey').toLowerCase();
  const key = type.includes('salvage') ? 'salvage' : type.includes('hazard') ? 'hazard' : 'survey';
  const variants = MISSION_SCENE_VARIANTS[key] || MISSION_SCENE_VARIANTS.survey;
  const index = missionHash(`${mission?.id || mission?.planet_name || ''}:${mission?.planet_type || ''}:${key}`) % variants.length;
  return { key, index, ...(variants[index] || variants[0]) };
}

function missionObjectTags(mission, theme) {
  return [
    theme?.key,
    String(mission?.planet_type || '').toLowerCase(),
    String(mission?.mission_key || mission?.missionKey || '').toLowerCase(),
    String(mission?.planet_name || '').toLowerCase(),
  ].filter(Boolean);
}

function missionWeightedPool(mission, theme, catalog, fallbackTag) {
  const tags = missionObjectTags(mission, theme);
  const scored = catalog
    .map(item => {
      const score = (item.tags || []).reduce((sum, tag) => sum + (tags.some(t => t.includes(tag) || tag.includes(t)) ? 1 : 0), 0);
      return {...item, score};
    })
    .filter(item => item.score > 0);
  const direct = scored.length ? scored : catalog.filter(item => (item.tags || []).includes(fallbackTag));
  return direct.length ? direct : catalog;
}

function missionMovingObjects(mission, theme) {
  const base = missionHash(`${mission?.id || mission?.planet_name || 'mission'}:${theme?.className || 'scene'}`);
  const sceneryPool = missionWeightedPool(mission, theme, MISSION_SCENERY_CATALOG, 'rock');
  const alienPool = missionWeightedPool(mission, theme, MISSION_ALIEN_CATALOG, 'alien');
  const count = 12 + (base % 5);
  const loopSeconds = 82 + (base % 20);
  return Array.from({length:count}, (_, i) => {
    const seed = missionHash(`${base}:scene:${i}`);
    const cluster = Math.floor(i / 2);
    const alienRoll = ((seed + i * 17) % 100) < (theme?.key === 'hazard' ? 18 : 11);
    const pool = alienRoll ? alienPool : sceneryPool;
    const item = pool[(seed + i) % pool.length];
    return {
      id: `flyby-${i}-${seed}`,
      ...item,
      kind: alienRoll ? 'alien' : (item.tags?.includes('bug') ? 'life' : item.tags?.includes('scrap') ? 'scrap' : 'landscape'),
      className: `pixelFlyby-${alienRoll ? 'alien' : (item.tags?.[0] || 'terrain')}`,
      bottom: 6 + (seed % 52),
      delay: -(((cluster * (8 + (seed % 6))) + ((i % 2) * (0.45 + ((seed % 5) / 10)))) % loopSeconds),
      duration: alienRoll ? 13 + (seed % 7) : 15 + (seed % 8),
      loopSeconds,
      scale: alienRoll ? 0.72 + ((seed % 34) / 100) : 0.78 + ((seed % 58) / 100),
      drift: (seed % 19) - 9,
    };
  });
}

function missionEventFlybys(visibleLogs, mission) {
  return (visibleLogs || []).slice(-3).map((event, i) => {
    const seed = missionHash(`${mission?.id || 'mission'}:${event?.text || event?.kind || i}:${i}`);
    const kind = String(event?.kind || 'event').toLowerCase();
    const objectName = event?.sceneObjectName || event?.itemName || (kind.includes('hazard') ? 'hazard plume' : kind.includes('loot') || kind.includes('reward') ? 'supply glint' : kind.includes('xp') ? 'survey marker' : 'field signal');
    return {
      id: `event-${i}-${seed}`,
      kind,
      name: objectName,
      label: event?.resultLabel || label(kind || 'event'),
      bottom: 14 + (seed % 52),
      delay: -((seed % 90) / 10),
      duration: 14 + (seed % 7),
      scale: 0.7 + ((seed % 40) / 100),
    };
  });
}

function PlanetMissionContracts({state,act,compact=false}) {
  const pm = state.planet_missions || {};
  const contracts = pm.contracts || [];
  const active = pm.active;
  const cooldown = pm.cooldown || {};
  if (active) {
    return <div className="missionActiveMini">
      <div className="missionActiveMiniTop">
        <div>
          <b>{active.mission_name}</b>
          <span>{active.planet_name} • {clockTimeLeft(active.completes_at)} remaining</span>
        </div>
        <div className="missionMiniBadges">
          <span>{Math.round((active.progress || 0) * 100)}%</span>
          <span>Cooldown on return {fmt(active.cooldownProjectedMinutes || 0)}m</span>
        </div>
      </div>
      <Progress value={(active.progress || 0) * 100} />
    </div>;
  }
  return <div className={compact ? "missionContractList compact" : "missionContractList"}>
    {cooldown.active && <div className="missionCooldownBanner">
      <div>
        <b>Mission Cooldown Active</b>
        <span>{clockTimeLeft(cooldown.until)} remaining • {cooldown.reason || 'Failures and cancellations add to this timer.'}</span>
      </div>
      <small>{fmt(cooldown.minutesRemaining || 0)} min</small>
    </div>}
    {contracts.map(c => <div className="missionContractCard" key={c.key}>
      <div className="missionCardHeader"><b>{c.name}</b><span>{c.planetName} • {c.tierLabel || `Lvl ${fmt(c.level)}`} • {fmt(c.minutes)} min</span></div>
      <small>{c.description}</small>
      <div className="tagCloud">
        <span>Rewards roll during mission</span>
        <span>XP only on success+</span>
        <span>Diff {fmt(c.difficulty)}</span>
        {(c.tags||[]).map(t=><span key={t}>{label(t)}</span>)}
      </div>
      <button disabled={!c.canStart} onClick={()=>act('start_planet_mission',{mission_key:c.key})}>{c.canStart ? 'Start Mission' : c.blockedReason}</button>
    </div>)}
    {!contracts.length && <p className="muted">No local planet contracts available.</p>}
  </div>;
}

function MissionScreen({state,act,clock,dialogs}) {
  const mission = state.planet_missions?.active;
  if (!mission) return null;
  const progress = Math.max(0, Math.min(1, Number(mission.progress || 0)));
  const logs = mission.eventLog || [];
  const totalEvents = Number(mission.totalEventCount || logs.length || 0);
  const visibleLogs = logs;
  const theme = missionThemeFor(mission);
  const movingObjects = missionMovingObjects(mission, theme);
  const eventFlybys = missionEventFlybys(visibleLogs, mission);
  const done = mission.returnReady || mission.status === 'return_ready';
  const cancel = async () => {
    if (done) {
      act('return_to_map_after_mission', {mission_id:mission.id});
      return;
    }
    if (await dialogs.critical('You will expedite returning to your ship and leave mission rewards behind.', {
      title:'Abort Planet Mission',
      eyebrow:'Rewards will be forfeited',
      confirmLabel:'Return to Ship',
      confirmationPhrase:'ABORT',
      inputLabel:'Type ABORT to confirm'
    })) {
      act('cancel_planet_mission', {});
    }
  };
  const itemCount = (mission.rewardItems || []).reduce((a,i)=>a+Number(i.qty||0),0);
  return <Panel title={done ? "Planet Mission Complete" : "Active Planet Mission"} help={done ? "Review final action results, then return to the map." : "Your ship is docked off-map during the run. Rewards are only revealed by completed action rolls."}>
    <div className={`missionScreen ${theme.className} ${done ? 'missionDone' : ''}`}>
      <div className="missionSceneCard">
        <div className="missionSceneHeader">
          <div>
            <h2>{mission.mission_name}</h2>
            <p>{mission.planet_name} • {mission.galaxy_name} • {label(mission.planet_type)} • {theme.accent}</p>
          </div>
          <div className="missionHeaderBadges">
            <span>{done ? 'Complete' : `${Math.round(progress * 100)}% complete`}</span>
            <span>{done ? 'Ready to return' : `${clockTimeLeft(mission.completes_at)} remaining`}</span>
            <span>Cooldown so far {fmt(mission.cooldownAccruedMinutes || 0)}m</span>
          </div>
        </div>

        <div className={`missionAdventureStage ${theme.className}`} style={missionThemeStyle(theme)}>
          <div className="missionSkyGlow"></div>
          <MissionPixelBackdrop theme={theme} />
          <div className="missionSceneParallax p1"></div>
          <div className="missionSceneParallax p2"></div>
          <div className="missionSceneParallax p3"></div>
          <div className="missionGroundLine"></div>
          <div className="missionRunnerWrap">
            <MissionExplorerSprite label={state?.player?.callsign || 'Explorer'} />
            <div className="missionRunnerLabel">{state?.player?.callsign || 'Explorer'}</div>
          </div>
          {movingObjects.map(o => <div key={o.id} className={`missionFlyby missionPixelFlyby ${o.kind} ${o.className}`} style={{'--fly-bottom':`${o.bottom}%`,'--fly-delay':`${o.delay}s`,'--fly-duration':`${o.duration}s`,'--fly-loop':`${o.loopSeconds}s`,'--fly-scale':o.scale,'--fly-drift':`${o.drift}px`}}><PixelSprite name={o.sprite} label={o.name} /><small>{o.name}</small></div>)}
          {eventFlybys.map(o => <div key={o.id} className={`missionFlyby missionEventFlyby ${o.kind}`} style={{'--fly-bottom':`${o.bottom}%`,'--fly-delay':`${o.delay}s`,'--fly-duration':`${o.duration}s`,'--fly-scale':o.scale}}><i></i><small>{o.label}: {o.name}</small></div>)}
          <div className="missionStageHud">
            <span>{theme.subtitle}</span>
            <b>{done ? 'Mission complete' : 'Rewards reveal as events resolve'}</b>
          </div>
        </div>

        <div className="missionProgressShell">
          <div className="missionProgressMeta">
            <span>Mission Progress</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <Progress value={progress * 100} />
        </div>

        <div className="missionBottomGrid">
          <div className="missionSummaryStrip">
            <div className="missionSummaryCard"><b>Level</b><span>{fmt(mission.level)}</span></div>
            <div className="missionSummaryCard"><b>XP Earned</b><span>{fmt(mission.rewardXpEarned || 0)}</span></div>
            <div className="missionSummaryCard"><b>Items Found</b><span>{fmt(itemCount)}</span></div>
            <div className="missionSummaryCard"><b>{done ? 'Final Cooldown' : 'Cooldown So Far'}</b><span>{fmt(mission.cooldownAccruedMinutes || 0)} min</span></div>
          </div>
          {!!(mission.rewardItems||[]).length && <div className="tagCloud missionRewardItems">{(mission.rewardItems||[]).map(i=><span key={i.code}>{fmt(i.qty)}x {i.name}</span>)}</div>}
          <div className="missionFeedWrap">
            <div className="missionFeedHeader">
              <b>Action Result Stream</b>
              <span>{visibleLogs.length} / {totalEvents} events resolved</span>
            </div>
            <div className="missionEventFeed">
              {visibleLogs.length ? visibleLogs.map((e,i)=><div key={i} className={`missionFeedItem ${e.kind || 'event'}`}>
                <div className="missionFeedItemTop">
                  <b>{e.resultLabel || label(e.kind || 'event')}</b>
                  <span>{!!e.cooldownAddMinutes ? `+${fmt(e.cooldownAddMinutes)}m cooldown` : Number(e.rewardXp || 0) > 0 ? `+${fmt(e.rewardXp)} XP` : ''}</span>
                </div>
                <span>{e.text}</span>
                {!!(e.rewardItems||[]).length && <div className="tagCloud missionEventRewards">{(e.rewardItems||[]).map(i=><span key={i.code}>{fmt(i.qty)}x {i.name}</span>)}</div>}
              </div>) : <div className="missionFeedItem"><div className="missionFeedItemTop"><b>Deploying</b></div><span>Landing team is leaving the ship and setting up mission instruments.</span></div>}
            </div>
          </div>
        </div>

        <button className={done ? "successBtn" : "dangerBtn"} onClick={cancel}>{done ? 'Return To Map' : 'Cancel Mission / Return To Ship'}</button>
      </div>
    </div>
  </Panel>;
}


function AdminMissionControlTab({group,state,onSave,onApply}) {
  const current = group?.value || group?.default || {};
  const [draft,setDraft] = useState(JSON.stringify(current, null, 2));
  const [error,setError] = useState('');
  useEffect(() => {
    setDraft(JSON.stringify(group?.value || group?.default || {}, null, 2));
    setError('');
  }, [group?.updated_at, group?.changed]);
  const parsed = useMemo(() => { try { return JSON.parse(draft || '{}'); } catch { return current || {}; } }, [draft, current]);
  const save = async () => {
    try {
      const value = JSON.parse(draft || '{}');
      setError('');
      await onSave(value);
    } catch (ex) { setError(ex.message); }
  };
  const planets = state.planets || [];
  const stationCount = planets.filter(p=>String(p.type||'').toLowerCase().includes('station') || String(p.type||'').toLowerCase().includes('freeport')).length;
  const wildCount = planets.filter(p=>String(p.type||'').toLowerCase().includes('uninhabitable')).length;
  return <div className="adminConsoleStack">
    <Panel title="Planet / Mission Balance" help="Controls station conversion, uninhabitable planets, landed contracts, mission timers, per-planet mission XP, event logs, and rewards.">
      <div className="adminHeroGrid">
        <div><b>Stations</b><span>{fmt(Math.round(Number(parsed.station_ratio_per_galaxy || .25)*100))}% target • current {fmt(stationCount)}</span></div>
        <div><b>Uninhabitable</b><span>{fmt(Math.round(Number(parsed.uninhabitable_ratio_per_galaxy || .40)*100))}% target • current {fmt(wildCount)}</span></div>
        <div><b>Mission time</b><span>{fmt(parsed.mission_base_minutes_min || 30)}-{fmt(parsed.mission_base_minutes_max || 60)} min</span></div>
        <div><b>Scaling</b><span>+{fmt(Math.round(Number(parsed.mission_time_growth_pct_per_level || .10)*100))}% time / +{fmt(Math.round(Number(parsed.mission_reward_growth_pct_per_level || .20)*100))}% reward per level</span></div>
      </div>
      <div className="buttonRow">
        <button className="primary" onClick={save}>Save Mission JSON</button>
        <button onClick={onApply}>Apply Planet Conversion</button>
        <button onClick={()=>setDraft(JSON.stringify(group?.default || {}, null, 2))}>Load Defaults</button>
      </div>
      {error && <div className="error">{error}</div>}
    </Panel>
    <Panel title="Mission Types">
      <div className="cards3">{Object.entries(parsed.mission_types || {}).map(([k,v])=><div className="missionContractCard" key={k}><b>{v.name || label(k)}</b><span>{fmt(v.baseCredits || 0)} base cr • {fmt(v.xp || 0)} XP</span><small>{(v.tags||[]).map(label).join(' • ')}</small></div>)}</div>
    </Panel>
    <Panel title="Raw Mission JSON">
      <div className="adminJsonEditor"><textarea value={draft} onChange={e=>setDraft(e.target.value)} spellCheck={false} /></div>
    </Panel>
  </div>
}

function AdminServerWorldControlTab({group,onSave,onRun}) {
  const current = group?.value || group?.default || {};
  const [draft,setDraft] = useState(JSON.stringify(current, null, 2));
  const [error,setError] = useState('');
  useEffect(() => {
    setDraft(JSON.stringify(group?.value || group?.default || {}, null, 2));
    setError('');
  }, [group?.updated_at, group?.changed]);

  const parsed = useMemo(() => {
    try { return JSON.parse(draft || '{}'); } catch { return current || {}; }
  }, [draft, current]);

  const save = async () => {
    try {
      const value = JSON.parse(draft || '{}');
      setError('');
      await onSave(value);
    } catch (ex) {
      setError(ex.message);
    }
  };

  return <div className="adminConsoleStack">
    <Panel title="Server World Authority" help="Server-owned population/resource controller. Checks are throttled; each due pass spawns or trims one item per category per galaxy until configured ranges are met.">
      <div className="adminHeroGrid">
        <div><b>NPC check</b><span>{fmt(parsed.npc_check_min_seconds || 60)}-{fmt(parsed.npc_check_max_seconds || 120)} sec</span></div>
        <div><b>Resource check</b><span>{fmt(Math.round((parsed.resource_check_min_seconds || 900)/60))}-{fmt(Math.round((parsed.resource_check_max_seconds || 1800)/60))} min</span></div>
        <div><b>NPCs / galaxy</b><span>{fmt(parsed.npcs_per_galaxy_min || 15)}-{fmt(parsed.npcs_per_galaxy_max || 30)}</span></div>
        <div><b>Patrols / galaxy</b><span>{fmt(parsed.patrols_per_galaxy_min || 4)}-{fmt(parsed.patrols_per_galaxy_max || 6)}</span></div>
        <div><b>Patrol strength</b><span>{fmt(Math.round(Number(parsed.patrol_strength_mult || 2.0) * 100))}% of top pirate</span></div>
        <div><b>Mining nodes</b><span>{fmt(parsed.mining_nodes_per_galaxy_min || 5)}-{fmt(parsed.mining_nodes_per_galaxy_max || 15)}</span></div>
        <div><b>Exploration nodes</b><span>{fmt(parsed.exploration_nodes_per_galaxy_min || 5)}-{fmt(parsed.exploration_nodes_per_galaxy_max || 15)}</span></div>
        <div><b>Pirate bases</b><span>{fmt(parsed.pirate_bases_per_galaxy_min ?? 0)}-{fmt(parsed.pirate_bases_per_galaxy_max ?? 2)}</span></div>
        <div><b>Pirate strength</b><span>{fmt(Math.round(Number(parsed.pirate_base_strength_mult || 1.25) * 100))}% of galaxy band</span></div>
        <div><b>Mode</b><span>{parsed.enabled === false ? 'Disabled' : 'Enabled'} • server controls NPC/resources</span></div>
      </div>
      <div className="buttonRow">
        <button className="primary" onClick={save}>Save Server Control JSON</button>
        <button onClick={onRun}>Run Server Check Now</button>
        <button onClick={()=>setDraft(JSON.stringify(group?.default || {}, null, 2))}>Load Defaults</button>
      </div>
      {error && <div className="error">{error}</div>}
    </Panel>

    <Panel title="Control Rules">
      <div className="adminHintGrid">
        <div><b>NPC pass</b><code>{fmt(parsed.npc_check_min_seconds || 60)}-{fmt(parsed.npc_check_max_seconds || 120)} sec</code><span>Each galaxy rolls a target between {fmt(parsed.npcs_per_galaxy_min || 15)} and {fmt(parsed.npcs_per_galaxy_max || 30)}. If short, the server spawns one NPC. If over target, it trims one.</span></div>
        <div><b>Faction patrol pass</b><code>{fmt(parsed.patrol_check_min_seconds || 60)}-{fmt(parsed.patrol_check_max_seconds || 120)} sec</code><span>Each galaxy rolls {fmt(parsed.patrols_per_galaxy_min || 4)}-{fmt(parsed.patrols_per_galaxy_max || 6)} own-faction patrols. Missing patrols spawn one at a time, away from existing patrols, and avoid grouping while navigating.</span></div>
        <div><b>Resource pass</b><code>{fmt(Math.round((parsed.resource_check_min_seconds || 900)/60))}-{fmt(Math.round((parsed.resource_check_max_seconds || 1800)/60))} min</code><span>Each galaxy independently rolls mining, exploration, and pirate-base targets. It spawns one of each missing category per due pass.</span></div>
        <div><b>Pirate bases</b><code>{fmt(Math.round(Number(parsed.pirate_base_strength_mult || 1.25) * 100))}% strength</code><span>Base tier and defender power are derived from the galaxy skills level band, then multiplied stronger than normal local pirates.</span></div>
        <div><b>Faction patrol behavior</b><code>{fmt(Math.round(Number(parsed.patrol_strength_mult || 2.0) * 100))}% top pirate</code><span>Patrols belong to their galaxy faction, ignore same-faction traffic, attack other-faction contacts on sight, and only patrol their own galaxy.</span></div>
        <div><b>Server authority</b><code>Request-triggered throttle</code><span>The check runs during state/action processing, but each galaxy has its own next-run timestamp so normal player polling does not spam spawns.</span></div>
      </div>
    </Panel>

    <Panel title="Raw Server Control JSON">
      <div className="adminJsonEditor">
        <textarea value={draft} onChange={e=>setDraft(e.target.value)} spellCheck={false} />
      </div>
    </Panel>
  </div>
}



function AdminEconomyBalanceTab({state,groups,onSave,onRecalc}) {
  const summary = state.ecosystem_balance || {};
  const [selected,setSelected] = useState('ECOSYSTEM_BALANCE');
  const group = groups[selected];
  const [draft,setDraft] = useState('');
  const [error,setError] = useState('');
  useEffect(() => {
    setDraft(JSON.stringify(group?.value || group?.default || {}, null, 2));
    setError('');
  }, [selected, group?.updated_at, group?.changed]);

  const save = async () => {
    try {
      const value = JSON.parse(draft || '{}');
      setError('');
      await onSave(selected, value);
    } catch (ex) {
      setError(ex.message);
    }
  };

  const quickGroups = [
    ['PROGRESSION_BALANCE','Skills curve + sim'],
    ['ECOSYSTEM_BALANCE','Top-level ecosystem'],
    ['ECONOMY_BALANCE','Direct vendor / market spread'],
    ['PLAYER_MARKET_BALANCE','Auction fees'],
    ['CRAFTING_BALANCE','Crafting cost/time'],
    ['TIER_BALANCE','Tier/upgrade curve'],
    ['PVE_BALANCE','Rewards + success'],
    ['UNIVERSAL_XP_BALANCE','Universal XP tuning'],
    ['SKILL_XP_BALANCE','Deprecated skill display curve'],
    ['WORLD_MISSION_BALANCE','Planet mission rewards'],
  ];

  return <div className="adminConsoleStack">
    <Panel title="Whole Ecosystem Balance" help="The target is easy start, painful completion. These controls apply instantly through runtime config; use Recalculate Markets after price changes.">
      <div className="adminHeroGrid ecosystemHero">
        <div><b>Ships</b><span>{fmt(summary.ships?.count || 0)} templates • median {fmt(summary.ships?.median || 0)} cr • max {fmt(summary.ships?.max || 0)} cr</span></div>
        <div><b>Modules</b><span>{fmt(summary.modules?.count || 0)} templates • median {fmt(summary.modules?.median || 0)} cr • max {fmt(summary.modules?.max || 0)} cr</span></div>
        <div><b>Commodities</b><span>{fmt(summary.commodities?.count || 0)} goods • median {fmt(summary.commodities?.median || 0)} cr</span></div>
        <div><b>Vendor Floor</b><span>Raw {Math.round(Number(summary.vendorSell?.rawOre || 0)*100)}% • Item {Math.round(Number(summary.vendorSell?.defaultItem || 0)*100)}%</span></div>
        <div><b>Fees</b><span>Legal {Math.round(Number(summary.vendorSell?.legalFee || 0)*100)}% • Illegal {Math.round(Number(summary.vendorSell?.illegalFee || 0)*100)}%</span></div>
        <div><b>Goal</b><span>Market pays best, vendor pays worst, bases/ships/crafting sink credits.</span></div>
        <div><b>1000-run Sim</b><span>25% {fmt(summary.simulation?.first_quarter_days || 0)}d • 75% {fmt(summary.simulation?.third_quarter_days || 0)}d • max {fmt(summary.simulation?.median_days || 0)}d median</span></div>
      </div>
      <div className="adminHintGrid ecosystemSimGrid">
        <div><b>First Quarter</b><code>{fmt(summary.simulation?.first_quarter_days || 0)}d avg</code><span>Starter skills reaches the first quarter near the one-month target.</span></div>
        <div><b>Middle Band</b><code>{fmt(summary.simulation?.third_quarter_days || 0)}d avg</code><span>Mid game and early late game sit in the several-month band.</span></div>
        <div><b>Skills</b><code>{fmt(summary.simulation?.component_mean_days?.skills || 0)}d avg</code><span>Skill level 75-100 is the intended completion wall.</span></div>
        <div><b>Skill Ranks</b><code>{fmt(summary.simulation?.component_mean_days?.skill_ranks || 0)}d avg</code><span>All skill rank-10 paths form the long-term grind.</span></div>
        <div><b>Completion</b><code>{fmt(summary.simulation?.component_mean_days?.completion_wall || summary.simulation?.median_days || 0)}d avg</code><span>Max-everything median from the latest 1000-run report.</span></div>
        <div><b>Baseline</b><code>{fmt(summary.simulation?.active_hours_per_day || 12)}h/day</code><span>{summary.simulation?.note || 'Simulation report loaded from backend balance tooling.'}</span></div>
      </div>
      <div className="buttonRow">
        <button className="primary" onClick={save}>Save Selected Balance Group</button>
        <button onClick={onRecalc}>Recalculate Markets + Crafting</button>
        <button onClick={()=>setDraft(JSON.stringify(group?.default || {}, null, 2))}>Load Defaults</button>
        <button onClick={()=>setDraft(JSON.stringify(group?.value || {}, null, 2))}>Reload Current</button>
      </div>
      {error && <div className="error">{error}</div>}
    </Panel>

    <div className="adminTuningLayout economyTuningLayout">
      <Panel title="Balance Tabs" help="Edit one group, save it, then recalc markets if pricing changed.">
        <div className="adminConfigList">
          {quickGroups.map(([key,desc]) => <button key={key} className={selected===key?'active':''} onClick={()=>setSelected(key)}>
            <b>{key}</b>
            <span>{desc}</span>
            <small>{groups[key]?.changed ? `LIVE OVERRIDE • ${groups[key]?.updated_by || ''}` : 'default'}</small>
          </button>)}
        </div>
      </Panel>
      <Panel title={selected} help={groups[selected]?.description || 'Runtime balance JSON.'}>
        <div className="adminJsonEditor">
          <div className="adminConfigMeta">
            <span>Status <b>{groups[selected]?.changed ? 'Live Override' : 'Default'}</b></span>
            <span>Updated <b>{groups[selected]?.updated_at ? new Date(groups[selected].updated_at).toLocaleString() : 'Never'}</b></span>
            <span>By <b>{groups[selected]?.updated_by || 'System'}</b></span>
          </div>
          <textarea value={draft} onChange={e=>setDraft(e.target.value)} spellCheck={false} />
        </div>
      </Panel>
    </div>

    <Panel title="Balance Rules Applied">
      <div className="adminHintGrid">
        <div><b>Recipes</b><code>CRAFTING_BALANCE + ECOSYSTEM_BALANCE</code><span>Recipe credit cost and craft time scale upward for modules, weapons, armor, ships, and higher tiers.</span></div>
        <div><b>Crafting mats</b><code>ECOSYSTEM_BALANCE commodity/direct vendor maps</code><span>Raw mats sell low to vendors, refined mats sell better, mission-only mats sell poorly to vendors but matter in recipes.</span></div>
        <div><b>Vendor sales</b><code>direct_vendor_sell_mult_by_category</code><span>Direct selling is the emergency floor. Auction and planet markets should beat vendor dumps.</span></div>
        <div><b>Ships/modules</b><code>skills_cost_mult</code><span>Purchase prices are multiplied live at buy time so mid-game and late-game purchases remain meaningful sinks.</span></div>
        <div><b>Rewards</b><code>PVE_BALANCE / WORLD_MISSION_BALANCE</code><span>Credits are restrained; XP/materials remain useful. Planet missions avoid direct credits.</span></div>
        <div><b>XP</b><code>PROGRESSION_BALANCE + SKILL_XP_BALANCE</code><span>First quarter is quick, the middle spans months, and the final quarter is the long wall.</span></div>
      </div>
    </Panel>
  </div>
}


function AdminConsoleTables({actors=[], actions=[], onRefresh}) {
  const [actorQuery,setActorQuery] = useState('');
  const [actorType,setActorType] = useState('all');
  const [actorPage,setActorPage] = useState(1);
  const [selectedActor,setSelectedActor] = useState(null);
  const [actionQuery,setActionQuery] = useState('');
  const [actionType,setActionType] = useState('all');
  const [actionPage,setActionPage] = useState(1);
  const pageSize = 50;

  const actorTypes = useMemo(() => ['all', ...Array.from(new Set((actors || []).map(a => a.actorType).filter(Boolean))).sort()], [actors]);
  const actionTypes = useMemo(() => ['all', ...Array.from(new Set((actions || []).map(a => a.actionType).filter(Boolean))).sort()], [actions]);

  const filteredActors = useMemo(() => {
    const q = actorQuery.trim().toLowerCase();
    return (actors || []).filter(a => {
      if (actorType !== 'all' && a.actorType !== actorType) return false;
      if (!q) return true;
      return `${a.name || ''} ${a.username || ''} ${a.location || ''} ${a.galaxy || ''} ${a.currentAction || ''} ${a.status || ''} ${a.ship?.name || ''} ${a.ship?.role || ''}`.toLowerCase().includes(q);
    });
  }, [actors, actorQuery, actorType]);

  const filteredActions = useMemo(() => {
    const q = actionQuery.trim().toLowerCase();
    return (actions || []).filter(a => {
      if (actionType !== 'all' && a.actionType !== actionType) return false;
      if (!q) return true;
      return `${a.actor || ''} ${a.actionType || ''} ${a.source || ''} ${a.message || ''}`.toLowerCase().includes(q);
    });
  }, [actions, actionQuery, actionType]);

  useEffect(() => setActorPage(1), [actorQuery, actorType, actors.length]);
  useEffect(() => setActionPage(1), [actionQuery, actionType, actions.length]);

  const actorSlice = paginate(filteredActors, actorPage, pageSize);
  const actionSlice = paginate(filteredActions, actionPage, pageSize);

  return <div className="adminConsoleStack">
    <Panel title="Admin Actor Monitor" help="All players and NPCs. Page size is fixed at 50. Filters are client-side against the admin snapshot.">
      <div className="adminTableToolbar">
        <button className="primary" onClick={onRefresh}>Manual Refresh</button>
        <input value={actorQuery} onChange={e=>setActorQuery(e.target.value)} placeholder="Filter actors, locations, actions, ships..." />
        <select value={actorType} onChange={e=>setActorType(e.target.value)}>{actorTypes.map(x=><option key={x} value={x}>{label(x)}</option>)}</select>
        <span>{fmt(filteredActors.length)} actors</span>
      </div>
      <AdminPager page={actorPage} setPage={setActorPage} total={filteredActors.length} pageSize={pageSize} />
      <div className="adminTableWrap">
        <table className="adminDataTable">
          <thead><tr><th>Type</th><th>Name</th><th>Location</th><th>Current Action</th><th>Level</th><th>Ship</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {actorSlice.map(a => <tr key={a.id}>
              <td><span className={`adminTypePill ${a.actorType}`}>{label(a.actorType)}</span></td>
              <td><b>{a.name}</b><small>{a.username ? `@${a.username}` : `#${a.actorId}`}</small></td>
              <td>{a.location || '—'}<small>{a.galaxy || ''}</small></td>
              <td>{a.currentAction || '—'}</td>
              <td>{fmt(a.level)}<small>XP {fmt(a.xp || 0)}</small></td>
              <td>{a.ship?.name || '—'}<small>{label(a.ship?.role || a.ship?.className || '')} • CMB {fmt(a.ship?.combatRating || 0)}</small></td>
              <td>{a.status || '—'}</td>
              <td><button onClick={()=>setSelectedActor(a)}>Open Profile</button></td>
            </tr>)}
            {!actorSlice.length && <tr><td colSpan="8">No actors match the filter.</td></tr>}
          </tbody>
        </table>
      </div>
      <AdminPager page={actorPage} setPage={setActorPage} total={filteredActors.length} pageSize={pageSize} />
    </Panel>

    <Panel title="Global Game Action Log" help="Merged admin feed. Displays the newest 500 events from player events, NPC actions, combat, and market transactions.">
      <div className="adminTableToolbar">
        <button className="primary" onClick={onRefresh}>Manual Refresh</button>
        <input value={actionQuery} onChange={e=>setActionQuery(e.target.value)} placeholder="Filter action log..." />
        <select value={actionType} onChange={e=>setActionType(e.target.value)}>{actionTypes.map(x=><option key={x} value={x}>{label(x)}</option>)}</select>
        <span>{fmt(filteredActions.length)} actions</span>
      </div>
      <AdminPager page={actionPage} setPage={setActionPage} total={filteredActions.length} pageSize={pageSize} />
      <div className="adminTableWrap">
        <table className="adminDataTable">
          <thead><tr><th>Time</th><th>Type</th><th>Actor</th><th>Source</th><th>Message</th></tr></thead>
          <tbody>
            {actionSlice.map(a => <tr key={a.id}>
              <td>{a.createdAt ? new Date(a.createdAt).toLocaleString() : '—'}</td>
              <td><span className="adminTypePill action">{label(a.actionType)}</span></td>
              <td>{a.actor || 'System'}</td>
              <td>{label(a.source || 'event')}</td>
              <td>{a.message || '—'}</td>
            </tr>)}
            {!actionSlice.length && <tr><td colSpan="5">No actions match the filter.</td></tr>}
          </tbody>
        </table>
      </div>
      <AdminPager page={actionPage} setPage={setActionPage} total={filteredActions.length} pageSize={pageSize} />
    </Panel>

    {selectedActor && <AdminActorProfileModal actor={selectedActor} onClose={()=>setSelectedActor(null)} />}
  </div>
}

function paginate(items, page, pageSize) {
  const maxPage = Math.max(1, Math.ceil((items || []).length / pageSize));
  const safePage = Math.max(1, Math.min(maxPage, page));
  return (items || []).slice((safePage - 1) * pageSize, safePage * pageSize);
}

function AdminPager({page,setPage,total,pageSize}) {
  const maxPage = Math.max(1, Math.ceil((total || 0) / pageSize));
  const safePage = Math.max(1, Math.min(maxPage, page));
  return <div className="adminPager">
    <button disabled={safePage <= 1} onClick={()=>setPage(1)}>First</button>
    <button disabled={safePage <= 1} onClick={()=>setPage(safePage - 1)}>Prev</button>
    <span>Page {fmt(safePage)} / {fmt(maxPage)} • Show 50</span>
    <button disabled={safePage >= maxPage} onClick={()=>setPage(safePage + 1)}>Next</button>
    <button disabled={safePage >= maxPage} onClick={()=>setPage(maxPage)}>Last</button>
  </div>
}

function AdminActorProfileModal({actor,onClose}) {
  const stats = actor.stats || {};
  const ship = actor.ship || {};
  const profile = actor.profile || {};
  return <div className="modalBackdrop">
    <div className="adminActorModal panel">
      <button className="modalClose" onClick={onClose}>Close</button>
      <h2>{actor.name}</h2>
      <div className="adminProfileGrid">
        <div className="adminProfileHero">
          <GameImage src="" assetType="ship" category={ship.role || ship.className || actor.actorType} alt={ship.name || actor.name} />
          <div><b>{label(actor.actorType)} #{actor.actorId}</b><span>{actor.location || 'Unknown location'} • {actor.galaxy || 'Unknown galaxy'}</span><small>{actor.currentAction || 'Idle'}</small></div>
        </div>
        <div>
          <h3>Profile</h3>
          <Stats pairs={{
            Username: actor.username || '—',
            Role: profile.role || profile.skill || actor.actorType,
            Status: actor.status || '—',
            Level: fmt(actor.level || 0),
            XP: fmt(actor.xp || 0),
            Target: profile.target || '—',
            Disposition: profile.disposition || '—',
            MarketBias: profile.marketBias || '—'
          }} />
        </div>
        <div>
          <h3>Ship</h3>
          <Stats pairs={{
            Name: ship.name || '—',
            Class: ship.className || '—',
            Role: label(ship.role || 'ship'),
            Tier: ship.tier ? `T${ship.tier}` : '—',
            Combat: fmt(ship.combatRating || 0),
            Hull: `${fmt(ship.hull || 0)} / ${fmt(ship.maxHull || ship.hull || 0)}`,
            Shield: `${fmt(ship.shield || 0)} / ${fmt(ship.maxShield || ship.shield || 0)}`,
            Armor: fmt(ship.armor || 0)
          }} />
        </div>
        <div>
          <h3>Stats</h3>
          <Stats pairs={{
            Credits: fmt(stats.credits || 0),
            Fuel: stats.maxFuel ? `${fmt(stats.fuel || 0)} / ${fmt(stats.maxFuel)}` : fmt(stats.fuel || 0),
            Cargo: stats.maxCargo ? `${fmt(stats.cargo || 0)} / ${fmt(stats.maxCargo)}` : fmt(stats.cargo || 0),
            Health: stats.maxHealth ? `${fmt(stats.health || 0)} / ${fmt(stats.maxHealth)}` : fmt(stats.health || 0),
            Heat: fmt(stats.heat || 0),
            Power: fmt(stats.power || 0),
            Aggression: fmt(stats.aggression || 0)
          }} />
        </div>
      </div>
      {stats.skills && <details className="defaultConfigPreview" open>
        <summary>NPC Skills JSON</summary>
        <pre>{JSON.stringify(stats.skills, null, 2)}</pre>
      </details>}
    </div>
  </div>
}



function CargoOperationPanel({state, act}) {
  const c = state.cargo_operation || {};
  if (!c.active) return null;
  return <Panel title="Cargo Handling In Progress" help="Market cargo loading/offloading is not instant. You cannot travel, change ships, fight, or start another cargo operation until it completes. During loading/offloading you are protected from attacks.">
    <div className="cargoOperationPanel">
      <div><b>{label(c.operationLabel || c.operationType || 'handling')}</b><span>{fmt(c.qty)}x {c.summary} • mass {fmt(c.mass)}</span><small>{c.message}</small></div>
      <div><b>{clockTimeLeft(c.completeAt)}</b><span>{fmt(c.progress)}% complete</span><Progress value={c.progress || 0}/></div>
      <div className="protectionBadge"><Shield size={16}/> <span>Protected while dock crews handle cargo</span>{c.canCancel && <button className="dangerBtn" onClick={()=>act && act('cancel_cargo_operation', {operation_id:c.id})}>Cancel Cargo Handling</button>}</div>
    </div>
  </Panel>;
}

function TravelStatus({state, clock}) {
  const t = state.travel_state || {};
  if (!t.active && t.open_space) return null;
  if (!t.active) return <Panel title="Docking Status"><div className="travelIdle"><b>Docked at {state.location?.name}</b><span>{state.location?.galaxy_name} • market, crafting, repairs, hangar, jobs, and local services are available only while docked.</span></div></Panel>;
  const isGateJump = t.gate_jump_status === 'initiated' || t.mode === 'galaxy_route';
  const routeTitle = isGateJump ? (t.route_auto_path ? 'Auto Gate Jump Initiated' : 'Gate Jump Initiated') : `${label(t.mode)} Route`;
  const routeLabel = t.route_label || `${t.origin_planet_name || t.origin_galaxy_name} -> ${t.destination_planet_name || t.destination_galaxy_name}`;
  const gateTimerLabel = compactDuration(t.gate_jump_seconds || (t.route_auto_path ? 10 : 3));
  return <Panel title="Active Travel">
    <div className="travelStatusGrid">
      <div><b>{routeTitle}</b><span>{routeLabel}</span></div>
      <div><b>{Math.max(0, Math.round(travelProgress(t, clock) * 100))}%</b><span>{clockTimeLeft(t.arrival_at)} remaining</span></div>
      <div><b>{compactDuration(t.elapsed_seconds)} / {compactDuration(t.total_seconds)}</b><span>{isGateJump ? `${gateTimerLabel} gate timer` : 'Backend timestamp timer'}</span></div>
    </div>
    <Progress value={travelProgress(t, clock) * 100} />
  </Panel>;
}


function PirateStation({state,act,clock,setPage}) {
  const ps = state.active_pirate_station;
  if (!ps) {
    return <Page title="Pirate Station" sub="No active station assault. Enter one from the System Map.">
      <Panel title="No Active Assault">
        <div className="guidePillLine"><InfoTip label="How it works" text="Pirate stations open a separate map. Pirates stay defeated after escape, and clearing the last pirate removes the station." /></div>
        <button onClick={()=>setPage('Map')}>Return to System Map</button>
      </Panel>
    </Page>;
  }

  const battle = ps.battle || {};
  const target = battle.target || {};
  const report = battle.report || {};
  const enemies = ps.enemies || [];
  const activeEnemies = enemies.filter(e => e.status === 'active' && Number(e.hull || 0) > 0);
  const players = ps.players || [];
  const player = ps.player || {};
  const balance = ps.balance || {};
  const edge = Number(balance.escape_edge_pct || 4);
  const move = (dx,dy)=>act('pirate_station_move',{dx,dy});
  const startBattle = (enemy)=>act('pirate_station_start_battle',{enemy_id:enemy.id});
  const nearest = [...activeEnemies].sort((a,b)=>(a.distancePct||99)-(b.distancePct||99))[0];

  return <Page title={ps.station?.name || 'Pirate Station'} sub="Pirate station map. Reach the outer 10% escape zone to return to the system map.">
    <div className="pirateStationLayout">
      <Panel title="Station Assault Status" help="The station resource is the shared defender pool. Defeated enemies stay defeated. Damaged enemies keep their damage for everyone in the station.">
        <div className="stationStatusHead">
          <GameImage src={ps.station?.image_url} assetType="station" category={`pirate base tier ${ps.station?.tier || 2}`} alt={ps.station?.name || 'Pirate base'} />
          <div>
            <b>{ps.station?.name}</b>
            <span>Tier T{fmt(ps.station?.tier)} - Difficulty {fmt(ps.station?.difficulty)} - {fmt(ps.remaining)} / {fmt(ps.total)} defenders - doubled station strength</span>
            <Progress value={ps.resourcePct || 0} danger={(ps.resourcePct || 0) > 60}/>
          </div>
        </div>
        <div className="mapMetaGrid">
          <span>Station Resource <b>{fmt(ps.resourcePct)}%</b></span>
          <span>Your X/Y <b>{fmt(player.x_pct)} / {fmt(player.y_pct)}</b></span>
          <span>Nearest Pirate <b>{nearest ? `${fmt(nearest.distancePct)}%` : 'clear'}</b></span>
          <span>Escape Edge <b>{player.escapeReady ? 'ready' : `${fmt(edge)}% border`}</b></span>
          <span>Pilots Inside <b>{fmt(ps.activePlayerCount)}</b></span>
        </div>
        <div className="buttonRow">
          <button onClick={()=>move(0,-1)}>Move Up</button>
          <button onClick={()=>move(-1,0)}>Move Left</button>
          <button onClick={()=>move(1,0)}>Move Right</button>
          <button onClick={()=>move(0,1)}>Move Down</button>
          <button className="dangerBtn" disabled={!player.escapeReady} onClick={()=>act('pirate_station_retreat')}>Retreat At Edge</button>
        </div>
        <div className="mapWarningLine">Defeated pirates stay defeated after escape. The station vanishes when the last pirate is destroyed.</div>
      </Panel>

      <Panel title="Station Map" help="This is a separate combat map. Pirates spawn spaced out and slowly converge on the closest pilot. Reach the outer 10% border to retreat.">
        <div className="pirateArena" style={{'--escape-edge': `${edge}%`}}>
          <div className="escapeBand top"/><div className="escapeBand bottom"/><div className="escapeBand left"/><div className="escapeBand right"/>
          <div className="escapeSlashLayer">{Array.from({length:28}).map((_,i)=><span key={i} style={{left:`${(i % 7) * 16}%`, top:`${Math.floor(i / 7) * 24}%`}}>ESCAPE</span>)}</div>
          {players.map(p=><button key={p.player_id} className={`arenaPlayer hasHoverTooltip ${p.self ? 'self' : 'ally'}`} style={{left:`${p.x_pct}%`, top:`${p.y_pct}%`}} data-tooltip={p.self ? 'Your ship. Reach the outer edge if you need to retreat.' : `${p.name}: allied pilot inside the station.`}>{p.self ? 'YOU' : 'P'}</button>)}
          {enemies.map(e=><button key={e.id} className={`arenaEnemy hasHoverTooltip ${e.status !== 'active' ? 'defeated' : ''} ${battle.target?.id === e.id ? 'engaged' : ''} ${e.targetingSelf ? 'targetingSelf' : ''}`} style={{left:`${e.x_pct}%`, top:`${e.y_pct}%`}} data-tooltip={`${e.name}: ${e.status}. ${e.targetPlayerName ? `Targeting ${e.targetPlayerName}.` : 'Not locked onto anyone yet.'}`}>
            <GameImage src={e.image_url} assetType="ship" category="pirate combat" alt={e.name}/>
            <em>{e.status === 'active' ? `T${e.tier}` : 'X'}</em>
          </button>)}
        </div>
      </Panel>

      <Panel title="Pilots Inside">
        <div className="stationPilotList">
          {players.map(p=><div key={p.player_id} className={`stationPilot ${p.self ? 'self' : ''}`}><b>{p.self ? 'You' : p.name}</b><span>{fmt(p.x_pct)} / {fmt(p.y_pct)}</span></div>)}
        </div>
      </Panel>

      <Panel title="Pirate Defenders">
        <div className="stationEnemyList">
          {enemies.map(e=><div key={e.id} className={`stationEnemy ${e.status !== 'active' ? 'defeated' : ''} ${e.targetingSelf ? 'targetingSelf' : ''}`}>
            <GameImage src={e.image_url} assetType="ship" category="pirate combat" alt={e.name}/>
            <div>
              <b>{e.name}</b>
              <span>{label(e.status)} • T{fmt(e.tier)} • Power {fmt(e.power)} • Distance {fmt(e.distancePct)}%</span>
              <small>Hull {fmt(e.hull)} / {fmt(e.max_hull)} • Shield {fmt(e.shield)} / {fmt(e.max_shield)} • Target {e.targetPlayerName || 'none'}</small>
              <Progress value={e.hullPct || 0} danger={e.status === 'active'}/>
            </div>
            {e.status === 'active' && <button onClick={()=>startBattle(e)}>Engage</button>}
          </div>)}
        </div>
      </Panel>
    </div>

    {battle.open && <div className="stationBattleOverlay nonBlocking">
      <div className="stationBattleModal">
        <div className="battleHeader">
          <GameImage src={target.image_url} assetType="ship" category="pirate combat" alt={target.name || 'Pirate'} />
          <div>
            <h2>{target.name || 'Pirate Attack'}</h2>
            <div className="guidePillLine"><InfoTip label="Battle pressure" text="This panel does not pause the assault. Pirates keep drifting toward the closest pilot while you fight." /></div>
          </div>
        </div>
        {!report.message ? <div className="battleActions">
          <Stats pairs={{EnemyPower:target.power, EnemyTier:target.tier, EnemyHull:target.hull, EnemyShield:target.shield}} />
          <button className="dangerBtn" onClick={()=>act('pirate_station_resolve_battle')}>Resolve Battle</button>
        </div> : <div className="battleReport">
          <h3>{report.message}</h3>
          <Stats pairs={{Outcome:label(report.outcome), Remaining:report.remaining, Credits:report.rewards?.credits || 0, XP:report.rewards?.xp || 0, Hull:report.playerHull, Shield:report.playerShield}} />
          <div className="combatLog">{(report.log || []).map((l,i)=><div key={i}><b>R{l.round} {label(l.actor)}</b><span>{l.text}</span></div>)}</div>
          <button onClick={()=>act('pirate_station_close_battle')}>{Number(report.remaining || 0) <= 0 ? 'Close: Station Cleared' : 'Close Battle Panel'}</button>
        </div>}
      </div>
    </div>}
  </Page>;
}

const ADMIN_SPAWN_OPTIONS = [
  {key:'ore', label:'Mine Node', detail:'Ore resource signature', qty:1, scale:'resourceTier'},
  {key:'salvage', label:'Salvage Wreck', detail:'Recoverable ship debris', qty:1, scale:'salvageTier'},
  {key:'exploration', label:'Ancient Site', detail:'Scannable exploration contact', qty:1, scale:'resourceTier'},
  {key:'npc', label:'NPC Traffic', detail:'Civilian or utility ship', qty:1, scale:'npcLevel'},
  {key:'pirate', label:'Pirate Ship', detail:'Hostile open-space contact', qty:1, scale:'npcLevel'},
  {key:'patrol', label:'Security Patrol', detail:'Lawful defense ship', qty:1, scale:'npcLevel'},
  {key:'pirate_station', label:'Pirate Station', detail:'Assault site with defenders', qty:1, scale:'pirateStationTier'},
];

const numberRange = (min, max) => {
  const lo = Math.max(1, Math.floor(Number(min) || 1));
  const hi = Math.max(lo, Math.floor(Number(max) || lo));
  return Array.from({length:Math.min(hi - lo + 1, 120)}, (_, i) => lo + i);
};
const cleanNumberList = (values, fallback=[1]) => {
  const out = [...new Set((Array.isArray(values) ? values : []).map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0).map(v => Math.floor(v)))].sort((a,b)=>a-b);
  return out.length ? out : fallback;
};
const adminSpawnScaleOptions = (option, constraints={}) => {
  if (option.scale === 'npcLevel') return numberRange(constraints.npcLevelMin || 1, constraints.npcLevelMax || 10);
  if (option.scale === 'resourceTier') return cleanNumberList(constraints.resourceTiers, [1]);
  if (option.scale === 'salvageTier') return cleanNumberList(constraints.salvageTiers, cleanNumberList(constraints.resourceTiers, [1]));
  if (option.scale === 'pirateStationTier') return cleanNumberList(constraints.pirateStationTiers, [1]);
  return [1];
};
const defaultAdminSpawnScale = (option, constraints={}) => {
  const options = adminSpawnScaleOptions(option, constraints);
  const fallback = options[Math.floor(options.length / 2)] || 1;
  const preferred = option.scale === 'npcLevel'
    ? constraints.defaultNpcLevel
    : option.scale === 'resourceTier'
      ? constraints.defaultResourceTier
      : option.scale === 'salvageTier'
        ? constraints.defaultSalvageTier
        : option.scale === 'pirateStationTier'
          ? constraints.defaultPirateStationTier
          : fallback;
  const n = Math.floor(Number(preferred));
  return options.includes(n) ? n : fallback;
};
const adminSpawnScaleLabel = (option, value) => option.scale === 'npcLevel' ? `Lv ${value}` : `T${value}`;

function AdminSpawnModal({context, onSpawn, onClose}) {
  const constraints = context.adminSpawnConstraints || context.admin_spawn_constraints || {};
  const [selected,setSelected] = useState(new Set(['ore']));
  const [counts,setCounts] = useState(Object.fromEntries(ADMIN_SPAWN_OPTIONS.map(o => [o.key, o.qty])));
  const [scales,setScales] = useState(Object.fromEntries(ADMIN_SPAWN_OPTIONS.map(o => [o.key, defaultAdminSpawnScale(o, constraints)])));
  const [submitting,setSubmitting] = useState(false);
  const toggle = (key) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  const setQty = (key, value) => setCounts(prev => ({...prev, [key]:Math.max(1, Math.min(25, Number(value) || 1))}));
  const scaleValue = (option) => {
    const options = adminSpawnScaleOptions(option, constraints);
    const current = Math.floor(Number(scales[option.key]));
    return options.includes(current) ? current : defaultAdminSpawnScale(option, constraints);
  };
  const setScale = (key, value) => setScales(prev => ({...prev, [key]:Number(value) || 1}));
  const spawns = ADMIN_SPAWN_OPTIONS
    .filter(o => selected.has(o.key))
    .map(o => {
      const item = {kind:o.key, qty:Math.max(1, Math.min(25, Number(counts[o.key]) || 1))};
      if (o.scale === 'npcLevel') item.level = scaleValue(o);
      else if (o.scale) item.tier = scaleValue(o);
      return item;
    });
  const total = spawns.reduce((sum, item) => sum + item.qty, 0);
  const submit = async (e) => {
    e.preventDefault();
    if (!spawns.length || !onSpawn || submitting) return;
    setSubmitting(true);
    const result = await onSpawn({map_type:context.map_type || 'system', x_pct:context.x_pct, y_pct:context.y_pct, spawns});
    setSubmitting(false);
    if (result) onClose();
  };
  return <div className="profileModalBackdrop adminSpawnBackdrop" onMouseDown={onClose}>
    <form className="adminSpawnModal publicProfileModal" onMouseDown={e=>e.stopPropagation()} onSubmit={submit}>
      <button type="button" className="modalX" onClick={onClose}>×</button>
      <div className="adminSpawnHeader">
        <div>
          <h2>Spawn Map Objects</h2>
          <span>{Number(context.x_pct || 50).toFixed(1)} / {Number(context.y_pct || 50).toFixed(1)} {constraints.bandName ? `• ${constraints.bandName}` : ''}</span>
        </div>
        <b>{fmt(total)} queued</b>
      </div>
      <div className="adminSpawnGrid">
        {ADMIN_SPAWN_OPTIONS.map(option => {
          const active = selected.has(option.key);
          const scaleOptions = adminSpawnScaleOptions(option, constraints);
          const currentScale = scaleValue(option);
          return <label key={option.key} className={`adminSpawnOption ${active ? 'active' : ''}`}>
            <input type="checkbox" checked={active} onChange={()=>toggle(option.key)} />
            <span><b>{option.label}</b><small>{option.detail}</small></span>
            <input type="number" min="1" max="25" value={counts[option.key] || 1} disabled={!active} onChange={e=>setQty(option.key, e.target.value)} />
            <select className="adminSpawnScale" value={currentScale} disabled={!active} onChange={e=>setScale(option.key, e.target.value)}>
              {scaleOptions.map(value => <option key={value} value={value}>{adminSpawnScaleLabel(option, value)}</option>)}
            </select>
          </label>;
        })}
      </div>
      <div className="buttonRow adminSpawnActions">
        <button type="submit" className="primary" disabled={!spawns.length || submitting}>{submitting ? 'Spawning...' : 'Spawn'}</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    </form>
  </div>;
}

const GATHERING_MINIGAME_IDLE_MS = 15000;

function minigameSeededPoint(seed) {
  let h = 2166136261;
  for (const ch of String(seed || 'nova')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return {x:18 + ((h >>> 4) % 65), y:18 + ((h >>> 13) % 65)};
}

function normalizedAngleDelta(a, b) {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}

function fractureZonesForAction(actionId) {
  const p = minigameSeededPoint(`${actionId}:fractures`);
  const first = (p.x * 3 + p.y) % 360;
  return [
    {start:first, size:42},
    {start:(first + 142 + (p.y % 30)) % 360, size:30},
  ];
}

function GatheringMinigameOverlay({action, playerEntry, zoom=1, onEvent}) {
  const actionType = String(action?.actionType || '').toLowerCase();
  const isMining = actionType === 'mining';
  const [minimized,setMinimized] = useState(!!playerEntry?.minimized);
  const [locked,setLocked] = useState(!!playerEntry?.bonusActive);
  const [lastInputAt,setLastInputAt] = useState(() => Date.now());
  const point = {x:clampPct(action?.x_pct ?? action?.x), y:clampPct(action?.y_pct ?? action?.y)};
  const counterScale = Math.max(1.0, Math.min(3.0, 1 / Math.max(.18, Number(zoom || 1))));
  const actionPayload = {
    action_id: action?.actionId,
    node_id: action?.nodeId,
    action_type: isMining ? 'mining' : actionType === 'anomaly' ? 'anomaly' : 'scanning',
  };
  const reportPresence = useCallback((active, nextMinimized) => {
    onEvent?.('presence', {...actionPayload, active:!!active, minimized:!!nextMinimized});
  }, [onEvent, action?.actionId, action?.nodeId, actionType]);
  const earnBonus = useCallback(() => {
    if (locked || playerEntry?.bonusActive) return;
    setLocked(true);
    setMinimized(true);
    onEvent?.('bonus', actionPayload);
  }, [locked, playerEntry?.bonusActive, onEvent, action?.actionId, action?.nodeId, actionType]);
  const touch = useCallback(() => {
    setLastInputAt(Date.now());
    if (minimized) setMinimized(false);
    if (!locked && !playerEntry?.bonusActive) reportPresence(true, false);
  }, [minimized, locked, playerEntry?.bonusActive, reportPresence]);
  useEffect(() => {
    setMinimized(!!playerEntry?.minimized);
    setLocked(!!playerEntry?.bonusActive);
    setLastInputAt(Date.now());
  }, [action?.actionId]);
  useEffect(() => {
    if (minimized || locked || playerEntry?.bonusActive) return;
    reportPresence(true, false);
    const id = window.setInterval(() => {
      if (Date.now() - lastInputAt >= GATHERING_MINIGAME_IDLE_MS) {
        setMinimized(true);
        reportPresence(false, true);
      }
    }, 750);
    return () => window.clearInterval(id);
  }, [minimized, locked, playerEntry?.bonusActive, lastInputAt, reportPresence]);
  const reopen = (e) => {
    e.stopPropagation();
    setMinimized(false);
    setLastInputAt(Date.now());
    if (!locked && !playerEntry?.bonusActive) reportPresence(false, false);
  };
  if (minimized || locked || playerEntry?.bonusActive) {
    return <button type="button" className={`gatherMinigameIcon ${isMining ? 'mining' : 'signal'} ${(locked || playerEntry?.bonusActive) ? 'locked' : ''}`} style={{left:`${point.x}%`, top:`${point.y}%`, transform:`translate(30px,-50%) scale(${counterScale})`}} onMouseDown={e=>e.stopPropagation()} onMouseUp={e=>e.stopPropagation()} onClick={reopen} aria-label={isMining ? 'Open mining minigame' : 'Open signal tuning minigame'}>
      {isMining ? <Hammer size={15}/> : <Radar size={15}/>}
      <span />
    </button>;
  }
  return <div className={`gatherMinigamePanel ${isMining ? 'mining' : 'signal'}`} style={{left:`${point.x}%`, top:`${point.y}%`, transform:`translate(38px,-50%) scale(${counterScale})`}} onMouseDown={e=>{ e.stopPropagation(); touch(); }} onMouseUp={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
    {isMining ? <MiningPulseMinigame action={action} onInput={touch} onSuccess={earnBonus} /> : <SignalTuningMinigame action={action} onInput={touch} onSuccess={earnBonus} />}
  </div>;
}

function SignalTuningMinigame({action,onInput,onSuccess}) {
  const target = useMemo(() => minigameSeededPoint(`${action?.actionId}:signal`), [action?.actionId]);
  const [freq,setFreq] = useState(50);
  const [phase,setPhase] = useState(50);
  const dx = Math.abs(freq - target.x);
  const dy = Math.abs(phase - target.y);
  const distance = Math.hypot(dx, dy);
  const strength = Math.max(0, Math.min(100, Math.round(100 - distance * 1.35)));
  const band = strength >= 86 ? 'strong' : strength >= 52 ? 'medium' : 'weak';
  useEffect(() => {
    if (dx <= 7 && dy <= 7) onSuccess?.();
  }, [dx, dy, onSuccess]);
  const setSlider = (setter) => (e) => {
    setter(Number(e.target.value));
    onInput?.();
  };
  return <>
    <div className="minigameHeader"><Radar size={15}/><b>Signal Tuning</b><span>{strength}%</span></div>
    <div className={`signalScope ${band}`}>
      <input className="signalPhaseSlider" type="range" min="0" max="100" value={phase} onChange={setSlider(setPhase)} aria-label="Signal phase" />
      <div className="signalWave"><i /><em>{band === 'strong' ? 'Signal Locked' : band === 'medium' ? 'Unstable Signal' : 'Weak Signal'}</em></div>
      <input className="signalFrequencySlider" type="range" min="0" max="100" value={freq} onChange={setSlider(setFreq)} aria-label="Frequency" />
    </div>
    <div className="minigameMeter"><span style={{width:`${strength}%`}} /></div>
  </>;
}

function MiningPulseMinigame({action,onInput,onSuccess}) {
  const zones = useMemo(() => fractureZonesForAction(action?.actionId), [action?.actionId]);
  const [angle,setAngle] = useState(0);
  const [progress,setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (now) => {
      setAngle(((now - start) / 1000 * 138) % 360);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [action?.actionId]);
  useEffect(() => {
    if (progress >= 100) onSuccess?.();
  }, [progress, onSuccess]);
  const pulse = () => {
    onInput?.();
    const best = Math.min(...zones.map(z => normalizedAngleDelta(angle, (z.start + z.size / 2) % 360)));
    const gain = best <= 22 ? 34 : best <= 38 ? 14 : 3;
    setProgress(v => Math.min(100, v + gain));
  };
  const gradientStops = zones.map(z => `rgba(255,210,122,.86) ${z.start}deg ${z.start + z.size}deg`).join(',');
  return <>
    <div className="minigameHeader"><Hammer size={15}/><b>Pulse Fracture</b><span>{Math.round(progress)}%</span></div>
    <div className="fractureDial" style={{'--needle-angle':`${angle}deg`, '--fracture-zones':gradientStops}}>
      <i /><b />
    </div>
    <button type="button" className="pulseButton" onClick={pulse}><Zap size={15}/>Pulse</button>
    <div className="minigameMeter"><span style={{width:`${progress}%`}} /></div>
  </>;
}

function formatMissionMinutes(minutes=0) {
  const total = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

function PlanetMissionInspectDetails({selected,onMissionTravel,travelBlocked}) {
  if (!isUninhabitableMapNode(selected, 'system')) return null;
  const mission = (selected.mission_contracts || [])[0];
  if (!mission) return <div className="planetMissionInspect"><b>Planet Mission</b><span>No mission assigned to this uninhabitable planet yet.</span></div>;
  const outcome = mission.outcomeChances || {};
  const rewardRows = mission.rewardChances || [];
  return <div className="planetMissionInspect">
    <div className="planetMissionInspectHead">
      <div>
        <span>Only Mission Here</span>
        <b>{mission.name}</b>
        <small>{mission.description}</small>
      </div>
      <em>{mission.tierLabel || `Lvl ${fmt(mission.level)}`}</em>
    </div>
    <div className="missionInspectStats">
      <span>Level <b>{fmt(mission.level)}</b></span>
      <span>XP <b>{fmt(mission.xpThisLevel || 0)} / {fmt((mission.xpThisLevel || 0) + (mission.xpToNext || 0))}</b></span>
      <span>Progress <b>{fmt(mission.xpProgressPct || 0)}%</b></span>
      <span>Time Spent <b>{formatMissionMinutes(mission.timeSpentMinutes || 0)}</b></span>
      <span>Runs <b>{fmt(mission.completed || 0)}</b></span>
      <span>Total Finds <b>{fmt(mission.totalRewardValue || 0)}</b></span>
      <span>Duration <b>{formatMissionMinutes(mission.minutes || 0)}</b></span>
      <span>Difficulty <b>{fmt(mission.difficulty || 0)}</b></span>
    </div>
    <Progress value={mission.xpProgressPct || 0} />
    <div className="missionOutcomeOdds">
      <span>Success <b>{fmt(outcome.success || 0)}%</b></span>
      <span>Critical <b>{fmt(outcome.critical_success || 0)}%</b></span>
      <span>Failure <b>{fmt((outcome.failure || 0) + (outcome.critical_failure || 0))}%</b></span>
    </div>
    <div className="missionRewardOdds">
      {rewardRows.map(r => <div key={r.code || r.name}>
        <b>{r.name}</b>
        <span>{fmt(r.chancePct)}% chance • {label(r.rarity)} • Qty {fmt(r.qtyMin)}-{fmt(r.qtyMax)}</span>
        <small>{r.description || label(r.category)}</small>
      </div>)}
    </div>
    <div className="buttonRow">
      <button disabled={travelBlocked || !onMissionTravel || !mission.canStart} onClick={()=>onMissionTravel && onMissionTravel(selected, mission)}>{mission.canStart ? 'Land & Start Mission' : (mission.blockedReason || 'Unavailable')}</button>
    </div>
  </div>;
}

function MapView({state=null, type, map, travel, onTravel, onCancelTravel, onIntercept, onResolveIntercept, onMine, onSalvage, onGoHere, onScanArea, onScanObject, onScanSite, onInvestigate, onEnterPirateStation, onPlaceBase, onAdminSpawn, onDockBase, onMissionTravel, currentId, clock, mapMode, onMapModeChange, onViewGalaxy, focusTarget=null, onPilotTrade=null, onPilotParty=null, onPilotBlock=null, party=null, publicProfiles=[], missionCooldown=null, autoExploreMode='', autoExploreLastMode='pirate', autoExploreStatus='', onToggleAutoExploreMode=null, onGatheringMinigame=null}) {
  const MAP_W = 48000;
  const MAP_H = 31200;
  const MAP_MIN_ZOOM = type === 'system' ? 0.045 : 0.09;
  const MAP_MAX_ZOOM = 1.75;
  const MAP_BASE_DEFAULT_ZOOM = 0.32;
  const mapDefaultZoom = type === 'galaxy' ? MAP_BASE_DEFAULT_ZOOM * 2 : MAP_BASE_DEFAULT_ZOOM * 1.5;
  const mapRecenterZoom = Math.max(MAP_MIN_ZOOM, mapDefaultZoom / 2);
  const nodes = map.nodes || [];
  const lanes = map.lanes || [];
  const traffic = map.traffic || [];
  const oreSites = map.ore_sites || [];
  const salvageIcons = map.salvage_icons || [];
  const explorationSites = map.exploration_sites || [];
  const pirateStations = map.pirate_stations || [];
  const playerBases = map.player_bases || [];
  const eventSites = map.event_sites || [];
  const warZones = map.war_zones || [];
  const scanBlips = map.scan_blips || [];
  const scanPings = map.scan_pings || [];
  const summary = map.summary || {};
  const refiningMapIndex = useMemo(() => {
    const byGalaxy = new Map();
    const byPlanet = new Map();
    const push = (target, key, complete) => {
      if (key === undefined || key === null || key === '') return;
      const k = String(key);
      const prev = target.get(k) || {count:0, complete:false};
      target.set(k, {count:prev.count + 1, complete:prev.complete || complete});
    };
    (state?.crafting_queue || []).filter(isRefiningJob).forEach(job => {
      const complete = job.status === 'completed' || (job.status === 'active' && new Date(job.completes_at).getTime() <= clock);
      push(byPlanet, job.location_planet_id || job.planet_id, complete);
      push(byGalaxy, job.location_galaxy_id || job.galaxy_id, complete);
    });
    return {byGalaxy, byPlanet};
  }, [state?.crafting_queue, clock]);
  const refiningMarkerForNode = (node) => type === 'galaxy'
    ? refiningMapIndex.byGalaxy.get(String(node.id))
    : refiningMapIndex.byPlanet.get(String(node.id));
  const [zoom,setZoom] = useState(mapDefaultZoom);
  const [pan,setPan] = useState({x:20,y:18});
  const [selectedObject,setSelectedObject] = useState(null);
  const [mobileSheetObject,setMobileSheetObject] = useState(null);
  const [mobileFilter,setMobileFilter] = useState('all');
  const [profileModal,setProfileModal] = useState(null);
  const [context,setContext] = useState(null);
  const [spawnContext,setSpawnContext] = useState(null);
  const [layers,setLayers] = useState({ships:true, hostiles:true, patrols:true, ore:true, wrecks:true, exploration:true, pirates:true, bases:true, events:true, routes:true, danger:true, market:true, territory:true});
  const [filtersOpen,setFiltersOpen] = useState(false);
  const mapShellRef = useRef(null);
  const viewportRef = useRef(null);
  const mapWorldRef = useRef(null);
  const dragRef = useRef(null);
  const panFrameRef = useRef(null);
  const pendingPanRef = useRef(null);
  const [viewportSize,setViewportSize] = useState({width:1200,height:760});
  const clampNum = (v,min,max) => Math.max(min, Math.min(max, Number.isFinite(v) ? v : min));
  const byId = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);
  const activeLane = useMemo(() => lanes.find(l => l.active), [lanes]);
  const progress = travelProgress(travel || {}, clock);
  const zoomClass = zoom < .9 ? 'zoomFar' : zoom > 1.72 ? 'zoomNear' : 'zoomMid';
  const activeTravelMode = String(travel?.mode || '').toLowerCase();
  const activeTravelMapType = String(travel?.map_type || travel?.mapType || '').toLowerCase();
  const activeRoutePhase = String(travel?.route_phase || '').toLowerCase();
  const galaxyTravelActive = !!travel?.active && (['galaxy','galaxy_route'].includes(activeTravelMode) || activeTravelMapType === 'galaxy');
  const activeTravelBelongsToView = !!travel?.active && (activeTravelMapType ? activeTravelMapType === type : (type === 'galaxy' ? galaxyTravelActive : !galaxyTravelActive));
  const travelBlocked = !!travel?.active && ['galaxy','galaxy_route','gate_approach'].includes(activeTravelMode);
  const gateNodeCountdown = (node) => {
    if (type !== 'system' || !travel?.active || !node) return '';
    const nodeId = String(node.id ?? '');
    if (activeTravelMode === 'gate_approach' && nodeId === String(travel.destination_planet_id ?? '')) {
      return `Approaching ${clockTimeLeft(travel.arrival_at)}`;
    }
    if (activeTravelMode === 'galaxy_route' && activeRoutePhase === 'wait' && (nodeId === String(travel.origin_planet_id ?? '') || nodeId === String(travel.destination_planet_id ?? ''))) {
      return `Jump in ${clockTimeLeft(travel.arrival_at)}`;
    }
    return '';
  };
  const activeOriginKey = type === 'galaxy' ? travel?.origin_galaxy_id : travel?.origin_planet_id;
  const activeCoordinateOrigin = activeTravelBelongsToView && travel?.origin_x_pct != null && travel?.origin_y_pct != null
    ? {x_pct:Number(travel.origin_x_pct), y_pct:Number(travel.origin_y_pct)}
    : null;
  const activeCoordinateDest = activeTravelBelongsToView && travel?.destination_x_pct != null && travel?.destination_y_pct != null
    ? {x_pct:Number(travel.destination_x_pct), y_pct:Number(travel.destination_y_pct)}
    : null;
  const activeWaypointOrigin = activeCoordinateOrigin || byId[activeOriginKey];
  const activeWaypointPoint = activeCoordinateOrigin && activeCoordinateDest
    ? lerpPoint(activeCoordinateOrigin, activeCoordinateDest, progress)
    : null;
  const activeGalaxyOrigin = type === 'galaxy' && galaxyTravelActive ? byId[travel?.origin_galaxy_id] : null;
  const activeGalaxyDest = type === 'galaxy' && galaxyTravelActive ? byId[travel?.destination_galaxy_id] : null;
  const activeGalaxyPoint = activeGalaxyOrigin && activeGalaxyDest
    ? lerpPoint(activeGalaxyOrigin, activeGalaxyDest, progress)
    : null;
  const openSpacePoint = type === 'system' && !travel?.active && travel?.open_space && (!travel.open_space_map_type || travel.open_space_map_type === type)
    ? {x:Number(travel.open_space_x_pct || 50), y:Number(travel.open_space_y_pct || 50)}
    : null;
  const shipPoint = activeWaypointPoint || (activeTravelBelongsToView && activeLane && byId[activeLane.from] && byId[activeLane.to]
    ? lerpPoint(byId[activeLane.from], byId[activeLane.to], progress)
    : activeGalaxyPoint || openSpacePoint);
  const hasCoordinateTravelLine = !!(activeCoordinateOrigin && activeCoordinateDest);
  const fallbackRadarPoint = nodes.find(n => n.current || n.id === currentId) || {x_pct:50, y_pct:50};
  const liveRadarPoint = shipPoint || fallbackRadarPoint;
  const summaryRadarX = Number(summary.radar_center_x_pct);
  const summaryRadarY = Number(summary.radar_center_y_pct);
  const liveRadarX = Number(liveRadarPoint?.x_pct ?? liveRadarPoint?.x);
  const liveRadarY = Number(liveRadarPoint?.y_pct ?? liveRadarPoint?.y);
  const radarCenter = {
    x: clampNum(Number.isFinite(liveRadarX) && liveRadarX > 0 ? liveRadarX : (Number.isFinite(summaryRadarX) && summaryRadarX > 0 ? summaryRadarX : 50), 1, 99),
    y: clampNum(Number.isFinite(liveRadarY) && liveRadarY > 0 ? liveRadarY : (Number.isFinite(summaryRadarY) && summaryRadarY > 0 ? summaryRadarY : 50), 1, 99),
  };
  const summaryRadarRange = Number(summary.radar_range_pct);
  const baselineRadarRange = map.remote ? 0 : 12;
  const radarRange = type === 'galaxy' || galaxyTravelActive ? 0 : Math.max(0, Number.isFinite(summaryRadarRange) ? summaryRadarRange : baselineRadarRange);
  const radarDiameterPx = Math.max(0, (radarRange / 100) * MAP_W * 2);
  const counterZoomScale = 1 / Math.max(zoom, 0.1);
  const markerScale = counterZoomScale;
  const nodeScale = counterZoomScale;
  const iconTransform = `translate(-50%,-50%) scale(${markerScale})`;
  const nodeTransform = `translate(-50%,-50%) scale(${nodeScale})`;
  const renderBounds = useMemo(() => {
    const bufferPx = zoom < 0.35 ? 1600 : zoom < 0.8 ? 1150 : 820;
    const safeZoom = Math.max(zoom, 0.001);
    const left = (-pan.x - bufferPx) / safeZoom;
    const top = (-pan.y - bufferPx) / safeZoom;
    const right = (-pan.x + viewportSize.width + bufferPx) / safeZoom;
    const bottom = (-pan.y + viewportSize.height + bufferPx) / safeZoom;
    return {
      leftPct: clampNum((left / MAP_W) * 100, -20, 120),
      rightPct: clampNum((right / MAP_W) * 100, -20, 120),
      topPct: clampNum((top / MAP_H) * 100, -20, 120),
      bottomPct: clampNum((bottom / MAP_H) * 100, -20, 120)
    };
  }, [pan.x, pan.y, zoom, viewportSize.width, viewportSize.height]);
  const inRenderBounds = useCallback((obj) => {
    const x = Number(obj?.x_pct ?? obj?.x);
    const y = Number(obj?.y_pct ?? obj?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return true;
    return x >= renderBounds.leftPct && x <= renderBounds.rightPct && y >= renderBounds.topPct && y <= renderBounds.bottomPct;
  }, [renderBounds]);

  const objectKey = (obj) => obj?.objectKey || obj?.id || obj?.siteId || obj?.salvageSiteId || obj?.explorationSiteId || `${obj?.kind || 'object'}:${obj?.name || obj?.label || 'unknown'}`;

  useEffect(() => {
    window.__novaActiveMapType = type || 'all';
  }, [type]);

  const objectDisplayName = (obj) => mapObjectDisplayName(obj);
  const galaxyIntelFor = (obj) => type === 'galaxy'
    ? state?.galaxy_war_intel?.by_galaxy?.[String(obj?.id ?? obj?.galaxy_id)] || null
    : null;
  const galaxyControlBreakdown = (obj) => {
    const intel = galaxyIntelFor(obj);
    return intel?.control_breakdown || obj?.control_breakdown || [];
  };
  const galaxyWarActive = (obj) => {
    const intel = galaxyIntelFor(obj);
    const breakdown = galaxyControlBreakdown(obj).filter(entry => Number(entry?.planets || 0) > 0);
    return !!(intel?.war_state === 'active_war' || intel?.security_state?.war_active || Number(intel?.war_planets || obj?.territory_war_count || 0) > 0 || breakdown.length > 1);
  };
  const galaxyStatusPayload = (node) => {
    const intel = galaxyIntelFor(node) || {};
    const breakdown = galaxyControlBreakdown(node);
    const totalPlanets = Number(intel.planet_count ?? node?.planet_count ?? 0);
    const owner = intel.owner_faction || {};
    const ownerName = owner.name || node?.faction_name || 'Neutral';
    const warActive = galaxyWarActive(node);
    const topOwners = breakdown.length
      ? breakdown.map(entry => `${entry?.faction?.name || 'Unknown'} ${fmt(entry?.percent || 0)}% (${fmt(entry?.planets || 0)})`).join(' / ')
      : `${ownerName} controls the registered galaxy capital.`;
    const statusText = warActive ? 'War Active' : (intel.war_label || label(node?.territory_status || 'peace'));
    return {
      ...node,
      kind:'node',
      scanUnlocked:true,
      warActive,
      statusText,
      rewardHint:`Bonus ${fmt(node?.control_bonus_pct || 0)}%`,
      riskBand:warActive ? 'War Active' : label(node?.territory_status || 'Stable'),
      controlBreakdown:breakdown,
      galaxyIntel:intel,
      selectedSummary:`${statusText}. ${fmt(totalPlanets)} planets tracked. Ownership: ${topOwners}. Secure ${fmt(intel.secure_planets ?? 0)}, contested ${fmt(intel.contested_planets ?? node?.contested_zone_count ?? 0)}, war ${fmt(intel.war_planets ?? node?.territory_war_count ?? 0)}.`
    };
  };
  const isUninhabitableNode = (obj) => isUninhabitableMapNode(obj, type);
  const mapPlanetAssetCategory = (node, isGateNode = false) => {
    if (isGateNode) return 'gate galaxy station';
    if (type === 'galaxy') return `${node.name || ''} ${node.sector || ''} ${node.faction_name || ''}`;
    const text = `${node.economy_type || ''} ${node.type || ''} ${node.kind || ''} ${node.name || ''} ${node.details_label || ''}`;
    return `${isUninhabitableNode(node) ? 'uninhabitable nonhabitable' : 'habitable'} ${text}`.trim();
  };
  const clientActionRangeAllows = (obj) => {
    if (!obj || !shipPoint) return false;
    const tx = Number(obj.x_pct ?? obj.x);
    const ty = Number(obj.y_pct ?? obj.y);
    const sx = Number(shipPoint.x ?? shipPoint.x_pct);
    const sy = Number(shipPoint.y ?? shipPoint.y_pct);
    if (![tx, ty, sx, sy].every(Number.isFinite)) return false;
    const kind = String(obj.kind || '').toLowerCase();
    const defaultRange = kind === 'npc' || kind === 'player' || obj.attackable ? 2.05 : 2.4;
    const actionRange = Math.max(1.65, Math.min(4.75, Number(obj.actionRangePct || obj.action_range_pct || defaultRange)));
    return Math.hypot(sx - tx, sy - ty) <= actionRange;
  };
  const needsApproach = (obj) => !!obj && obj.inActionRange === false && !clientActionRangeAllows(obj);
  const approachPointFor = (obj) => {
    if (!obj || !shipPoint || !needsApproach(obj)) return {x_pct:Number(obj?.x_pct ?? 50), y_pct:Number(obj?.y_pct ?? 50)};
    const tx = Number(obj.x_pct ?? 50);
    const ty = Number(obj.y_pct ?? 50);
    const sx = Number(shipPoint.x ?? shipPoint.x_pct ?? 50);
    const sy = Number(shipPoint.y ?? shipPoint.y_pct ?? 50);
    const dx = sx - tx;
    const dy = sy - ty;
    const dist = Math.sqrt(dx*dx + dy*dy) || 0.0001;
    const stopRadius = Math.max(1.85, Math.min(3.25, Number(obj.actionRangePct || 2.4))) * 0.88;
    return {x_pct:clampNum(tx + (dx / dist) * stopRadius, 1, 99), y_pct:clampNum(ty + (dy / dist) * stopRadius, 1, 99)};
  };
  const targetPayload = (obj) => {
    const pt = approachPointFor(obj);
    return {x_pct:pt.x_pct, y_pct:pt.y_pct, label:objectDisplayName(obj), map_type:type};
  };
  const isSystemDockTarget = (obj) => type === 'system' && ['node','planet'].includes(String(obj?.kind || '').toLowerCase()) && !isGalaxyGateMapNode(obj) && !isUninhabitableNode(obj);
  const baseTrafficForView = useMemo(
    () => type === 'galaxy' ? [] : traffic.filter(t => t?.id !== 'player:self' && t?.kind !== 'self' && !t?.self),
    [traffic, type]
  );
  const trafficForView = useMemo(() => {
    const clockMs = Number(clock || Date.now());
    return baseTrafficForView.map(t => {
      const startedAt = t.npcStartedAt || t.routeStartedAt;
      const arrivalAt = t.npcArrivalAt || t.routeArrivalAt;
      const moving = ((t.npcActionStateRaw === 'moving') || t.routeStartedAt) && startedAt && arrivalAt;
      if (!moving) return t;
      const start = new Date(startedAt).getTime();
      const end = new Date(arrivalAt).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return t;
      const pct = Math.max(0, Math.min(1, (clockMs - start) / (end - start)));
      const origin = {x_pct:Number(t.routeOriginX ?? t.x_pct ?? 50), y_pct:Number(t.routeOriginY ?? t.y_pct ?? 50)};
      const dest = {x_pct:Number(t.routeDestinationX ?? t.x_pct ?? 50), y_pct:Number(t.routeDestinationY ?? t.y_pct ?? 50)};
      const pt = lerpPoint(origin, dest, pct);
      return {...t, x_pct:pt.x, y_pct:pt.y, progress:Math.round(pct * 1000) / 10, label:t.npcObjectiveLabel ? `${t.npcObjectiveLabel}: moving smoothly to objective.` : t.label};
    });
  }, [baseTrafficForView, clock]);
  const allObjects = useMemo(
    () => [...nodes.map(n => ({...n, kind:n.kind || 'node'})), ...trafficForView, ...oreSites, ...salvageIcons, ...explorationSites, ...pirateStations, ...playerBases, ...eventSites, ...warZones, ...scanBlips],
    [nodes, trafficForView, oreSites, salvageIcons, explorationSites, pirateStations, playerBases, eventSites, warZones, scanBlips]
  );
  const selectedLiveObject = useMemo(
    () => selectedObject && selectedObject.kind !== 'blank' ? allObjects.find(o => objectKey(o) === objectKey(selectedObject)) : selectedObject,
    [selectedObject, allObjects]
  );

  useEffect(() => {
    if (!selectedObject || selectedObject.kind === 'blank') return;
    if (!allObjects.some(o => objectKey(o) === objectKey(selectedObject))) {
      setSelectedObject(null);
      setContext(null);
    }
  }, [type, selectedObject?.objectKey, selectedObject?.id, selectedObject?.siteId, selectedObject?.salvageSiteId, selectedObject?.explorationSiteId, nodes.length, traffic.length, oreSites.length, salvageIcons.length, explorationSites.length, pirateStations.length, playerBases.length, eventSites.length, warZones.length]);

  const autoInterceptRef = useRef(null);
  useEffect(() => {
    if (travel?.mode !== 'intercept' || !travel?.active || !travel?.intercept_target_ref || !shipPoint || !onResolveIntercept) return;
    const target = trafficForView.find(t => t.combatTargetRef === travel.intercept_target_ref || t.id === travel.intercept_target_ref);
    if (!target) return;
    const dx = Number(shipPoint.x || 0) - Number(target.x_pct || 0);
    const dy = Number(shipPoint.y || 0) - Number(target.y_pct || 0);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const key = `${travel.intercept_target_ref}:${travel.started_at || ''}`;
    const contactRange = type === 'galaxy' ? 1.55 : 2.05;
    if (distance <= contactRange && autoInterceptRef.current !== key) {
      autoInterceptRef.current = key;
      onResolveIntercept();
    }
  }, [clock, travel?.mode, travel?.active, travel?.intercept_target_ref, travel?.started_at, progress, shipPoint?.x, shipPoint?.y, traffic]);

  const worldFromEvent = (e) => {
    const worldRect = mapWorldRef.current?.getBoundingClientRect();
    if (worldRect?.width && worldRect?.height) {
      return {
        x_pct:clampNum(((e.clientX - worldRect.left) / worldRect.width) * 100, 1, 99),
        y_pct:clampNum(((e.clientY - worldRect.top) / worldRect.height) * 100, 1, 99),
      };
    }
    const viewport = viewportRef.current;
    const rect = viewport?.getBoundingClientRect();
    if (!rect) return {x_pct:50,y_pct:50};
    const x = (e.clientX - rect.left + (viewport?.scrollLeft || 0) - pan.x) / zoom;
    const y = (e.clientY - rect.top + (viewport?.scrollTop || 0) - pan.y) / zoom;
    return {x_pct:clampNum((x / MAP_W) * 100, 1, 99), y_pct:clampNum((y / MAP_H) * 100, 1, 99)};
  };
  const mapLocalPoint = (e) => {
    const rect = mapShellRef.current?.getBoundingClientRect();
    return rect ? {x:e.clientX - rect.left, y:e.clientY - rect.top} : {x:e.clientX, y:e.clientY};
  };
  const openContext = (e, obj) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = null;
    const anchor = mapLocalPoint(e);
    const detailedObj = type === 'galaxy' && ['node','galaxy',''].includes(String(obj?.kind || '').toLowerCase())
      ? galaxyStatusPayload(obj)
      : obj;
    const next = {...detailedObj, objectKey:objectKey(detailedObj), screenX:anchor.x, screenY:anchor.y, clientX:e.clientX, clientY:e.clientY, anchorX:anchor.x, anchorY:anchor.y};
    setContext(next);
  };
  const inspectGalaxyNode = (e, node) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = null;
    const anchor = mapLocalPoint(e);
    const payload = galaxyStatusPayload(node);
    setContext(null);
    setSelectedObject({...payload, objectKey:objectKey(payload), screenX:anchor.x, screenY:anchor.y, clientX:e.clientX, clientY:e.clientY, anchorX:anchor.x, anchorY:anchor.y});
  };
  const openBlankContext = (e) => {
    if (dragRef.current?.moved) return;
    if (type === 'galaxy') {
      setContext(null);
      return;
    }
    const pos = worldFromEvent(e);
    const anchor = mapLocalPoint(e);
    const blank = {kind:'blank', objectKey:`blank:${pos.x_pct.toFixed(1)}:${pos.y_pct.toFixed(1)}`, name:'Open Space', label:`Map point ${pos.x_pct.toFixed(1)} / ${pos.y_pct.toFixed(1)}`, ...pos, screenX:anchor.x, screenY:anchor.y, clientX:e.clientX, clientY:e.clientY, anchorX:anchor.x, anchorY:anchor.y};
    setContext(blank);
  };
  const closeContext = () => setContext(null);
  const run = (fn, arg) => { closeContext(); if (fn) fn(arg); };
  const scanPayloadFor = (obj) => ({
    target_ref: obj?.sourceTargetKey || obj?.targetScanKey || obj?.objectKey || obj?.id || obj?.siteId || obj?.salvageSiteId || obj?.explorationSiteId || obj?.stationId || obj?.baseId,
    object_key: obj?.objectKey,
    id: obj?.id,
    kind: obj?.kind,
    map_type:type
  });
  const canShowInspect = (obj) => !!obj && (obj.kind === 'self' || obj.kind === 'server_event' || isUninhabitableNode(obj) || obj.scanUnlocked || obj.scanResult?.success);
  const scanAndOpen = async (obj) => {
    closeContext();
    if (!onScanObject || !obj) return;
    const data = await onScanObject(scanPayloadFor(obj));
    const result = data?.result || {};
    if (result?.scan?.success) {
      const target = result.target || obj;
      setSelectedObject({...obj, ...target, objectKey:obj.objectKey || target.objectKey || objectKey(target), scanUnlocked:true, scanResult:result.scan});
    }
  };
  const scanInspectButton = (obj, scanLabel='Scan Details', inspectLabel='Inspect') => canShowInspect(obj)
    ? <button onClick={()=>{setSelectedObject(obj); closeContext();}}>{inspectLabel}</button>
    : <button disabled={!onScanObject} onClick={()=>scanAndOpen(obj)}>{scanLabel}</button>;
  const mobileOriginPoint = shipPoint || nodes.find(n => n.current || String(n.id) === String(currentId)) || {x_pct:50, y_pct:50};
  const mobileObjectType = (obj) => {
    const kind = String(obj?.kind || obj?.type || '').toLowerCase();
    const role = String(obj?.role || '').toLowerCase();
    if (isGalaxyGateMapNode(obj)) return 'gate';
    if (type === 'galaxy' && (kind === 'node' || kind === 'galaxy')) return 'galaxy';
    if (kind === 'node') return type === 'galaxy' ? 'galaxy' : (isUninhabitableNode(obj) ? 'uninhabitable' : 'planet');
    if (kind === 'planet') return isUninhabitableNode(obj) ? 'uninhabitable' : 'planet';
    if (kind === 'npc' || role.includes('npc')) return 'npc';
    if (kind === 'player') return 'ship';
    if (kind === 'ore') return 'ore';
    if (kind === 'salvage') return 'salvage';
    if (kind === 'pirate_station') return 'station';
    if (kind === 'exploration') return 'signal';
    if (kind === 'war_zone') return 'war';
    return kind || 'object';
  };
  const mobileIsHostile = (obj) => !!(obj?.hostile || obj?.attackable || ['pirate','raider','alien','bounty'].includes(String(obj?.role || '').toLowerCase()));
  const mobileDistanceFor = (obj) => {
    const ox = Number(mobileOriginPoint?.x_pct ?? mobileOriginPoint?.x ?? 50);
    const oy = Number(mobileOriginPoint?.y_pct ?? mobileOriginPoint?.y ?? 50);
    const tx = Number(obj?.x_pct ?? obj?.x ?? ox);
    const ty = Number(obj?.y_pct ?? obj?.y ?? oy);
    if (![ox, oy, tx, ty].every(Number.isFinite)) return 0;
    return Math.max(0, Math.round(Math.hypot(ox - tx, oy - ty) * 10) / 10);
  };
  const mobileMapObjects = useMemo(() => {
    const accepted = allObjects
      .filter(obj => obj && obj.kind !== 'blank')
      .filter(obj => type === 'galaxy' || mobileObjectType(obj) !== 'galaxy')
      .map(obj => ({...obj, mobileType:mobileObjectType(obj), mobileDistance:mobileDistanceFor(obj), objectKey:objectKey(obj)}))
      .filter(obj => {
        if (mobileFilter === 'all') return true;
        if (mobileFilter === 'hostile') return mobileIsHostile(obj);
        if (mobileFilter === 'ships') return ['ship','npc'].includes(obj.mobileType);
        if (mobileFilter === 'planets') return ['planet','uninhabitable','gate','galaxy'].includes(obj.mobileType);
        if (mobileFilter === 'npcs') return obj.mobileType === 'npc';
        if (mobileFilter === 'salvage') return obj.mobileType === 'salvage';
        return obj.mobileType === mobileFilter;
      })
      .sort((a,b) => a.mobileDistance - b.mobileDistance || String(objectDisplayName(a)).localeCompare(String(objectDisplayName(b))));
    return accepted.slice(0, 96);
  }, [allObjects, mobileFilter, type, mobileOriginPoint?.x_pct, mobileOriginPoint?.x, mobileOriginPoint?.y_pct, mobileOriginPoint?.y]);
  const mobileFilters = type === 'galaxy'
    ? [['all','All'], ['planets','Galaxies']]
    : [['all','All'], ['ships','Ships'], ['planets','Planets'], ['npcs','NPCs'], ['salvage','Salvage'], ['hostile','Hostile']];
  const openMobileSheet = (obj) => {
    setMobileSheetObject(obj);
    setSelectedObject(obj);
  };
  const closeMobileSheet = () => setMobileSheetObject(null);
  const inspectMobileObject = (obj) => {
    if (canShowInspect(obj)) {
      setSelectedObject({...obj, scanUnlocked:true});
      closeMobileSheet();
    } else {
      scanAndOpen(obj);
      closeMobileSheet();
    }
  };
  const runMobileAction = (fn, arg) => {
    closeMobileSheet();
    if (fn) fn(arg);
  };
  const stopMapBubble = (e) => { e.stopPropagation(); };
  const clampPanForZoom = (candidate, nextZoom) => ({
    x: clampNum(candidate.x, -(MAP_W * nextZoom) + 340, 260),
    y: clampNum(candidate.y, -(MAP_H * nextZoom) + 260, 220)
  });
  const resetView = () => { setZoom(mapDefaultZoom); setPan({x:20,y:18}); };
  const zoomToAnchor = (nextZoom, clientX, clientY) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const ax = Number.isFinite(clientX) && rect ? clientX - rect.left : (rect?.width || 1200) / 2;
    const ay = Number.isFinite(clientY) && rect ? clientY - rect.top : (rect?.height || 760) / 2;
    const mapX = (ax - pan.x) / Math.max(zoom, 0.001);
    const mapY = (ay - pan.y) / Math.max(zoom, 0.001);
    const z = clampNum(+Number(nextZoom).toFixed(3), MAP_MIN_ZOOM, MAP_MAX_ZOOM);
    setZoom(z);
    setPan(clampPanForZoom({x:ax - mapX * z, y:ay - mapY * z}, z));
  };
  const zoomBy = (delta, anchor='center', event=null) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const cx = anchor === 'mouse' && event ? event.clientX : (rect ? rect.left + rect.width / 2 : undefined);
    const cy = anchor === 'mouse' && event ? event.clientY : (rect ? rect.top + rect.height / 2 : undefined);
    zoomToAnchor(zoom + delta, cx, cy);
  };
  const normalizedMapPoint = (pt, fallback = null) => {
    const x = Number(pt?.x_pct ?? pt?.x);
    const y = Number(pt?.y_pct ?? pt?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return fallback;
    return {x_pct:clampNum(x, 1, 99), y_pct:clampNum(y, 1, 99)};
  };
  const centerOnPct = (pt, nextZoom = 1.0) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const vw = rect?.width || 1200;
    const vh = rect?.height || 760;
    const point = normalizedMapPoint(pt, {x_pct:50, y_pct:50});
    const x = (point.x_pct / 100) * MAP_W;
    const y = (point.y_pct / 100) * MAP_H;
    setZoom(nextZoom);
    setPan(clampPanForZoom({
      x: vw / 2 - x * nextZoom,
      y: vh / 2 - y * nextZoom
    }, nextZoom));
  };
  const dockedMapTarget = () => {
    if (type !== 'system' || travel?.active || travel?.open_space || travel?.docked === false) return null;
    const baseId = travel?.dock_base_id ?? travel?.docked_base_id;
    if (baseId != null) {
      const dockedBase = playerBases.find(base =>
        String(base.baseId ?? base.id).replace(/^base:/, '') === String(baseId)
      );
      if (dockedBase) return {...dockedBase, kind:'player_base', scanUnlocked:true};
    }
    const planetId = travel?.dock_planet_id ?? currentId ?? map.current_planet_id ?? state?.location?.planet_id;
    const dockedNode = nodes.find(node =>
      node.current ||
      String(node.id) === String(planetId) ||
      String(node.planet_id) === String(planetId)
    );
    return dockedNode ? {...dockedNode, kind:dockedNode.kind || 'node', scanUnlocked:true} : null;
  };
  const centerMyShip = (select = false, zoomOverride = null) => {
    const myShipZoom = Number.isFinite(Number(zoomOverride)) ? Number(zoomOverride) : 1.05;
    const liveShipPoint = normalizedMapPoint(shipPoint);
    if (liveShipPoint) {
      centerOnPct(liveShipPoint, myShipZoom);
      if (select) setSelectedObject({kind:'self', name: travel?.mode === 'intercept' ? 'Your Ship - Intercept Course' : 'Your Ship', label: travel?.intercept_target_name ? `Intercepting ${travel.intercept_target_name}` : 'In open space', ...liveShipPoint});
      return;
    }
    const dockedTarget = dockedMapTarget();
    if (dockedTarget) {
      setSelectedObject(null);
      setContext(null);
      setMobileSheetObject(null);
      centerOnPct(dockedTarget, myShipZoom);
      return;
    }
    const current = nodes.find(n => n.current || n.id === currentId) || nodes[0];
    if (current) {
      const dockedFallback = type === 'system' && !travel?.active && !travel?.open_space && travel?.docked !== false;
      centerOnPct(current, myShipZoom);
      if (dockedFallback) {
        setSelectedObject(null);
        setContext(null);
        setMobileSheetObject(null);
      } else if (select) setSelectedObject({...current, kind:'node', selectedSummary:'You are docked here. Your ship is inside the planet/station and is not visible as a separate map object until launch/travel.'});
    }
  };
  const findMyShip = () => {
    setContext(null);
    setMobileSheetObject(null);
    if (type === 'galaxy' && !galaxyTravelActive && onMapModeChange) {
      onMapModeChange('system');
      return;
    }
    requestAnimationFrame(() => centerMyShip(false, mapRecenterZoom));
  };
  const focusMatchesObject = (obj) => {
    if (!focusTarget || !obj) return false;
    const eventId = String(focusTarget.eventId || focusTarget.id || '');
    const eventType = String(focusTarget.eventType || '').toLowerCase();
    const targetKey = String(focusTarget.objectKey || '');
    if (targetKey && String(obj.objectKey || obj.id || '') === targetKey) return true;
    if (eventId && String(obj.eventId || obj.event_id || obj.serverEventId || '') === eventId) return true;
    if (eventType && String(obj.eventType || obj.event_type || obj.code || '').toLowerCase() === eventType && obj.kind === 'server_event') return true;
    return false;
  };
  const focusedMapObject = useMemo(() => {
    if (focusTarget?.kind !== 'server_event') return null;
    const targetMap = String(focusTarget.mapType || focusTarget.map_type || '').toLowerCase();
    if (targetMap && targetMap !== type) return null;
    const direct = eventSites.find(focusMatchesObject) || allObjects.find(focusMatchesObject);
    if (direct) return direct;
    if (type === 'system' && focusTarget.targetPlanetId) {
      const planet = nodes.find(n => String(n.id) === String(focusTarget.targetPlanetId));
      if (planet) return {...planet, kind:planet.kind || 'node'};
    }
    if (type === 'galaxy' && focusTarget.targetGalaxyId) {
      const galaxy = nodes.find(n => String(n.id) === String(focusTarget.targetGalaxyId));
      if (galaxy) return {...galaxy, kind:galaxy.kind || 'node'};
    }
    if (Number.isFinite(Number(focusTarget.x_pct)) && Number.isFinite(Number(focusTarget.y_pct))) {
      return {
        kind:'server_event',
        id:focusTarget.objectKey || `server-event-focus:${focusTarget.id || focusTarget.eventType || 'event'}`,
        objectKey:focusTarget.objectKey,
        name:focusTarget.name || 'Server Event',
        label:focusTarget.name || 'Server Event',
        eventId:focusTarget.eventId,
        eventType:focusTarget.eventType,
        x_pct:Number(focusTarget.x_pct),
        y_pct:Number(focusTarget.y_pct),
        selectedSummary:'Server event location.'
      };
    }
    return null;
  }, [focusTarget?.nonce, focusTarget?.id, focusTarget?.eventId, focusTarget?.eventType, focusTarget?.objectKey, focusTarget?.x_pct, focusTarget?.y_pct, type, allObjects, eventSites, nodes]);
  const appliedFocusNonceRef = useRef('');
  useEffect(() => {
    if (!focusedMapObject) return;
    const nonce = String(focusTarget?.nonce || focusTarget?.id || focusTarget?.eventId || focusTarget?.objectKey || '');
    if (nonce && appliedFocusNonceRef.current === nonce) return;
    appliedFocusNonceRef.current = nonce;
    centerOnPct(focusedMapObject, 1.12);
    setSelectedObject({...focusedMapObject, scanUnlocked:true, anchorX:Math.round((viewportSize.width || 1200) / 2), anchorY:120});
  }, [focusTarget?.nonce, focusTarget?.id, focusTarget?.eventId, focusTarget?.objectKey, focusedMapObject]);
  const autoCenterKeyRef = useRef('');
  useEffect(() => {
    const key = [
      type,
      currentId || '',
      map.current_planet_id || '',
      map.current_galaxy_id || '',
      travel?.dock_planet_id || '',
      travel?.dock_base_id || travel?.docked_base_id || '',
      nodes.length
    ].join('|');
    if (autoCenterKeyRef.current === key) return;
    if (!viewportRef.current) return;
    autoCenterKeyRef.current = key;
    requestAnimationFrame(() => centerMyShip(false, mapRecenterZoom));
  }, [type, currentId, map.current_planet_id, map.current_galaxy_id, travel?.dock_planet_id, travel?.dock_base_id, travel?.docked_base_id, nodes.length, mapRecenterZoom]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateSize = () => {
      const rect = viewport.getBoundingClientRect();
      setViewportSize(prev => (
        Math.abs(prev.width - rect.width) > 1 || Math.abs(prev.height - rect.height) > 1
          ? {width:rect.width || 1200, height:rect.height || 760}
          : prev
      ));
    };
    updateSize();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    if (panFrameRef.current) cancelAnimationFrame(panFrameRef.current);
  }, []);

  const schedulePan = useCallback((nextPan) => {
    pendingPanRef.current = nextPan;
    if (panFrameRef.current) return;
    panFrameRef.current = requestAnimationFrame(() => {
      panFrameRef.current = null;
      const pending = pendingPanRef.current;
      pendingPanRef.current = null;
      if (pending) setPan(pending);
    });
  }, []);

  const toggleLayer = (key) => setLayers(v => ({...v, [key]:!v[key]}));

  const onMouseDown = (e) => { if (e.button !== 0) return; const currentPan = pendingPanRef.current || pan; dragRef.current = {x:e.clientX, y:e.clientY, panX:currentPan.x, panY:currentPan.y, moved:false}; };
  const onMouseMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.moved) schedulePan({x:clampNum(d.panX + dx, -(MAP_W * zoom) + 340, 260), y:clampNum(d.panY + dy, -(MAP_H * zoom) + 260, 220)});
  };
  const onMouseUp = (e) => { const d = dragRef.current; dragRef.current = null; if (!d?.moved) openBlankContext(e); };
  const onWheel = (e) => {
    if (e.defaultPrevented) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    zoomBy(e.deltaY < 0 ? 0.075 : -0.075, 'mouse', e);
  };

  const isPatrol = (t) => !!t?.securityDefense || ['patrol','security_pilot','marshal','turret','gate_turret'].includes(String(t.role || '').toLowerCase());
  const layerFilterOptions = [
    ['ships','Ships'],
    ['hostiles','Hostiles'],
    ['patrols','Patrols'],
    ['ore','Ore'],
    ['wrecks','Wrecks'],
    ['exploration','Ancient Sites'],
    ['pirates','Pirate Stations'],
    ['bases','Bases'],
    ['events','Events'],
    ['routes','Routes'],
    ['territory','Territory']
  ];
  const activeLayerFilterCount = layerFilterOptions.filter(([key]) => layers[key]).length;
  const allLayerFiltersActive = activeLayerFilterCount === layerFilterOptions.length;
  const setAllLayerFilters = (checked) => setLayers(v => {
    const next = {...v};
    layerFilterOptions.forEach(([key]) => { next[key] = checked; });
    return next;
  });
  const BulkLayerIcon = allLayerFiltersActive ? Square : CheckSquare;
  const shellWidth = viewportSize.width || window.innerWidth;
  const shellHeight = viewportSize.height || window.innerHeight;
  const popupX = context ? clampNum((context.anchorX ?? context.screenX) + 14, 8, shellWidth - 276) : 0;
  const popupY = context ? clampNum(context.anchorY ?? context.screenY, 8, shellHeight - 340) : 0;
  const selected = selectedLiveObject && selectedLiveObject.kind !== 'blank'
    ? (selectedObject?.scanUnlocked ? {...selectedLiveObject, ...selectedObject} : {...selectedObject, ...selectedLiveObject})
    : selectedLiveObject;
  const selectedX = selected ? clampNum((selected.anchorX ?? selected.screenX ?? 420) + 18, 8, shellWidth - 520) : 0;
  const selectedY = selected ? clampNum((selected.anchorY ?? selected.screenY ?? 180) + 18, 8, shellHeight - 520) : 0;
  const blockedReason = travelBlocked
    ? `Blocked while ${label(travel.mode || 'traveling')} is active.`
    : (travel?.active ? `Current ${label(travel.mode || 'travel')} route will be interrupted.` : '');
  const regionSummary = summary.readable_hint || `${summary.risk_band || 'Unknown'} route risk. Watch hostile traffic, salvage depletion, ore depletion, and ancient signals.`;
  const pointInRadar = (obj) => {
    if (type === 'galaxy') return true;
    if (!radarRange || !obj) return false;
    const x = Number(obj.x_pct ?? obj.x);
    const y = Number(obj.y_pct ?? obj.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const dx = ((x - radarCenter.x) / 100) * MAP_W;
    const dy = ((y - radarCenter.y) / 100) * MAP_H;
    return Math.hypot(dx, dy) <= (radarRange / 100) * MAP_W;
  };
  const radarAllowsObject = (obj) => {
    if (!radarRange || !obj) return false;
    return pointInRadar(obj);
  };
  const isAlwaysVisibleNavNode = (obj) => {
    if (type === 'galaxy') return true;
    const kind = String(obj?.kind || '').toLowerCase();
    const typeText = String(obj?.type || obj?.economy_type || '').toLowerCase();
    const nameText = String(obj?.name || obj?.label || '').toLowerCase();
    const gateLike = kind === 'gate' || /gate|jump/.test(typeText) || /gate|jump/.test(nameText);
    return gateLike || kind === 'planet';
  };
  const scanPingDiameterPx = (ping) => Math.max(0, (Number(ping?.radius_pct || 0) / 100) * MAP_W * 2);
  const isHostile = (t) => !!(t?.hostile || t?.attackable || ['pirate','raider','alien','bounty'].includes(String(t?.role || '').toLowerCase()));
  const radarNodes = radarRange > 0 ? nodes.filter(pointInRadar) : [];
  const radarShips = radarRange > 0 ? trafficForView.filter(pointInRadar) : [];
  const radarHostiles = radarShips.filter(isHostile);
  const radarOre = radarRange > 0 ? oreSites.filter(pointInRadar) : [];
  const radarWrecks = radarRange > 0 ? salvageIcons.filter(pointInRadar) : [];
  const radarAncient = radarRange > 0 ? explorationSites.filter(pointInRadar) : [];
  const radarPirates = radarRange > 0 ? pirateStations.filter(pointInRadar) : [];
  const radarBases = radarRange > 0 ? playerBases.filter(pointInRadar) : [];
  const radarEvents = radarRange > 0 ? eventSites.filter(pointInRadar) : [];
  const radarLocationLabel = type === 'galaxy' ? 'galaxies' : 'places';
  const systemGalaxyId = Math.abs(Number(map.current_galaxy_id || state?.location?.galaxy_id || 1) || 1);
  const systemSunIndex = celestialSunAssets.length ? (Math.max(1, systemGalaxyId) - 1) % celestialSunAssets.length : 0;
  const systemSunAsset = type === 'system' ? celestialSunAssets[systemSunIndex] : '';
  const clientHiddenOutsideRadar = type === 'system'
    ? trafficForView.filter(t => !pointInRadar(t)).length
      + oreSites.filter(o => !pointInRadar(o)).length
      + salvageIcons.filter(w => !pointInRadar(w)).length
      + explorationSites.filter(site => !pointInRadar(site)).length
      + pirateStations.filter(st => !pointInRadar(st)).length
      + playerBases.filter(b => !pointInRadar(b)).length
      + eventSites.filter(ev => !pointInRadar(ev)).length
      + warZones.filter(w => !pointInRadar(w)).length
      + scanBlips.filter(b => !pointInRadar(b)).length
      + nodes.filter(n => !isAlwaysVisibleNavNode(n) && !pointInRadar(n)).length
    : 0;
  const radarSummaryLabel = type === 'galaxy'
    ? `Command map: ${fmt(nodes.length)} galaxies, ${fmt(lanes.length)} lanes, ${fmt(nodes.filter(galaxyWarActive).length)} war fronts`
    : radarRange > 0
      ? `Radar ${fmt(radarRange)}% view: ${fmt(radarNodes.length)} ${radarLocationLabel}, ${fmt(radarShips.length)} ships, ${fmt(radarHostiles.length)} hostile, ${fmt(radarOre.length)} ore, ${fmt(radarWrecks.length)} wrecks, ${fmt(radarAncient.length)} ancient, ${fmt(radarPirates.length)} pirate, ${fmt(radarBases.length)} bases, ${fmt(radarEvents.length)} events`
      : 'Radar inactive: no local contacts in view';
  const radarSummaryTooltip = type === 'galaxy'
    ? 'Strategic galaxy command view. Local radar, local ship traffic, and system travel markers are hidden here.'
    : `${regionSummary} Hidden outside radar: ${fmt(clientHiddenOutsideRadar || summary.hidden_by_radar || 0)}. Activity: ${label(travel?.active ? travel.mode : 'idle')}${travel?.active ? `, ${clockTimeLeft(travel.arrival_at)} remaining` : ''}.`;
  const galaxyTerritoryGroups = useMemo(() => {
    if (type !== 'galaxy') return [];
    const groups = new Map();
    nodes.forEach(node => {
      const intel = state?.galaxy_war_intel?.by_galaxy?.[String(node?.id ?? node?.galaxy_id)] || null;
      const owner = intel?.owner_faction || {};
      const key = String(owner.id || node.faction_id || node.faction_name || node.color || 'neutral');
      const color = factionCssColor(owner.color || node.faction_color || node.color);
      const point = {
        id:node.id,
        x:Number(node.x_pct ?? 50),
        y:Number(node.y_pct ?? 50),
        node,
      };
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      if (!groups.has(key)) groups.set(key, {key, color, points:[], war:false});
      const group = groups.get(key);
      group.points.push(point);
      group.war ||= galaxyWarActive(node);
    });
    const makeLinks = (points) => {
      if (points.length < 2) return [];
      const visited = new Set([0]);
      const links = [];
      while (visited.size < points.length) {
        let best = null;
        for (const fromIndex of visited) {
          points.forEach((candidate, toIndex) => {
            if (visited.has(toIndex)) return;
            const from = points[fromIndex];
            const distance = Math.hypot(from.x - candidate.x, from.y - candidate.y);
            if (!best || distance < best.distance) best = {from, to:candidate, toIndex, distance};
          });
        }
        if (!best) break;
        visited.add(best.toIndex);
        links.push(best);
      }
      return links;
    };
    return Array.from(groups.values())
      .filter(group => group.points.length > 1)
      .map(group => ({...group, links:makeLinks(group.points)}));
  }, [type, nodes, state?.galaxy_war_intel]);
  const missionCooldownActive = !!missionCooldown?.active;
  const missionCooldownLabel = missionCooldownActive
    ? `Planet Mission: ${fmt(missionCooldown?.minutesRemaining || 0)}m`
    : 'Planet Mission: Ready';
  const missionCooldownDetail = missionCooldownActive
    ? (missionCooldown?.reason || 'Planet mission recovery active.')
    : 'No active planet mission cooldown.';
  const scanArea = summary.scan_area || {};
  const scanCooldownUntilMs = scanArea.cooldown_until ? new Date(scanArea.cooldown_until).getTime() : 0;
  const scanCooldownTotalMs = Math.max(1, Number(scanArea.cooldown_seconds || 0) * 1000);
  const scanCooldownStartRaw = scanArea.cooldown_started_at ? new Date(scanArea.cooldown_started_at).getTime() : NaN;
  const scanCooldownStartMs = Number.isFinite(scanCooldownStartRaw) ? scanCooldownStartRaw : scanCooldownUntilMs - scanCooldownTotalMs;
  const scanCooldownMs = scanCooldownUntilMs ? scanCooldownUntilMs - Number(clock || Date.now()) : 0;
  const scanCooldownActive = scanCooldownMs > 0;
  const scanChargeRaw = scanCooldownActive
    ? ((Number(clock || Date.now()) - scanCooldownStartMs) / Math.max(1, scanCooldownUntilMs - scanCooldownStartMs)) * 100
    : 100;
  const scanChargePct = Math.max(0, Math.min(100, Math.floor(scanChargeRaw)));
  const scanChargeState = scanChargePct >= 100 ? 'ready' : scanChargePct >= 50 ? 'chargingMid' : 'chargingLow';
  const scanCooldownSeconds = Math.max(0, Math.ceil(scanCooldownMs / 1000));
  const scanStatusLabel = scanCooldownActive ? `${scanCooldownSeconds}s Probe` : 'Probe Ready';
  const scanStatusDetail = scanCooldownActive
    ? `Probe launcher recharging. Global cooldown is ${fmt(scanArea.cooldown_seconds || 10)}s. Radius ${fmt(scanArea.radius_pct || 0)}%.`
    : `Probe launcher ready. Sends a probe to mark class-only contacts for ${fmt(scanArea.duration_seconds || 30)}s; radar still controls what renders.`;
  const playerFactionColor = factionCssColor(summary?.player_faction?.color);
  const visibleTraffic = useMemo(
    () => trafficForView.filter(t => layers.ships && radarAllowsObject(t) && (layers.hostiles || !t.hostile) && (layers.patrols || !isPatrol(t)) && inRenderBounds(t)),
    [trafficForView, layers.ships, layers.hostiles, layers.patrols, inRenderBounds, radarRange, radarCenter.x, radarCenter.y]
  );
  const visibleOreSites = useMemo(() => layers.ore ? oreSites
    .filter(o => radarAllowsObject(o) && inRenderBounds(o))
    .map(o => {
      const tier = o.tier || o.rewardTier || 1;
      const hint = `ore ${o.oreCode || o.code || o.resource_type || ''} ${o.name || o.label || ''} tier ${tier}`;
      return {...o, resource_type:hint};
    }) : [], [layers.ore, oreSites, inRenderBounds, radarRange, radarCenter.x, radarCenter.y]);
  const visibleSalvageIcons = useMemo(() => layers.wrecks ? salvageIcons
    .filter(w => radarAllowsObject(w) && inRenderBounds(w))
    .map(w => {
      const tier = w.ship_tier || w.tier || 1;
      return {...w, visualCategory:`salvage wreck ${w.code || ''} ${w.ship_name || w.label || ''} tier ${tier}`};
    }) : [], [layers.wrecks, salvageIcons, inRenderBounds, radarRange, radarCenter.x, radarCenter.y]);
  const visibleExplorationSites = useMemo(() => layers.exploration ? explorationSites
    .filter(site => radarAllowsObject(site) && inRenderBounds(site))
    .map(site => {
      const tier = site.rewardTier || site.tier || 1;
      return {...site, visualCategory:`anomaly exploration ${site.siteCode || site.code || ''} ${site.signalState || ''} ${site.realName || site.name || site.label || ''} tier ${tier}`};
    }) : [], [layers.exploration, explorationSites, inRenderBounds, radarRange, radarCenter.x, radarCenter.y]);
  const visiblePlayerBases = useMemo(() => layers.bases ? playerBases.filter(b => radarAllowsObject(b) && inRenderBounds(b)) : [], [layers.bases, playerBases, inRenderBounds, radarRange, radarCenter.x, radarCenter.y]);
  const visiblePirateStations = useMemo(() => layers.pirates ? pirateStations.filter(st => radarAllowsObject(st) && inRenderBounds(st)) : [], [layers.pirates, pirateStations, inRenderBounds, radarRange, radarCenter.x, radarCenter.y]);
  const visibleEventSites = useMemo(() => layers.events ? eventSites.filter(ev => radarAllowsObject(ev) && inRenderBounds(ev)) : [], [layers.events, eventSites, inRenderBounds, radarRange, radarCenter.x, radarCenter.y]);
  const visibleWarZones = useMemo(() => layers.territory ? warZones.filter(w => pointInRadar(w) && inRenderBounds(w)) : [], [layers.territory, warZones, inRenderBounds, radarRange, radarCenter.x, radarCenter.y]);
  const visibleScanBlips = useMemo(() => scanBlips.filter(b => {
    const expires = b.expiresAt || b.expires_at;
    if (expires && new Date(expires).getTime() <= Number(clock || Date.now())) return false;
    return inRenderBounds(b);
  }), [scanBlips, clock, inRenderBounds, radarRange, radarCenter.x, radarCenter.y]);
  const visibleScanPings = useMemo(() => scanPings.filter(p => {
    const expires = p.expires_at || p.expiresAt;
    if (expires && new Date(expires).getTime() <= Number(clock || Date.now())) return false;
    return inRenderBounds(p);
  }), [scanPings, clock, inRenderBounds, radarRange, radarCenter.x, radarCenter.y]);
  const visibleRouteLanes = useMemo(() => lanes.filter(l => {
    const a = byId[l.from], b = byId[l.to];
    return !!(a && b && pointInRadar(a) && pointInRadar(b));
  }), [lanes, byId, radarRange, radarCenter.x, radarCenter.y]);
  const showActiveCoordinateLine = !!(hasCoordinateTravelLine && pointInRadar(activeCoordinateOrigin) && pointInRadar(activeCoordinateDest));
  const partyMembersForHud = party?.members || [];
  const partyPointFor = (m) => type === 'galaxy'
    ? {x_pct:Number(m.position?.galaxy_x_pct || 50), y_pct:Number(m.position?.galaxy_y_pct || 50)}
    : {x_pct:Number(m.position?.system_x_pct || 50), y_pct:Number(m.position?.system_y_pct || 50)};
  const focusPartyMember = (m) => {
    const pos = m?.position || {};
    const currentGalaxy = Number(map.current_galaxy_id || 0);
    if (type === 'system' && Number(pos.galaxy_id || 0) && Number(pos.galaxy_id || 0) !== currentGalaxy) {
      onViewGalaxy?.({id:Number(pos.galaxy_id)});
      return;
    }
    centerOnPct(partyPointFor(m), 1.1);
  };
  const pctOf = (value,max) => Math.max(0, Math.min(100, Number(value || 0) / Math.max(1, Number(max || 1)) * 100));
  const showAutoExploreControls = type === 'system' && !!onToggleAutoExploreMode;
  const mobileSheetType = mobileSheetObject ? mobileObjectType(mobileSheetObject) : '';
  const mobileSheetHostile = mobileSheetObject ? mobileIsHostile(mobileSheetObject) : false;
  const gatheringActions = state?.gathering_state?.actions || [];
  const currentGatheringPlayerId = Number(state?.gathering_state?.currentPlayerId || state?.player?.id || state?.user?.player_id || 0);
  const visibleGatheringActions = useMemo(() => gatheringActions.filter(a => {
    const x = Number(a?.x_pct ?? a?.x);
    const y = Number(a?.y_pct ?? a?.y);
    return Number.isFinite(x) && Number.isFinite(y) && inRenderBounds({x_pct:x, y_pct:y});
  }), [gatheringActions, inRenderBounds]);
  const currentGatheringAction = useMemo(() => visibleGatheringActions.find(a => (a.players || []).some(p => Number(p.playerId) === currentGatheringPlayerId)), [visibleGatheringActions, currentGatheringPlayerId]);
  const currentGatheringPlayer = currentGatheringAction ? (currentGatheringAction.players || []).find(p => Number(p.playerId) === currentGatheringPlayerId) : null;
  const gatheringSourcePoint = shipPoint || radarCenter || {x:50, y:50};
  const gatheringSourceX = Number(gatheringSourcePoint.x ?? gatheringSourcePoint.x_pct ?? 50);
  const gatheringSourceY = Number(gatheringSourcePoint.y ?? gatheringSourcePoint.y_pct ?? 50);
  const selfMarkerPoint = normalizedMapPoint(shipPoint);
  const radarVisualCenter = selfMarkerPoint || normalizedMapPoint(radarCenter, {x_pct:radarCenter.x, y_pct:radarCenter.y});

  return <div className="mapShell phase23bMapShell" ref={mapShellRef}>
    <div className="mobileProximityMap">
      <div className="mobileMapModeRow">
        <div className="mapModeSwitch" role="group" aria-label="Map view">
          <button type="button" className={type==='system' ? 'active' : ''} aria-pressed={type==='system'} onClick={()=>onMapModeChange && onMapModeChange('system')}>Local</button>
          <button type="button" className={type==='galaxy' ? 'active' : ''} aria-pressed={type==='galaxy'} onClick={()=>onMapModeChange && onMapModeChange('galaxy')}>Galaxy</button>
        </div>
        <button type="button" className="mobileMapLocate" onClick={findMyShip}><LocateFixed size={16}/> Me</button>
      </div>
      <div className="mobileMapStats">
        <span><b>{fmt(mobileMapObjects.length)}</b> contacts</span>
        <span><b>{fmt(radarHostiles.length)}</b> hostile</span>
        <span><b>{travel?.active ? clockTimeLeft(travel.arrival_at) : 'Idle'}</b> status</span>
      </div>
      <div className="mobileMapFilterChips">
        {mobileFilters.map(([key,name])=><button key={key} className={mobileFilter===key?'active':''} onClick={()=>setMobileFilter(key)}>{name}</button>)}
      </div>
      <div className="mobileObjectList" role="list">
        {mobileMapObjects.map(obj => {
          const objType = obj.mobileType || mobileObjectType(obj);
          const hostile = mobileIsHostile(obj);
          const nodeAccentColor = mapNodeAccentColor(obj, type);
          return <button key={obj.objectKey || objectKey(obj)} className={`mobileObjectCard ${hostile ? 'hostile' : ''} type-${objType}`} onClick={()=>openMobileSheet(obj)} style={{'--faction-accent':nodeAccentColor}} role="listitem">
            <span className="mobileObjectIcon">{objType.slice(0,2).toUpperCase()}</span>
            <span className="mobileObjectMain">
              <b>{objectDisplayName(obj)}</b>
              <small>{label(objType)} · {obj.faction_name || obj.factionName || obj.statusText || obj.label || (hostile ? 'Hostile contact' : 'Known contact')}</small>
            </span>
            <span className="mobileObjectMeta">
              <b>{fmt(obj.mobileDistance)}u</b>
              <small>{hostile ? 'Threat' : obj.current ? 'Here' : (obj.dockable || isSystemDockTarget(obj)) ? 'Dockable' : label(obj.role || obj.kind || 'tracked')}</small>
            </span>
          </button>;
        })}
        {!mobileMapObjects.length && <div className="mobileMapEmpty">No contacts match this filter.</div>}
      </div>
    </div>
    {mobileSheetObject && <div className="mobileObjectSheetBackdrop" onMouseDown={closeMobileSheet}>
      <section className={`mobileObjectSheet ${mobileSheetHostile ? 'hostile' : ''}`} onMouseDown={e=>e.stopPropagation()}>
        <header>
          <div><b>{objectDisplayName(mobileSheetObject)}</b><span>{label(mobileSheetType)} · {fmt(mobileDistanceFor(mobileSheetObject))}u away</span></div>
          <button aria-label="Close actions" onClick={closeMobileSheet}><X size={18}/></button>
        </header>
        <div className="mobileObjectSheetBadges">
          <span>{mobileSheetHostile ? 'Hostile' : mobileSheetObject.current ? 'Current location' : 'Tracked'}</span>
          <span>{mobileSheetObject.faction_name || mobileSheetObject.factionName || label(mobileSheetObject.role || mobileSheetObject.kind || 'neutral')}</span>
          {(mobileSheetObject.inActionRange === false || needsApproach(mobileSheetObject)) && <span>Approach needed</span>}
        </div>
        <div className="mobileObjectSheetActions">
          {mobileSheetType === 'galaxy' && <button disabled={travelBlocked || mobileSheetObject.current} onClick={()=>runMobileAction(onTravel,mobileSheetObject)}>Travel</button>}
          {mobileSheetType === 'galaxy' && <button onClick={()=>runMobileAction(onViewGalaxy,mobileSheetObject)}>View Local</button>}
          {mobileSheetType === 'planet' && isSystemDockTarget(mobileSheetObject) && <button disabled={travelBlocked || (mobileSheetObject.current && !travel?.open_space)} onClick={()=>runMobileAction(onTravel,{...mobileSheetObject, kind:mobileSheetObject.kind || 'planet'})}>{mobileSheetObject.current && !travel?.open_space ? 'Docked Here' : 'Travel / Dock'}</button>}
          {mobileSheetObject.kind === 'gate' && <button disabled={travelBlocked || !onTravel} onClick={()=>runMobileAction(onTravel,mobileSheetObject)}>Jump Gate</button>}
          {isUninhabitableNode(mobileSheetObject) && (mobileSheetObject.mission_contracts || []).slice(0,1).map(m => <button key={m.key} disabled={travelBlocked || !onMissionTravel || !m.canStart} onClick={()=>runMobileAction(()=>onMissionTravel && onMissionTravel(mobileSheetObject,m))}>{m.name}</button>)}
          {(mobileSheetType === 'ship' || mobileSheetType === 'npc' || mobileSheetObject.attackable) && <button onClick={()=>inspectMobileObject(mobileSheetObject)}>{canShowInspect(mobileSheetObject) ? 'Inspect' : 'Scan / Inspect'}</button>}
          {(mobileSheetType === 'ship' || mobileSheetType === 'npc' || mobileSheetObject.attackable) && <button className="dangerBtn" disabled={!mobileSheetObject.attackable || mobileSheetObject.canAttack === false || mobileSheetObject.inActionRange === false} onClick={()=>runMobileAction(onIntercept,mobileSheetObject)}>Attack</button>}
          {(mobileSheetType === 'ship' || mobileSheetType === 'npc' || mobileSheetObject.attackable) && <button disabled={!onGoHere} onClick={()=>runMobileAction(onGoHere,targetPayload(mobileSheetObject))}>Track</button>}
          {mobileSheetObject.kind === 'ore' && <button disabled={travelBlocked} onClick={()=>runMobileAction(mobileSheetObject.inActionRange === false ? onGoHere : onMine, mobileSheetObject.inActionRange === false ? targetPayload(mobileSheetObject) : mobileSheetObject)}>{mobileSheetObject.inActionRange === false ? 'Approach' : 'Mine'}</button>}
          {mobileSheetObject.kind === 'salvage' && <button disabled={travelBlocked} onClick={()=>runMobileAction(mobileSheetObject.inActionRange === false ? onGoHere : onSalvage, mobileSheetObject.inActionRange === false ? targetPayload(mobileSheetObject) : mobileSheetObject)}>{mobileSheetObject.inActionRange === false ? 'Approach' : 'Collect'}</button>}
          {mobileSheetObject.kind === 'exploration' && <button disabled={travelBlocked} onClick={()=>runMobileAction(mobileSheetObject.inActionRange === false ? onGoHere : onScanSite, mobileSheetObject.inActionRange === false ? targetPayload(mobileSheetObject) : mobileSheetObject)}>{mobileSheetObject.inActionRange === false ? 'Approach' : 'Scan Signal'}</button>}
          {mobileSheetObject.kind === 'pirate_station' && <button className="dangerBtn" disabled={travelBlocked || mobileSheetObject.locked || !onEnterPirateStation} onClick={()=>runMobileAction(onEnterPirateStation,mobileSheetObject)}>{mobileSheetObject.locked ? 'Unavailable' : 'Enter Station'}</button>}
          {mobileSheetObject.kind === 'server_event' && <button disabled={travelBlocked || !onGoHere} onClick={()=>runMobileAction(onGoHere,{x_pct:mobileSheetObject.x_pct,y_pct:mobileSheetObject.y_pct,label:mobileSheetObject.name || 'Server event',map_type:type})}>Enter Event</button>}
          {!['ship','npc'].includes(mobileSheetType) && <button onClick={()=>inspectMobileObject(mobileSheetObject)}>{canShowInspect(mobileSheetObject) ? 'Inspect' : 'Scan Details'}</button>}
        </div>
      </section>
    </div>}
    <div className="mapToolbar enhancedMapToolbar singleRowMapToolbar mapCommandBar" onMouseDown={stopMapBubble} onMouseUp={stopMapBubble} onClick={stopMapBubble}>
      <div className="mapToolbarLeft mapCommandPrimary">
        <div className="mapModeSwitch" role="group" aria-label="Map view">
          <button type="button" className={type==='system' ? 'active' : ''} aria-pressed={type==='system'} onClick={()=>onMapModeChange && onMapModeChange('system')}>System</button>
          <button type="button" className={type==='galaxy' ? 'active' : ''} aria-pressed={type==='galaxy'} onClick={()=>onMapModeChange && onMapModeChange('galaxy')}>Galaxy</button>
        </div>
        <button type="button" className="mapMyShipButton hasHoverTooltip" aria-label="Center my ship" data-tooltip="Center your ship at mid zoom" onClick={findMyShip}><LocateFixed size={15}/><span>My Ship</span></button>
        <div className="mapZoomCluster" role="group" aria-label="Map zoom controls">
          <button type="button" className="mapIconButton hasHoverTooltip" aria-label="Zoom out" data-tooltip="Zoom out" onClick={()=>zoomBy(-0.075, 'center')}><Minus size={16}/><span className="srOnly">Zoom out</span></button>
          <button type="button" className="mapIconButton hasHoverTooltip" aria-label="Reset map view" data-tooltip="Reset view" onClick={resetView}><RotateCcw size={16}/><span className="srOnly">Reset view</span></button>
          <button type="button" className="mapIconButton hasHoverTooltip" aria-label="Zoom in" data-tooltip="Zoom in" onClick={()=>zoomBy(0.075, 'center')}><Plus size={16}/><span className="srOnly">Zoom in</span></button>
        </div>
        <span className="mapRadarSummary mapStatusChip hasHoverTooltip" tabIndex={0} data-tooltip={radarSummaryTooltip}><Radar size={15}/><span>{radarSummaryLabel}</span></span>
      </div>
      <div className="mapToolbarRight">
        <div className="mapLayerPanel">
          <button type="button" className={`mapLayerLabel mapFilterMenuButton ${filtersOpen ? 'active' : ''}`} aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(v => !v)}><Filter size={14}/> Filters <span>{activeLayerFilterCount}/{layerFilterOptions.length}</span></button>
          {filtersOpen && <div className="mapLayerChecklist" role="group" aria-label="Map filters">
            <button type="button" className="mapLayerBulkToggle" onClick={()=>setAllLayerFilters(!allLayerFiltersActive)} aria-label={allLayerFiltersActive ? 'Uncheck all map filters' : 'Check all map filters'}>
              <BulkLayerIcon size={14}/>
              <span>{allLayerFiltersActive ? 'Uncheck All' : 'Check All'}</span>
            </button>
            {layerFilterOptions.map(([key,name]) => <label key={key} className={layers[key] ? 'active' : ''}>
              <input type="checkbox" checked={!!layers[key]} onChange={()=>toggleLayer(key)} />
              <span>{name}</span>
            </label>)}
          </div>}
        </div>
        <span className={`mapScanSummary mapStatusChip hasHoverTooltip ${scanChargeState}`} tabIndex={0} data-tooltip={scanStatusDetail} style={{'--scan-charge-pct':`${scanChargePct}%`}}><Zap size={15}/><span>{scanStatusLabel}</span></span>
        <span className={`mapToolbarMissionCooldown mapStatusChip mapPlanetMissionSummary hasHoverTooltip ${missionCooldownActive ? 'active' : 'ready'}`} tabIndex={0} data-tooltip={missionCooldownActive ? missionCooldownDetail : 'You can start a planet mission right now.'}>
          <Globe2 size={14}/>
          <b>{missionCooldownLabel}</b>
          <small>{missionCooldownActive ? missionCooldownDetail : 'You can start a planet mission right now.'}</small>
        </span>
      </div>
    </div>
    <div className={`mapViewport ${zoomClass}`} ref={viewportRef} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={()=>{dragRef.current=null}} onWheel={onWheel} onWheelCapture={onWheel} onClick={()=>{}}>
      {showAutoExploreControls && <div className={`mapAutoExploreOverlay ${autoExploreMode ? 'active' : 'paused'}`} onMouseDown={stopMapBubble} onMouseUp={stopMapBubble} onClick={stopMapBubble}>
        <div className="mapAutoExploreCluster" role="group" aria-label="AFK automation controls">
          {AUTO_EXPLORE_MODE_OPTIONS.map(mode => {
            const active = autoExploreMode === mode.key;
            const Icon = mode.key === 'pirate' ? Crosshair : mode.key === 'salvage' ? Hammer : mode.key === 'anomaly' ? Radar : Factory;
            return <button key={mode.key} type="button" className={`mapAutoExploreButton hasHoverTooltip ${active ? 'active' : ''}`} aria-pressed={active} data-tooltip={mode.tooltip} onClick={()=>onToggleAutoExploreMode(mode.key)}><Icon size={15}/><span>{active ? mode.activeLabel : mode.label}</span></button>;
          })}
        </div>
      </div>}
      {!!partyMembersForHud.length && <div className="partyMapHud" onMouseDown={stopMapBubble} onMouseUp={stopMapBubble} onClick={stopMapBubble}>{partyMembersForHud.map(m=><button key={m.playerId} type="button" className={`partyHudCard ${m.isLeader ? 'leader' : ''}`} onClick={()=>focusPartyMember(m)}><ProfileAvatar profile={{avatarUrl:m.avatarUrl, displayName:m.displayName}} size="tiny"/><span><b>{m.displayName || m.username}</b><i><em style={{width:`${pctOf(m.ship?.shield,m.ship?.maxShield)}%`}} /></i><i><em style={{width:`${pctOf(m.ship?.hull,m.ship?.maxHull)}%`}} /></i></span></button>)}</div>}
      <div ref={mapWorldRef} className={`infoMap ${type}Map openWorldMap mapWorld`} style={{width:MAP_W, height:MAP_H, minWidth:MAP_W, minHeight:MAP_H, transform:`translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin:'0 0'}}>
        {systemSunAsset && <img className="systemSunArt" src={systemSunAsset} alt="" aria-hidden="true" />}
        {type === 'system' && radarRange > 0 && radarVisualCenter && <span className="playerRadarRing mapRadarRangeRing" aria-hidden="true" style={{left:`${radarVisualCenter.x_pct}%`, top:`${radarVisualCenter.y_pct}%`, width:`${radarDiameterPx}px`, height:`${radarDiameterPx}px`}} />}
        {type === 'system' && layers.danger && nodes.map(n => pointInRadar(n) && Number(n.risk_level || 0) >= 45 ? <span key={`danger-${n.id}`} className={`dangerZone ${Number(n.risk_level || 0) >= 70 ? 'extreme' : 'high'}`} style={{left:`${n.x_pct}%`, top:`${n.y_pct}%`}} /> : null)}
        {type === 'system' && layers.market && nodes.map(n => pointInRadar(n) ? <span key={`market-${n.id}`} className="marketPulse hasHoverTooltip" style={{left:`${n.x_pct}%`, top:`${n.y_pct}%`}} data-tooltip={`Market pressure here: legal ${n.legal_market_strength || 0}, illicit ${n.illicit_market_strength || 0}.`} /> : null)}
        {visibleScanPings.map(p => {
          const diameter = scanPingDiameterPx(p);
          return <span key={p.id} className="scanAreaPing" style={{left:`${p.x_pct}%`, top:`${p.y_pct}%`, width:`${diameter}px`, height:`${diameter}px`, '--scan-ping-duration':`${Number(p.animation_seconds || 2)}s`}} />;
        })}
        {!!visibleGatheringActions.length && <svg className="gatheringTethers" viewBox="0 0 100 100" preserveAspectRatio="none">
          {visibleGatheringActions.flatMap((a, ai) => (a.players || []).map((p, pi) => {
            const active = !!(p.activeMinigame || p.bonusActive);
            const ox = ((pi % 3) - 1) * 0.45;
            const oy = (Math.floor(pi / 3) - 0.5) * 0.34;
            return <line key={`${a.actionId || a.nodeId}:${p.playerId}:${pi}`} x1={gatheringSourceX + ox} y1={gatheringSourceY + oy} x2={Number(a.x_pct ?? a.x)} y2={Number(a.y_pct ?? a.y)} className={`${a.actionType || 'gather'} ${active ? 'active' : 'passive'} ${p.bonusActive ? 'bonus' : ''}`} />;
          }))}
        </svg>}
        {visibleGatheringActions.map(a => {
          const active = (a.players || []).some(p => p.activeMinigame || p.bonusActive);
          return <span key={`gather-fx-${a.actionId || a.nodeId}`} className={`gatheringNodeFx ${a.actionType || 'gather'} ${active ? 'active' : 'passive'}`} style={{left:`${a.x_pct}%`, top:`${a.y_pct}%`, '--gather-count':Math.max(1, Number(a.gatheringCount || 1))}} />;
        })}
        {partyMembersForHud.map(m => { const pt = partyPointFor(m); const same = type === 'galaxy' || Number(m.position?.galaxy_id || 0) === Number(map.current_galaxy_id || 0); return same && pointInRadar(pt) ? <span key={`party-radar-${m.playerId}`} className="partyRadarRing hasHoverTooltip" style={{left:`${pt.x_pct}%`, top:`${pt.y_pct}%`}} data-tooltip={`${m.displayName || 'Party member'} is sharing radar from here.`} /> : null; })}
        {visibleScanBlips.map(b => {
          const blipClass = b.blipClass || b.category || 'contact';
          return <button key={b.id || b.objectKey} type="button" className={`scanBlipMarker hasHoverTooltip ${blipClass}`} style={{left:`${b.x_pct}%`, top:`${b.y_pct}%`, transform:iconTransform}} onMouseUp={(e)=>openContext(e,b)} data-tooltip={`${label(blipClass)} blip. Scan it to resolve details.`}><ScanBlipIcon type={blipClass} /></button>;
        })}
        {layers.territory && type === 'galaxy' && !!galaxyTerritoryGroups.length && <svg className="galaxyTerritoryFabric" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {galaxyTerritoryGroups.flatMap(group => group.links.map((link, index) => <line key={`${group.key}-fabric-${index}`} x1={link.from.x} y1={link.from.y} x2={link.to.x} y2={link.to.y} className={group.war ? 'war' : ''} style={{'--territory-color':group.color}} />))}
        </svg>}
        {layers.territory && type === 'galaxy' && nodes.map(n => {
          const intel = galaxyIntelFor(n);
          const zoneColor = factionCssColor(intel?.owner_faction?.color || n.faction_color || n.color);
          const zoneState = galaxyWarActive(n) ? 'war' : (intel?.war_state || n.territory_status || 'secure');
          const zoneScale = Math.max(1, Math.min(1.75, Number(n.planet_count || 1) / 4));
          const galaxyVisual = galaxyVisualFor(n);
          return <span key={`galaxy-zone-${n.id}`} className={`galaxyControlZone ${galaxyVisual.visualClass} ${zoneState} ${n.current ? 'current' : ''}`} style={{left:`${n.x_pct}%`, top:`${n.y_pct}%`, '--territory-color': zoneColor, '--zone-scale':zoneScale, ...galaxyVisual.cssVars}}><GameImage className="galaxyZoneArt" src={n.image_url} assetType="galaxy" category={`${n.name || ''} ${n.sector || ''} ${n.faction_name || ''}`} alt="" /></span>;
        })}
        {layers.territory && type === 'system' && nodes.filter(n => n.kind !== 'gate' && pointInRadar(n)).map(n => <span key={`territory-${n.id}`} className={`territoryOverlay ${n.territory_status || 'secure'} ${n.is_border_system ? 'border' : ''}`} style={{left:`${n.x_pct}%`, top:`${n.y_pct}%`, '--territory-color': mapNodeFactionColor(n)}} />)}
        {visibleWarZones.map(w => <span key={w.id} className={`galaxyWarRing planetWarRing hasHoverTooltip ${w.territory_status || ''}`} style={{left:`${w.x_pct}%`, top:`${w.y_pct}%`, width:`${w.radius_pct*2}%`, height:`${w.radius_pct*2}%`}} data-tooltip={`${w.name}: ${w.status === 'contested' ? 'contested territory' : 'capture ring'}. Hold this area to push the war.`} />)}
        {visibleWarZones.map(w => <button key={`${w.id}:station`} className="captureStationMarker hasHoverTooltip" style={{left:`${w.x_pct}%`, top:`${w.y_pct}%`, transform:iconTransform}} onMouseUp={(e)=>openContext(e,w)} data-tooltip={`${w.name}: war objective. Scan it before opening full details.`}>⚔</button>)}
        {layers.routes && <svg className="mapLines" viewBox="0 0 100 100" preserveAspectRatio="none">{visibleRouteLanes.map(l => { const a = byId[l.from], b = byId[l.to]; if (!a || !b) return null; return <line key={l.key} x1={a.x_pct} y1={a.y_pct} x2={b.x_pct} y2={b.y_pct} className={l.active && !hasCoordinateTravelLine ? 'lane active' : l.visited ? 'lane visited' : 'lane planned'} />; })}{showActiveCoordinateLine && <line x1={activeCoordinateOrigin.x_pct} y1={activeCoordinateOrigin.y_pct} x2={activeCoordinateDest.x_pct} y2={activeCoordinateDest.y_pct} className="lane active mapCoordinateTravelLine" />}</svg>}
        {nodes.filter(n => isAlwaysVisibleNavNode(n) || pointInRadar(n)).map(n => {
          const isGateNode = isGalaxyGateMapNode(n);
          const displayName = objectDisplayName(n);
          n = {...n, name:displayName, kind:isGateNode ? 'gate' : (n.kind || 'planet')};
          const isCurrentNode = !!(n.current || n.id===currentId);
          const isDockedNode = isCurrentNode && !travel?.active && !travel?.open_space;
          const territoryLabel = n.territory_status === 'war' ? 'WAR' : n.territory_status === 'contested' ? 'CONTESTED' : n.is_border_system ? 'BORDER' : '';
          const galaxyStatus = type === 'galaxy' ? galaxyStatusPayload(n) : null;
          const galaxyMeta = galaxyStatus?.warActive ? 'WAR ACTIVE' : galaxyStatus?.statusText || label(n.territory_status || 'Stable');
          const gateCountdown = isGateNode ? gateNodeCountdown(n) : '';
          return <button key={n.id} className={`mapNode hasHoverTooltip ${isGateNode ? 'gateNode' : ''} ${isUninhabitableNode(n) ? 'uninhabitableNode' : ''} ${isCurrentNode ? 'current' : ''} ${isDockedNode ? 'dockedCurrent' : ''} ${n.visited ? 'visited' : ''} ${Number(n.risk_level || 0) >= 65 ? 'riskyNode' : ''} ${n.capturable===false ? 'homeGalaxyNode' : ''} ${n.territory_status === 'war' ? 'territoryWarNode' : ''} ${n.territory_status === 'contested' || n.is_border_system ? 'contestedNode' : ''}`} style={{left:`${n.x_pct}%`, top:`${n.y_pct}%`, transform:nodeTransform, '--faction-color': mapNodeAccentColor(n, type)}} onMouseUp={(e)=>openContext(e,{...n,kind:n.kind || 'node'})} data-tooltip={type === 'galaxy' ? `${n.name}: ${n.faction_name || 'Neutral'} influence here. ${n.territory_status === 'war' ? 'Active territory war in this galaxy. ' : n.territory_status === 'contested' ? 'Contested territory pressure in this galaxy. ' : ''}Open it when you want the safety, trade, and conflict readout.` : isGateNode ? `${n.name}: this is your route to a neighboring galaxy. Dock here before jumping.` : `${n.name}: ${territoryLabel ? `${territoryLabel}. ` : ''}risk ${n.risk_level ?? '—'}, security ${n.security_level ?? '—'}, stability ${n.stability_level ?? '—'}. Good quick check before docking or taking jobs.`}><GameImage src={isGateNode ? '' : n.image_url} assetType={isGateNode ? 'station' : type === 'galaxy' ? 'galaxy' : (String(n.type || '').toLowerCase().includes('station') || String(n.type || '').toLowerCase().includes('freeport') ? 'station' : 'planet')} category={mapPlanetAssetCategory(n, isGateNode)} hint={isGateNode ? 'station gate galaxy jump gate' : mapPlanetAssetCategory(n, isGateNode)} alt={n.name} /><b>{n.name}</b>{type === 'galaxy' ? <span>{n.faction_name || 'Neutral'} • {n.territory_status === 'war' ? `${n.territory_war_count || 0} WAR • ` : n.territory_status === 'contested' ? `${n.contested_zone_count || 0} CONTESTED • ` : ''}Bonus {n.control_bonus_pct || 0}% • {n.capturable ? 'Capturable' : 'Home Safe'}</span> : isGateNode ? <><span>Jump lane • adjacent galaxy</span>{gateCountdown && <em className="gateNodeCountdown">{gateCountdown}</em>}</> : isUninhabitableNode(n) ? <span>{territoryLabel ? `${territoryLabel} • ` : ''}Uninhabitable planet • Missions only • RISK {n.risk_level}</span> : <span>{territoryLabel ? `${territoryLabel} • ` : ''}SEC {n.security_level} • STAB {n.stability_level} • RISK {n.risk_level}</span>}</button>
        })}
        {nodes.filter(n => isAlwaysVisibleNavNode(n) || pointInRadar(n)).map(n => {
          const marker = refiningMarkerForNode(n);
          return marker ? <span key={`refining-${type}-${n.id}`} className={`refiningMapBadge ${marker.complete ? 'complete' : 'active'} hasHoverTooltip`} style={{left:`${n.x_pct}%`, top:`${n.y_pct}%`, transform:iconTransform}} data-tooltip={marker.complete ? `${n.name}: refining output ready to claim.` : `${n.name}: ${marker.count} refining job(s) active.`}><Hammer size={11}/><em>{marker.complete ? 'Ready' : fmt(marker.count)}</em></span> : null;
        })}
        {selfMarkerPoint && <button className={`shipMarker selfShip ${travel?.mode === 'intercept' ? 'intercepting' : ''} ${!travel?.active && travel?.open_space ? 'parkedOpenSpace' : ''}`} style={{left:`${selfMarkerPoint.x_pct}%`, top:`${selfMarkerPoint.y_pct}%`, transform:iconTransform, '--ship-faction-color': playerFactionColor}} onMouseUp={(e)=>openContext(e,{kind:'self', name:travel?.mode === 'intercept' ? 'Your Ship — Intercept Course' : 'Your Ship', label:travel?.intercept_target_name ? `Intercepting ${travel.intercept_target_name}` : (travel?.open_space ? 'Holding position in open space.' : 'You are traveling in open space.'), progress:Math.round(progress*100)})}>
          <span className="selfShipVisual" aria-hidden="true"><GameImage className="selfShipImg" src={state?.active_ship?.image_url} assetType="ship" category={`${summary?.player_faction?.name || ''} ${state?.active_ship?.role || state?.active_ship?.class_name || state?.active_ship?.template_name || state?.active_ship?.name || (travel?.mode === 'intercept' ? 'interceptor combat' : 'player explorer')}`} alt="" /></span><span className="selfShipName">{travel?.active ? `${Math.round(progress*100)}%` : 'YOU'}</span><small className="mapShipLevel">Lv {fmt(state?.player?.level || 1)}</small></button>}
        {visibleTraffic.map(t => {
          const trafficLevel = t.npcLevel || t.npc_level || t.level || t.playerLevel || t.player_level || t.ship_level || 1;
          const atWar = !!(t.atWar || t.at_war || t.guildWar || t.guild_war || t.warTarget || t.war_target || String(t.hostileReason || t.statusText || t.label || '').toLowerCase().includes('war'));
          const securityType = String(t.securityDefenseType || '').toLowerCase();
          const shipHint = [t.faction_name, t.faction, t.playerFactionName, t.npcFactionName, t.ship_class, t.class_name, t.ship_name, t.role, t.kind, t.name, securityType, t.securityDefense ? 'security defense' : '', t.hostile ? 'combat fighter' : 'exploration scout'].filter(Boolean).join(' ');
          const markerLabel = t.securityDefense ? (securityType === 'turret' ? 'TUR' : 'SEC') : (t.partyMember ? 'PARTY' : t.npcObjective ? label(t.npcObjective).slice(0,7) : `${Math.round(t.progress || 0)}%`);
          const securityClass = t.securityDefense ? `securityDefense ${securityType}` : '';
          if (t.securityDefense) {
            const securityTooltip = `${t.name || 'Security defender'} - Lv ${fmt(trafficLevel)}. ${securityType === 'turret' ? 'Gate turret. It fires on wanted or opposing-faction pilots.' : 'Security patrol. It roams the map and can join battles.'}`;
            return <button key={t.id} className={`trafficShip hasHoverTooltip ${t.kind || 'npc'} ${t.hostile ? 'hostile' : ''} patrol ${securityClass} ${atWar ? 'atWar' : ''}`} style={{left:`${t.x_pct}%`, top:`${t.y_pct}%`, transform:iconTransform, '--ship-faction-color': shipFactionColor(t, summary)}} onMouseUp={(e)=>openContext(e,t)} data-tooltip={securityTooltip}><GameImage src={t.image_url} assetType="ship" category={shipHint} hint={shipHint} alt={t.name || t.label || 'Security defender'} /><em>{markerLabel}</em><small className="mapShipLevel">Lv {fmt(trafficLevel)}</small>{atWar && <i className="warSwords" aria-label="War target">âš”</i>}</button>;
          }
          const tooltip = t.securityDefense
            ? `${t.name || 'Security defender'} - Lv ${fmt(trafficLevel)}. ${securityType === 'turret' ? 'Gate turret. It fires on wanted or opposing-faction pilots.' : 'Security patrol. It roams the map and can join battles.'}`
            : `${t.name || t.label || 'Ship'} - Lv ${fmt(trafficLevel)}. ${atWar ? 'War target: fighting them does not use normal bounty/jail rules.' : t.hostile ? 'Hostile contact. Scan before committing if you are not sure.' : 'Local traffic. Scan to open full details.'}`;
          return <button key={t.id} className={`trafficShip hasHoverTooltip ${t.kind || 'npc'} ${t.hostile ? 'hostile' : ''} ${isPatrol(t) ? 'patrol' : ''} ${t.partyMember ? 'partyMember' : ''} ${atWar ? 'atWar' : ''} ${t.scanUnlocked ? 'scanUnlocked' : ''}`} style={{left:`${t.x_pct}%`, top:`${t.y_pct}%`, transform:iconTransform, '--ship-faction-color': shipFactionColor(t, summary)}} onMouseUp={(e)=>openContext(e,t)} data-tooltip={`${t.name || t.label || 'Ship'} • Lv ${fmt(trafficLevel)}. ${atWar ? 'War target: fighting them does not use normal bounty/jail rules.' : t.hostile ? 'Hostile contact. Scan before committing if you are not sure.' : 'Local traffic. Scan to open full details.'}`}><GameImage src={t.image_url} assetType="ship" category={shipHint} hint={shipHint} alt={t.name || t.label || 'Transit ship'} /><em>{t.partyMember ? 'PARTY' : t.npcObjective ? label(t.npcObjective).slice(0,7) : `${Math.round(t.progress || 0)}%`}</em><small className="mapShipLevel">Lv {fmt(trafficLevel)}</small>{atWar && <i className="warSwords" aria-label="War target">⚔</i>}</button>;
        })}
        {visibleOreSites.map(o => <button key={o.id} className="resourceNode oreNode hasHoverTooltip" style={{left:`${o.x_pct}%`, top:`${o.y_pct}%`, transform:iconTransform}} onMouseUp={(e)=>openContext(e,o)} data-tooltip={`${o.name || o.label || 'Ore signature'} • Tier ${o.tier || '—'}. Approach it if you want to mine this site.`}><GameImage src={o.image_url} assetType="material" category={o.resource_type || o.kind || 'ore'} alt={o.name || 'Ore signature'} /><em>T{o.tier}</em></button>)}
        {visibleSalvageIcons.map(w => <button key={w.id} className="resourceNode salvageNode hasHoverTooltip" style={{left:`${w.x_pct}%`, top:`${w.y_pct}%`, transform:iconTransform}} onMouseUp={(e)=>openContext(e,w)} data-tooltip={`${w.ship_name || w.label || 'Wreck'} • Tier ${w.ship_tier || '—'}. This is real salvage from a destroyed ship.`}><GameImage src={w.image_url} assetType="material" category={w.visualCategory || w.kind || 'salvage wreck'} alt={w.ship_name || 'Wreck'} /><em>T{w.ship_tier}</em></button>)}
        {visibleExplorationSites.map(site => <button key={site.id} className={`resourceNode explorationNode hasHoverTooltip ${site.signalState || 'unknown'} ${Number(site.signalQuality || 0) >= 70 ? 'highQuality' : ''}`} style={{left:`${site.x_pct}%`, top:`${site.y_pct}%`, transform:iconTransform}} onMouseUp={(e)=>openContext(e,site)} data-tooltip={`${site.realName || site.name || site.label || 'Exploration site'} • Signal quality ${fmt(site.signalQuality ?? site.rewardTier)}. Scan or approach to learn what is really here.`}><GameImage src={site.image_url} assetType="material" category={site.visualCategory || site.kind || 'ancient exploration'} alt={site.realName || site.name || 'Ancient site'} /><em>Q{fmt(site.signalQuality ?? site.rewardTier)}</em></button>)}
        {visiblePlayerBases.map(b => <button key={b.id} className={`resourceNode playerBaseNode hasHoverTooltip ${b.ownBase ? 'ownBase' : ''}`} style={{left:`${b.x_pct}%`, top:`${b.y_pct}%`, transform:iconTransform}} onMouseUp={(e)=>openContext(e,b)} data-tooltip={b.ownBase ? `${b.name || 'Your base'}: your private base. Dock here to manage it.` : `${b.name || 'Private base'}: another pilot owns this. You cannot dock or attack it.`}><GameImage src={b.image_url} assetType="station" category="player base" alt={b.name || 'Player base'} /><em>{b.ownBase ? 'BASE' : 'PRIV'}</em></button>)}
        {visiblePirateStations.map(st => <button key={st.id} className={`resourceNode pirateStationNode tier${Math.max(1, Math.min(3, Number(st.tier || 2)))} hasHoverTooltip ${st.locked ? 'locked' : ''}`} style={{left:`${st.x_pct}%`, top:`${st.y_pct}%`, transform:iconTransform}} onMouseUp={(e)=>openContext(e,{...st, role:`pirate base tier ${st.tier || 2}`})} data-tooltip={`${st.name || st.label || 'Pirate base'}: assault site with a shared defender pool.`}><GameImage src={st.image_url} assetType="station" category={`pirate base tier ${st.tier || 2}`} alt={st.name || 'Pirate base'} /><em>{fmt(st.resourcePct ?? st.resource_pct)}%</em></button>)}
        {visibleEventSites.map(ev => <button key={ev.id || ev.objectKey} className={`resourceNode eventNode hasHoverTooltip ${ev.eventType || ev.event_type || ev.code || ''}`} style={{left:`${ev.x_pct}%`, top:`${ev.y_pct}%`, transform:iconTransform}} onMouseUp={(e)=>openContext(e,{...ev,kind:'server_event'})} data-tooltip={`${ev.name || ev.label || 'Server event'}: ${ev.selectedSummary || ev.dangerHint || ev.statusText || 'active event site'}`}><GameImage src={ev.image_url} assetType="item" category={ev.eventType || ev.event_type || ev.code || 'server event'} alt={ev.name || 'Server event'} /><em>EVT</em></button>)}
        {currentGatheringAction && currentGatheringPlayer && onGatheringMinigame && <GatheringMinigameOverlay action={currentGatheringAction} playerEntry={currentGatheringPlayer} zoom={zoom} onEvent={onGatheringMinigame} />}
      </div>
    </div>
    {context && <div className="mapContextPopup phase23bPopup" style={{left:popupX, top:popupY}} onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}><b>{context.name || context.label || context.ship_name}</b><small>{context.selectedSummary || context.label || context.statusText || label(context.kind || context.role || 'object')}</small>{blockedReason && <small className="blockedReason">{blockedReason}</small>}{context.inActionRange === false && <small className="blockedReason">{context.rangeLabel || 'Out of range. Approach first.'}</small>}<div className="buttonRow verticalButtons">
      {type === 'system' && context.kind === 'blank' && <button disabled={travelBlocked || !onGoHere} onClick={()=>run(onGoHere,{x_pct:context.x_pct,y_pct:context.y_pct,label:'Open-space waypoint',map_type:type})}>Go Here</button>}
      {context.kind === 'blank' && travel?.active && <button className="dangerBtn" disabled={!onCancelTravel} onClick={()=>run(onCancelTravel,{})}>Cancel Current Travel</button>}
      {type === 'system' && context.kind === 'blank' && <button disabled={travelBlocked || !onScanArea || scanCooldownActive} onClick={()=>run(onScanArea,{x_pct:context.x_pct,y_pct:context.y_pct,map_type:type})}>{scanCooldownActive ? `${scanCooldownSeconds}s Probe Cooldown` : 'Launch Probe'}</button>}
      {type === 'system' && context.kind === 'blank' && <button disabled={travelBlocked || !onPlaceBase} onClick={()=>run(onPlaceBase,{x_pct:context.x_pct,y_pct:context.y_pct})}>Build Base Here</button>}
      {type === 'system' && state?.user?.god_mode && context.kind === 'blank' && <button disabled={!onAdminSpawn} onClick={()=>{ setSpawnContext({x_pct:context.x_pct,y_pct:context.y_pct,map_type:type,adminSpawnConstraints:summary.admin_spawn_constraints}); closeContext(); }}>Spawn</button>}
      {context.kind === 'scan_blip' && scanInspectButton(context, 'Scan Contact', 'Inspect Contact')}
      {isSystemDockTarget(context) && scanInspectButton(context, 'Scan Details', 'Inspect')}
      {type === 'galaxy' && context.kind === 'node' && scanInspectButton(context, 'Scan Details', 'Inspect')}{type === 'galaxy' && context.kind === 'node' && <button onClick={()=>run(onViewGalaxy,context)}>View Map</button>}
      {isUninhabitableNode(context) && scanInspectButton(context, 'Scan Details', 'Inspect')}
      {isUninhabitableNode(context) && <>{(context.mission_contracts || []).slice(0,1).map(m => <button key={m.key} disabled={travelBlocked || !onMissionTravel || !m.canStart} onClick={()=>run(()=>onMissionTravel(context,m),{})}>{m.name} • {fmt(m.minutes)}m</button>)}{!(context.mission_contracts || []).length && <button disabled>No mission available</button>}</>}
      {isSystemDockTarget(context) && (context.current || context.id===currentId) && travel?.open_space && <button disabled={travelBlocked} onClick={()=>run(onTravel,{...context, kind:context.kind || 'planet'})}>Dock Here</button>}
      {isSystemDockTarget(context) && !(context.current || context.id===currentId) && <button disabled={travelBlocked} onClick={()=>run(onTravel,{...context, kind:context.kind || 'planet'})}>Dock Here</button>}
      {type === 'galaxy' && context.kind === 'node' && !(context.current || context.id===currentId) && <button disabled={travelBlocked} onClick={()=>run(onTravel,context)}>Jump Here</button>}
      {context.kind === 'gate' && <button disabled={travelBlocked} onClick={()=>run(onTravel,context)}>Jump Gate</button>}
      {context.kind === 'player_base' && scanInspectButton(context, 'Scan Base', 'Inspect Base')}
      {context.kind === 'player_base' && context.ownBase && <button disabled={travelBlocked || !onDockBase} onClick={()=>run(onDockBase,context)}>Dock At My Base</button>}
      {context.kind === 'player_base' && !context.ownBase && <button disabled className="hasHoverTooltip" data-tooltip="Private base. Another pilot owns it, so you cannot dock here or attack it.">Private Base</button>}
      {(context.kind === 'npc' || context.kind === 'player' || context.attackable) && scanInspectButton(context, 'Scan Ship', 'Inspect Ship')}
      {context.attackable && context.canAttack !== false && <button className="dangerBtn" onClick={()=>run(onIntercept,context)}>Intercept / Attack</button>}
      {context.kind === 'ore' && scanInspectButton(context, 'Scan Ore', 'Inspect Ore')}
      {context.kind === 'ore' && <button disabled={travelBlocked} onClick={()=>run(onGoHere,{x_pct:context.x_pct,y_pct:context.y_pct,label:context.name || 'Ore signature'})}>{needsApproach(context) ? 'Approach Ore' : 'Plot Course to Node'}</button>}
      {context.kind === 'ore' && context.canMine !== false && <button disabled={travelBlocked} onClick={()=>needsApproach(context) ? run(onGoHere,targetPayload(context)) : run(onMine,context)}>{needsApproach(context) ? 'Approach to Mine' : 'Mine'}</button>}
      {context.kind === 'salvage' && scanInspectButton(context, 'Scan Wreck', 'Inspect Wreck')}
      {context.kind === 'salvage' && <button disabled={travelBlocked} onClick={()=>run(onGoHere,{x_pct:context.x_pct,y_pct:context.y_pct,label:context.ship_name || 'Wreck'})}>{needsApproach(context) ? 'Approach Wreck' : 'Plot Course to Wreck'}</button>}
      {context.kind === 'salvage' && context.canSalvage !== false && <button disabled={travelBlocked} onClick={()=>needsApproach(context) ? run(onGoHere,targetPayload(context)) : run(onSalvage,context)}>{needsApproach(context) ? 'Approach to Salvage' : 'Salvage'}</button>}
      {context.kind === 'exploration' && scanInspectButton(context, 'Scan Signal', 'Inspect Signal')}
      {context.kind === 'exploration' && <button disabled={travelBlocked} onClick={()=>run(onGoHere,{x_pct:context.x_pct,y_pct:context.y_pct,label:context.realName || context.name || 'Ancient site'})}>{needsApproach(context) ? 'Approach Site' : 'Plot Course to Site'}</button>}
      {context.kind === 'exploration' && context.canScan !== false && <button disabled={travelBlocked} onClick={()=>needsApproach(context) ? run(onGoHere,targetPayload(context)) : run(onScanSite,context)}>{needsApproach(context) ? 'Approach to Scan' : 'Scan Site'}</button>}
      {context.kind === 'exploration' && context.canInvestigate !== false && <button disabled={travelBlocked} onClick={()=>needsApproach(context) ? run(onGoHere,targetPayload(context)) : run(onInvestigate,context)}>{needsApproach(context) ? 'Approach to Investigate' : 'Investigate'}</button>}
      {context.kind === 'pirate_station' && scanInspectButton(context, 'Scan Station', 'Inspect Station')}
      {context.kind === 'pirate_station' && needsApproach(context) && <button disabled={travelBlocked || !onGoHere} onClick={()=>run(onGoHere,targetPayload(context))}>Approach Station</button>}
      {context.kind === 'pirate_station' && <button className="dangerBtn" disabled={travelBlocked || context.locked || !onEnterPirateStation} onClick={()=>run(onEnterPirateStation,context)}>{context.locked ? 'Unavailable' : needsApproach(context) ? 'Plot Approach / Dock' : 'Enter Station Map'}</button>}
      {context.kind === 'server_event' && scanInspectButton(context, 'Scan Event', 'Inspect Event')}
      {context.kind === 'server_event' && <button disabled={travelBlocked || !onGoHere} onClick={()=>run(onGoHere,{x_pct:context.x_pct,y_pct:context.y_pct,label:context.name || 'Server event',map_type:type})}>{needsApproach(context) ? 'Approach Event' : 'Enter Event Site'}</button>}
      {context.kind === 'war_zone' && scanInspectButton(context, 'Scan Objective', 'Inspect Objective')}
      {context.kind === 'war_zone' && <button disabled={travelBlocked || !onGoHere} onClick={()=>run(onGoHere,{x_pct:context.x_pct,y_pct:context.y_pct,label:context.name,map_type:'system'})}>{needsApproach(context) ? 'Approach Capture Ring' : 'Enter Capture Ring'}</button>}
      <button onClick={closeContext}>Cancel</button></div></div>}
    {selected && selected.kind !== 'blank' && canShowInspect(selected) && <div className="mapInspectOverlay" onMouseDown={()=>setSelectedObject(null)} onMouseUp={stopMapBubble} onClick={stopMapBubble}><div className="mapObjectPanel phase23bObjectPanel mapInspectModal" style={{left:selectedX, top:selectedY}} onMouseDown={e=>e.stopPropagation()}><button className="modalX mapInspectX" onClick={()=>setSelectedObject(null)}>×</button><div className="mapObjectHeader mapObjectHeaderVisual">{selected.kind === 'player' ? <ProfileAvatar profile={findPublicProfile(publicProfiles, selected) || {displayName:selected.name, selectedBadgeCode:selected.selectedBadgeCode}} src={findPublicProfile(publicProfiles, selected)?.avatarUrl} size="md" onClick={()=>{ const p=findPublicProfile(publicProfiles, selected); if(p) setProfileModal(p); }} /> : <GameImage src={selected.kind === 'npc' || selected.attackable ? '' : selected.image_url} assetType={selected.kind === 'npc' || selected.attackable ? 'ship' : selected.kind === 'node' ? (type === 'galaxy' ? 'galaxy' : (selected.type === 'station' ? 'station' : 'planet')) : selected.kind === 'ore' || selected.kind === 'salvage' || selected.kind === 'exploration' ? 'material' : 'item'} category={selected.role || selected.kind || selected.type || selected.economy_type} alt={selected.name || selected.realName || selected.label || selected.ship_name} />}<div><b>{selected.name || selected.realName || selected.label || selected.ship_name}</b><span>{label(selected.kind || selected.role || 'object')} • {selected.statusText || selected.label || ''}</span></div></div><div className="mapMetaGrid"><span>Risk <b>{selected.riskBand || fmt(selected.riskLevel ?? selected.risk_level ?? selected.route_danger ?? 0)}</b></span><span>Reward <b>{selected.rewardHint || `T${fmt(selected.rewardTier ?? selected.tier ?? selected.ship_tier ?? 0)}`}</b></span><span>State <b>{label(selected.signalState || selected.kind || selected.role || 'known')}</b></span><span>ETA <b>{travel?.active ? clockTimeLeft(travel.arrival_at) : 'Idle'}</b></span><span>Radar <b>{selected.radarDistancePct !== undefined ? `${fmt(selected.radarDistancePct)} / ${fmt(selected.radarRangePct || summary.radar_range_pct)}%` : `${fmt(summary.radar_range_pct || 0)}%`}</b></span><span>Range <b>{selected.rangeLabel || (selected.inActionRange === false ? 'Out of Range' : selected.inActionRange === true ? 'In Range' : '—')}</b></span></div><div className="selectedSummary">{selected.selectedSummary || selected.outcomeFactors || 'No extra intel yet. Scan or approach for better data.'}</div><PlanetMissionInspectDetails selected={selected} onMissionTravel={onMissionTravel} travelBlocked={travelBlocked} />{selected.dangerHint && <div className="mapWarningLine">{selected.dangerHint}</div>}{selected.npcObjectiveLabel && <div className="npcObjectiveBox"><b>NPC Objective</b><span>{selected.npcObjectiveLabel}</span><small>{selected.npcObjectiveState || selected.npcRadarBehavior}</small>{selected.npcObjectiveTargetName && <small>Target: {selected.npcObjectiveTargetName}</small>}</div>}{selected.kind === 'npc' && <div className="npcLifeBox"><span>Level <b>{fmt(selected.npcLevel || 1)}</b></span><span>XP <b>{fmt(selected.npcXp || 0)}</b></span><span>Gen <b>{fmt(selected.npcGeneration || 1)}</b></span><span>Deaths <b>{fmt(selected.npcDeathCount || 0)}</b></span>{selected.npcSkills && Object.entries(selected.npcSkills).slice(0,5).map(([k,v])=><em key={k}>{label(k)} {fmt(v)}</em>)}</div>}{selected.npcVisibleCounts && <div className="npcRadarCounts"><span>Radar sees ships <b>{fmt(selected.npcVisibleCounts.ship || 0)}</b></span><span>ore <b>{fmt(selected.npcVisibleCounts.ore || 0)}</b></span><span>wrecks <b>{fmt(selected.npcVisibleCounts.salvage || 0)}</b></span><span>ancient <b>{fmt(selected.npcVisibleCounts.exploration || 0)}</b></span></div>}{selected.disabledReason && <div className="mapWarningLine">{selected.disabledReason}</div>}{selected.outcomeFactors && <small>Factors: {selected.outcomeFactors}</small>}<div className="buttonRow">{selected.inActionRange === false && ['ore','salvage','exploration','pirate_station','war_zone'].includes(selected.kind) && <button disabled={travelBlocked || !onGoHere} onClick={()=>onGoHere && onGoHere(targetPayload(selected))}>Approach</button>}{isUninhabitableNode(selected) && (selected.mission_contracts || []).slice(0,1).map(m => <button key={m.key} disabled={travelBlocked || !onMissionTravel || !m.canStart} onClick={()=>onMissionTravel && onMissionTravel(selected,m)}>{m.name} • Land & Start</button>)}{isSystemDockTarget(selected) && !(selected.current && !travel?.open_space) && <button disabled={travelBlocked || !onTravel} onClick={()=>onTravel && onTravel({...selected, kind:selected.kind || 'planet'})}>Dock</button>}{type === 'galaxy' && selected.kind === 'node' && <button onClick={()=>onViewGalaxy && onViewGalaxy(selected)}>View Map</button>}{selected.kind === 'gate' && <button disabled={travelBlocked || !onTravel} onClick={()=>onTravel && onTravel(selected)}>Jump Gate</button>}{selected.attackable && selected.canAttack !== false && selected.inActionRange !== false && <button className="dangerBtn" onClick={()=>onIntercept && onIntercept(selected)}>Intercept / Attack</button>}{selected.kind === 'ore' && selected.canMine !== false && <button disabled={travelBlocked} onClick={()=>selected.inActionRange === false ? (onGoHere && onGoHere(targetPayload(selected))) : (onMine && onMine(selected))}>{selected.inActionRange === false ? 'Approach to Mine' : `Mine`}</button>}{selected.kind === 'salvage' && selected.canSalvage !== false && <button disabled={travelBlocked} onClick={()=>selected.inActionRange === false ? (onGoHere && onGoHere(targetPayload(selected))) : (onSalvage && onSalvage(selected))}>{selected.inActionRange === false ? 'Approach to Salvage' : `Salvage`}</button>}{selected.kind === 'exploration' && selected.canScan !== false && <button disabled={travelBlocked} onClick={()=>selected.inActionRange === false ? (onGoHere && onGoHere(targetPayload(selected))) : (onScanSite && onScanSite(selected))}>{selected.inActionRange === false ? 'Approach to Scan' : `Scan`}</button>}{selected.kind === 'exploration' && selected.canInvestigate !== false && <button disabled={travelBlocked} onClick={()=>selected.inActionRange === false ? (onGoHere && onGoHere(targetPayload(selected))) : (onInvestigate && onInvestigate(selected))}>{selected.inActionRange === false ? 'Approach to Investigate' : `Investigate`}</button>}{selected.kind === 'pirate_station' && <button className="dangerBtn" disabled={travelBlocked || selected.locked || !onEnterPirateStation} onClick={()=>onEnterPirateStation && onEnterPirateStation(selected)}>{selected.locked ? 'Occupied' : selected.inActionRange === false ? 'Plot Approach / Dock' : 'Enter Station'}</button>}{selected.kind === 'war_zone' && <button disabled={travelBlocked || !onGoHere} onClick={()=>onGoHere && onGoHere({x_pct:selected.x_pct,y_pct:selected.y_pct,label:selected.name,map_type:'galaxy'})}>Enter Capture Ring</button>}{selected.kind === 'player' && <><button onClick={()=>{ const p=findPublicProfile(publicProfiles, selected); if(p) setProfileModal(p); }}>Profile</button><button onClick={()=>onPilotTrade && onPilotTrade(selected)}>Trade</button><button onClick={()=>onPilotParty && onPilotParty(selected)}>Party</button><button className="dangerBtn" onClick={()=>onPilotBlock && onPilotBlock(selected)}>Block</button></>}<button onClick={()=>setSelectedObject(null)}>Close</button></div><small>{selected.kind === 'exploration' ? 'Exploration is uncertain by design: scanning improves quality, modules improve analysis, hazard gear lowers trap damage, and bad sites can still produce nothing.' : selected.kind === 'npc' || selected.attackable ? 'Interceptions occur in open space. Planetary defense does not respond once ships are away from the planet.' : ''}</small></div></div>}
    {spawnContext && <AdminSpawnModal context={spawnContext} onSpawn={onAdminSpawn} onClose={()=>setSpawnContext(null)} />}
    <PublicProfileModal profile={profileModal} onClose={()=>setProfileModal(null)} />
  </div>;
}

function ShipStatusPanel({state}) {
  const ss = state.ship_status || {systems:[], warnings:[]};
  return <Panel title="Ship Systems" help="Real ship, module, cargo, fuel, hull, shield, and role-derived status.">
    <div className="shipStatusHead"><div className="shipArt smallShip"><GameImage src="" assetType="ship" category={state?.active_ship?.role || state?.active_ship?.class_name || state?.active_ship?.template_name || state?.active_ship?.name} alt={state?.active_ship?.name || 'Ship'} /></div><div><b>{state?.active_ship?.name || 'No Ship'}</b><span>Combat {fmt(ss.combat_rating)} • Mining {fmt(ss.mining_efficiency)} • Stealth {fmt(ss.stealth_rating)} • Scan {fmt(ss.scan_strength)} • Modules {fmt(ss.active_modules)}</span></div></div>
    <div className="systemBars">{(ss.systems || []).map(x=><div key={x.key}><span>{x.label}</span><Progress value={x.pct} danger={x.danger}/><small>{fmt(x.value)} / {fmt(x.max)}</small></div>)}</div>
    {!!(ss.warnings || []).length && <div className="warningStack">{ss.warnings.map(w=><span key={w}><AlertTriangle size={14}/>{w}</span>)}</div>}
  </Panel>;
}

function MarketPressure({state}) {
  const market = state.market || [];
  const highDemand = [...market].sort((a,b)=>(b.demand||0)-(a.demand||0)).slice(0,4);
  const scarce = [...market].sort((a,b)=>(a.supply||0)-(b.supply||0)).slice(0,4);
  const illegalPressure = market.filter(x=>!x.legal).sort((a,b)=>(b.pressureScore||0)-(a.pressureScore||0)).slice(0,4);
  return <Panel title="Economy Pressure" help="Demand, scarcity, trend, pressure, and illicit risk calculated from local market and planet conditions.">
    <div className="pressureColumns">
      <MiniMarketStack title="High Demand" items={highDemand} field="demand" />
      <MiniMarketStack title="Scarce Stock" items={scarce} field="supply" invert />
      <MiniMarketStack title="Illicit Pressure" items={illegalPressure} field="riskRating" />
    </div>
  </Panel>;
}

function MiniMarketStack({title, items, field, invert}) {
  return <div className="miniMarketStack"><h3>{title}</h3>{items.map(i=><div key={`${title}-${i.code}`}><ItemVisual item={i} size="xs"/><span>{i.name}</span><b>{fmt(i[field])}</b><em>{label(i.priceTrend || i.scarcityLevel || 'flat')}</em></div>)}</div>;
}

function PlanetControlVisual({state}) {
  const pc = state.planet_control || {effects:{}};
  const p = pc.planet || state.location || {};
  const effects = pc.effects || {};
  return <Panel title="Control Layer" help="Planet control effects are live modifiers, not flavor text.">
    <div className="nodeHeader"><ItemVisual item={p} size="ship"/><div><b>{effects.controller_label || label(p.controller_type || 'npc')}</b><span>{label(p.economy_type || 'balanced')} economy • Tax {effects.tax_rate_pct ?? 0}% • Production {fmt(p.production_bonus || 0)}</span></div></div>
    <div className="influenceStack">
      <InfluenceBar label="Influence" value={p.player_influence || 0} />
      <InfluenceBar label="Security" value={p.security_level || 0} />
      <InfluenceBar label="Stability" value={p.stability_level || 0} />
      <InfluenceBar label="Conflict" value={p.conflict_level || 0} danger />
    </div>
    <div className="effectNotes"><span>High security lowers smuggling profit but reduces piracy.</span><span>Low stability increases illicit activity and travel risk.</span><span>{label(p.economy_type || 'balanced')} economy changes market and crafting pressure.</span></div>
  </Panel>;
}

function EnhancedEventFeed({events}) {
  const [filter,setFilter] = useState('all');
  const groups = ['all', ...Array.from(new Set((events || []).map(e=>e.group || e.action_type))).slice(0,8)];
  const shown = (events || []).filter(e=>filter==='all' || (e.group || e.action_type) === filter).slice(0,28);
  return <>
    <div className="chipRow eventFilters">{groups.map(g=><button key={g} className={filter===g?'active':''} onClick={()=>setFilter(g)}>{label(g)}</button>)}</div>
    <div className="feedList enhancedFeed">{shown.map(e=><div key={e.id} className={`eventCard ${e.severity || 'info'}`}><b><span>{e.icon || '•'}</span>{label(e.group || e.action_type)}</b><span>{e.message}</span><small>{e.affected_location || e.planet_name || 'Unknown'}{e.affected_good ? ` • ${e.affected_good}` : ''} • {new Date(e.created_at).toLocaleTimeString()}</small></div>)}</div>
  </>;
}


const GameImage = React.memo(function GameImage({ src, assetType = 'item', category = '', className = '', alt = '', hint = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src, assetType, category, hint, alt]);
  const mergedHint = `${category || ''} ${hint || ''} ${alt || ''}`.trim();
  const fallback = imageFallbackFor(assetType, mergedHint, src);
  const resolved = failed ? fallback : resolveAsset(assetType, src, category, mergedHint);
  return <img className={className} src={resolved || fallback} alt={alt || assetType} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
});

function assetTypeForItem(item) {
  const category = String(item?.category || item?.inventory_category || '').toLowerCase();
  const type = String(item?.item_type || item?.type || item?.slot_type || '').toLowerCase();
  if (category.includes('weapon') || type.includes('weapon') || type.includes('laser') || type.includes('railgun') || type.includes('missile')) return 'weapon';
  if (category.includes('armor') || type.includes('armor') || type.includes('shield')) return 'armor';
  if (category.includes('module') || category.includes('ship_part') || type.includes('module') || type.includes('engine') || type.includes('scanner')) return 'module';
  if (category.includes('material') || category.includes('salvage') || category.includes('ore')) return 'material';
  if (type.includes('station')) return 'station';
  if (type.includes('planet') || item?.galaxy_id) return 'planet';
  return 'item';
}

function Progress({value, danger}) {
  const pct = Math.max(0, Math.min(100, Number(value || 0)));
  return <i className="progress"><b className={danger ? 'danger' : ''} style={{width:`${pct}%`}} /></i>;
}


function ItemVisual({item, size='md'}) {
  const src = item?.image_url || item?.visual?.image_url;
  const hint = [
    item?.item_code,
    item?.commodity_code,
    item?.commodity_id,
    item?.material_code,
    item?.module_code,
    item?.ship_code,
    item?.code,
    item?.name,
    item?.item_name,
    item?.commodity_name,
    item?.category_label,
    item?.slot_type,
    item?.subcategory,
    item?.description,
  ].filter(Boolean).join(' ');
  const category = [item?.category, item?.inventory_category, item?.item_type, item?.type, item?.economy_type].filter(Boolean).join(' ');
  return <div className={`itemVisual ${size}`}><GameImage src={src} assetType={assetTypeForItem(item)} category={category} hint={hint} alt={item?.name || item?.item_name || item?.commodity_name || 'Item'} /></div>;
}


function achievementBadgeCodeFrom(badge) {
  const raw = typeof badge === 'string' ? badge : (badge?.code || badge?.url || badge?.badgeUrl || '');
  return String(raw || '')
    .trim()
    .split(/[\\/]/)
    .pop()
    .replace(/\.(png|jpe?g|webp|svg)$/i, '');
}

function AchievementBadge({badge, size='md', locked=false, onClick=null}) {
  const code = achievementBadgeCodeFrom(badge);
  const tier = typeof badge === 'object' ? (badge?.tier || '') : '';
  const labelText = typeof badge === 'object' ? (badge?.name || badge?.code || 'Achievement') : 'Achievement';
  const body = <span className={`achievementBadge hasHoverTooltip ${size} ${locked ? 'locked' : ''}`} tabIndex={0} data-tooltip={labelText}>
    <GameImage src="" assetType="item" category={`achievement ${code}`} hint={code} alt={labelText} />
    {tier ? <em>T{tier}</em> : null}
  </span>;
  return onClick ? <button className="badgeButton" disabled={locked} onClick={onClick}>{body}</button> : body;
}

function ProfileAvatar({profile, src, alt='Pilot avatar', size='md', onClick=null}) {
  const badge = profile?.selectedBadgeUrl || profile?.selectedBadgeCode;
  const inner = <span className={`profileAvatarWithBadge ${size}`}>
    <GameImage src={src || profile?.avatarUrl} assetType="avatar" alt={alt || profile?.displayName || 'Pilot'} />
    {badge ? <AchievementBadge badge={badge} size="tiny" /> : null}
  </span>;
  return onClick ? <button className="profileAvatarButton" onClick={onClick}>{inner}</button> : inner;
}

function PublicProfileModal({profile, onClose, act=null, setPage=null, setTradeModalId=null}) {
  if (!profile) return null;
  const stats = profile.stats || {};
  const top = profile.topAchievements || [];
  return <div className="modalBackdrop profileModalBackdrop" onMouseDown={onClose}>
    <div className="publicProfileModal" onMouseDown={e=>e.stopPropagation()}>
      <button className="modalX" onClick={onClose}>×</button>
      <div className="publicProfileHeader">
        <ProfileAvatar profile={profile} size="lg" />
        <div>
          <h2>{profile.displayName || 'Pilot'}</h2>
          <span>@{profile.username || 'unknown'} • Level {fmt(stats.level || 1)}</span>
          <p>{profile.bio || 'No public status.'}</p>
        </div>
      </div>
      <Stats pairs={{Galaxy:profile.homeGalaxy || '—', Location:profile.currentLocation || '—', Ship:profile.currentShip?.name || profile.currentShip?.template_name || '—', Travel:stats.travelEvents || 0, Combat:stats.combatEvents || 0, Mining:stats.miningEvents || 0, Salvage:stats.salvageEvents || 0, Exploration:stats.explorationEvents || 0}} />
      {act && Number(profile.playerId || 0) > 0 && <div className="pilotActionButtons"><button onClick={()=>act('trade_invite',{playerId:profile.playerId})}>Trade</button><button onClick={()=>act('party_invite',{playerId:profile.playerId})}>Party</button><button className="danger" onClick={()=>act('social_block_player',{playerId:profile.playerId})}>Block</button><button onClick={()=>setPage && setPage('Social')}>Social</button></div>}
      <h3>Top Achievements</h3>
      <div className="publicAchievementGrid">{top.map(a=><div key={a.loopKey} className="publicAchievementCard"><AchievementBadge badge={a.badgeUrl} size="sm"/><b>{a.name}</b><span>Tier {a.tierUnlocked || 0}</span><Progress value={a.percentToNext || 0}/></div>)}</div>
      <small className="muted">Public profile hides wealth, cargo, exact ship strength, and private resource stats.</small>
    </div>
  </div>;
}

function findPublicProfile(profiles, thing) {
  if (!thing) return null;
  const userId = Number(thing.userId || thing.profileUserId || thing.user_id || 0);
  const playerId = Number(thing.playerId || thing.player_id || 0);
  return (profiles || []).find(p => (userId && Number(p.userId) === userId) || (playerId && Number(p.playerId) === playerId)) || null;
}

function TierBadge({item}) {
  const tier = item?.current_tier ?? item?.tier ?? item?.ship_tier ?? item?.recipe_tier ?? item?.tier_display?.tier;
  if (tier === undefined || tier === null) return null;
  const style = item?.tier_display?.style || ['scrap','basic','improved','advanced','military','prototype','exotic','relic'][Number(tier)] || 'basic';
  const name = item?.tier_display?.name || `Tier ${tier}`;
  return <span className={`tierBadge hasHoverTooltip tier-${style}`} tabIndex={0} data-tooltip={name}>T{tier}</span>;
}

function OperationRow({item, actionLabel, onRun}) {
  const creditsMin = item.preview_reward_min ?? item.reward_min ?? item.base;
  const creditsMax = item.preview_reward_max ?? item.reward_max ?? item.base;
  const fuel = item.fuel_cost ?? 0;
  const xp = item.xp_reward ?? item.xp;
  const success = item.success_odds !== undefined ? `${Math.round(item.success_odds * 100)}%` : '—';
  const tier = item.operation_tier || item.kind || 'operation';
  return <div className={`operationCard ${item.recommended ? 'recommendedOp' : ''} ${item.legal === 0 || item.op_type === 'smuggling' ? 'illegalOp' : ''}`}>
    <div className="opIcon">{opIcon(item.op_type || item.job_code || item.kind)}</div>
    <div className="operationMain">
      <div className="operationTitle"><b>{item.name}</b><em>{label(tier)}</em><em>{item.risk_profile ? label(item.risk_profile) : 'Risk Rated'}</em></div>
      <p>{item.description || item.desc}</p>
      <span>Fuel {fmt(fuel)} • XP {fmt(xp)} • Credits {fmt(creditsMin)}{creditsMax !== creditsMin ? `-${fmt(creditsMax)}` : ''} • Success {success}</span>
      <div className="factorLine"><small>Job {factorPct(item.job_bonus)} </small><small>Ship {factorPct(item.ship_bonus)} </small><small>Skill {factorPct(item.skill_bonus)} </small><small>Planet {factorPct(item.planet_bonus)} </small></div>
      <span className="operationHintWrap"><InfoTip text={item.recommendation_reason || 'Success chance is calculated from real ship, job, skill, and location state.'} label="Why this fits" side="left" /></span>
    </div>
    <button onClick={onRun}>{actionLabel}</button>
  </div>
}

const HUMAN_TOOLTIP_COPY = {
  'Automatically fires Use All when your weapons recover. Turns on after 1 minute without manual combat actions.': 'Turns the fight into cruise control. When your weapons recover, it presses Use All for you.',
  'Combat targets are limited to your current planet or station. Travel and jail block combat.': 'You can only fight targets where you are right now. Traveling or being jailed blocks combat.',
  'Your fitted weapons, shields, armor, scanners, engines, and skills affect battle outcome.': 'Your ship fit matters. Weapons, shields, armor, scanners, engines, and skills all affect the fight.',
  'NPCs and players shown here are at your current location only. Legal targets are safer; unlawful attacks can raise heat and cause jail.': 'These targets are standing where you are. Legal fights are safer; unlawful ones can bring heat or jail.',
  'Preview explains legality, danger, rewards, and ship-vs-ship context before battle.': 'Check this before you fire. It tells you what is legal, how dangerous the target is, and what is at stake.',
  'Battles open in a modal overlay. Server resolves the battle; the modal replays it at a readable pace.': 'The server resolves combat. The overlay just plays it back clearly so you can follow what happened.',
  'Click a slot to filter storage to equipment that can fit there. Empty slots are valid; different ships have different fitting identities.': 'Click a slot to show gear that fits it. Empty slots are fine; ships are supposed to have different fitting personalities.',
  'Equipped modules affect derived stats. Equipped items cannot be sold/listed/crafted until removed.': 'Installed gear changes your real stats. Remove it before selling, listing, or using it in crafting.',
  'Available ships show requirements, role, tier, price, and purchase availability. Duplicate classes are blocked for normal players.': 'Market ships show role, tier, price, and requirements. Normal players cannot stack duplicate classes.',
  'Stat comparison shows selected ship vs active ship. Deltas help decide whether to activate or buy upgrades.': 'Compare this ship against what you are flying now. Green and red deltas show what you gain or give up.',
  'Ship loss is not permanent character death. Insurance pays part of the loss and the permanent starter ship is always usable.': 'Losing a ship hurts, but it does not delete your pilot. Insurance softens the hit, and your starter ship is always there as a fallback.',
  'Current location prices. Goods are safer; restricted goods carry more risk and larger spread.': 'These are the prices at this stop. Legal cargo is steady. Restricted cargo can pay better, but it brings heat and bigger swings.',
  'Restricted goods pay better but raise heat and can cause jail. Risk scales with item severity, quantity, security, stability, heat, ship stealth, and skills.': 'Smuggling can pay, but every run carries heat. Risk depends on what you carry, how much, local security, your heat, stealth, and skills.',
  'Heat is created only by restricted activity. Goods trade never raises heat. Heat decays slowly server-side.': 'Heat comes from illegal work only. Legal trading is safe. Heat cools off slowly over time.',
  'Your current galaxy and stop live here, including local safety, stability, defense, and galaxy security forces.': 'Start here when you feel lost. It tells you where you are, how safe the area feels, and whether the local defenses are on your side.',
  'Current planet/station conditions. NPC ticks can slowly move market activity, security, stability, and pirate pressure.': 'These numbers are the local weather. Traffic, pirates, security, and market pressure can drift as the world sim runs.',
  'Local control affects prices, mission risk, illegal trade risk, crafting bonuses, and travel danger.': 'Control is not just color on the map. It nudges prices, job danger, smuggling risk, crafting, and travel safety.',
  'Only locations inside the current galaxy are shown here. Use the Galaxies map for cross-galaxy movement.': 'This is local travel only. For another galaxy, use the galaxy map and let the gate route handle the long leg.',
  'Planet-side/station-side missions. Each mission levels separately for each planet; higher local mission level takes slightly longer but pays much better.': 'Local missions remember where you run them. Repeating work on the same planet slowly turns it into better-paying work.',
  'Dashboard operations are limited to basic credit/XP work plus current-skill jobs. Bosses, raids, wars, and galaxy-scale content stay off this quick panel.': 'This panel is for quick errands, not the whole game. Big commitments live in their own screens so you do not start them by accident.',
  'Sorted from current skill, skills, ship power, and local planet conditions.': 'These are not random chores. The list weighs your ship, skill, skills, and the planet you are standing on.',
  'Server-side NPC simulation events from planets and stations in your current galaxy.': 'This is the galaxy breathing in the background: patrols, traders, pressure changes, and trouble that happened while you were doing other things.',
  'Hospital time exists after ship destruction or serious injury. Surgery payments reduce time but never below 10 minutes.': 'Recovery is a penalty, not a lockout forever. Money can shorten it, but there is always a small floor after a serious loss.',
  'Fuel affects movement only. At 0 fuel, emergency power halves speed and jump gates are blocked.': 'Fuel only affects movement. Empty tanks mean half-speed emergency travel, and gates will not let you jump.',
  'Nodes summarize security, market activity, conflict, influence, and known locations across each galaxy.': 'Each node is a quick scan of a galaxy: safety, trade, conflict, influence, and known places.',
  'Planet nodes expose security, stability, faction control, market strength, operation count, and route danger.': 'Hover or inspect a place to judge safety, stability, control, trade strength, available work, and route danger.',
  'Profile|Pilot identity, public profile, stats, achievement badges, and passive tier-8 bonuses.': 'This is your public pilot card: portrait, badge, stats, achievements, and long-term passive bonuses.',
  'Map — Galaxy View|Galaxy travel uses gate lanes only. Select any destination galaxy and autopilot follows the connected gate path.': 'Galaxy travel is gate-only. Pick a destination galaxy and autopilot follows the connected gate route.',
  'Map — System View|Planet view shows local planets, stations, pirate stations, resources, and galaxy gates leading to adjacent galaxies.': 'System view shows what is nearby: planets, uninhabitable planets, resources, traffic, and gates to nearby galaxies.',
  'Server Calendar|Server events, bounties, wormholes, derelicts, artifacts, refining, contracts, fuel, and weekly event ladder.': 'Use this to track timed world content: events, bounties, wormholes, derelicts, artifacts, contracts, fuel, and the weekly ladder.',
  'NPC Goods Market|Station trade is local. Restricted goods are removed. Trade goods are station-market cargo only; player listings are galaxy-scoped.': 'Station trade is local. Goods stay in station markets, and player listings stay inside the current galaxy.',
  'Inventory|Unified cargo, loose inventory, materials, modules, consumables, restricted goods, market listing readiness, and item inspection.': 'Everything you carry or store is here: cargo, loose items, materials, modules, consumables, contraband, and item details.',
  'Guild Command|Guilds earn respect from wars, control, missions, and activity. Respect unlocks a large guild skill tree with small useful buffs.': 'Guilds build respect through wars, control, missions, and activity. Respect unlocks guild-wide perks over time.',
  'Faction War|Wars are declared by guilds on planets. A galaxy flips only after one faction controls every planet inside it.': 'Guilds start wars on planets. A whole galaxy flips only when one faction controls every planet in it.',
  'Faction War|Guild wars start on planets; galaxy control is earned planet by planet.': 'Think campaign, not duel. You win planets first; the galaxy follows only when the whole set belongs to one faction.',
  'This is the flag you fight under. Guild declarations pull the whole attacker and defender factions into the planet war.': 'Your guild may start the war, but your whole faction carries the banner once it begins.',
  'Galaxy count is the scoreboard. Planet count tells you where the next real pressure points are.': 'Galaxies show who is winning the map. Planet counts show where the next campaign can actually move.',
  'This is the travel board. Declared wars show when the ring opens; active wars show whether someone is already holding it.': 'Use this before undocking for war. It tells you where to go, whether you are early, and whether the capture clock is already under pressure.',
  'Disabled planets are not broken. The backend is telling you what still blocks the declaration: treasury, guild size, faction rules, or cooldowns.': 'If the button is locked, there is a real rule in the way: money, members, faction status, or a cooldown.',
  'Operations Hub|PvE now uses skill rank, skill levels, ship power, fuel cost, local security, stability, pirate pressure, and job fit.': 'PvE jobs look at your skill, skills, ship, fuel, local safety, pirate pressure, and job fit.',
  'Crafting & Fabrication|Crafting is timed. Raw ore now feeds refinery recipes first, then refined outputs feed higher-end manufacturing. Materials and credits are committed up front.': 'Crafting takes time and spends materials up front. Raw ore feeds refining first; refined outputs feed higher-end builds.',
  'Deprecated Work|Skills do not lock gameplay. Anyone can mine, craft, trade, fight, smuggle, salvage, explore, or jailbreak. XP is universal; your build comes from skill point allocation.': 'Skills guide work preferences, not skills pools. Spend universal skill points to define your build.',
  'Skill Tree Progress|XP is universal. Skill points from the character XP pool define your Combat, Industry, Market, and Exploration build.': 'All valid action XP becomes character progress. Your tree investments are what make you specialized.',
  'Medical Bay|No permanent death. Serious defeat causes hospital time; ship can be lost. Payments speed surgery but minimum hospital time is 10 minutes.': 'There is no permanent pilot death. A serious defeat can cost a ship and put you in recovery; payment can shorten, not erase, the timer.',
  'Fight|Same-location PvE/PvP combat. Ship loadout, combat skills, skill, legality, heat, and rewards all matter.': 'Combat only happens where you are. Your ship fit, skills, skill, legality, heat, and target reward all matter.',
  'Ships & Hangar|Active ship, owned ships, ship market, modules, slots, compatibility, stats, repairs, and gameplay impact.': 'Manage what you fly here: active ship, owned ships, market ships, modules, slots, compatibility, stats, and repairs.',
  'Buying market goods uses backend cargo capacity checks. Trade goods are for station markets and cannot be exploited through player-market listing.': 'Cargo checks happen on the server, so the UI cannot sneak extra mass through. Station goods stay in the station economy.',
  'Selling legal items restocks the local market with no risk. Listing on the auction creates a current-galaxy listing.': 'Selling is the simple exit. Listing is slower but can pay better, and it belongs to the galaxy you are standing in.',
  'Player buying depletes supply and raises demand. Player selling restocks local markets and reduces demand. System restock slowly replenishes depleted stock.': 'Markets remember player pressure. Buying dries stock up, selling cools demand down, and restock takes time.',
  'Success chance is calculated from real ship, job, skill, and location state.': 'The fit score is grounded in your actual situation: ship, skills, skill, and the planet around you.',
  'Your selected achievement badge appears on the lower-right of your profile image in chat, sidebar, and public profile views.': 'Your showcase badge follows your pilot around the UI, so pick the one you want other players to notice.',
  'Each loop has 8 tiers. Tier 7 is tuned as a long active-play goal; Tier 8 is a deeper 8-month-style chase and unlocks a small relevant passive.': 'Achievements are long arcs. Tier 7 is a serious active goal, and Tier 8 is the slow prestige tier with a small passive reward.',
  'Pick one unlocked achievement badge. It overlays the lower-right of your profile image.': 'Choose the badge you want displayed on your portrait in social spaces.',
  'Your faction controls this roster. Each faction has 12 sheet-sourced portraits, and the backend rejects cross-faction avatar ids.': 'Your portrait choices come from your faction. The server will block avatars that belong to another faction.',
  'Click a pilot image/name to view their public profile. Wealth and private strength stats stay hidden.': 'Open another pilot to see public identity and badges. Private money and strength details stay private.',
  'You are not physically here. Party members act as radar relays.': 'This is remote intel. You can see it because a party member is effectively sharing their radar.',
  'Enemy-territory cargo and escort contracts complete only when docked at the destination. Escort NPCs detach on completion, abandon, failure, destruction, or timer expiry.': 'For enemy routes, getting there is not enough. Dock at the target to finish, and escorts leave when the job ends or fails.',
  'NPC bounties are server controlled and limited to one per galaxy. Player bounties cost reward plus a 10% fee. Last-seen data updates every 30 minutes.': 'Bounties are meant to feel scarce and traceable. NPC bounties are galaxy-limited, and player targets only update their last-seen trail every 30 minutes.',
  'Weekly event. Join the control ring, build capture time, and unlock a 48-hour reward wormhole when your faction wins.': 'This is a weekly faction race. Hold the ring long enough and your faction opens a reward wormhole for two days.',
  'Send probes outside radar to create 30-second category blips. Object scans still use scanner/counter-scanner math clamped between 20% and 80% certainty.': 'Probes give temporary area hints, not perfect truth. Scanning a specific contact is still where scanner strength and counter-scanners matter.',
  'Derelicts are scan/discovery objects. Exploration is shorter than planet exploration and pays about 85% of comparable rewards.': 'Derelicts are quick exploration finds. They resolve faster than planet runs and pay slightly less.',
  'Artifacts are planet-stored unless carried/equipped. Unidentified carried artifacts are lost if the ship is destroyed. Identified artifacts can be mounted to active ships.': 'Artifacts are safest in planet storage. Carry unidentified ones only when you accept the risk of losing them with the ship.',
  'Mining produces raw ore. Refining converts raw ore/materials into crafting materials at stations/inhabitable planets.': 'Mine first, refine second. Raw ore becomes useful crafting material only at places with refinery access.',
  'Supply contributions are per border/frontline galaxy. Higher contribution levels unlock small frontline bonuses.': 'Frontline supply is local to the war zone. Keep feeding a border galaxy to unlock small bonuses there.',
  'Regenerates positions only. Preserves planet/galaxy names, ownership, stations, and content.': 'This only rearranges the map layout. Names, ownership, stations, and content stay intact.',
  'Station trade goods are legal cargo. Same-galaxy arbitrage is intentionally low; cross-galaxy routes are the profit layer.': 'Legal station trade is steady inside one galaxy. The bigger margins are meant to come from cross-galaxy routes.',
  'Planet cargo is visible everywhere for planning. Deposits and withdrawals only work while docked at the cargo\'s planet or station.': 'You can plan from anywhere, but you still have to dock at the right place to move stored cargo.',
  'Inspection uses backend-resolved item data, not frontend-only guesses.': 'These details come from the server, so action locks and item rules should match what will actually happen.',
  'Actions are small nudges. Job-matched actions gain extra influence while fuel and credit costs still matter.': 'Control actions push a planet gradually. Matching your skill helps, while fuel and credit costs still matter.',
  'High fit does not mean no risk. It means your current build is better suited for the action.': 'A high fit score means your current setup matches the job. It does not make the job risk-free.',
  'Available to all players. Lower reward, higher success rate.': 'Basic work is the reliable lane: safer, steadier, and lower paying.',
  'Better rewards. Lower success rate unless your ship, skills, and current job fit the operation.': 'Advanced work pays better when your build fits it. If your ship or skills are off, expect more failures.',
  'These are defeated ships in the current area. Player battles, PvE combat, PvP, and occasional NPC-vs-NPC fights can populate this list. Zero available wrecks is valid if the area has been cleaned out.': 'Fresh wrecks come from real combat in this area. If the list is empty, pilots may have already picked it clean.',
  'Timed crafting jobs persist through refresh. Completed jobs auto-resolve on state refresh or when you press Claim Completed. Ore refining recipes require refinery access at the current planet or station.': 'Crafting keeps running after refresh. Finished jobs claim on refresh or by button, and ore recipes need local refinery access.',
  'Market cargo and loose inventory both count toward recipe requirements. Raw ore appears here so it can be routed into refinery recipes.': 'Recipes can use carried cargo and loose inventory. Raw ore is shown so you can feed it into refining first.',
  'Active jobs finish on backend timestamps. Long projects keep running while you are away.': 'The server owns crafting time. Long builds keep ticking while you are offline or on another page.',
  'Build from a blank point on the System Map. Clearance requires two icon-spaces from planets, stations, nodes, pirate bases, and other bases.': 'Private bases need breathing room. Place one from empty system-map space, away from major icons and other bases.',
  'One research project at a time. Research only costs credits and time; it unlocks matching base construction.': 'Research is the gate before construction. Start one project, wait it out, then build what it unlocks.',
  'One construction project at a time. Buildings are private and provide slow passive outputs or small quality-of-life bonuses.': 'Base construction is slow and private. Buildings add passive trickles or small convenience bonuses over time.',
  'Activating a lower-cargo ship is blocked if your cargo will not fit. Active ship controls travel, cargo, PvE, mining, combat, exploration, and smuggling modifiers.': 'Your active ship is your real toolkit. You cannot swap into a smaller hold while carrying more cargo than it can fit.',
  'Changed groups have a LIVE OVERRIDE badge. Defaults stay in code; overrides live in DB.': 'A live override means the database is beating the code default right now.',
  'Controls galaxy count, planets per galaxy, faction balance, resource tier distribution, and NPC level bands from each faction home toward center space.': 'These settings shape the world layout: galaxy size, planet count, faction spread, resources, and NPC level bands.',
  'Admin shortcut for the two knobs that matter most: gameplay-loop spawn mix and optional per-galaxy NPC level overrides.': 'This is the quick spawn-tuning panel: what gameplay loops appear, and how hard NPCs can be by galaxy.',
  'Controls station conversion, uninhabitable planets, landed contracts, mission timers, per-planet mission XP, event logs, and rewards.': 'These knobs tune planet-side play, from station conversion and mission timing to rewards and local XP.',
  'Server-owned population/resource controller. Checks are throttled; each due pass spawns or trims one item per category per galaxy until configured ranges are met.': 'The server slowly keeps the world stocked. Each pass adjusts a little so spawns do not lurch all at once.',
  'The target is easy start, painful completion. These controls apply instantly through runtime config; use Recalculate Markets after price changes.': 'This tuning aims for a friendly start and a demanding endgame. Market price edits need a recalculation afterward.',
  'Edit one group, save it, then recalc markets if pricing changed.': 'Save one balance group at a time. Recalculate markets after changing prices so the economy catches up.',
  'All players and NPCs. Page size is fixed at 50. Filters are client-side against the admin snapshot.': 'This is a snapshot browser for actors. Filters narrow the current admin data instead of fetching a new page.',
  'Merged admin feed. Displays the newest 500 events from player events, NPC actions, combat, and market transactions.': 'This feed stitches together the latest player, NPC, combat, and market activity for admin review.',
  'Market cargo loading/offloading is not instant. You cannot travel, change ships, fight, or start another cargo operation until it completes. During loading/offloading you are protected from attacks.': 'Cargo handling takes time. While the crew is loading or unloading, you are locked in place but protected.',
  'The station resource is the shared defender pool. Defeated enemies stay defeated. Damaged enemies keep their damage for everyone in the station.': 'Pirate stations are shared assaults. Damage and defeated defenders persist for everyone working the station.',
  'This is a separate combat map. Pirates spawn spaced out and slowly converge on the closest pilot. Reach the outer 10% border to retreat.': 'Station assaults use their own map. Pirates move toward nearby pilots, and the outer edge is your retreat lane.',
  'Real ship, module, cargo, fuel, hull, shield, and role-derived status.': 'This is your actual ship state: gear, cargo, fuel, defenses, and role effects.',
  'Demand, scarcity, trend, pressure, and illicit risk calculated from local market and planet conditions.': 'These market signals come from the local planet: demand, scarcity, price motion, pressure, and smuggling risk.',
  'Planet control effects are live modifiers, not flavor text.': 'Control numbers actively change the planet. They are real bonuses and penalties, not just lore.',
  'Local Chat|Chat identity uses your selected profile image, badge, and display name.': 'Your chat presence uses your chosen portrait, badge, and pilot name.',
  'Social|Manage friends and blocked pilots. Friend online notifications are toasts only; invites and requests also appear in Messages.': 'Use this for people management. Friend pings are temporary, while invites and requests also land in Messages.',
  'Map — Mission View|You are away from the ship on a planet mission. The map returns after completion or cancellation.': 'Your ship is parked while the mission runs. Finish or cancel the mission to return to the map.',
  'Planet Control|Local influence, faction control, security, stability, taxes, conflict, and economy modifiers for the current planet or station.': 'This is the planet\'s political and economic dashboard: who controls it, how safe it is, and what that changes.',
  'Industry|Mining, battlefield salvage, refining, NPC contracts, and materials for crafting modules and ship parts.': 'Industry is the material pipeline: mine, salvage, refine, and feed crafting or ship work.',
  'Properties, Research & Bases|Mid-game private bases. Research costs credits/time; construction costs more credits/time. One private base per player. Other players cannot dock or attack it.': 'Private bases are mid-game projects. Research unlocks buildings, construction takes time, and the base is yours alone.',
  'Messages|Actionable invites and requests persist here even after toast notifications disappear.': 'Messages keeps the important social actions after the quick toast is gone.',
  'Pirate Station|No active station assault. Enter one from the System Map.': 'No pirate assault is running. Find and enter a pirate station from the System Map.',
  'Warfare|Read the war map before you commit ships, treasury, and travel time. Warfare is about preparation, staging, and holding objectives long enough for your faction to matter.': 'Use this as the war-room brief: choose the right front, arrive prepared, and hold the objective long enough to matter.',
  'Godmode/dev admin only. Values persist in SQLite game_settings and apply immediately without rebuilding. Edit JSON carefully.': 'Admin-only tuning. Saved values go straight into the DB and take effect without a rebuild, so bad JSON can break things fast.'
};

function humanHelpText(text, context='') {
  if (!text) return '';
  const raw = String(text).trim();
  const contextual = context ? `${context}|${raw}` : raw;
  if (HUMAN_TOOLTIP_COPY[contextual]) return HUMAN_TOOLTIP_COPY[contextual];
  if (HUMAN_TOOLTIP_COPY[raw]) return HUMAN_TOOLTIP_COPY[raw];
  return raw
    .replace(/\bCurrent\b/g, 'This')
    .replace(/\bcurrent\b/g, 'this')
    .replace(/\bServer-side\b/g, 'Server')
    .replace(/\bserver-side\b/g, 'server')
    .replace(/\bbackend-resolved\b/g, 'server-checked')
    .replace(/\bmodifiers\b/g, 'bonuses and penalties')
    .replace(/\butilizes\b/gi, 'uses')
    .replace(/\bapproximately\b/gi, 'about');
}

function InfoTip({text, label='Guide', side='right'}) {
  const copy = humanHelpText(text);
  if (!copy) return null;
  return <span className={`infoTip ${side === 'left' ? 'left' : ''}`} tabIndex={0} role="note" aria-label={`${label}: ${copy}`} data-tooltip={copy}>
    <Info size={14} aria-hidden="true"/>
  </span>;
}

function Panel({title, help, children}) {
  const copy = humanHelpText(help);
  return <section className="panel"><h2><span>{title}</span>{copy && <InfoTip text={copy} label={`${title} help`} />}</h2>{children}</section>
}
function DescriptionBlock({eyebrow, title, lead, points=[]}) {
  return <section className="descriptionBlock">
    <div className="descriptionBlockIntro">
      {eyebrow && <span>{eyebrow}</span>}
      <h2>{title}</h2>
      <p>{lead}</p>
    </div>
    <div className="descriptionBlockGrid">
      {points.map(([pointTitle, pointCopy]) => <div key={pointTitle}>
        <b>{pointTitle}</b>
        <p>{pointCopy}</p>
      </div>)}
    </div>
  </section>
}
function Page({title,sub,children}) {
  return <div className={`pageFrame pageFrame-${pageSlug(title)}`}>{children}</div>
}
function Grid({children}) { return <div className="dashboardGrid">{children}</div> }
function Bar({label,value,max,danger}) { const pct = Math.max(0,Math.min(100,(value/(max||1))*100)); return <div className="bar"><span>{label}</span><i><b style={{width:`${pct}%`}} className={danger?'danger':''}/></i><small>{fmt(value)} / {fmt(max)}</small></div> }
function Stats({pairs}) { return <div className="stats">{Object.entries(pairs).map(([k,v])=><div key={k}><span>{label(k)}</span><b>{fmt(v)}</b></div>)}</div> }
function ShipCard({ship}) { if(!ship) return null; return <div className="shipCard"><div className="shipArt"><GameImage src={ship.image_url} assetType="ship" category={ship.role || ship.class_name} alt={ship.name || 'Ship'} /></div><div><h3>{ship.name}</h3><p>{ship.class_name || ship.template_name}</p><Stats pairs={{Tier:`T${ship.current_tier ?? ship.ship_tier ?? 1}/${ship.max_tier ?? '—'}`, Hull:`${fmt(ship.hull)}/${fmt(ship.max_hull)}`, Shield:`${fmt(ship.shield)}/${fmt(ship.max_shield)}`, Armor:ship.armor, Cargo:ship.cargo_capacity, Drive:ship.drive_speed}}/></div></div> }
function TwoCols({leftTitle,rightTitle,left,right}) { return <div className="twoCols"><div><h3>{leftTitle}</h3>{left.map(x=><div className="miniItem" key={x.code}><ItemVisual item={x} size="xs"/><span>{x.name}</span><b>{fmt(x.sell_price)}</b></div>)}</div><div><h3>{rightTitle}</h3>{right.map(x=><div className="miniItem" key={x.code}><ItemVisual item={x} size="xs"/><span>{x.name}</span><b>{fmt(x.sell_price)}</b></div>)}</div></div> }
function ActionLog({log}) { return <div className="actionLog">{log.map((l,i)=><div key={i}>{l}</div>)}</div> }
function fmt(n) { if (n===null || n===undefined) return '—'; if (typeof n === 'string') return n; return Number(n).toLocaleString(); }
function label(s) { return String(s).replaceAll('_',' ').replace(/\b\w/g, m=>m.toUpperCase()); }
function groupBy(arr,k) { return arr.reduce((a,x)=>((a[x[k]] ||= []).push(x),a),{}); }
function jsonSafe(v, fallback) { try { return typeof v === 'string' ? JSON.parse(v) : (v || fallback); } catch { return fallback; } }
function signed(n) { const x = Number(n || 0); return `${x >= 0 ? '+' : ''}${fmt(x)}`; }
function timeLeft(date) { const ms = new Date(date)-new Date(); if (ms<=0) return 'Ready'; const m=Math.ceil(ms/60000); return `${Math.floor(m/60)}h ${m%60}m`; }

function travelProgress(t, clock=Date.now()) { if (!t?.active || !t.started_at || !t.arrival_at) return t?.active ? Number(t.progress || 0) : 1; const start=new Date(t.started_at).getTime(); const end=new Date(t.arrival_at).getTime(); if (!end || end<=start) return 1; return Math.max(0, Math.min(1, (clock-start)/(end-start))); }
function clockTimeLeft(date) { if (!date) return '—'; const ms = new Date(date).getTime() - Date.now(); if (ms<=0) return 'Arriving'; const s=Math.ceil(ms/1000), m=Math.floor(s/60), sec=s%60, h=Math.floor(m/60); return h>0 ? `${h}h ${m%60}m` : `${m}m ${sec}s`; }
function compactDuration(seconds) { const s = Math.max(0, Math.ceil(Number(seconds || 0))); if (s < 60) return `${s}s`; const m = Math.floor(s / 60), sec = s % 60; return sec ? `${m}m ${sec}s` : `${m}m`; }
function lerpPoint(a,b,t) { return {x:(a.x_pct || 0)+((b.x_pct || 0)-(a.x_pct || 0))*t, y:(a.y_pct || 0)+((b.y_pct || 0)-(a.y_pct || 0))*t}; }
function trendIcon(t) { return t === 'up' ? '▲' : t === 'down' ? '▼' : '▬'; }
function opIcon(type) { const k=String(type||'').toLowerCase(); if(k.includes('mine')) return '⛏'; if(k.includes('haul')||k.includes('trade')||k.includes('cargo')) return '⇄'; if(k.includes('combat')||k.includes('bounty')||k.includes('security')||k.includes('merc')) return '✦'; if(k.includes('salv')) return '⚙'; if(k.includes('smug')) return '☣'; if(k.includes('explor')||k.includes('scan')) return '◎'; if(k.includes('engineer')||k.includes('craft')) return '⚒'; return '◈'; }
function factorPct(v) { if (v===undefined || v===null) return '—'; const n = Number(v); if (!Number.isFinite(n)) return '—'; return `${Math.round(n*100)}%`; }

createRoot(document.getElementById('root')).render(<App/>);

// NOVA_FLOATING_CHAT_MESSAGES_PATCH_V1
// Self-contained global chat/messages overlay. It avoids /api/state polling unless the panel is opened.
(function novaFloatingChatMessagesPatch(){
  if (typeof window === 'undefined' || window.__novaFloatingChatMessagesPatch) return;
  window.__novaFloatingChatMessagesPatch = true;

  const cssReady = () => document.body;
  const API_BASE = (() => {
    try {
      return String(typeof API !== 'undefined' ? API : (window.NOVA_API_URL || '')).replace(/\/$/, '');
    } catch {
      return '';
    }
  })();
  const apiUrl = (url) => {
    const raw = String(url || '');
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/api/')) return `${API_BASE}${raw}`;
    return raw;
  };
  const apiJson = async (url, options = {}) => {
    const token = sessionStorage.getItem('nova_token') || '';
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
      ...(options.headers || {}),
    };
    const res = await fetch(apiUrl(url), {
      credentials: 'include',
      ...options,
      headers,
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) {
      const msg = data?.detail || data?.error || `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  };

  let cachedState = null;
  let cachedStateAt = 0;
  const savedChannel = localStorage.getItem('novaChatChannel');
  let currentChannel = ['global', 'faction', 'guild'].includes(savedChannel) ? savedChannel : 'global';
  let open = false;
  let pollTimer = null;
  let lastId = 0;
  let localSendTimes = [];
  let localCooldownUntil = 0;
  let bootWired = false;
  let chatObserver = null;

  function normalizeState(data){ return data?.state || data || {}; }
  async function getState(force = false){
    if (!force && cachedState && Date.now() - cachedStateAt < 15000) return cachedState;
    cachedState = normalizeState(await apiJson('/api/state'));
    cachedStateAt = Date.now();
    return cachedState;
  }
  function playerFromState(state){
    const player = state?.player || {};
    const profile = state?.profile || {};
    const current = state?.current_player || {};
    const user = state?.user || {};
    const loc = state?.location || {};
    return {
      player_id: player.id ?? player.player_id ?? current.player_id ?? current.id ?? state?.player_id ?? user.player_id ?? user.id,
      username: profile.username || user.username || profile.displayName || player.callsign || player.username || current.username || player.name || player.display_name || 'Pilot',
      faction_id: player.faction_id ?? current.faction_id ?? user.faction_id ?? loc.faction_id ?? state?.faction_id,
      faction: player.faction || current.faction || user.faction || loc.faction,
      guild_id: player.guild_id ?? current.guild_id ?? user.guild_id ?? player.guild ?? player.corporation_id ?? state?.guild_id,
      guild: player.guild_name || current.guild_name || user.guild_name || player.guild || player.corporation,
    };
  }
  function esc(s){
    return String(s ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
  function qs(sel){ return document.querySelector(sel); }
  function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }
  function hasAuthToken(){ return !!sessionStorage.getItem('nova_token'); }
  function shouldShowFloatingChat(){
    return hasAuthToken() && !!qs('.appShell') && !qs('.loginScreen') && !qs('.boot');
  }
  function removeFloatingChat(){
    setOpen(false);
    qs('[data-nova-floating-chat]')?.remove();
    qs('[data-nova-messages-page]')?.remove();
  }

  function hideChatNav(){
    qsa('nav a, nav button, aside a, aside button, header a, header button, [role="navigation"] a, [role="navigation"] button').forEach(el => {
      if (el.closest('[data-nova-floating-chat]')) return;
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ').toLowerCase();
      const href = String(el.getAttribute('href') || '').toLowerCase();
      const dataPage = String(el.getAttribute('data-page') || el.getAttribute('data-route') || '').toLowerCase();
      if (text === 'chat' || href.endsWith('#chat') || href.includes('/chat') || dataPage === 'chat') {
        el.style.display = 'none';
        el.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function ensureRoot(){
    if (!shouldShowFloatingChat()) return null;
    let root = qs('[data-nova-floating-chat]');
    if (root) return root;
    root = document.createElement('div');
    root.setAttribute('data-nova-floating-chat', '1');
    root.innerHTML = `
      <button class="nova-chat-fab hasHoverTooltip" type="button" data-tooltip="Open comms. Global, faction, and guild chat are all tucked in here." aria-label="Open chat" aria-expanded="false">
        <svg class="nova-chat-fab-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path>
        </svg>
      </button>
      <section class="nova-chat-panel" hidden>
        <header class="nova-chat-head">
          <strong>Comms</strong>
          <button class="nova-chat-close" type="button" aria-label="Minimize chat">&times;</button>
        </header>
        <div class="nova-chat-tabs">
          <button data-channel="global" type="button">Global</button>
          <button data-channel="faction" type="button">Faction</button>
          <button data-channel="guild" type="button">Guild</button>
        </div>
        <div class="nova-chat-status"></div>
        <div class="nova-chat-list" aria-live="polite"></div>
        <form class="nova-chat-form">
          <input class="nova-chat-input" maxlength="500" autocomplete="off" placeholder="Message" />
          <button type="submit">Send</button>
        </form>
      </section>
    `;
    document.body.appendChild(root);
    root.querySelector('.nova-chat-fab').addEventListener('click', () => setOpen(true));
    root.querySelector('.nova-chat-close').addEventListener('click', () => setOpen(false));
    root.querySelectorAll('[data-channel]').forEach(btn => btn.addEventListener('click', () => switchChannel(btn.getAttribute('data-channel'))));
    root.querySelector('.nova-chat-form').addEventListener('submit', sendChatMessage);
    return root;
  }

  function setStatus(msg, isError = false){
    const el = qs('.nova-chat-status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('error', !!isError);
  }
  function setOpen(next){
    if (!shouldShowFloatingChat()) {
      open = false;
      qs('[data-nova-floating-chat]')?.remove();
      clearInterval(pollTimer);
      pollTimer = null;
      return;
    }
    open = !!next;
    const root = ensureRoot();
    if (!root) return;
    root.classList.toggle('open', open);
    root.querySelector('.nova-chat-panel').hidden = !open;
    root.querySelector('.nova-chat-fab').hidden = open;
    root.querySelector('.nova-chat-fab').setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      lastId = 0;
      renderActiveTab();
      loadChatMessages(true);
      clearInterval(pollTimer);
      pollTimer = setInterval(() => { if (open) loadChatMessages(false); }, 2500);
    } else {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }
  function renderActiveTab(){
    qsa('.nova-chat-tabs [data-channel]').forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-channel') === currentChannel));
  }
  function switchChannel(channel){
    currentChannel = channel || 'global';
    localStorage.setItem('novaChatChannel', currentChannel);
    lastId = 0;
    const list = qs('.nova-chat-list');
    if (list) list.innerHTML = '';
    renderActiveTab();
    loadChatMessages(true);
  }
  function appendMessages(messages, replace = false){
    const list = qs('.nova-chat-list');
    if (!list) return;
    if (replace) list.innerHTML = '';
    (messages || []).forEach(m => {
      if (m.id && Number(m.id) > lastId) lastId = Number(m.id);
      const row = document.createElement('div');
      row.className = 'nova-chat-msg';
      row.innerHTML = `<button class="nova-chat-user" data-user-id="${esc(m.user_id)}" data-username="${esc(m.username)}" type="button">${esc(m.username)}</button><span>${esc(m.message)}</span>`;
      list.appendChild(row);
    });
    while (list.children.length > 100) list.removeChild(list.firstElementChild);
    list.scrollTop = list.scrollHeight;
  }
  async function loadChatMessages(replace){
    try {
      const state = await getState(false);
      const p = playerFromState(state);
      const params = new URLSearchParams({channel: currentChannel});
      if (p.player_id) params.set('player_id', p.player_id);
      if (!replace && lastId) params.set('after_id', lastId);
      const data = await apiJson(`/api/chat/messages?${params.toString()}`);
      appendMessages(Array.isArray(data?.messages) ? data.messages : [], replace);
      setStatus('');
    } catch (err) {
      setStatus(err.message || 'Chat unavailable', true);
    }
  }
  async function sendChatMessage(ev){
    ev.preventDefault();
    const input = qs('.nova-chat-input');
    const body = (input?.value || '').trim();
    if (!body) return;
    const now = Date.now();
    if (localCooldownUntil > now) {
      setStatus(`Cooldown ${Math.ceil((localCooldownUntil - now) / 1000)}s`, true);
      return;
    }
    localSendTimes = localSendTimes.filter(t => now - t < 20000);
    if (localSendTimes.length >= 5) {
      localCooldownUntil = now + 60000;
      setStatus('Too many messages. Cooldown 60s.', true);
      return;
    }
    if (localSendTimes.length && now - localSendTimes[localSendTimes.length - 1] < 3000) {
      setStatus('Wait 3 seconds between messages.', true);
      return;
    }
    try {
      const state = await getState(false);
      const p = playerFromState(state);
      const data = await apiJson('/api/chat/messages', {
        method: 'POST',
        body: JSON.stringify({channel: currentChannel, message: body, ...p}),
      });
      localSendTimes.push(now);
      input.value = '';
      if (data?.message) appendMessages([data.message], false);
      else await loadChatMessages(true);
      setStatus('');
    } catch (err) {
      if (err.status === 429) localCooldownUntil = Date.now() + 60000;
      setStatus(err.message || 'Message failed', true);
    }
  }

  function ensureMessagesPage(){
    if (!shouldShowFloatingChat()) return null;
    let page = qs('[data-nova-messages-page]');
    if (page) return page;
    page = document.createElement('section');
    page.setAttribute('data-nova-messages-page', '1');
    page.hidden = true;
    page.innerHTML = `
      <div class="nova-messages-shell">
        <header class="nova-messages-head">
          <strong>Messages</strong>
          <button type="button" class="nova-messages-close">&times;</button>
        </header>
        <div class="nova-messages-body">
          <aside class="nova-message-threads"></aside>
          <main class="nova-message-thread">
            <div class="nova-message-empty">Select a thread or enter a pilot name.</div>
          </main>
        </div>
        <form class="nova-message-compose">
          <input class="nova-message-recipient" placeholder="Pilot name or selected profile" />
          <input class="nova-message-input" maxlength="2000" placeholder="Private message" />
          <button type="submit">Send</button>
        </form>
      </div>
    `;
    document.body.appendChild(page);
    page.querySelector('.nova-messages-close').addEventListener('click', () => { page.hidden = true; if (location.hash === '#messages') history.back(); });
    page.querySelector('.nova-message-compose').addEventListener('submit', sendDirectMessage);
    return page;
  }
  async function openMessages(target){
    if (!shouldShowFloatingChat()) return;
    const page = ensureMessagesPage();
    if (!page) return;
    page.hidden = false;
    if (target?.username) page.querySelector('.nova-message-recipient').value = target.username;
    await loadThreads();
  }
  async function loadThreads(){
    try {
      const state = await getState(false);
      const p = playerFromState(state);
      if (!p.player_id) return;
      const data = await apiJson(`/api/messages/threads?player_id=${encodeURIComponent(p.player_id)}`);
      const wrap = qs('.nova-message-threads');
      if (!wrap) return;
      wrap.innerHTML = '';
      const threads = Array.isArray(data?.threads) ? data.threads : [];
      if (!threads.length) {
        wrap.innerHTML = '<div class="nova-message-empty">No direct message threads yet.</div>';
      }
      threads.forEach(t => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nova-message-thread-btn';
        btn.innerHTML = `<strong>${esc(t.other_name)}</strong><span>${esc(t.last_body || '')}</span>${t.unread ? `<b>${t.unread}</b>` : ''}`;
        btn.addEventListener('click', () => loadThread(t.other_id, t.other_name));
        wrap.appendChild(btn);
      });
    } catch (err) {
      const wrap = qs('.nova-message-threads');
      if (wrap) wrap.textContent = err.message || 'Messages unavailable';
    }
  }
  async function loadThread(otherId, otherName){
    try {
      const state = await getState(false);
      const p = playerFromState(state);
      const data = await apiJson(`/api/messages/thread?player_id=${encodeURIComponent(p.player_id)}&other_id=${encodeURIComponent(otherId)}`);
      const thread = qs('.nova-message-thread');
      if (!thread) return;
      const messages = Array.isArray(data?.messages) ? data.messages : [];
      thread.innerHTML = messages.length ? '' : '<div class="nova-message-empty">No messages in this thread yet.</div>';
      messages.forEach(m => {
        const div = document.createElement('div');
        div.className = `nova-direct-msg ${String(m.sender_id) === String(p.player_id) ? 'mine' : ''}`;
        div.innerHTML = `<strong>${esc(m.sender_name)}</strong><span>${esc(m.body)}</span>`;
        thread.appendChild(div);
      });
      const recipient = qs('.nova-message-recipient');
      if (recipient) recipient.value = otherName || otherId;
    } catch (err) {
      const thread = qs('.nova-message-thread');
      if (thread) thread.innerHTML = `<div class="nova-message-empty">${esc(err.message || 'Thread unavailable')}</div>`;
    }
  }
  async function sendDirectMessage(ev){
    ev.preventDefault();
    const recipient = (qs('.nova-message-recipient')?.value || '').trim();
    const body = (qs('.nova-message-input')?.value || '').trim();
    if (!recipient || !body) return;
    try {
      const state = await getState(false);
      const p = playerFromState(state);
      await apiJson('/api/messages/send', {method:'POST', body: JSON.stringify({player_id:p.player_id, recipient_name:recipient, body})});
      const input = qs('.nova-message-input');
      if (input) input.value = '';
      await loadThreads();
    } catch (err) {
      const thread = qs('.nova-message-thread');
      if (thread) thread.innerHTML = `<div class="nova-message-empty">${esc(err.message || 'Message failed')}</div>`;
    }
  }

  window.novaOpenDirectMessages = function(target){
    location.hash = 'messages';
    openMessages(target || {});
  };

  function installProfileMessageButtons(){
    qsa('[data-user-id], [data-player-id]').forEach(el => {
      if (el.closest('[data-nova-floating-chat]') || el.closest('[data-nova-messages-page]')) return;
      if (el.querySelector?.('.nova-profile-message-btn')) return;
      const id = el.getAttribute('data-user-id') || el.getAttribute('data-player-id');
      if (!id) return;
      const username = el.getAttribute('data-username') || el.getAttribute('data-player-name') || (el.textContent || '').trim().slice(0, 80);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nova-profile-message-btn';
      btn.textContent = 'Message';
      btn.addEventListener('click', (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        window.novaOpenDirectMessages({user_id:id, username});
      });
      try { el.appendChild(btn); } catch {}
    });
  }

  function routeWatcher(){
    if (location.hash.replace(/^#\/?/, '') === 'messages' || location.pathname.toLowerCase().endsWith('/messages')) {
      openMessages({});
    }
  }

  function boot(){
    if (!cssReady()) return setTimeout(boot, 50);
    if (!bootWired) {
      window.addEventListener('hashchange', routeWatcher);
      bootWired = true;
    }
    if (!chatObserver) {
      chatObserver = new MutationObserver(() => {
        if (!shouldShowFloatingChat()) {
          removeFloatingChat();
          return;
        }
        hideChatNav();
        ensureRoot();
        routeWatcher();
        installProfileMessageButtons();
      });
      chatObserver.observe(document.body, {childList:true, subtree:true});
    }
    if (!shouldShowFloatingChat()) {
      removeFloatingChat();
      return;
    }
    hideChatNav();
    ensureRoot();
    routeWatcher();
    installProfileMessageButtons();
  }
  window.addEventListener('nova:auth-changed', boot);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();


/* NOVA_STARTER_TUTORIAL_AND_FETCH_GUARD_V3 */
(function novaStarterTutorialAndFetchGuard(){
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // In-flight /api/state de-dupe: prevents same-tab stampedes when multiple UI actions refresh state at once.
  // It does not cache completed state and does not alter backend authority.
  if (!window.__novaStateFetchGuardInstalled && window.fetch) {
    window.__novaStateFetchGuardInstalled = true;
    const originalFetch = window.fetch.bind(window);
    const inflight = new Map();
    window.fetch = function novaGuardedFetch(input, init){
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        const method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        const isState = method === 'GET' && /\/api\/state(?:\?|$)/.test(url);
        if (isState) {
          const key = url;
          if (inflight.has(key)) {
            return inflight.get(key).then(function(resp){ return resp.clone(); });
          }
          const p = originalFetch(input, init).finally(function(){ inflight.delete(key); });
          inflight.set(key, p);
          return p.then(function(resp){ return resp.clone(); });
        }
      } catch (err) {}
      return originalFetch(input, init);
    };
  }

  const STORAGE_PREFIX = 'novaStarterTutorialDoneV3';
  const SESSION_PREFIX = 'novaStarterTutorialMinimizedV3';
  const LEGACY_STORAGE_KEY = 'novaStarterTutorialDoneV1';
  const LEGACY_COLLAPSED_KEY = 'novaStarterTutorialMinimizedV1';

  const steps = [];
  // Keep the legacy copy readable for patch history; the active guide is loaded below.
  const starterTutorialStepsV2 = [
    {
      screen: 'Dashboard',
      title: 'Command Deck: read your ship first',
      body: 'The dashboard is your quiet checkpoint. Before you fly anywhere, use it to read your location, fuel, cargo, health, local safety, and the game-suggested next actions.',
      points: [
        'Fuel, cargo, and health tell you what kind of trip is safe right now.',
        'Current Details explains the galaxy, planet, security, market pressure, and local danger.',
        'Recommended Next Actions and Basic Work are the softest early income buttons.'
      ],
      loop: 'Check status -> pick a safe action -> return to dock and reassess.',
      route: '#dashboard',
      action: 'Open Dashboard'
    },
    {
      title: 'Your faction is your first big bet',
      body: 'You already picked a side. That choice decides your starter territory, who feels friendly on the map, who becomes a war target later, and what kind of jobs feel natural early on. You can still trade, fight, mine, and explore — faction mostly shapes your starting lane and long-term politics.',
      route: '#faction',
      action: 'View Faction War'
    },
    {
      title: 'Travel first, fight second',
      body: 'Click a destination and watch for the travel path. The client shows movement right away, but the server is still the source of truth. Get comfortable with movement before picking fights.',
      route: '#map',
      action: 'Stay on Map'
    },
    {
      title: 'Docking is your safe reset',
      body: 'When you are docked, use that time to repair, shop, craft, sell cargo, and check missions. Ships, cargo, and materials live on planets; credits are the thing that follows you everywhere.',
      route: '#missions',
      action: 'View Missions'
    },
    {
      title: 'Missions are the cleanest start',
      body: 'Starter missions give you direction without making you memorize every system. Use them to learn rewards, cooldowns, travel, and planet storage before roaming too far.',
      route: '#missions',
      action: 'View Missions'
    },
    {
      title: 'Combat is about timing, not spam',
      body: 'Fight manually early so you can see what shields, hull, buffs, debuffs, and cooldowns are doing. Auto battle is better after the basics click.',
      route: '#map',
      action: 'Return to Map'
    },
    {
      title: 'Use messages when you need people',
      body: 'Global, faction, and guild chat are there when you want them. Direct messages are cleaner for one-on-one coordination, trades, and guild planning.',
      route: '#messages',
      action: 'Open Messages'
    }
  ];

  steps.splice(0, steps.length,
    {
      screen: 'Command',
      title: 'Start with the command view',
      body: 'This overview is your checkpoint before you spend fuel. Read your ship state, location, and recommended work, then decide what kind of run makes sense.',
      loop: 'Check status -> pick safe work -> collect rewards -> reassess.',
      hub: 'Galaxy',
      tab: 'overview',
      route: '#dashboard',
      target: ['.commandRibbon', '.dashboardGrid', '.content']
    },
    {
      screen: 'Navigation',
      title: 'Move from the map',
      body: 'The map is the real flight layer. It highlights planets, stations, routes, resources, threats, and your current movement so you can choose the next stop with context.',
      loop: 'Pick a nearby stop -> travel -> dock -> work the local loop.',
      hub: 'Galaxy',
      tab: 'navigation',
      route: '#map',
      target: ['.mapShell.phase23bMapShell', '.mapShell', '.mapViewport']
    },
    {
      screen: 'Map Tools',
      title: 'Use map controls before committing',
      body: 'These controls help you switch scale, scan space, filter clutter, and understand what is worth clicking before you burn time moving there.',
      loop: 'Filter -> inspect -> travel only when the target is worth it.',
      hub: 'Galaxy',
      tab: 'navigation',
      route: '#map',
      target: ['.mapToolbar', '.mapCommandBar', '.mapShell']
    },
    {
      screen: 'Planet',
      title: 'Docking is your safe reset',
      body: 'Planet screens are where you repair, sell, craft, store, and work local opportunities. When the frontier gets messy, dock and reset your plan here.',
      loop: 'Dock -> repair or sell -> choose the next run.',
      hub: 'Planet',
      tab: 'overview',
      route: '#planet',
      target: ['.pageFrame-planet-control', '.hubBody .panel', '.hubBody']
    },
    {
      screen: 'Goods',
      title: 'Trade with cargo space in mind',
      body: 'NPC goods are the cleanest early trade loop. Watch supply, demand, price, and free cargo before buying anything you need to haul.',
      loop: 'Buy where supply is good -> haul safely -> sell where demand pays.',
      hub: 'Planet',
      tab: 'goods',
      route: '#market',
      target: ['.pageFrame-npc-goods-market', '.marketTabs', '.hubBody .panel']
    },
    {
      screen: 'Crafting',
      title: 'Turn scraps into ship progress',
      body: 'Industry turns mining and salvage into refined parts, modules, and upgrades. Timed jobs keep working while you keep playing.',
      loop: 'Mine or salvage -> refine -> craft -> equip or sell.',
      hub: 'Planet',
      tab: 'industry',
      route: '#crafting',
      target: ['.hubSplitStack', '.pageFrame-crafting', '.hubBody .panel']
    },
    {
      screen: 'Ship / Cargo',
      title: 'Know what you are carrying',
      body: 'Ship and cargo screens connect combat loot, trade goods, modules, materials, and sale value. If cargo is full, this is where you make the keep-or-sell decision.',
      loop: 'Inspect loot -> sell extras -> equip upgrades -> keep core materials.',
      hub: 'Character',
      tab: 'ship',
      route: '#inventory',
      target: ['.inventoryLayout', '.hubSplitStack', '.hubBody .panel']
    },
    {
      screen: 'Skills',
      title: 'Spend skills with a plan',
      body: 'Skills shape the loops you want to run more often. Spend points toward the skill rhythm you actually enjoy instead of chasing every bonus at once.',
      loop: 'Earn XP -> spend points -> improve your favorite loop.',
      hub: 'Character',
      tab: 'skills',
      route: '#skills',
      target: ['.pageFrame-skills', '.skillGrid', '.hubBody .panel']
    },
    {
      screen: 'Auction',
      title: 'Use the Auction after basics click',
      body: 'The auction view is for player listings and broader trade. It matters more once you understand cargo, planet storage, and where goods physically live.',
      loop: 'Compare listings -> buy or list -> remember delivery location.',
      hub: 'Market',
      tab: 'auction',
      route: '#auction',
      target: ['.pageFrame-auction', '.marketTabs', '.hubBody .panel']
    },
    {
      screen: 'Guilds / War',
      title: 'The bigger game can wait',
      body: 'Guilds, faction war, leaderboards, and social systems are long-term pressure. Peek here early, but build stable money and a ship you trust first.',
      loop: 'Build stability -> coordinate -> fight or supply borders.',
      hub: 'Market',
      tab: 'guilds',
      route: '#faction',
      target: ['.hubSplitStack', '.pageFrame-faction-war', '.hubBody .panel']
    }
  );

  let index = 0;
  let root = null;
  let card = null;
  let targetBox = null;
  let shades = [];
  let activeUserKey = '';
  let autoCheckedForUser = '';
  let booted = false;
  let targetRefreshTimer = null;

  function cleanKey(value) {
    return String(value || 'local-player').trim().toLowerCase().replace(/[^a-z0-9_.:@-]/g, '_').slice(0, 120) || 'local-player';
  }

  function doneKey() {
    return `${STORAGE_PREFIX}:${activeUserKey || 'local-player'}`;
  }

  function minimizedKey() {
    return `${SESSION_PREFIX}:${activeUserKey || 'local-player'}`;
  }

  function isGameShellReady() {
    return !!document.querySelector('.appShell');
  }

  function removeTutorialUi() {
    document.body.classList.remove('novaTutorialActive');
    if (root) root.remove();
    root = null;
    card = null;
    targetBox = null;
    shades = [];
    window.clearTimeout(targetRefreshTimer);
    document.querySelector('.novaTutorialLauncher')?.remove();
  }

  function applyStepRoute(step) {
    if (!step) return;
    if (step.hub) {
      window.dispatchEvent(new CustomEvent('nova:set-page', {
        detail: { hub: step.hub, tab: step.tab || '' }
      }));
    } else if (step.page) {
      window.dispatchEvent(new CustomEvent('nova:set-page', { detail: { page: step.page } }));
    }
    if (step.route && window.location.hash !== step.route) window.location.hash = step.route;
  }

  function tutorialEscape(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) {
      return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'}[ch];
    });
  }

  function tutorialDone() {
    try {
      return localStorage.getItem(doneKey()) === '1';
    } catch (err) {
      return false;
    }
  }

  function tutorialMinimizedThisSession() {
    try {
      return sessionStorage.getItem(minimizedKey()) === '1';
    } catch (err) {
      return false;
    }
  }

  function markDone() {
    try {
      localStorage.setItem(doneKey(), '1');
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      localStorage.removeItem('novaStarterTutorialDoneV2');
      sessionStorage.removeItem(minimizedKey());
      sessionStorage.removeItem(LEGACY_COLLAPSED_KEY);
      sessionStorage.removeItem('novaStarterTutorialMinimizedV2');
    } catch (err) {}
  }

  function finish() {
    markDone();
    removeTutorialUi();
    ensureLauncher();
  }

  function isUsableRect(rect) {
    return rect && rect.width >= 24 && rect.height >= 24 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
  }

  function firstVisibleTarget(selectors) {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    for (const selector of list) {
      if (!selector) continue;
      const candidates = Array.from(document.querySelectorAll(selector));
      for (const el of candidates) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        if (style.display !== 'none' && style.visibility !== 'hidden' && isUsableRect(rect)) return el;
      }
    }
    return document.querySelector('.content') || document.querySelector('.appShell') || document.body;
  }

  function paddedRect(rect, pad = 9) {
    const left = Math.max(8, rect.left - pad);
    const top = Math.max(8, rect.top - pad);
    const right = Math.min(window.innerWidth - 8, rect.right + pad);
    const bottom = Math.min(window.innerHeight - 8, rect.bottom + pad);
    return {
      left,
      top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top),
      right,
      bottom
    };
  }

  function updateSpotlight() {
    if (!root || !targetBox || !card) return;
    const step = steps[index] || steps[0];
    const target = firstVisibleTarget(step.target);
    const rect = paddedRect(target.getBoundingClientRect(), target === document.body ? 0 : 10);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const [topShade, leftShade, rightShade, bottomShade] = shades;

    topShade.style.cssText = `left:0;top:0;width:${vw}px;height:${rect.top}px`;
    leftShade.style.cssText = `left:0;top:${rect.top}px;width:${rect.left}px;height:${rect.height}px`;
    rightShade.style.cssText = `left:${rect.right}px;top:${rect.top}px;width:${Math.max(0, vw - rect.right)}px;height:${rect.height}px`;
    bottomShade.style.cssText = `left:0;top:${rect.bottom}px;width:${vw}px;height:${Math.max(0, vh - rect.bottom)}px`;
    targetBox.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;

    const cardRect = card.getBoundingClientRect();
    const cardLeft = Math.max(12, Math.min(vw - cardRect.width - 12, rect.left + rect.width / 2 - cardRect.width / 2));
    const targetIsLow = rect.top > vh * 0.48;
    card.style.left = `${cardLeft}px`;
    card.style.right = 'auto';
    if (targetIsLow) {
      card.style.top = '18px';
      card.style.bottom = 'auto';
    } else {
      card.style.top = 'auto';
      card.style.bottom = '22px';
    }
  }

  function scheduleSpotlightUpdate(delay = 70) {
    window.clearTimeout(targetRefreshTimer);
    targetRefreshTimer = window.setTimeout(updateSpotlight, delay);
    window.requestAnimationFrame(updateSpotlight);
  }

  function setTutorialIndex(nextIndex) {
    index = Math.max(0, Math.min(steps.length - 1, nextIndex));
    applyStepRoute(steps[index]);
    render();
    scheduleSpotlightUpdate(120);
  }

  function render() {
    if (!root) {
      root = document.createElement('div');
      root.className = 'novaTutorialOverlay';
      document.body.appendChild(root);
      shades = ['top', 'left', 'right', 'bottom'].map(function(pos) {
        const shade = document.createElement('div');
        shade.className = `novaTutorialShade novaTutorialShade-${pos}`;
        root.appendChild(shade);
        return shade;
      });
      targetBox = document.createElement('div');
      targetBox.className = 'novaTutorialSpotlightBox';
      root.appendChild(targetBox);
    }
    document.body.classList.add('novaTutorialActive');
    const step = steps[index] || steps[0];
    if (card) card.remove();
    card = document.createElement('div');
    card.className = 'novaTutorialCard';
    card.innerHTML = `
      <div class="novaTutorialTopline">
        <span>Starter Flight Plan</span>
        <span>${index + 1} / ${steps.length}</span>
      </div>
      <div class="novaTutorialScreenBadge">${tutorialEscape(step.screen || 'Guide')}</div>
      <h2>${tutorialEscape(step.title)}</h2>
      <p>${tutorialEscape(step.body)}</p>
      <div class="novaTutorialCallout">
        <b>Loop</b>
        <span>${tutorialEscape(step.loop || '')}</span>
      </div>
      <div class="novaTutorialProgress"><span style="width:${((index + 1) / steps.length) * 100}%"></span></div>
      <div class="novaTutorialActions">
        <button type="button" data-role="cancel">Cancel</button>
        <button type="button" data-role="back" ${index === 0 ? 'disabled' : ''}>Prev</button>
        <button type="button" data-role="next">${index === steps.length - 1 ? 'Done' : 'Next'}</button>
      </div>
    `;
    root.appendChild(card);
    card.addEventListener('click', function(evt){
      const btn = evt.target.closest('button');
      if (!btn) return;
      const role = btn.getAttribute('data-role');
      if (role === 'cancel') finish();
      if (role === 'back') setTutorialIndex(index - 1);
      if (role === 'next') {
        if (index >= steps.length - 1) finish();
        else setTutorialIndex(index + 1);
      }
    });
    scheduleSpotlightUpdate(30);
  }

  function start() {
    if (!isGameShellReady()) {
      removeTutorialUi();
      return;
    }
    try { sessionStorage.removeItem(minimizedKey()); } catch (err) {}
    const launcher = document.querySelector('.novaTutorialLauncher');
    if (launcher) launcher.remove();
    setTutorialIndex(0);
  }

  function ensureLauncher() {
    document.querySelector('.novaTutorialLauncher')?.remove();
  }

  function maybeAutoStart() {
    if (!activeUserKey || !isGameShellReady()) {
      if (!isGameShellReady()) removeTutorialUi();
      return;
    }
    ensureLauncher();
    if (autoCheckedForUser === activeUserKey) return;
    autoCheckedForUser = activeUserKey;
    if (!tutorialDone() && !tutorialMinimizedThisSession()) {
      window.setTimeout(function(){
        if (!tutorialDone() && !tutorialMinimizedThisSession() && isGameShellReady()) start();
      }, 650);
    }
  }

  function setTutorialUser(detail) {
    const nextKey = cleanKey(detail && detail.userKey);
    if (activeUserKey !== nextKey) {
      activeUserKey = nextKey;
      autoCheckedForUser = '';
    }
    maybeAutoStart();
  }

  function boot() {
    if (booted) return;
    booted = true;
    window.addEventListener('nova:tutorial-user-ready', function(evt){ setTutorialUser(evt.detail || {}); });
    window.addEventListener('nova:tutorial-open', function(){ start(); });
    window.addEventListener('nova:auth-changed', function(evt){
      if (!evt.detail?.authenticated) removeTutorialUi();
    });
    window.addEventListener('resize', function(){ scheduleSpotlightUpdate(0); });
    window.addEventListener('scroll', function(){ scheduleSpotlightUpdate(0); }, true);
    window.novaOpenTutorial = function(){ start(); };
    new MutationObserver(function(){
      if (!isGameShellReady()) removeTutorialUi();
      else maybeAutoStart();
      if (root) scheduleSpotlightUpdate(80);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

// NOVA_SECURITY_DEFENSE_FRONTEND_OVERLAY_V1
// Passive security-status overlay. Does not poll unless opened.
(function novaSecurityDefenseOverlay(){
  if (typeof document !== 'undefined') document.querySelector('[data-nova-security-overlay]')?.remove();
  return;
  if (typeof window === 'undefined' || typeof document === 'undefined' || window.__novaSecurityDefenseOverlay) return;
  window.__novaSecurityDefenseOverlay = true;

  function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  async function getJson(url){
    const res = await fetch(url, {credentials:'include'});
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) throw new Error(data?.detail || data?.error || `Request failed ${res.status}`);
    return data;
  }
  function ensure(){
    let root = document.querySelector('[data-nova-security-overlay]');
    if (root) return root;
    root = document.createElement('div');
    root.setAttribute('data-nova-security-overlay', '1');
    root.className = 'novaSecurityOverlay minimized';
    root.innerHTML = `
      <button type="button" class="novaSecurityToggle hasHoverTooltip" data-tooltip="Quick security view. Use it to spot unsafe galaxies before committing to a route.">SEC</button>
      <div class="novaSecurityPanel">
        <div class="novaSecurityHead">
          <strong>Galaxy Security</strong>
          <button type="button" class="novaSecurityClose">×</button>
        </div>
        <div class="novaSecurityBody">Open to load security state.</div>
      </div>`;
    document.body.appendChild(root);
    root.querySelector('.novaSecurityToggle')?.addEventListener('click', async () => {
      root.classList.toggle('minimized');
      if (!root.classList.contains('minimized')) await load(root);
    });
    root.querySelector('.novaSecurityClose')?.addEventListener('click', () => root.classList.add('minimized'));
    return root;
  }
  async function load(root){
    const body = root.querySelector('.novaSecurityBody');
    if (!body) return;
    body.innerHTML = '<div class="novaSecurityMuted">Loading security state...</div>';
    try {
      const data = await getJson('/api/security/state');
      const rows = (data.galaxies || []).slice(0, 20);
      body.innerHTML = rows.length ? rows.map(g => `
        <div class="novaSecurityRow ${g.war_active ? 'war' : ''}">
          <div><strong>${esc(g.galaxy_id)}</strong><span>${esc(g.owner_faction || 'contested')}</span></div>
          <div class="novaSecurityPill">SEC ${Number(g.security_level || 0).toFixed(1)}</div>
          <div class="novaSecurityStats">T ${g.turret_count ?? 0} ×${g.turret_multiplier ?? 1} · P ${g.patrol_count ?? 0}${g.patrol_bonus ? ` +${g.patrol_bonus}` : ''}${g.war_active ? ' · WAR' : ''}</div>
        </div>`).join('') : '<div class="novaSecurityMuted">No galaxy security state yet.</div>';
    } catch (err) {
      body.innerHTML = `<div class="novaSecurityMuted">${esc(err.message || err)}</div>`;
    }
  }
  function boot(){ ensure(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

// NOVA_GUILD_SYSTEM_FRONTEND_V1
// Self-contained Guild UI shell. It loads guild data on the Guild page only; it does not expand /api/state.
(function novaGuildSystemFrontend(){
  if (typeof window === 'undefined' || window.__novaGuildSystemFrontendV1) return;
  window.__novaGuildSystemFrontendV1 = true;

  const stateCache = { value: null, at: 0 };
  const app = { open: false, tab: localStorage.getItem('novaGuildTab') || 'overview', me: null, roster: null, contributions: null, research: null, armory: null, treasury: null, wars: null, logs: null, guilds: null, err: '' };

  async function apiJson(url, options = {}) {
    const authToken = sessionStorage.getItem('nova_token') || '';
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(options.headers || {})
      }
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) {
      const err = new Error(data?.detail || data?.error || `Request failed (${res.status})`);
      err.data = data;
      err.status = res.status;
      throw err;
    }
    return data;
  }
  function esc(v){ return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }
  function qs(s){ return document.querySelector(s); }
  function qsa(s){ return Array.from(document.querySelectorAll(s)); }
  function normalizeState(data){ return data?.state || data || {}; }
  async function getState(force=false){
    if (!force && stateCache.value && Date.now() - stateCache.at < 15000) return stateCache.value;
    const data = normalizeState(await apiJson('/api/state'));
    stateCache.value = data; stateCache.at = Date.now();
    return data;
  }
  function playerIdFromState(state){
    const p = state?.player || state?.profile || state?.current_player || state?.user || {};
    return p.id ?? p.player_id ?? state?.player_id ?? localStorage.getItem('novaPlayerId') ?? 1;
  }
  async function currentPlayerId(){ return playerIdFromState(await getState()); }

  function ensureNav(){
    qsa('nav button, [role="navigation"] button, .sidebar button').forEach(btn => {
      const page = String(btn.getAttribute('data-page') || '').toLowerCase();
      const text = (btn.textContent || '').trim().replace(/\s+/g, ' ').toLowerCase();
      if (page !== 'guild' && text !== 'guild') return;
      if (btn.dataset.novaGuildNavBound === '1') return;
      btn.dataset.novaGuildNavBound = '1';
      btn.addEventListener('click', () => {
        if (location.hash !== '#guild') location.hash = 'guild';
        else openGuildPage();
      });
    });
  }

  function ensureRoot(){
    let root = qs('[data-nova-guild-root]');
    if (root) return root;
    root = document.createElement('section');
    root.setAttribute('data-nova-guild-root', '1');
    root.className = 'nova-guild-root';
    root.hidden = true;
    document.body.appendChild(root);
    return root;
  }

  function openGuildPage(){
    app.open = true;
    location.hash = 'guild';
    ensureRoot().hidden = false;
    loadAll().catch(showError);
  }
  function closeGuildPage(){ app.open = false; ensureRoot().hidden = true; }
  function setTab(tab){ app.tab = tab; localStorage.setItem('novaGuildTab', tab); render(); loadTab(tab).catch(showError); }
  function showError(e){ app.err = e?.message || String(e); render(); }

  async function loadMe(){
    const player_id = await currentPlayerId();
    app.me = await apiJson(`/api/guild/me?player_id=${encodeURIComponent(player_id)}`);
    app.err = '';
    return app.me;
  }
  async function loadAll(){ await loadMe(); await loadGuildList(); await loadTab(app.tab); render(); }
  async function loadGuildList(){ app.guilds = await apiJson('/api/guild/list?limit=50'); }
  async function loadTab(tab){
    const me = app.me || await loadMe();
    const gid = me?.guild?.id;
    const pid = me?.player?.id || await currentPlayerId();
    if (!gid) return;
    if (tab === 'roster' || tab === 'settings') app.roster = await apiJson(`/api/guild/roster?player_id=${pid}&guild_id=${gid}`);
    if (tab === 'contributions') app.contributions = await apiJson(`/api/guild/contributions?player_id=${pid}&guild_id=${gid}`);
    if (tab === 'research') app.research = await apiJson(`/api/guild/research?player_id=${pid}&guild_id=${gid}`);
    if (tab === 'armory') app.armory = await apiJson(`/api/guild/armory?player_id=${pid}&guild_id=${gid}`);
    if (tab === 'treasury') app.treasury = await apiJson(`/api/guild/treasury?player_id=${pid}&guild_id=${gid}`);
    if (tab === 'wars') app.wars = await apiJson(`/api/guild/wars?player_id=${pid}&guild_id=${gid}`);
    if (tab === 'logs') app.logs = await apiJson(`/api/guild/logs?player_id=${pid}&guild_id=${gid}`);
  }
  async function post(url, body){ const data = await apiJson(url, { method: 'POST', body: JSON.stringify(body) }); await loadAll(); return data; }

  function progressPct(g){
    const xp = Number(g?.xp || 0), next = Number(g?.next_level_xp || 1);
    return Math.max(0, Math.min(100, Math.round((xp / Math.max(1,next)) * 100)));
  }
  function tabButton(id, label){ return `<button type="button" class="${app.tab===id?'active':''}" data-guild-tab="${id}">${label}</button>`; }

  function renderNoGuild(){
    const guilds = app.guilds?.guilds || [];
    return `
      <div class="nova-guild-grid two">
        <form class="nova-guild-card" data-guild-create>
          <h3>Create Guild</h3>
          <p class="muted">Requires money and being docked at a planet. HQ becomes your current planet.</p>
          <label>Name<input name="name" maxlength="64" required /></label>
          <label>Tag<input name="tag" maxlength="8" required /></label>
          <label>Description<textarea name="description" maxlength="500"></textarea></label>
          <label>Status<select name="status"><option value="public">Public</option><option value="invite">Invite Only</option><option value="private">Private</option></select></label>
          <button type="submit">Create Guild</button>
        </form>
        <div class="nova-guild-card">
          <h3>Join Guild</h3>
          <div class="nova-guild-list compact">
            ${guilds.map(g => `<div class="row"><b>[${esc(g.tag)}] ${esc(g.name)}</b><span>Lvl ${esc(g.level)} · ${esc(g.member_count)}/${esc(g.max_members)}</span><button type="button" data-apply-guild="${g.id}">Apply</button></div>`).join('') || '<p class="muted">No guilds yet.</p>'}
          </div>
        </div>
      </div>
      ${renderInvites()}`;
  }
  function renderInvites(){
    const invites = app.me?.invites || [];
    if (!invites.length) return '';
    return `<div class="nova-guild-card"><h3>Invites</h3>${invites.map(i => `<div class="row"><b>[${esc(i.guild_tag)}] ${esc(i.guild_name)}</b><button data-invite-accept="${i.id}">Accept</button><button data-invite-decline="${i.id}">Decline</button></div>`).join('')}</div>`;
  }
  function renderOverview(){
    const g = app.me?.guild;
    const bonuses = g?.research_bonuses || {};
    return `<div class="nova-guild-grid two">
      <div class="nova-guild-card hero"><h2>[${esc(g.tag)}] ${esc(g.name)}</h2><p>${esc(g.description || 'No description set.')}</p><div class="nova-guild-xp"><span style="width:${progressPct(g)}%"></span></div><div class="statline"><b>Level ${esc(g.level)}</b><span>${esc(g.xp)} / ${esc(g.next_level_xp)} XP</span><span>${esc(g.member_count)} / ${esc(g.max_members)} members</span><span>Treasury ${esc(g.treasury)}</span></div><p class="motd">${esc(g.motd || 'No guild message set.')}</p></div>
      <div class="nova-guild-card"><h3>Research Bonuses</h3><div class="chips">${Object.keys(bonuses).map(k => `<span>${esc(k)} +${esc(bonuses[k])}%</span>`).join('') || '<em>No bonuses yet.</em>'}</div></div>
      <div class="nova-guild-card"><h3>Quick Actions</h3><form data-treasury-deposit><label>Deposit Money<input name="amount" type="number" min="1" /></label><button>Deposit</button></form><form data-contribution-record><label>Manual Contribution XP<input name="xp" type="number" min="1" /></label><select name="contribution_type"><option>mission</option><option>material</option><option>combat</option><option>crafting</option><option>war</option></select><button>Record</button></form></div>
      <div class="nova-guild-card"><h3>Guild Loop</h3><ol><li>Gather, fight, craft, mission.</li><li>Contribute XP daily.</li><li>Level guild for capacity and research.</li><li>Use treasury/armory for wars and planet control.</li></ol></div>
    </div>`;
  }
  function renderRoster(){
    const rows = app.roster?.members || [];
    const ranks = app.roster?.ranks || [];
    return `<div class="nova-guild-card"><h3>Roster</h3><table><thead><tr><th>Pilot</th><th>Rank</th><th>Contribution</th><th>Actions</th></tr></thead><tbody>${rows.map(m => `<tr><td>${esc(m.username)}</td><td>${esc(m.rank_name)}</td><td>${esc(m.contribution_total)}</td><td><select data-rank-player="${m.player_id}">${ranks.map(r => `<option value="${r.id}" ${String(r.id)===String(m.rank_id)?'selected':''}>${esc(r.name)}</option>`).join('')}</select><button data-kick-player="${m.player_id}">Kick</button></td></tr>`).join('')}</tbody></table></div>`;
  }
  function renderContributions(){
    const daily = app.contributions?.daily || [];
    const events = app.contributions?.events || [];
    return `<div class="nova-guild-grid two"><div class="nova-guild-card"><h3>Daily Contributions</h3><table><thead><tr><th>Day</th><th>Player</th><th>Raw</th><th>Effective</th></tr></thead><tbody>${daily.map(r => `<tr><td>${esc(r.day)}</td><td>${esc(r.player_id)}</td><td>${esc(r.raw_xp)}</td><td>${esc(r.effective_xp)}</td></tr>`).join('')}</tbody></table></div><div class="nova-guild-card"><h3>Recent Events</h3>${events.map(e => `<div class="log"><b>${esc(e.contribution_type)}</b> +${esc(e.effective_xp)} XP <small>${esc(e.created_at)}</small></div>`).join('') || '<p class="muted">No contributions yet.</p>'}</div></div>`;
  }
  function renderResearch(){
    const defs = app.research?.definitions || [];
    const byCat = defs.reduce((a,d)=>{(a[d.category] ||= []).push(d); return a;},{});
    return `<div class="nova-guild-card"><h3>Research <span>${esc(app.research?.guild?.research_points || 0)} points</span></h3>${Object.entries(byCat).map(([cat,items]) => `<h4>${esc(cat)}</h4><div class="nova-research-grid">${items.map(d => `<div class="research"><b>${esc(d.name)}</b><p>${esc(d.description)}</p><span>Rank ${esc(d.current_rank)} / ${esc(d.max_rank)} · Req Lvl ${esc(d.required_guild_level)}</span><button data-unlock-research="${esc(d.research_key)}">Unlock</button></div>`).join('')}</div>`).join('')}</div>`;
  }
  function renderArmory(){
    const items = app.armory?.items || [];
    return `<div class="nova-guild-grid two"><form class="nova-guild-card" data-armory-deposit><h3>Deposit Current Planet Item</h3><label>Type<input name="item_type" value="material" /></label><label>Key<input name="item_key" required /></label><label>Name<input name="item_name" /></label><label>Quantity<input name="quantity" type="number" min="1" value="1" /></label><button>Deposit</button><p class="muted">Inventory is planet-specific. If the adapter cannot find your inventory table, it blocks the action instead of duplicating items.</p></form><div class="nova-guild-card"><h3>Planet Armory ${esc(app.armory?.planet_id || '')}</h3><table><thead><tr><th>Item</th><th>Qty</th><th></th></tr></thead><tbody>${items.map(i => `<tr><td>${esc(i.item_name || i.item_key)}<small>${esc(i.item_type)}</small></td><td>${esc(i.quantity)}</td><td><button data-withdraw-key="${esc(i.item_key)}" data-withdraw-type="${esc(i.item_type)}">Withdraw 1</button></td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function renderTreasury(){
    const logs = app.treasury?.logs || [];
    return `<div class="nova-guild-grid two"><form class="nova-guild-card" data-treasury-deposit><h3>Treasury</h3><p class="big">${esc(app.treasury?.treasury || 0)}</p><label>Deposit<input name="amount" type="number" min="1" /></label><button>Deposit</button></form><div class="nova-guild-card"><h3>Transactions</h3>${logs.map(l => `<div class="log"><b>${esc(l.reason)}</b> ${esc(l.amount)} → ${esc(l.balance_after)} <small>${esc(l.created_at)}</small></div>`).join('')}</div></div>`;
  }
  function renderWars(){
    const wars = app.wars?.wars || [];
    return `<div class="nova-guild-grid two"><form class="nova-guild-card" data-war-declare><h3>Declare War</h3><label>Type<select name="target_type"><option value="guild">Guild</option><option value="planet">Planet</option></select></label><label>Target Guild ID<input name="target_guild_id" type="number" /></label><label>Target Planet ID<input name="target_planet_id" type="number" /></label><label>Reason<textarea name="reason"></textarea></label><button>Declare</button></form><div class="nova-guild-card"><h3>Wars</h3>${wars.map(w => `<div class="war"><b>${esc(w.target_type)} war #${esc(w.id)}</b><span>${esc(w.status)} · Cost ${esc(w.declaration_cost)}</span><small>${esc(w.starts_at)} → ${esc(w.ends_at)}</small></div>`).join('') || '<p class="muted">No wars.</p>'}</div></div>`;
  }
  function renderApps(){
    return `<div class="nova-guild-card"><h3>Applications / Invites</h3><form data-guild-invite><label>Recipient Player ID<input name="recipient_id" type="number" /></label><label>Recipient Name<input name="recipient_name" /></label><button>Send Invite</button></form>${renderInvites()}</div>`;
  }
  function renderSettings(){
    return `<div class="nova-guild-card"><h3>Settings</h3><p class="muted">Rank permissions are server-side and data-driven. This first pass exposes rank assignment; full custom-rank editing is table-ready.</p>${renderRoster()}</div>`;
  }
  function renderLogs(){
    const logs = app.logs?.logs || [];
    return `<div class="nova-guild-card"><h3>Guild Logs</h3>${logs.map(l => `<div class="log"><b>${esc(l.action)}</b> actor ${esc(l.actor_player_id || '')} target ${esc(l.target_player_id || '')}<small>${esc(l.created_at)}</small></div>`).join('') || '<p class="muted">No logs.</p>'}</div>`;
  }

  function render(){
    const root = ensureRoot();
    if (!app.open) { root.hidden = true; return; }
    root.hidden = false;
    const me = app.me;
    const g = me?.guild;
    root.innerHTML = `<div class="nova-guild-shell"><header><div><strong>Guild Command</strong><span>${g ? `[${esc(g.tag)}] ${esc(g.name)}` : 'No guild'}</span></div><button type="button" data-guild-close>×</button></header>${app.err ? `<div class="nova-guild-error">${esc(app.err)}</div>` : ''}<nav>${g ? [tabButton('overview','Overview'),tabButton('roster','Roster'),tabButton('contributions','Contributions'),tabButton('armory','Armory'),tabButton('research','Research'),tabButton('treasury','Treasury'),tabButton('wars','Wars'),tabButton('apps','Apps/Invites'),tabButton('settings','Settings'),tabButton('logs','Logs')].join('') : ''}</nav><main>${!me ? '<div class="nova-guild-card">Loading guild data...</div>' : !g ? renderNoGuild() : app.tab==='overview' ? renderOverview() : app.tab==='roster' ? renderRoster() : app.tab==='contributions' ? renderContributions() : app.tab==='armory' ? renderArmory() : app.tab==='research' ? renderResearch() : app.tab==='treasury' ? renderTreasury() : app.tab==='wars' ? renderWars() : app.tab==='apps' ? renderApps() : app.tab==='settings' ? renderSettings() : renderLogs()}</main></div>`;
    bind();
  }

  function formData(form){ return Object.fromEntries(new FormData(form).entries()); }
  function bind(){
    qs('[data-guild-close]')?.addEventListener('click', closeGuildPage);
    qsa('[data-guild-tab]').forEach(b => b.addEventListener('click', () => setTab(b.getAttribute('data-guild-tab'))));
    qs('[data-guild-create]')?.addEventListener('submit', async e => { e.preventDefault(); const pid = await currentPlayerId(); await post('/api/guild/create', { player_id: pid, ...formData(e.currentTarget) }).catch(showError); });
    qsa('[data-apply-guild]').forEach(b => b.addEventListener('click', async () => { const pid = await currentPlayerId(); await post('/api/guild/apply', { player_id: pid, guild_id: Number(b.dataset.applyGuild) }).catch(showError); }));
    qsa('[data-invite-accept]').forEach(b => b.addEventListener('click', async () => { const pid = await currentPlayerId(); await post('/api/guild/invite/respond', { player_id: pid, invite_id: Number(b.dataset.inviteAccept), accept: true }).catch(showError); }));
    qsa('[data-invite-decline]').forEach(b => b.addEventListener('click', async () => { const pid = await currentPlayerId(); await post('/api/guild/invite/respond', { player_id: pid, invite_id: Number(b.dataset.inviteDecline), accept: false }).catch(showError); }));
    qs('[data-treasury-deposit]')?.addEventListener('submit', async e => { e.preventDefault(); const pid = await currentPlayerId(); await post('/api/guild/treasury/deposit', { player_id: pid, guild_id: app.me.guild.id, amount: Number(formData(e.currentTarget).amount || 0) }).catch(showError); });
    qs('[data-contribution-record]')?.addEventListener('submit', async e => { e.preventDefault(); const pid = await currentPlayerId(); const d = formData(e.currentTarget); await post('/api/guild/contributions/record', { player_id: pid, contribution_type: d.contribution_type, xp: Number(d.xp || 0), source: 'guild_ui_manual' }).catch(showError); });
    qsa('[data-unlock-research]').forEach(b => b.addEventListener('click', async () => { const pid = await currentPlayerId(); await post('/api/guild/research/unlock', { player_id: pid, guild_id: app.me.guild.id, research_key: b.dataset.unlockResearch }).catch(showError); }));
    qs('[data-armory-deposit]')?.addEventListener('submit', async e => { e.preventDefault(); const pid = await currentPlayerId(); const d = formData(e.currentTarget); await post('/api/guild/armory/deposit', { player_id: pid, guild_id: app.me.guild.id, ...d, quantity: Number(d.quantity || 1) }).catch(showError); });
    qsa('[data-withdraw-key]').forEach(b => b.addEventListener('click', async () => { const pid = await currentPlayerId(); await post('/api/guild/armory/withdraw', { player_id: pid, guild_id: app.me.guild.id, item_key: b.dataset.withdrawKey, item_type: b.dataset.withdrawType, quantity: 1 }).catch(showError); }));
    qs('[data-war-declare]')?.addEventListener('submit', async e => { e.preventDefault(); const pid = await currentPlayerId(); const d = formData(e.currentTarget); await post('/api/guild/war/declare', { player_id: pid, guild_id: app.me.guild.id, target_type: d.target_type, target_guild_id: d.target_guild_id ? Number(d.target_guild_id) : null, target_planet_id: d.target_planet_id ? Number(d.target_planet_id) : null, reason: d.reason || '' }).catch(showError); });
    qs('[data-guild-invite]')?.addEventListener('submit', async e => { e.preventDefault(); const pid = await currentPlayerId(); const d = formData(e.currentTarget); await post('/api/guild/invite', { player_id: pid, guild_id: app.me.guild.id, recipient_id: d.recipient_id ? Number(d.recipient_id) : null, recipient_name: d.recipient_name || null }).catch(showError); });
    qsa('[data-kick-player]').forEach(b => b.addEventListener('click', async () => { const pid = await currentPlayerId(); await post('/api/guild/kick', { player_id: pid, guild_id: app.me.guild.id, target_player_id: Number(b.dataset.kickPlayer) }).catch(showError); }));
    qsa('[data-rank-player]').forEach(s => s.addEventListener('change', async () => { const pid = await currentPlayerId(); await post('/api/guild/rank/update', { player_id: pid, guild_id: app.me.guild.id, target_player_id: Number(s.dataset.rankPlayer), rank_id: Number(s.value) }).catch(showError); }));
  }

  function routeCheck(){ if (String(location.hash || '').replace('#','').toLowerCase() === 'guild') openGuildPage(); else if (app.open) closeGuildPage(); }
  function boot(){ ensureNav(); routeCheck(); setInterval(ensureNav, 3000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('hashchange', routeCheck);
})();



// === NOVA LEADERBOARDS PAGE PATCH START ===
(function novaInstallLeaderboardsPage(){
  if (typeof window === "undefined" || window.__novaLeaderboardsInstalled) return;
  window.__novaLeaderboardsInstalled = true;
  const api = async (url, opts = {}) => {
    const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    const res = await fetch(url, { credentials: "include", ...opts, headers });
    let data = null;
    try { data = await res.json(); } catch (_) { data = {}; }
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  };
  const state = {
    open: false,
    summary: null,
    board: null,
    scope: "global",
    category: "Skills",
    metric: "player_level",
    period: "daily",
    lastVersion: null,
    loading: false,
    error: ""
  };
  function esc(v){ return String(v ?? "").replace(/[&<>"']/g, s => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[s])); }
  function fmt(v){
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return esc(v);
    if (Math.abs(n) >= 1000000) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
    if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return n.toLocaleString(undefined, { maximumFractionDigits: n % 1 ? 2 : 0 });
  }
  function root(){
    let el = document.getElementById("nova-leaderboards-root");
    if (!el) {
      el = document.createElement("div");
      el.id = "nova-leaderboards-root";
      document.body.appendChild(el);
    }
    return el;
  }
  function selectedMetrics(){
    const metrics = state.summary?.metrics || [];
    return metrics.filter(m => !state.category || m.category === state.category);
  }
  function render(){
    const el = root();
    const categories = state.summary?.categories || [];
    const metrics = selectedMetrics();
    const rows = state.board?.rows || [];
    el.innerHTML = `
      <section class="nova-lb-panel ${state.open ? "open" : ""}" aria-hidden="${state.open ? "false" : "true"}">
        <div class="nova-lb-head">
          <div>
            <strong>Leaderboards</strong>
            <span>${state.board?.generated_at ? `Updated ${esc(new Date(state.board.generated_at).toLocaleString())}` : "Daily snapshots"}</span>
          </div>
          <button class="nova-lb-close" type="button">×</button>
        </div>
        <div class="nova-lb-tabs">
          <button class="${state.scope === "global" ? "active" : ""}" data-lb-scope="global" type="button">Global</button>
          <button class="${state.scope === "faction" ? "active" : ""}" data-lb-scope="faction" type="button">Faction</button>
        </div>
        <div class="nova-lb-filters">
          <label>Category<select id="nova-lb-category">${categories.map(c => `<option value="${esc(c)}" ${c === state.category ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
          <label>Metric<select id="nova-lb-metric">${metrics.map(m => `<option value="${esc(m.metric_key)}" ${m.metric_key === state.metric ? "selected" : ""}>${esc(m.display_name)}</option>`).join("")}</select></label>
          <label>Period<select id="nova-lb-period">
            <option value="daily" ${state.period === "daily" ? "selected" : ""}>Daily</option>
            <option value="weekly" ${state.period === "weekly" ? "selected" : ""}>Weekly</option>
            <option value="monthly" ${state.period === "monthly" ? "selected" : ""}>Monthly</option>
            <option value="all_time" ${state.period === "all_time" ? "selected" : ""}>All-time</option>
          </select></label>
          ${state.summary?.is_admin ? `<button class="nova-lb-refresh" type="button">Manual Refresh</button>` : ""}
        </div>
        ${state.error ? `<div class="nova-lb-error">${esc(state.error)}</div>` : ""}
        ${state.loading ? `<div class="nova-lb-loading">Loading leaderboard…</div>` : ""}
        <div class="nova-lb-meta">
          <span>Scope: ${esc(state.scope)}</span>
          <span>Next: ${state.board?.next_refresh_at ? esc(new Date(state.board.next_refresh_at).toLocaleString()) : "scheduled"}</span>
          ${state.board?.stale ? `<b>STALE</b>` : ""}
        </div>
        <div class="nova-lb-table-wrap">
          <table class="nova-lb-table">
            <thead><tr><th>#</th><th>Player</th><th>Faction</th><th>Guild</th><th>Value</th><th>Events</th></tr></thead>
            <tbody>
              ${rows.length ? rows.map(r => `<tr class="${String(r.player_id) === String(state.board?.current_player_id) ? "me" : ""}"><td>${esc(r.rank)}</td><td>${esc(r.player_name || r.player_id)}</td><td>${esc(r.faction_id || "—")}</td><td>${esc(r.guild_id || "—")}</td><td>${fmt(r.value)}</td><td>${fmt(r.secondary_value)}</td></tr>`).join("") : `<tr><td colspan="6" class="nova-lb-empty">No snapshot data yet. Metrics appear after validated gameplay events are recorded and snapshots refresh.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `;
    el.querySelector(".nova-lb-close")?.addEventListener("click", () => { state.open = false; if (location.hash === "#leaderboards") history.replaceState(null, "", location.pathname + location.search); render(); });
    el.querySelectorAll("[data-lb-scope]").forEach(btn => btn.addEventListener("click", () => { state.scope = btn.dataset.lbScope; loadBoard(); }));
    el.querySelector("#nova-lb-category")?.addEventListener("change", e => { state.category = e.target.value; const first = (state.summary?.metrics || []).find(m => m.category === state.category); if (first) state.metric = first.metric_key; loadBoard(); });
    el.querySelector("#nova-lb-metric")?.addEventListener("change", e => { state.metric = e.target.value; loadBoard(); });
    el.querySelector("#nova-lb-period")?.addEventListener("change", e => { state.period = e.target.value; loadBoard(); });
    el.querySelector(".nova-lb-refresh")?.addEventListener("click", async () => { try { state.loading = true; render(); await api('/api/admin/leaderboards/refresh', { method: 'POST', body: JSON.stringify({ metric_key: state.metric, scope: state.scope, period: state.period }) }); await loadSummary(true); await loadBoard(); } catch(e){ state.error = e.message; state.loading = false; render(); } });
  }
  async function loadSummary(force=false){
    if (state.summary && !force) return state.summary;
    state.summary = await api('/api/leaderboards/summary');
    state.lastVersion = state.summary?.state_versions?.leaderboards ?? state.summary?.snapshot_version ?? null;
    if (!state.summary.metrics?.some(m => m.metric_key === state.metric)) {
      state.metric = state.summary.metrics?.[0]?.metric_key || "player_level";
      state.category = state.summary.metrics?.[0]?.category || "Skills";
    }
    return state.summary;
  }
  async function loadBoard(){
    state.open = true;
    state.loading = true;
    state.error = "";
    render();
    try {
      await loadSummary();
      const url = new URL('/api/leaderboards', window.location.origin);
      url.searchParams.set('metric_key', state.metric);
      url.searchParams.set('scope', state.scope);
      url.searchParams.set('period', state.period);
      if (state.scope === 'faction' && state.summary?.current_faction_id) url.searchParams.set('faction_id', state.summary.current_faction_id);
      state.board = await api(url.pathname + url.search);
    } catch(e){ state.error = e.message || String(e); }
    state.loading = false;
    render();
  }
  async function openPage(){
    state.open = true;
    if (location.hash !== '#leaderboards') history.replaceState(null, '', '#leaderboards');
    render();
    await loadSummary();
    await loadBoard();
  }
  function installNavButton(){
    document.querySelectorAll('nav button, [role="navigation"] button, .sidebar button').forEach(btn => {
      const page = String(btn.getAttribute('data-page') || '').toLowerCase();
      const text = (btn.textContent || '').trim().replace(/\s+/g, ' ').toLowerCase();
      if (page !== 'leaderboards' && text !== 'leaderboards') return;
      if (btn.dataset.novaLeaderboardsNav === '1') return;
      btn.dataset.novaLeaderboardsNav = '1';
      btn.addEventListener('click', openPage);
    });
  }
  function routeCheck(){
    if (location.hash === '#leaderboards') openPage();
    else if (state.open) {
      state.open = false;
      render();
    }
  }
  window.addEventListener('hashchange', routeCheck);
  window.addEventListener('nova:state', (ev) => {
    const version = ev?.detail?.state_versions?.leaderboards;
    if (!version || version === state.lastVersion) return;
    state.lastVersion = version;
    if (state.open) loadBoard();
  });
  const originalFetch = window.fetch;
  window.fetch = async function patchedNovaLeaderboardFetch(){
    const res = await originalFetch.apply(this, arguments);
    try {
      const req = arguments[0];
      const url = typeof req === 'string' ? req : req?.url;
      if (url && String(url).includes('/api/state')) {
        res.clone().json().then(data => window.dispatchEvent(new CustomEvent('nova:state', { detail: data }))).catch(()=>{});
      }
    } catch(_) {}
    return res;
  };
  setTimeout(() => { installNavButton(); render(); routeCheck(); }, 500);
  new MutationObserver(() => installNavButton()).observe(document.documentElement, { childList: true, subtree: true });
})();
// === NOVA LEADERBOARDS PAGE PATCH END ===


// === NOVA_GUILD_WAR_MAP_LEVELS_FRONTEND_BEGIN ===
function novaGetEntityLevel(entity) {
  if (!entity) return null;
  return entity.level ?? entity.ship_level ?? entity.player_level ?? entity.npc_level ?? entity.lvl ?? null;
}

function novaEntityIsWarHighlighted(entity, state) {
  if (!entity) return false;
  if (entity.guildWarHostile || entity.guild_war_hostile || entity.isWarTarget || entity.is_war_target) return true;
  const ids = new Set((state?.warHighlightPlayerIds || state?.war_highlight_player_ids || []).map((v) => Number(v)));
  const pid = Number(entity.playerId ?? entity.player_id ?? entity.id ?? 0);
  return !!(pid && ids.has(pid));
}

function NovaMapEntityBadge({ entity, state }) {
  const level = novaGetEntityLevel(entity);
  const war = novaEntityIsWarHighlighted(entity, state);
  return (
    <>
      {war ? (
        <div className="nova-war-badge hasHoverTooltip" tabIndex={0} data-tooltip="Guild war target. Fighting here follows war rules instead of normal crime rules.">⚔</div>
      ) : null}
      {level != null ? (
        <div className="nova-entity-level hasHoverTooltip" tabIndex={0} data-tooltip={`Level ${level}. Higher level usually means a tougher fight and better rewards.`}>Lv {level}</div>
      ) : null}
    </>
  );
}
// === NOVA_GUILD_WAR_MAP_LEVELS_FRONTEND_END ===


/* NOVA_GUILD_WAR_MAP_LEVELS_INJECTED
Manual integration note:
Render <NovaMapEntityBadge entity={entity} state={state} /> inside each visible player/NPC map marker container.
Use state.warHighlightPlayerIds or entity.guildWarHostile to trigger the swords icon.
*/
