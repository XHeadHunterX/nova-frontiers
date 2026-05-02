const u = (path) => new URL(path, import.meta.url).href;

const generatedModules = import.meta.glob('./generated/**/*.{png,svg,webp,jpg,jpeg}', {
  eager: true,
  import: 'default',
});

const brandModules = import.meta.glob('./brand/*.svg', {
  eager: true,
  import: 'default',
});

const factionModules = import.meta.glob('./factions/**/*.svg', {
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

const generated = (key, fallback = '') => generatedAssetMap[key] || generatedAssetMap[key.replace(/^ships\//, '')] || fallback;
const generatedShip = (key, fallback = '') => generated(`ships/${key}`, fallback);

const generatedShipAssets = {
  frontier_endeavor: generatedShip('frontier_endeavor'),
  eclipse_hunter: generatedShip('eclipse_hunter'),
  nova_runner: generatedShip('nova_runner'),
  freightline_77: generatedShip('freightline_77'),
  pathfinder: generatedShip('pathfinder'),
  deepcore_19: generatedShip('deepcore_19'),
  reclaimer: generatedShip('reclaimer'),
  vanguard: generatedShip('vanguard'),
  ironwall: generatedShip('ironwall'),
  titans_bane: generatedShip('titans_bane'),
  helios_solar_lancer: generatedShip('helios_solar_lancer'),
  helios_aureate_bastion: generatedShip('helios_aureate_bastion'),
  helios_crown_dreadnought: generatedShip('helios_crown_dreadnought'),
  varn_foundry_sloop: generatedShip('varn_foundry_sloop'),
  varn_convoy_bulwark: generatedShip('varn_convoy_bulwark'),
  varn_orebreaker_colossus: generatedShip('varn_orebreaker_colossus'),
  nyx_razor_kite: generatedShip('nyx_razor_kite'),
  nyx_blackwake_corvette: generatedShip('nyx_blackwake_corvette'),
  neutral_horizon_skiff: generatedShip('neutral_horizon_skiff'),
  neutral_arcology_cruiser: generatedShip('neutral_arcology_cruiser'),
};

const generatedShipAliases = {
  starter: 'frontier_endeavor',
  frontier_endeavor: 'frontier_endeavor',
  eclipse_hunter: 'eclipse_hunter',
  nova_runner: 'nova_runner',
  freightline_77: 'freightline_77',
  freightline: 'freightline_77',
  pathfinder: 'pathfinder',
  deepcore_19: 'deepcore_19',
  deepcore: 'deepcore_19',
  reclaimer: 'reclaimer',
  vanguard: 'vanguard',
  ironwall: 'ironwall',
  ironwall_mk_ii: 'ironwall',
  titan_s_bane: 'titans_bane',
  titans_bane: 'titans_bane',
  titan_bane: 'titans_bane',
  helios_solar_lancer: 'helios_solar_lancer',
  solar_lancer: 'helios_solar_lancer',
  helios_aureate_bastion: 'helios_aureate_bastion',
  aureate_bastion: 'helios_aureate_bastion',
  helios_crown_dreadnought: 'helios_crown_dreadnought',
  crown_dreadnought: 'helios_crown_dreadnought',
  varn_foundry_sloop: 'varn_foundry_sloop',
  foundry_sloop: 'varn_foundry_sloop',
  varn_convoy_bulwark: 'varn_convoy_bulwark',
  convoy_bulwark: 'varn_convoy_bulwark',
  varn_orebreaker_colossus: 'varn_orebreaker_colossus',
  orebreaker_colossus: 'varn_orebreaker_colossus',
  nyx_razor_kite: 'nyx_razor_kite',
  razor_kite: 'nyx_razor_kite',
  nyx_blackwake_corvette: 'nyx_blackwake_corvette',
  blackwake_corvette: 'nyx_blackwake_corvette',
  neutral_horizon_skiff: 'neutral_horizon_skiff',
  horizon_skiff: 'neutral_horizon_skiff',
  neutral_arcology_cruiser: 'neutral_arcology_cruiser',
  arcology_cruiser: 'neutral_arcology_cruiser',
};

const generatedShipRolePools = {
  starter: ['frontier_endeavor', 'neutral_horizon_skiff'],
  scout: ['neutral_horizon_skiff', 'frontier_endeavor', 'varn_foundry_sloop'],
  fighter: ['helios_solar_lancer', 'nyx_razor_kite', 'eclipse_hunter'],
  interceptor: ['eclipse_hunter', 'nyx_razor_kite'],
  combat: ['eclipse_hunter', 'vanguard', 'helios_solar_lancer', 'nyx_blackwake_corvette'],
  gunship: ['vanguard', 'nyx_blackwake_corvette'],
  frigate: ['helios_aureate_bastion', 'varn_convoy_bulwark', 'nyx_blackwake_corvette'],
  cruiser: ['pathfinder', 'neutral_arcology_cruiser', 'helios_aureate_bastion'],
  destroyer: ['vanguard', 'ironwall'],
  siege: ['ironwall', 'helios_aureate_bastion'],
  battleship: ['ironwall', 'vanguard', 'helios_crown_dreadnought'],
  carrier: ['titans_bane', 'helios_crown_dreadnought'],
  fleet: ['titans_bane', 'helios_crown_dreadnought'],
  capital: ['titans_bane', 'helios_crown_dreadnought', 'varn_orebreaker_colossus'],
  trade: ['nova_runner', 'freightline_77', 'neutral_horizon_skiff'],
  cargo: ['freightline_77', 'nova_runner', 'varn_convoy_bulwark'],
  freighter: ['freightline_77', 'varn_orebreaker_colossus'],
  hauler: ['freightline_77', 'varn_convoy_bulwark'],
  mining: ['deepcore_19', 'varn_orebreaker_colossus'],
  miner: ['deepcore_19', 'varn_orebreaker_colossus'],
  salvage: ['reclaimer', 'nyx_blackwake_corvette'],
  salvager: ['reclaimer', 'nyx_blackwake_corvette'],
  exploration: ['pathfinder', 'frontier_endeavor', 'neutral_horizon_skiff'],
  explorer: ['pathfinder', 'frontier_endeavor'],
  civilian: ['neutral_horizon_skiff', 'neutral_arcology_cruiser'],
  neutral: ['neutral_horizon_skiff', 'pathfinder', 'neutral_arcology_cruiser'],
  helios: ['helios_solar_lancer', 'helios_aureate_bastion', 'vanguard', 'titans_bane'],
  solar: ['helios_solar_lancer', 'helios_aureate_bastion', 'vanguard', 'titans_bane'],
  accord: ['helios_solar_lancer', 'helios_aureate_bastion', 'vanguard', 'titans_bane'],
  solar_accord: ['helios_solar_lancer', 'helios_aureate_bastion', 'vanguard', 'titans_bane'],
  varn: ['varn_foundry_sloop', 'varn_convoy_bulwark', 'deepcore_19', 'varn_orebreaker_colossus'],
  iron: ['varn_foundry_sloop', 'varn_convoy_bulwark', 'deepcore_19', 'varn_orebreaker_colossus'],
  meridian: ['varn_foundry_sloop', 'varn_convoy_bulwark', 'deepcore_19', 'varn_orebreaker_colossus'],
  iron_meridian: ['varn_foundry_sloop', 'varn_convoy_bulwark', 'deepcore_19', 'varn_orebreaker_colossus'],
  nyx: ['nyx_razor_kite', 'nyx_blackwake_corvette', 'eclipse_hunter', 'reclaimer'],
  umbral: ['nyx_razor_kite', 'nyx_blackwake_corvette', 'eclipse_hunter', 'reclaimer'],
  veil: ['nyx_razor_kite', 'nyx_blackwake_corvette', 'eclipse_hunter', 'reclaimer'],
  umbral_veil: ['nyx_razor_kite', 'nyx_blackwake_corvette', 'eclipse_hunter', 'reclaimer'],
};

const factionAsset = (path) => factionModules[`./factions/${path}`] || u(`./factions/${path}`);
const brandAsset = (path) => brandModules[`./brand/${path}`] || u(`./brand/${path}`);
const pad2 = (value) => String(value).padStart(2, '0');

const factionAvatarNames = {
  solar_accord: {
    female: ['Aster Command', 'Dawn Wing', 'Civic Ace', 'Sun Marshal', 'Halo Runner', 'Aurora Envoy'],
    male: ['Atlas Watch', 'Bright Lance', 'Cobalt Captain', 'Sol Ranger', 'Beacon Guard', 'Zenith Pilot'],
  },
  iron_meridian: {
    female: ['Chrome Oracle', 'Forge Relay', 'Servo Crown', 'Vector Saint', 'Arc Warden', 'Titan Loom'],
    male: ['Anvil Prime', 'Steel Vector', 'Torque Herald', 'Bulwark Node', 'Cinder Core', 'Rail Sentinel'],
  },
  umbral_veil: {
    female: ['Nebula Whisper', 'Crescent Shade', 'Star Siren', 'Omen Drift', 'Void Seer', 'Eclipse Bloom'],
    male: ['Night Cartographer', 'Grave Star', 'Abyss Broker', 'Vesper Coil', 'Dark Meridian', 'Moonless Scout'],
  },
};

const factionAvatarMeta = {
  solar_accord: { name: 'Solar Accord', species: 'Human' },
  iron_meridian: { name: 'Iron Meridian', species: 'Synthetic' },
  umbral_veil: { name: 'Umbral Veil', species: 'Voidborne' },
};

function makeFactionAvatars(factionCode) {
  const meta = factionAvatarMeta[factionCode];
  return ['female', 'male'].flatMap((gender) =>
    factionAvatarNames[factionCode][gender].map((name, index) => {
      const num = index + 1;
      return {
        id: `${factionCode}_${gender}_${pad2(num)}`,
        label: `${name}`,
        fullLabel: `${meta.name} ${name}`,
        gender,
        factionCode,
        faction: meta.name,
        species: meta.species,
        index: num,
        url: factionAsset(`${factionCode}/${gender}-${pad2(num)}.svg`),
      };
    })
  );
}

export const factionAvatarAssets = {
  solar_accord: makeFactionAvatars('solar_accord'),
  iron_meridian: makeFactionAvatars('iron_meridian'),
  umbral_veil: makeFactionAvatars('umbral_veil'),
};

const factionAvatarCatalog = Object.values(factionAvatarAssets).flat();
const avatarAssetById = Object.fromEntries(factionAvatarCatalog.map((avatar) => [avatar.id, avatar.url]));


export const brandAssets = {
  logo: brandAsset('nova-frontiers-logo.svg'),
  emblem: brandAsset('nova-frontiers-emblem.svg'),
  favicon: brandAsset('favicon.svg'),
};

export const factionAssets = {
  solar_accord: {
    key: 'solar_accord',
    name: 'Solar Accord',
    species: 'Human',
    color: '#ffb84d',
    accent: '#2563eb',
    emblem: factionAsset('solar_accord/emblem.svg'),
    avatarOptions: factionAvatarAssets.solar_accord,
    avatars: factionAvatarAssets.solar_accord.map((avatar) => avatar.url),
    ships: {
      fighter: generatedShipAssets.helios_solar_lancer || u('./ships/helios/fighter.svg'),
      frigate: generatedShipAssets.helios_aureate_bastion || u('./ships/helios/frigate.svg'),
      cruiser: generatedShipAssets.vanguard || u('./ships/helios/cruiser.svg'),
      battleship: generatedShipAssets.titans_bane || u('./ships/helios/battleship.svg'),
    },
  },
  iron_meridian: {
    key: 'iron_meridian',
    name: 'Iron Meridian',
    species: 'Synthetic',
    color: '#c9d2d8',
    accent: '#ff8f2e',
    emblem: factionAsset('iron_meridian/emblem.svg'),
    avatarOptions: factionAvatarAssets.iron_meridian,
    avatars: factionAvatarAssets.iron_meridian.map((avatar) => avatar.url),
    ships: {
      fighter: generatedShipAssets.varn_foundry_sloop || u('./ships/varn/fighter.svg'),
      frigate: generatedShipAssets.varn_convoy_bulwark || u('./ships/varn/frigate.svg'),
      cruiser: generatedShipAssets.deepcore_19 || u('./ships/varn/cruiser.svg'),
      battleship: generatedShipAssets.varn_orebreaker_colossus || u('./ships/varn/battleship.svg'),
    },
  },
  umbral_veil: {
    key: 'umbral_veil',
    name: 'Umbral Veil',
    species: 'Voidborne',
    color: '#b174ff',
    accent: '#42f0ff',
    emblem: factionAsset('umbral_veil/emblem.svg'),
    avatarOptions: factionAvatarAssets.umbral_veil,
    avatars: factionAvatarAssets.umbral_veil.map((avatar) => avatar.url),
    ships: {
      fighter: generatedShipAssets.nyx_razor_kite || u('./ships/nyx/fighter.svg'),
      frigate: generatedShipAssets.nyx_blackwake_corvette || u('./ships/nyx/frigate.svg'),
      cruiser: generatedShipAssets.reclaimer || u('./ships/nyx/cruiser.svg'),
      battleship: generatedShipAssets.eclipse_hunter || u('./ships/nyx/battleship.svg'),
    },
  },
};

const shipClassAssets = {
  scout: generatedShipAssets.neutral_horizon_skiff || u('./ships/neutral/scout.svg'),
  fighter: generatedShipAssets.helios_solar_lancer || u('./ships/neutral/fighter.svg'),
  interceptor: generatedShipAssets.eclipse_hunter || u('./ships/neutral/interceptor.svg'),
  frigate: generatedShipAssets.helios_aureate_bastion || u('./ships/neutral/frigate.svg'),
  destroyer: generatedShipAssets.vanguard || u('./ships/neutral/destroyer.svg'),
  cruiser: generatedShipAssets.pathfinder || u('./ships/neutral/cruiser.svg'),
  battleship: generatedShipAssets.ironwall || u('./ships/neutral/battleship.svg'),
  capital: generatedShipAssets.titans_bane || generatedShipAssets.helios_crown_dreadnought || u('./ships/neutral/battleship.svg'),
  carrier: generatedShipAssets.titans_bane || u('./ships/neutral/carrier.svg'),
  freighter: generatedShipAssets.freightline_77 || u('./ships/neutral/freighter.svg'),
  mining: generatedShipAssets.deepcore_19 || u('./ships/neutral/mining.svg'),
  miner: generatedShipAssets.deepcore_19 || u('./ships/neutral/mining.svg'),
  salvage: generatedShipAssets.reclaimer || u('./ships/neutral/salvage.svg'),
  salvager: generatedShipAssets.reclaimer || u('./ships/neutral/salvage.svg'),
  civilian: generatedShipAssets.neutral_horizon_skiff || u('./ships/neutral/civilian.svg'),
  pirate: generatedShipAssets.nyx_razor_kite || u('./ships/pirate/pirate-ship.svg'),
  alien: u('./ships/alien/alien-ship.svg'),
};

const catalogs = {
  avatar: [
    ...factionAvatarCatalog.map((avatar) => avatar.url),
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
    ...shipClassAssets,
    helios: factionAssets.solar_accord.ships.fighter,
    dominion: factionAssets.solar_accord.ships.fighter,
    accord: factionAssets.solar_accord.ships.fighter,
    solar: factionAssets.solar_accord.ships.fighter,
    iron: factionAssets.iron_meridian.ships.fighter,
    meridian: factionAssets.iron_meridian.ships.fighter,
    varn: factionAssets.iron_meridian.ships.fighter,
    collective: factionAssets.iron_meridian.ships.fighter,
    industrial: shipClassAssets.freighter,
    umbral: factionAssets.umbral_veil.ships.fighter,
    veil: factionAssets.umbral_veil.ships.fighter,
    nyx: factionAssets.umbral_veil.ships.fighter,
    syndicate: factionAssets.umbral_veil.ships.fighter,
    stealth: factionAssets.umbral_veil.ships.fighter,
    neutral: shipClassAssets.civilian,
    civilian: shipClassAssets.civilian,
    combat: generatedShipAssets.vanguard || shipClassAssets.fighter,
    gunship: generatedShipAssets.vanguard || shipClassAssets.fighter,
    frigate: generatedShipAssets.helios_aureate_bastion || shipClassAssets.frigate,
    escort: generatedShipAssets.varn_convoy_bulwark || shipClassAssets.frigate,
    patrol: generatedShipAssets.helios_solar_lancer || shipClassAssets.fighter,
    security: generatedShipAssets.helios_solar_lancer || shipClassAssets.fighter,
    interceptor: generatedShipAssets.eclipse_hunter || shipClassAssets.interceptor,
    scout: generatedShipAssets.neutral_horizon_skiff || shipClassAssets.scout,
    stealth: generatedShipAssets.nyx_razor_kite || factionAssets.umbral_veil.ships.fighter,
    exploration: generatedShipAssets.pathfinder || shipClassAssets.cruiser,
    explorer: generatedShipAssets.pathfinder || shipClassAssets.cruiser,
    runner: generatedShipAssets.nova_runner || shipClassAssets.scout,
    smuggling: generatedShipAssets.nyx_razor_kite || shipClassAssets.scout,
    cargo: generatedShipAssets.freightline_77 || shipClassAssets.freighter,
    freighter: generatedShipAssets.freightline_77 || shipClassAssets.freighter,
    hauler: generatedShipAssets.freightline_77 || shipClassAssets.freighter,
    industrial: generatedShipAssets.varn_foundry_sloop || factionAssets.iron_meridian.ships.fighter,
    mining: generatedShipAssets.deepcore_19 || shipClassAssets.mining,
    miner: generatedShipAssets.deepcore_19 || shipClassAssets.mining,
    salvage: generatedShipAssets.reclaimer || shipClassAssets.salvage,
    salvager: generatedShipAssets.reclaimer || shipClassAssets.salvage,
    shuttle: generatedShipAssets.neutral_horizon_skiff || shipClassAssets.civilian,
    default: [
      generatedShipAssets.frontier_endeavor,
      generatedShipAssets.eclipse_hunter,
      generatedShipAssets.nova_runner,
      generatedShipAssets.freightline_77,
      generatedShipAssets.pathfinder,
      generatedShipAssets.deepcore_19,
      generatedShipAssets.reclaimer,
      generatedShipAssets.vanguard,
      generatedShipAssets.ironwall,
      generatedShipAssets.titans_bane,
      generatedShipAssets.helios_solar_lancer,
      generatedShipAssets.helios_aureate_bastion,
      generatedShipAssets.helios_crown_dreadnought,
      generatedShipAssets.varn_foundry_sloop,
      generatedShipAssets.varn_convoy_bulwark,
      generatedShipAssets.varn_orebreaker_colossus,
      generatedShipAssets.nyx_razor_kite,
      generatedShipAssets.nyx_blackwake_corvette,
      generatedShipAssets.neutral_horizon_skiff,
      generatedShipAssets.neutral_arcology_cruiser,
      shipClassAssets.fighter,
      shipClassAssets.frigate,
      shipClassAssets.cruiser,
      shipClassAssets.battleship,
      shipClassAssets.freighter,
      shipClassAssets.mining,
      shipClassAssets.salvage,
      shipClassAssets.scout,
      shipClassAssets.interceptor,
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

function exactGeneratedShipAssetFor(hint = '', seed = '') {
  const text = normalizeAssetKey(`${hint || ''} ${seed || ''}`);
  if (!text) return '';
  const aliases = Object.entries(generatedShipAliases).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, key] of aliases) {
    if (text.includes(alias) && generatedShipAssets[key]) return generatedShipAssets[key];
  }
  const keys = Object.keys(generatedShipAssets).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (text.includes(key) && generatedShipAssets[key]) return generatedShipAssets[key];
  }
  return '';
}

function generatedShipAssetFor(hint = '', seed = '') {
  const exact = exactGeneratedShipAssetFor(hint, seed);
  if (exact) return exact;
  const text = normalizeAssetKey(`${hint || ''} ${seed || ''}`);
  if (!text) return '';
  for (const [role, pool] of Object.entries(generatedShipRolePools)) {
    if (!text.includes(role)) continue;
    const key = choose(pool, text);
    if (generatedShipAssets[key]) return generatedShipAssets[key];
  }
  return '';
}

function exactAvatarAsset(src = '', hint = '') {
  const raw = `${src || ''} ${hint || ''}`.trim();
  if (!raw) return '';
  const direct = avatarAssetById[normalizeAssetKey(raw)];
  if (direct) return direct;
  const text = raw.toLowerCase().replace(/[^a-z0-9_]+/g, '_');
  for (const avatar of factionAvatarCatalog) {
    const num = pad2(avatar.index);
    if (text.includes(avatar.id)) return avatar.url;
    if (text.includes(avatar.factionCode) && text.includes(`${avatar.gender}_${num}`)) return avatar.url;
    if (text.includes(avatar.factionCode) && text.includes(`${avatar.gender}_${avatar.index}`)) return avatar.url;
  }
  return '';
}


function factionKeyFromText(value = '') {
  const text = String(value || '').toLowerCase();
  if (text.includes('solar accord') || text.includes('solar_accord') || text.includes('helios') || text.includes('dominion') || text.includes('solar')) return 'solar_accord';
  if (text.includes('iron meridian') || text.includes('iron_meridian') || text.includes('meridian') || text.includes('varn') || text.includes('collective') || text.includes('industrial') || text.includes('miner')) return 'iron_meridian';
  if (text.includes('umbral veil') || text.includes('umbral_veil') || text.includes('umbral') || text.includes('veil') || text.includes('nyx') || text.includes('syndicate') || text.includes('smuggler') || text.includes('stealth')) return 'umbral_veil';
  return '';
}

function shipClassFromText(value = '') {
  const text = String(value || '').toLowerCase();
  const checks = [
    ['alien', ['alien', 'xeno', 'bio']],
    ['pirate', ['pirate', 'corsair', 'raider']],
    ['capital', ['capital', 'dreadnought']],
    ['battleship', ['battleship']],
    ['carrier', ['carrier']],
    ['cruiser', ['cruiser']],
    ['destroyer', ['destroyer']],
    ['frigate', ['frigate', 'patrol', 'escort']],
    ['interceptor', ['interceptor', 'intercept']],
    ['fighter', ['fighter', 'combat', 'gunship', 'security']],
    ['freighter', ['freighter', 'hauler', 'cargo', 'transport', 'freight']],
    ['mining', ['mining', 'miner', 'deepcore']],
    ['salvage', ['salvage', 'salvager', 'reclaimer', 'wreck']],
    ['scout', ['scout', 'explorer', 'exploration', 'runner', 'shuttle']],
    ['civilian', ['civilian', 'trader', 'npc']],
  ];
  for (const [cls, terms] of checks) {
    if (terms.some(term => text.includes(term))) return cls;
  }
  return 'fighter';
}

function themedShipAsset(category = '', hint = '', seed = '') {
  const query = `${category || ''} ${hint || ''} ${seed || ''}`.toLowerCase();
  const exact = exactGeneratedShipAssetFor(query);
  if (exact) return exact;
  const cls = shipClassFromText(query);
  if (cls === 'pirate' || cls === 'alien') return shipClassAssets[cls];
  const factionKey = factionKeyFromText(query);
  if (factionKey && factionAssets[factionKey]?.ships?.[cls]) return factionAssets[factionKey].ships[cls];
  const pooled = generatedShipAssetFor(query);
  if (pooled) return pooled;
  if (factionKey && factionAssets[factionKey]?.ships?.fighter) return factionAssets[factionKey].ships.fighter;
  return shipClassAssets[cls] || shipClassAssets.fighter;
}


function exactGeneratedAsset(assetType = 'item', hint = '', seed = '') {
  if (String(assetType || '').toLowerCase() === 'ship') {
    const ship = exactGeneratedShipAssetFor(hint, seed);
    if (ship) return ship;
  }
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
    case 'avatar': return exactAvatarAsset(hint, hint) || choose(catalogs.avatar, hint);
    case 'ship': return exactGeneratedShipAssetFor(hint, hint) || themedShipAsset(hint, hint, hint) || lookupByHint(catalogs.ship, hint);
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
  if (String(assetType || '').toLowerCase() === 'avatar') return exactAvatarAsset(safeSeed, category) || selectCatalog(assetType, `${category || ''} ${safeSeed || ''}`.trim());
  const exact = exactGeneratedAsset(assetType, category, safeSeed);
  if (exact) return exact;
  if (String(assetType || '').toLowerCase() === 'ship') return themedShipAsset(category, safeSeed, seed);
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
  if (String(assetType || '').toLowerCase() === 'avatar') {
    const exactAvatar = exactAvatarAsset(src, `${category || ''} ${hint || ''}`.trim());
    if (exactAvatar) return exactAvatar;
  }
  if (shouldUseProvidedAsset(src)) return String(src).trim();
  const safeSeed = String(src || '').startsWith('data:image') ? '' : String(src || '').slice(0, 160);
  if (String(assetType || '').toLowerCase() === 'ship') return exactGeneratedShipAssetFor(`${category || ''} ${hint || ''}`.trim(), safeSeed) || themedShipAsset(category, hint, safeSeed);
  const exact = exactGeneratedAsset(assetType, hint || category, safeSeed || hint);
  if (exact) return exact;
  return imageFallbackFor(assetType, `${category || ''} ${hint || ''}`.trim(), safeSeed);
}

export const shipAssetCatalog = shipClassAssets;
export const assetCatalog = catalogs;
export const generatedAssetCatalog = generatedAssetMap;
