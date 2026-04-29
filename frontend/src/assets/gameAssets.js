const u = (path) => new URL(path, import.meta.url).href;

const generatedModules = import.meta.glob('./generated/**/*.{png,svg,webp,jpg,jpeg}', {
  eager: true,
  import: 'default',
});

const generatedAssetMap = {};
for (const [path, value] of Object.entries(generatedModules)) {
  const rel = path.replace(/^\.\/generated\//, '').replace(/\.(png|svg|webp|jpg|jpeg)$/i, '').toLowerCase();
  generatedAssetMap[rel] = value;
  const base = rel.split('/').pop();
  generatedAssetMap[base] = value;
}

const catalogs = {
  avatar: [
    u('./avatars/avatar_explorer.png'),
    u('./avatars/avatar_trader.png'),
    u('./avatars/avatar_miner.png'),
    u('./avatars/avatar_salvage_ai.png'),
    u('./avatars/avatar_security.png'),
    u('./avatars/avatar_smuggler.png'),
    u('./avatars/avatar_officer.png'),
    u('./avatars/avatar_engineer.png'),
  ],
  ship: {
    combat: u('./ships/ship_gunship.png'),
    gunship: u('./ships/ship_gunship.png'),
    frigate: u('./ships/ship_patrol.png'),
    escort: u('./ships/ship_patrol.png'),
    patrol: u('./ships/ship_patrol.png'),
    security: u('./ships/ship_patrol.png'),
    interceptor: u('./ships/ship_interceptor.png'),
    scout: u('./ships/ship_runner.png'),
    stealth: u('./ships/ship_runner.png'),
    exploration: u('./ships/ship_explorer.png'),
    explorer: u('./ships/ship_explorer.png'),
    runner: u('./ships/ship_runner.png'),
    smuggling: u('./ships/ship_runner.png'),
    cargo: u('./ships/ship_freighter.png'),
    freighter: u('./ships/ship_freighter.png'),
    hauler: u('./ships/ship_freighter.png'),
    industrial: u('./ships/ship_freighter.png'),
    mining: u('./ships/ship_miner.png'),
    miner: u('./ships/ship_miner.png'),
    salvage: u('./ships/ship_salvager.png'),
    salvager: u('./ships/ship_salvager.png'),
    shuttle: u('./ships/ship_shuttle.png'),
    default: [
      u('./ships/ship_vanguard.png'),
      u('./ships/ship_freighter.png'),
      u('./ships/ship_miner.png'),
      u('./ships/ship_salvager.png'),
      u('./ships/ship_interceptor.png'),
      u('./ships/ship_patrol.png'),
      u('./ships/ship_runner.png'),
      u('./ships/ship_explorer.png'),
      u('./ships/ship_gunship.png'),
      u('./ships/ship_shuttle.png'),
    ],
  },
  station: {
    hub: u('./stations/station_hub.png'),
    gate: u('./stations/station_gate.png'),
    relay: u('./stations/station_relay.png'),
    refinery: u('./stations/station_refinery.png'),
    shipyard: u('./stations/station_shipyard.png'),
    fortress: u('./stations/station_fortress.png'),
    research: u('./stations/station_research.png'),
    ruins: u('./stations/station_ruins.png'),
    default: [
      u('./stations/station_hub.png'),
      u('./stations/station_shipyard.png'),
      u('./stations/station_refinery.png'),
      u('./stations/station_gate.png'),
      u('./stations/station_relay.png'),
      u('./stations/station_fortress.png'),
      u('./stations/station_research.png'),
      u('./stations/station_ruins.png'),
    ],
  },
  planet: {
    terran: u('./planets/planet_terran.png'),
    agriculture: u('./planets/planet_terran.png'),
    agri: u('./planets/planet_terran.png'),
    desert: u('./planets/planet_desert.png'),
    trade: u('./planets/planet_desert.png'),
    industrial: u('./planets/planet_lava.png'),
    forge: u('./planets/planet_lava.png'),
    mining: u('./planets/planet_moon.png'),
    frontier: u('./planets/planet_asteroid.png'),
    pirate: u('./planets/planet_asteroid.png'),
    research: u('./planets/planet_ice.png'),
    high_tech: u('./planets/planet_ice.png'),
    tech: u('./planets/planet_ice.png'),
    military: u('./planets/planet_lava.png'),
    balanced: u('./planets/planet_gas.png'),
    gas: u('./planets/planet_gas.png'),
    moon: u('./planets/planet_moon.png'),
    anomaly: u('./planets/planet_nebula.png'),
    nebula: u('./planets/planet_nebula.png'),
    blackhole: u('./planets/planet_singularity.png'),
    singularity: u('./planets/planet_singularity.png'),
    default: [
      u('./planets/planet_terran.png'),
      u('./planets/planet_desert.png'),
      u('./planets/planet_ice.png'),
      u('./planets/planet_lava.png'),
      u('./planets/planet_gas.png'),
      u('./planets/planet_moon.png'),
      u('./planets/planet_asteroid.png'),
      u('./planets/planet_nebula.png'),
      u('./planets/planet_star.png'),
      u('./planets/planet_singularity.png'),
    ],
  },
  galaxy: [
    u('./planets/planet_nebula.png'),
    u('./planets/planet_star.png'),
    u('./planets/planet_singularity.png'),
    u('./planets/planet_gas.png'),
    u('./planets/planet_terran.png'),
  ],
  material: {
    ore: u('./materials/ore_vein.png'),
    crystal: u('./materials/ore_blue_crystal.png'),
    relic: u('./materials/ancient_relic.png'),
    ancient: u('./materials/ancient_ruin.png'),
    beacon: u('./materials/ancient_beacon.png'),
    artifact: u('./materials/ancient_relic.png'),
    salvage: u('./materials/wreck_hull.png'),
    wreck: u('./materials/wreck_engine.png'),
    cache: u('./materials/cargo_cache.png'),
    anomaly: u('./materials/anomaly_core.png'),
    fuel: u('./materials/ore_teal_crystal.png'),
    default: [
      u('./materials/ore_blue_crystal.png'),
      u('./materials/ore_vein.png'),
      u('./materials/ore_purple_crystal.png'),
      u('./materials/ore_teal_crystal.png'),
      u('./materials/wreck_ring.png'),
      u('./materials/wreck_engine.png'),
      u('./materials/wreck_hull.png'),
      u('./materials/cargo_cache.png'),
      u('./materials/ancient_ruin.png'),
      u('./materials/ancient_relic.png'),
      u('./materials/ancient_beacon.png'),
      u('./materials/anomaly_core.png'),
    ],
  },
  module: {
    scanner: u('./modules/module_scanner.png'),
    scan: u('./modules/module_scanner.png'),
    radar: u('./modules/module_radar.png'),
    probe: u('./modules/module_probe.png'),
    drill: u('./modules/module_drill.png'),
    mining: u('./modules/module_drill.png'),
    salvage: u('./modules/module_salvage_arm.png'),
    cargo: u('./modules/module_cargo.png'),
    engine: u('./modules/module_engine.png'),
    shield: u('./modules/shield_emitter.png'),
    armor: u('./modules/armor_plating.png'),
    drone: u('./modules/module_drone.png'),
    cockpit: u('./modules/module_cockpit.png'),
    relay: u('./modules/module_dish.png'),
    default: [
      u('./modules/module_dish.png'),
      u('./modules/module_pad.png'),
      u('./modules/module_relic_bay.png'),
      u('./modules/module_probe.png'),
      u('./modules/module_scanner.png'),
      u('./modules/module_drill.png'),
      u('./modules/module_salvage_arm.png'),
      u('./modules/module_radar.png'),
      u('./modules/module_drone.png'),
      u('./modules/module_cargo.png'),
      u('./modules/module_engine.png'),
      u('./modules/shield_emitter.png'),
    ],
  },
  weapon: {
    laser: u('./modules/weapon_lance.png'),
    rail: u('./modules/weapon_lance.png'),
    cannon: u('./modules/weapon_turret.png'),
    turret: u('./modules/weapon_turret.png'),
    missile: u('./modules/weapon_turret.png'),
    mining: u('./modules/module_drill.png'),
    default: [u('./modules/weapon_lance.png'), u('./modules/weapon_turret.png'), u('./modules/module_drill.png')],
  },
  armor: {
    shield: u('./modules/shield_emitter.png'),
    plating: u('./modules/armor_plating.png'),
    armor: u('./modules/armor_plating.png'),
    default: [u('./modules/armor_plating.png'), u('./modules/shield_emitter.png')],
  },
  item: [
    u('./materials/cargo_cache.png'),
    u('./modules/module_cargo.png'),
    u('./materials/ore_blue_crystal.png'),
    u('./materials/ancient_relic.png'),
  ],
};

function hashString(value) {
  const str = String(value || 'nova-frontiers');
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function choose(list, seed) {
  const safe = Array.isArray(list) && list.length ? list : catalogs.item;
  return safe[hashString(seed) % safe.length];
}

function normalizeAssetKey(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/^data:image[^,]*,.*/i, '')
    .replace(/\?.*$/, '')
    .replace(/^.*\//, '')
    .replace(/\.(png|svg|webp|jpg|jpeg)$/i, '')
    .replace(/%[0-9a-f]{2}/gi, ' ')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function exactGeneratedAsset(assetType = 'item', hint = '', seed = '') {
  const tokens = new Set();
  const push = (value) => {
    const key = normalizeAssetKey(value);
    if (!key) return;
    tokens.add(key);
    tokens.add(key.replace(/__(improved|advanced|elite|legendary)$/i, ''));
  };
  const safeHint = String(hint || '');
  const safeSeed = String(seed || '').startsWith('data:image') ? '' : String(seed || '').slice(0, 160);
  push(safeHint);
  push(safeSeed);
  safeHint.split(/[\s,/|]+/).forEach(push);
  safeSeed.split(/[\s,/|]+/).forEach(push);
  for (const key of tokens) {
    if (generatedAssetMap[key]) return generatedAssetMap[key];
    if ((assetType === 'module' || assetType === 'weapon' || assetType === 'armor') && generatedAssetMap[`modules/${key}`]) return generatedAssetMap[`modules/${key}`];
    if (generatedAssetMap[`items/${key}`]) return generatedAssetMap[`items/${key}`];
    if (generatedAssetMap[`modules/${key}`]) return generatedAssetMap[`modules/${key}`];
  }
  return '';
}

function lookupByHint(bucket, hint) {
  if (Array.isArray(bucket)) return choose(bucket, hint);
  const needle = String(hint || '').toLowerCase();
  for (const [key, value] of Object.entries(bucket)) {
    if (key !== 'default' && needle.includes(key)) return value;
  }
  return choose(bucket.default || catalogs.item, needle);
}

function selectCatalog(assetType, hint) {
  switch (String(assetType || 'item').toLowerCase()) {
    case 'avatar': return choose(catalogs.avatar, hint);
    case 'ship': return lookupByHint(catalogs.ship, hint);
    case 'station': return lookupByHint(catalogs.station, hint);
    case 'planet': return lookupByHint(catalogs.planet, hint);
    case 'galaxy': return choose(catalogs.galaxy, hint);
    case 'material': return lookupByHint(catalogs.material, hint);
    case 'module': return lookupByHint(catalogs.module, hint);
    case 'weapon': return lookupByHint(catalogs.weapon, hint);
    case 'armor': return lookupByHint(catalogs.armor, hint);
    default: return choose(catalogs.item, hint);
  }
}

export function imageFallbackFor(assetType = 'item', category = '', seed = '') {
  const safeSeed = String(seed || '').startsWith('data:image') ? '' : String(seed || '').slice(0, 160);
  const exact = exactGeneratedAsset(assetType, category, safeSeed);
  if (exact) return exact;
  return selectCatalog(assetType, `${category || ''} ${safeSeed || ''}`.trim());
}

export function isPlaceholderAsset(src = '') {
  const value = String(src || '').trim().toLowerCase();
  if (!value) return true;
  if (value === 'null' || value === 'undefined' || value === 'none') return true;
  if (value.startsWith('data:image/svg')) return true;
  if (value.includes('placeholder')) return true;
  if (value.includes('fallback')) return true;
  if (value.includes('default')) return true;
  if (value.includes('initial')) return true;
  if (value.includes('avatar.svg')) return true;
  if (value.includes('/assets/ships/') && value.endsWith('.svg')) return true;
  if (value.includes('/assets/items/') && value.endsWith('.svg')) return true;
  if (value.includes('/assets/planets/') && value.endsWith('.svg')) return true;
  return false;
}

export function shouldUseProvidedAsset(src = '') {
  const value = String(src || '').trim();
  if (isPlaceholderAsset(value)) return false;
  if (/^https?:\/\//i.test(value)) return true;
  if (value.startsWith('/uploads/') || value.startsWith('/media/') || value.startsWith('/user-content/')) return true;
  if (value.includes('/generated/') || value.includes('/assets/generated/')) return true;
  return false;
}

export function resolveAsset(assetType = 'item', src = '', category = '', hint = '') {
  if (shouldUseProvidedAsset(src)) return String(src).trim();
  const safeSeed = String(src || '').startsWith('data:image') ? '' : String(src || '').slice(0, 160);
  const exact = exactGeneratedAsset(assetType, hint || category, safeSeed || hint);
  if (exact) return exact;
  return imageFallbackFor(assetType, `${category || ''} ${hint || ''}`.trim(), safeSeed);
}

export const assetCatalog = catalogs;
export const generatedAssetCatalog = generatedAssetMap;
