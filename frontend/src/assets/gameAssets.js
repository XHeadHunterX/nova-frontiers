const u = (path) => new URL(path, import.meta.url).href;

const generatedModules = import.meta.glob('./generated/**/*.{png,svg,webp,jpg,jpeg}', {
  eager: true,
  import: 'default',
});

const brandModules = import.meta.glob('./brand/*.svg', {
  eager: true,
  import: 'default',
});

const factionModules = import.meta.glob(['./factions/**/emblem.svg', './factions/**/avatar-*.png'], {
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

const generatedAssetsByPrefix = (prefix) => Object.keys(generatedAssetMap)
  .filter((key) => key.startsWith(prefix))
  .sort()
  .map((key) => generatedAssetMap[key])
  .filter(Boolean);

const generatedPlanetSet = (kind) => generatedAssetsByPrefix(`celestial/planets/${kind}_`);
const generatedCelestialPlanets = generatedAssetsByPrefix('celestial/planets/');
const generatedHabitableWaterPlanets = generatedPlanetSet('habitable_water');
const generatedGalaxyAssets = generatedAssetsByPrefix('celestial/galaxies/');
const generatedSunAssets = generatedAssetsByPrefix('celestial/suns/');
const generatedCelestialBodies = [...generatedGalaxyAssets, ...generatedSunAssets];
export const celestialSunAssets = generatedSunAssets;

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
  alien_spore_skiff: generatedShip('alien_spore_skiff'),
  alien_chitin_interceptor: generatedShip('alien_chitin_interceptor'),
  alien_void_manta: generatedShip('alien_void_manta'),
  alien_neural_frigate: generatedShip('alien_neural_frigate'),
  alien_hive_carrier: generatedShip('alien_hive_carrier'),
  alien_gravemind_dreadnought: generatedShip('alien_gravemind_dreadnought'),
  alien_singularity_leviathan: generatedShip('alien_singularity_leviathan'),
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
  alien: 'alien_void_manta',
  xeno: 'alien_void_manta',
  alien_bio_ship: 'alien_void_manta',
  bio_ship: 'alien_void_manta',
  xeno_spore_skiff: 'alien_spore_skiff',
  spore_skiff: 'alien_spore_skiff',
  xeno_chitin_interceptor: 'alien_chitin_interceptor',
  chitin_interceptor: 'alien_chitin_interceptor',
  xeno_void_manta: 'alien_void_manta',
  void_manta: 'alien_void_manta',
  xeno_neural_frigate: 'alien_neural_frigate',
  neural_frigate: 'alien_neural_frigate',
  xeno_hive_carrier: 'alien_hive_carrier',
  hive_carrier: 'alien_hive_carrier',
  xeno_gravemind_dreadnought: 'alien_gravemind_dreadnought',
  gravemind_dreadnought: 'alien_gravemind_dreadnought',
  xeno_singularity_leviathan: 'alien_singularity_leviathan',
  singularity_leviathan: 'alien_singularity_leviathan',
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
  alien: ['alien_spore_skiff', 'alien_chitin_interceptor', 'alien_void_manta', 'alien_neural_frigate', 'alien_hive_carrier', 'alien_gravemind_dreadnought', 'alien_singularity_leviathan'],
  xeno: ['alien_chitin_interceptor', 'alien_void_manta', 'alien_neural_frigate', 'alien_hive_carrier', 'alien_gravemind_dreadnought'],
  bio: ['alien_spore_skiff', 'alien_void_manta', 'alien_hive_carrier'],
  bio_ship: ['alien_void_manta', 'alien_neural_frigate', 'alien_hive_carrier'],
  alien_invader: ['alien_chitin_interceptor', 'alien_void_manta', 'alien_neural_frigate'],
};

const factionAsset = (path) => factionModules[`./factions/${path}`] || u(`./factions/${path}`);
const brandAsset = (path) => brandModules[`./brand/${path}`] || u(`./brand/${path}`);
const pad2 = (value) => String(value).padStart(2, '0');

const factionAvatarNames = {
  solar_accord: ['Solar Pilot 01', 'Solar Pilot 02', 'Solar Pilot 03', 'Solar Pilot 04', 'Solar Pilot 05', 'Solar Pilot 06', 'Solar Pilot 07', 'Solar Pilot 08', 'Solar Pilot 09', 'Solar Pilot 10', 'Solar Pilot 11', 'Solar Pilot 12'],
  iron_meridian: ['Meridian Unit 01', 'Meridian Unit 02', 'Meridian Unit 03', 'Meridian Unit 04', 'Meridian Unit 05', 'Meridian Unit 06', 'Meridian Unit 07', 'Meridian Unit 08', 'Meridian Unit 09', 'Meridian Unit 10', 'Meridian Unit 11', 'Meridian Unit 12'],
  umbral_veil: ['Veil Envoy 01', 'Veil Envoy 02', 'Veil Envoy 03', 'Veil Envoy 04', 'Veil Envoy 05', 'Veil Envoy 06', 'Veil Envoy 07', 'Veil Envoy 08', 'Veil Envoy 09', 'Veil Envoy 10', 'Veil Envoy 11', 'Veil Envoy 12'],
};

const factionAvatarMeta = {
  solar_accord: { name: 'Solar Accord', species: 'Human' },
  iron_meridian: { name: 'Iron Meridian', species: 'Synthetic' },
  umbral_veil: { name: 'Umbral Veil', species: 'Voidborne' },
};

function makeFactionAvatars(factionCode) {
  const meta = factionAvatarMeta[factionCode];
  return factionAvatarNames[factionCode].map((name, index) => {
    const num = index + 1;
    return {
      id: `${factionCode}_avatar_${pad2(num)}`,
      legacyIds: [
        `${factionCode}_${num <= 6 ? 'female' : 'male'}_${pad2(num <= 6 ? num : num - 6)}`,
      ],
      label: `${name}`,
      fullLabel: `${meta.name} ${name}`,
      gender: 'portrait',
      factionCode,
      faction: meta.name,
      species: meta.species,
      index: num,
      url: factionAsset(`${factionCode}/avatar-${pad2(num)}.png`),
    };
  });
}

export const factionAvatarAssets = {
  solar_accord: makeFactionAvatars('solar_accord'),
  iron_meridian: makeFactionAvatars('iron_meridian'),
  umbral_veil: makeFactionAvatars('umbral_veil'),
};

const factionAvatarCatalog = Object.values(factionAvatarAssets).flat();
const avatarAssetById = Object.fromEntries(
  factionAvatarCatalog.flatMap((avatar) => [
    [avatar.id, avatar.url],
    ...(avatar.legacyIds || []).map((id) => [id, avatar.url]),
  ])
);


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
  alien: generatedShipAssets.alien_void_manta || u('./ships/alien/alien-ship.svg'),
};

const pirateBaseAssets = {
  t1: u('./stations/pirate_base_t1.svg'),
  t2: u('./stations/pirate_base_t2.svg'),
  t3: u('./stations/pirate_base_t3.svg'),
};

function pirateBaseAssetForHint(hint = '') {
  const text = String(hint || '').toLowerCase();
  if (!text.includes('pirate') || !(text.includes('base') || text.includes('station'))) return '';
  const match = text.match(/(?:tier|t)\s*([1-9])/i);
  const tier = Math.max(1, Math.min(3, Number(match?.[1] || 2)));
  return pirateBaseAssets[`t${tier}`] || pirateBaseAssets.t2;
}

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
    alien: generatedShipAssets.alien_void_manta || shipClassAssets.alien,
    xeno: generatedShipAssets.alien_chitin_interceptor || shipClassAssets.alien,
    bio_ship: generatedShipAssets.alien_void_manta || shipClassAssets.alien,
    alien_invader: generatedShipAssets.alien_void_manta || shipClassAssets.alien,
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
      generatedShipAssets.alien_spore_skiff,
      generatedShipAssets.alien_chitin_interceptor,
      generatedShipAssets.alien_void_manta,
      generatedShipAssets.alien_neural_frigate,
      generatedShipAssets.alien_hive_carrier,
      generatedShipAssets.alien_gravemind_dreadnought,
      generatedShipAssets.alien_singularity_leviathan,
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
    pirate_base_t1: pirateBaseAssets.t1,
    pirate_base_t2: pirateBaseAssets.t2,
    pirate_base_t3: pirateBaseAssets.t3,
    pirate_station_t1: pirateBaseAssets.t1,
    pirate_station_t2: pirateBaseAssets.t2,
    pirate_station_t3: pirateBaseAssets.t3,
    pirate: pirateBaseAssets.t2,
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
    uninhabitable: [
      ...generatedPlanetSet('barren'),
      ...generatedPlanetSet('toxic'),
      ...generatedPlanetSet('ice'),
      ...generatedPlanetSet('lava'),
      ...generatedPlanetSet('gas'),
      ...generatedPlanetSet('moon'),
      ...generatedPlanetSet('storm'),
      ...generatedPlanetSet('crystal'),
      ...generatedPlanetSet('desert'),
    ],
    nonhabitable: [
      ...generatedPlanetSet('barren'),
      ...generatedPlanetSet('toxic'),
      ...generatedPlanetSet('ice'),
      ...generatedPlanetSet('lava'),
      ...generatedPlanetSet('gas'),
      ...generatedPlanetSet('moon'),
      ...generatedPlanetSet('storm'),
      ...generatedPlanetSet('crystal'),
      ...generatedPlanetSet('desert'),
    ],
    habitable: generatedHabitableWaterPlanets,
    water: generatedHabitableWaterPlanets,
    ocean: generatedHabitableWaterPlanets,
    terran: generatedHabitableWaterPlanets,
    agriculture: generatedHabitableWaterPlanets,
    agri: generatedHabitableWaterPlanets,
    desert: generatedPlanetSet('desert'),
    trade: generatedPlanetSet('desert'),
    industrial: generatedPlanetSet('lava'),
    forge: generatedPlanetSet('lava'),
    mining: generatedPlanetSet('moon'),
    frontier: generatedPlanetSet('barren'),
    pirate: generatedPlanetSet('barren'),
    research: generatedPlanetSet('ice'),
    high_tech: generatedPlanetSet('crystal'),
    tech: generatedPlanetSet('crystal'),
    military: generatedPlanetSet('lava'),
    balanced: generatedPlanetSet('gas'),
    gas: generatedPlanetSet('gas'),
    moon: generatedPlanetSet('moon'),
    toxic: generatedPlanetSet('toxic'),
    barren: generatedPlanetSet('barren'),
    storm: generatedPlanetSet('storm'),
    crystal: generatedPlanetSet('crystal'),
    anomaly: generatedGalaxyAssets,
    nebula: generatedGalaxyAssets,
    star: generatedSunAssets,
    sun: generatedSunAssets,
    blackhole: generatedGalaxyAssets,
    singularity: generatedGalaxyAssets,
    default: generatedCelestialPlanets.length ? generatedCelestialPlanets : [
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
  galaxy: {
    sun: generatedSunAssets,
    star: generatedSunAssets,
    solar: generatedSunAssets,
    galaxy: generatedGalaxyAssets,
    nebula: generatedGalaxyAssets,
    anomaly: generatedGalaxyAssets,
    default: generatedCelestialBodies.length ? generatedCelestialBodies : [
      u('./planets/planet_nebula.png'),
      u('./planets/planet_star.png'),
      u('./planets/planet_singularity.png'),
      u('./planets/planet_gas.png'),
      u('./planets/planet_terran.png'),
    ],
  },
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
    alien: generatedAssetMap['modules/alien_utility_brood_relay'] || generatedAssetMap.alien_utility_brood_relay || u('./modules/module_relic_bay.png'),
    xeno: generatedAssetMap['modules/alien_weapon_spore_lance'] || generatedAssetMap.alien_weapon_spore_lance || u('./modules/module_relic_bay.png'),
    bio: generatedAssetMap['modules/alien_repair_regrowth_vat'] || generatedAssetMap.alien_repair_regrowth_vat || u('./modules/module_relic_bay.png'),
    default: [
      generatedAssetMap['modules/alien_weapon_spore_lance'],
      generatedAssetMap['modules/alien_shield_membrane_veil'],
      generatedAssetMap['modules/alien_engine_cilia_drive'],
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
    alien: generatedAssetMap['modules/alien_weapon_spore_lance'] || generatedAssetMap.alien_weapon_spore_lance || u('./modules/weapon_lance.png'),
    xeno: generatedAssetMap['modules/alien_weapon_void_thorn'] || generatedAssetMap.alien_weapon_void_thorn || u('./modules/weapon_lance.png'),
    default: [generatedAssetMap['modules/alien_weapon_spore_lance'], u('./modules/weapon_lance.png'), u('./modules/weapon_turret.png'), u('./modules/module_drill.png')],
  },
  armor: {
    shield: u('./modules/shield_emitter.png'),
    plating: u('./modules/armor_plating.png'),
    armor: u('./modules/armor_plating.png'),
    default: [u('./modules/armor_plating.png'), u('./modules/shield_emitter.png')],
  },
  item: [
    generatedAssetMap['items/ai_cores'] || generatedAssetMap.ai_cores,
    generatedAssetMap['items/fuel_cell'] || generatedAssetMap.fuel_cell,
    generatedAssetMap['items/field_rations'] || generatedAssetMap.field_rations,
    generatedAssetMap['items/meds'] || generatedAssetMap.meds,
    generatedAssetMap['items/luxury'] || generatedAssetMap.luxury,
    generatedAssetMap['items/microchips'] || generatedAssetMap.microchips,
    generatedAssetMap['items/refined_alloy'] || generatedAssetMap.refined_alloy,
    generatedAssetMap['items/void_crystal'] || generatedAssetMap.void_crystal,
    u('./materials/cargo_cache.png'),
    u('./modules/module_cargo.png'),
    u('./materials/ore_blue_crystal.png'),
    u('./materials/ancient_relic.png'),
  ].filter(Boolean),
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

const mapSpawnTypeAliases = {
  ore: {
    titanium: ['titanium'],
    nickel_iron: ['nickel_iron', 'nickel', 'iron_rock'],
    helium_3: ['helium_3', 'helium3', 'he3'],
    iridium: ['iridium'],
    quantum_silicate: ['quantum_silicate', 'silicate'],
    void_crystal: ['void_crystal', 'void_crystals'],
    pocket_ore: ['pocket_ore', 'pocket_rich'],
    cobalt_lattice: ['cobalt_lattice', 'cobalt'],
    osmium_black: ['osmium_black', 'osmium'],
    vanadium_glass: ['vanadium_glass', 'vanadium'],
    neodymium_bloom: ['neodymium_bloom', 'neodymium'],
    plasma_ice: ['plasma_ice'],
    stellar_gold: ['stellar_gold'],
    dark_matter_ore: ['dark_matter_ore', 'dark_matter'],
    bio_lattice: ['bio_lattice'],
    zero_point_ore: ['zero_point_ore', 'zero_point'],
  },
  anomaly: {
    ancient_ruin: ['ancient_ruin', 'ruin', 'ancient'],
    signal_echo: ['signal_echo', 'unknown_signal', 'signal'],
    relic_vault: ['relic_vault', 'relic', 'vault'],
    derelict_archive: ['derelict_archive', 'archive'],
    gravity_anomaly: ['gravity_anomaly', 'gravitational_anomaly', 'gravity'],
    precursor_beacon: ['precursor_beacon', 'precursor', 'beacon'],
    pocket_artifact: ['pocket_artifact', 'artifact_cache'],
    wormhole: ['wormhole'],
    temporal_rift: ['temporal_rift', 'rift'],
    alien_signal: ['alien_signal', 'xeno_signal'],
    plasma_storm: ['plasma_storm'],
    data_cache: ['data_cache'],
    quarantine_zone: ['quarantine_zone'],
    psionic_mirror: ['psionic_mirror'],
  },
  salvage: {
    wreck: ['wreck', 'salvage'],
    derelict_engine: ['derelict_engine', 'engine'],
    cargo_pod: ['cargo_pod'],
    battle_debris: ['battle_debris', 'debris'],
  },
  cache: {
    cargo_cache: ['cargo_cache', 'cache'],
    smuggler_cache: ['smuggler_cache'],
    medical_cache: ['medical_cache'],
    fuel_cache: ['fuel_cache'],
  },
  hazard: {
    radiation_cloud: ['radiation_cloud', 'radiation'],
    minefield: ['minefield'],
    ion_squall: ['ion_squall'],
    void_wake: ['void_wake'],
  },
};

const mapSpawnDefaults = {
  ore: 'titanium',
  anomaly: 'signal_echo',
  salvage: 'wreck',
  cache: 'cargo_cache',
  hazard: 'ion_squall',
};

function spawnTierFromText(text, fallback = 1) {
  const match = String(text || '').match(/(?:^|_)t(?:ier)?_?([1-6])(?=_|$)/);
  if (match) return Number(match[1]);
  const reward = String(text || '').match(/reward_tier_([1-6])(?=_|$)/);
  if (reward) return Number(reward[1]);
  return Math.max(1, Math.min(6, Number(fallback) || 1));
}

function mapSpawnFamiliesForText(text) {
  const families = [];
  const containsType = (family) => Object.values(mapSpawnTypeAliases[family] || {}).flat().some(alias => text.includes(alias));
  if (text.includes('ore') || text.includes('mining') || text.includes('mine') || containsType('ore')) families.push('ore');
  if (text.includes('anomaly') || text.includes('anomal') || text.includes('exploration') || text.includes('ancient') || text.includes('signal') || text.includes('relic') || text.includes('artifact') || containsType('anomaly')) families.push('anomaly');
  if (text.includes('salvage') || text.includes('wreck') || text.includes('derelict') || containsType('salvage')) families.push('salvage');
  if (text.includes('cache') || containsType('cache')) families.push('cache');
  if (text.includes('hazard') || text.includes('storm') || text.includes('radiation') || containsType('hazard')) families.push('hazard');
  return [...new Set(families)];
}

function mapSpawnAssetFor(assetType = 'material', hint = '', seed = '') {
  const type = String(assetType || '').toLowerCase();
  if (!['material', 'item'].includes(type)) return '';
  const text = normalizeAssetKey(`${hint || ''} ${seed || ''}`);
  if (!text) return '';
  const families = mapSpawnFamiliesForText(text);
  if (!families.length) return '';
  const tier = spawnTierFromText(text, text.includes('pocket') ? 6 : 1);
  for (const family of families) {
    const types = mapSpawnTypeAliases[family] || {};
    const matched = Object.entries(types).find(([, aliases]) => aliases.some(alias => text.includes(alias)));
    const key = matched?.[0] || mapSpawnDefaults[family];
    const asset = generatedAssetMap[`map_spawns/${family}/${key}_t${tier}`]
      || generatedAssetMap[`${key}_t${tier}`]
      || generatedAssetMap[`map_spawns/${family}/${mapSpawnDefaults[family]}_t${tier}`];
    if (asset) return asset;
  }
  return '';
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
    if ((avatar.legacyIds || []).some((id) => text.includes(id))) return avatar.url;
    if (text.includes(avatar.factionCode) && text.includes(`avatar_${num}`)) return avatar.url;
    if (text.includes(avatar.factionCode) && text.includes(`avatar_${avatar.index}`)) return avatar.url;
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



const generatedItemAssetAliases = {
  ai_core: 'ai_cores',
  alien_relic: 'alien_relics',
  alien_artifact: 'alien_relics',
  ammunition: 'ammo',
  ammo_pack: 'ammo',
  bio_gel_pack: 'bio_gel',
  implants: 'black_implants',
  black_market_implants: 'black_implants',
  chemical_crate: 'chemicals',
  electronics: 'microchips',
  electronic_parts: 'microchips',
  microchip: 'microchips',
  id_chip: 'forged_ids',
  forged_id: 'forged_ids',
  fuel: 'fuel_cell',
  fuel_cells: 'fuel_cell',
  helium3: 'helium_3',
  helium_3_cells: 'helium3_cells',
  medical_supplies: 'meds',
  medicine: 'meds',
  rations: 'field_rations',
  spices: 'hydro_spices',
  luxury_goods: 'luxury',
  luxuries: 'luxury',
  alloys: 'refined_alloy',
  alloy: 'refined_alloy',
  restricted_weapon: 'restricted_weapons',
  weapons_cache: 'restricted_weapons',
  weapons: 'restricted_weapons',
  polymer_sheet: 'polymer',
  quantum_glass_sheet: 'quantum_glass',
  void_crystals: 'void_crystal',
  volatile_reagent: 'volatile_reagents',
};

function generatedItemAliasAsset(key = '') {
  const alias = generatedItemAssetAliases[key];
  if (!alias) return '';
  return generatedAssetMap[`items/${alias}`] || generatedAssetMap[alias] || '';
}

function exactGeneratedAsset(assetType = 'item', hint = '', seed = '') {
  if (String(assetType || '').toLowerCase() === 'ship') {
    const ship = exactGeneratedShipAssetFor(hint, seed);
    if (ship) return ship;
  }
  const safeSeed = String(seed || '').startsWith('data:image') ? '' : String(seed || '').slice(0, 160);
  const spawnAsset = mapSpawnAssetFor(assetType, hint, safeSeed);
  if (spawnAsset) return spawnAsset;
  const tokens = new Set();
  const push = (value) => {
    const key = normalizeAssetKey(value);
    if (!key) return;
    tokens.add(key);
    tokens.add(key.replace(/__(improved|advanced|elite|legendary)$/i, ''));
  };
  const safeHint = String(hint || '');
  push(safeHint);
  push(safeSeed);
  safeHint.split(/[\s,/|]+/).forEach(push);
  safeSeed.split(/[\s,/|]+/).forEach(push);
  for (const key of tokens) {
    if (generatedAssetMap[key]) return generatedAssetMap[key];
    const aliasedItem = generatedItemAliasAsset(key);
    if (aliasedItem) return aliasedItem;
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
    if (key !== 'default' && new RegExp(`(^|[^a-z0-9])${key.replace(/_/g, '[_\\s-]*')}([^a-z0-9]|$)`, 'i').test(needle)) return Array.isArray(value) ? choose(value, needle) : value;
  }
  return choose(bucket.default || catalogs.item, needle);
}

function selectCatalog(assetType, hint) {
  switch (String(assetType || 'item').toLowerCase()) {
    case 'avatar': return exactAvatarAsset(hint, hint) || choose(catalogs.avatar, hint);
    case 'ship': return exactGeneratedShipAssetFor(hint, hint) || themedShipAsset(hint, hint, hint) || lookupByHint(catalogs.ship, hint);
    case 'station': return pirateBaseAssetForHint(hint) || lookupByHint(catalogs.station, hint);
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
  const pirateBase = pirateBaseAssetForHint(`${category || ''} ${safeSeed || ''}`);
  if (pirateBase) return pirateBase;
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
  const pirateBase = pirateBaseAssetForHint(`${category || ''} ${hint || ''} ${String(src || '').startsWith('data:image') ? '' : src || ''}`);
  if (pirateBase) return pirateBase;
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
