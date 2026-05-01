import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const assetRoot = join(root, '..', 'src', 'assets', 'factions');
const pad = (value) => String(value).padStart(2, '0');

const factions = {
  solar_accord: {
    name: 'Solar Accord',
    species: 'Human',
    primary: '#ffb84d',
    secondary: '#2563eb',
    trim: '#fff3c4',
    dark: '#081426',
    skin: ['#8f563b', '#b9825a', '#d7a170', '#f0c090', '#70422f', '#c98665'],
    hair: ['#18131a', '#58321c', '#d9b46a', '#e8e8e8', '#8b1f35', '#243348'],
  },
  iron_meridian: {
    name: 'Iron Meridian',
    species: 'Synthetic',
    primary: '#c9d2d8',
    secondary: '#ff8f2e',
    trim: '#50e7ff',
    dark: '#090d11',
    metal: ['#8c98a3', '#bcc8cf', '#5f6b77', '#d7e2e8', '#6e7680', '#a7b0ba'],
    light: ['#ff8f2e', '#50e7ff', '#facc15', '#7dd3fc', '#fb7185', '#a7f3d0'],
  },
  umbral_veil: {
    name: 'Umbral Veil',
    species: 'Voidborne',
    primary: '#b174ff',
    secondary: '#42f0ff',
    trim: '#f472b6',
    dark: '#070718',
    skin: ['#79e6e1', '#92a8ff', '#b790ff', '#65d0ff', '#c084fc', '#5eead4'],
    crest: ['#20113d', '#102a43', '#35184f', '#18314b', '#26144a', '#083344'],
  },
};

const femaleNames = {
  solar_accord: ['Aster Command', 'Dawn Wing', 'Civic Ace', 'Sun Marshal', 'Halo Runner', 'Aurora Envoy'],
  iron_meridian: ['Chrome Oracle', 'Forge Relay', 'Servo Crown', 'Vector Saint', 'Arc Warden', 'Titan Loom'],
  umbral_veil: ['Nebula Whisper', 'Crescent Shade', 'Star Siren', 'Omen Drift', 'Void Seer', 'Eclipse Bloom'],
};

const maleNames = {
  solar_accord: ['Atlas Watch', 'Bright Lance', 'Cobalt Captain', 'Sol Ranger', 'Beacon Guard', 'Zenith Pilot'],
  iron_meridian: ['Anvil Prime', 'Steel Vector', 'Torque Herald', 'Bulwark Node', 'Cinder Core', 'Rail Sentinel'],
  umbral_veil: ['Night Cartographer', 'Grave Star', 'Abyss Broker', 'Vesper Coil', 'Dark Meridian', 'Moonless Scout'],
};

function defs(id, faction) {
  return `
  <defs>
    <radialGradient id="bg-${id}" cx="50%" cy="35%" r="70%">
      <stop offset="0%" stop-color="${faction.primary}" stop-opacity=".36"/>
      <stop offset="52%" stop-color="${faction.dark}" stop-opacity=".96"/>
      <stop offset="100%" stop-color="#01040a"/>
    </radialGradient>
    <linearGradient id="suit-${id}" x1="26" x2="102" y1="94" y2="126">
      <stop offset="0%" stop-color="${faction.primary}"/>
      <stop offset="55%" stop-color="${faction.secondary}"/>
      <stop offset="100%" stop-color="${faction.dark}"/>
    </linearGradient>
    <filter id="glow-${id}" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.1" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;
}

function frame(id, faction, title, role) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" fill="none">
  <title>${title}</title>
  ${defs(id, faction)}
  <rect width="128" height="128" rx="20" fill="url(#bg-${id})"/>
  <circle cx="64" cy="61" r="55" fill="none" stroke="${faction.primary}" stroke-opacity=".24" stroke-width="2"/>
  <path d="M17 25 L27 20 M101 20 L112 27 M13 102 L24 108 M104 109 L116 101" stroke="${faction.secondary}" stroke-opacity=".46" stroke-width="2"/>
  <path d="M8 72 H23 M105 72 H120" stroke="${faction.primary}" stroke-opacity=".38" stroke-width="2"/>
  <text x="64" y="121" text-anchor="middle" fill="${faction.trim}" opacity=".82" font-size="8" font-family="Arial, sans-serif" font-weight="800">${role}</text>`;
}

function solarAvatar(gender, index) {
  const f = factions.solar_accord;
  const id = `solar-${gender}-${index}`;
  const skin = f.skin[(index - 1) % f.skin.length];
  const hair = f.hair[(index + (gender === 'female' ? 1 : 3)) % f.hair.length];
  const title = `${f.name} ${gender === 'female' ? femaleNames.solar_accord[index - 1] : maleNames.solar_accord[index - 1]}`;
  const jaw = gender === 'female'
    ? 'M41 58 C42 35 51 25 65 25 C80 25 90 36 88 59 C87 82 78 94 65 94 C51 94 42 82 41 58Z'
    : 'M39 57 C40 34 50 24 65 24 C82 24 91 36 90 60 C89 82 79 96 65 96 C50 96 40 82 39 57Z';
  const hairShape = gender === 'female'
    ? [
        `M35 61 C31 38 45 17 66 18 C87 19 96 37 92 62 C86 50 78 43 65 43 C52 43 43 50 35 61Z`,
        `M36 66 C34 38 48 19 67 19 C84 19 94 34 92 57 C78 49 58 44 40 54 C39 63 38 69 36 66Z`,
        `M33 70 C34 36 51 17 70 19 C88 21 99 41 91 70 C85 52 74 42 58 43 C47 44 39 54 33 70Z`,
        `M40 50 C44 27 58 18 75 21 C89 25 95 41 88 58 C76 45 58 42 40 50Z`,
        `M38 64 C32 42 41 22 61 19 C85 15 99 37 93 62 C82 47 57 48 38 64Z`,
        `M35 61 C33 32 53 16 74 21 C89 25 95 43 88 62 C75 51 52 47 35 61Z`,
      ][index - 1]
    : [
        `M39 50 C43 30 55 21 69 21 C82 21 91 31 91 47 C76 40 57 39 39 50Z`,
        `M38 48 C47 25 71 17 90 35 C82 36 65 37 44 51Z`,
        `M41 44 C48 28 61 22 75 25 C83 27 89 34 91 46 C72 38 55 39 41 44Z`,
        `M39 48 C42 31 55 22 68 22 C81 22 91 33 91 49 C75 43 55 43 39 48Z`,
        `M42 46 C44 31 55 23 69 23 C82 23 90 32 90 45 C76 40 57 40 42 46Z`,
        `M40 47 C45 28 61 20 80 25 C87 27 92 34 93 43 C75 39 56 40 40 47Z`,
      ][index - 1];
  const beard = gender === 'male' && [2, 4, 6].includes(index)
    ? `<path d="M49 76 C57 87 73 87 82 76 C79 91 70 99 64 99 C57 99 50 91 49 76Z" fill="#2b1b16" opacity=".48"/>`
    : '';
  const accessory = index % 3 === 0
    ? `<path d="M25 65 C25 40 40 24 58 22" stroke="${f.primary}" stroke-width="3" stroke-linecap="round"/><circle cx="26" cy="66" r="4" fill="${f.secondary}"/>`
    : `<path d="M93 57 C103 62 107 75 102 88" stroke="${f.secondary}" stroke-width="3" stroke-linecap="round"/><circle cx="101" cy="90" r="4" fill="${f.primary}"/>`;
  return `${frame(id, f, title, 'HUMAN')}
  <path d="M27 126 C31 103 44 91 64 91 C84 91 98 103 102 126Z" fill="url(#suit-${id})" stroke="${f.trim}" stroke-opacity=".72" stroke-width="2"/>
  <path d="M42 95 L54 123 M86 95 L74 123" stroke="${f.dark}" stroke-opacity=".55" stroke-width="5"/>
  <path d="${jaw}" fill="${skin}" stroke="${f.trim}" stroke-opacity=".7" stroke-width="2"/>
  <path d="${hairShape}" fill="${hair}" stroke="#09080b" stroke-opacity=".65" stroke-width="2"/>
  ${beard}
  <path d="M48 63 C53 59 57 59 61 63 M70 63 C75 59 80 59 84 63" stroke="#07111d" stroke-width="3" stroke-linecap="round"/>
  <circle cx="55" cy="65" r="2.5" fill="#eafcff"/><circle cx="77" cy="65" r="2.5" fill="#eafcff"/>
  <path d="M63 68 L60 78 L67 78" stroke="#6b3e2d" stroke-opacity=".55" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M56 84 C62 88 70 88 76 84" stroke="#3b1720" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M31 80 C43 90 86 90 99 80" stroke="${f.primary}" stroke-width="4" stroke-linecap="round" opacity=".85"/>
  ${accessory}
</svg>`;
}

function ironAvatar(gender, index) {
  const f = factions.iron_meridian;
  const id = `iron-${gender}-${index}`;
  const metal = f.metal[(index - 1) % f.metal.length];
  const light = f.light[(index + 1) % f.light.length];
  const title = `${f.name} ${gender === 'female' ? femaleNames.iron_meridian[index - 1] : maleNames.iron_meridian[index - 1]}`;
  const head = gender === 'female'
    ? `M39 58 L44 31 L64 19 L84 31 L91 58 L83 89 L65 101 L46 90Z`
    : `M34 58 L42 29 L64 17 L88 29 L96 58 L88 92 L64 105 L40 92Z`;
  const crest = gender === 'female'
    ? `<path d="M54 20 L64 7 L74 20 L70 37 H58Z" fill="${light}" opacity=".92" filter="url(#glow-${id})"/>`
    : `<path d="M43 28 L64 11 L86 28 L82 36 L64 25 L47 36Z" fill="${f.dark}" stroke="${light}" stroke-width="2"/>`;
  const jaw = gender === 'female'
    ? `<path d="M49 79 L64 89 L80 79 L78 91 L64 102 L51 91Z" fill="#202a32" stroke="${light}" stroke-opacity=".45" stroke-width="2"/>`
    : `<path d="M46 80 H82 L76 96 L64 104 L52 96Z" fill="#202a32" stroke="${light}" stroke-opacity=".45" stroke-width="2"/>`;
  const antenna = index % 2
    ? `<path d="M34 41 L22 23 M94 41 L106 23" stroke="${f.primary}" stroke-width="3" stroke-linecap="round"/><circle cx="21" cy="22" r="3" fill="${light}" filter="url(#glow-${id})"/>`
    : `<path d="M29 61 L13 58 M99 61 L115 58" stroke="${f.secondary}" stroke-width="3" stroke-linecap="round"/><circle cx="116" cy="58" r="3" fill="${light}" filter="url(#glow-${id})"/>`;
  return `${frame(id, f, title, 'SYNTH')}
  <path d="M23 126 C28 100 43 88 64 88 C87 88 100 101 106 126Z" fill="url(#suit-${id})" stroke="${f.primary}" stroke-opacity=".75" stroke-width="2"/>
  <path d="M40 104 H88 M47 116 H81" stroke="${f.dark}" stroke-opacity=".72" stroke-width="5"/>
  ${antenna}
  <path d="${head}" fill="${metal}" stroke="${f.primary}" stroke-width="3"/>
  <path d="M42 55 H86 L80 70 H48Z" fill="#06090d" stroke="${light}" stroke-width="2"/>
  <path d="M49 62 H60 M69 62 H82" stroke="${light}" stroke-width="4" stroke-linecap="round" filter="url(#glow-${id})"/>
  <path d="M64 69 L58 78 H70Z" fill="${f.dark}" stroke="${f.primary}" stroke-opacity=".55"/>
  ${jaw}
  <path d="M47 37 L82 37 M39 54 L47 54 M82 54 L91 54" stroke="#f8fbff" stroke-opacity=".38" stroke-width="2"/>
  <circle cx="64" cy="45" r="${index % 3 === 0 ? 6 : 4}" fill="${light}" opacity=".92" filter="url(#glow-${id})"/>
  ${crest}
</svg>`;
}

function umbralAvatar(gender, index) {
  const f = factions.umbral_veil;
  const id = `umbral-${gender}-${index}`;
  const skin = f.skin[(index - 1) % f.skin.length];
  const crest = f.crest[(index + 2) % f.crest.length];
  const title = `${f.name} ${gender === 'female' ? femaleNames.umbral_veil[index - 1] : maleNames.umbral_veil[index - 1]}`;
  const head = gender === 'female'
    ? `M38 59 C39 34 50 20 64 18 C82 20 92 36 91 59 C90 80 78 96 64 99 C50 96 39 80 38 59Z`
    : `M36 57 C38 33 50 20 65 18 C83 20 94 35 94 59 C92 82 79 99 64 102 C49 98 37 81 36 57Z`;
  const crown = [
    `<path d="M43 39 L34 18 L55 30 L64 8 L73 30 L94 18 L85 40" fill="${crest}" stroke="${f.secondary}" stroke-width="2"/>`,
    `<path d="M40 46 C43 22 54 15 64 7 C75 15 86 22 90 46 C78 36 52 36 40 46Z" fill="${crest}" stroke="${f.secondary}" stroke-width="2"/>`,
    `<path d="M39 43 L30 28 L48 31 L51 13 L64 29 L78 13 L80 31 L99 28 L89 44" fill="${crest}" stroke="${f.secondary}" stroke-width="2"/>`,
    `<path d="M37 47 C38 24 48 14 64 9 C81 14 91 24 92 47 C78 38 52 38 37 47Z" fill="${crest}" stroke="${f.primary}" stroke-width="2"/>`,
    `<path d="M42 44 L25 25 L52 29 L64 11 L76 29 L103 25 L86 44" fill="${crest}" stroke="${f.secondary}" stroke-width="2"/>`,
    `<path d="M39 45 C40 25 53 11 64 18 C76 11 90 25 91 45 C80 37 51 37 39 45Z" fill="${crest}" stroke="${f.secondary}" stroke-width="2"/>`,
  ][index - 1];
  const tendrils = gender === 'female'
    ? `<path d="M37 56 C24 70 26 91 37 106 M91 56 C105 72 101 93 91 106" stroke="${f.primary}" stroke-width="4" stroke-linecap="round" opacity=".7"/>`
    : `<path d="M39 53 C28 63 25 78 31 93 M91 53 C103 63 106 78 99 93" stroke="${f.primary}" stroke-width="4" stroke-linecap="round" opacity=".62"/>`;
  const markings = index % 2
    ? `<path d="M64 47 L59 58 L64 69 L69 58Z" fill="${f.secondary}" opacity=".78" filter="url(#glow-${id})"/>`
    : `<circle cx="64" cy="57" r="5" fill="${f.secondary}" opacity=".72" filter="url(#glow-${id})"/>`;
  return `${frame(id, f, title, 'VOID')}
  <path d="M21 126 C30 101 44 88 64 88 C86 88 100 101 108 126Z" fill="url(#suit-${id})" stroke="${f.secondary}" stroke-opacity=".72" stroke-width="2"/>
  <path d="M29 99 C43 111 84 111 99 99" stroke="${f.trim}" stroke-opacity=".68" stroke-width="4" stroke-linecap="round"/>
  ${tendrils}
  <path d="${head}" fill="${skin}" stroke="${f.secondary}" stroke-width="3"/>
  ${crown}
  <path d="M47 62 C52 57 57 57 61 62 M69 62 C74 57 80 57 85 62" stroke="#05131b" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="55" cy="65" rx="4" ry="6" fill="${f.secondary}" filter="url(#glow-${id})"/>
  <ellipse cx="77" cy="65" rx="4" ry="6" fill="${f.secondary}" filter="url(#glow-${id})"/>
  ${markings}
  <path d="M57 83 C62 88 70 88 76 83" stroke="#07111d" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M43 76 C54 82 75 82 86 76" stroke="${f.primary}" stroke-opacity=".32" stroke-width="2"/>
</svg>`;
}

function emblem(factionKey) {
  const f = factions[factionKey];
  const marks = {
    solar_accord: `<circle cx="64" cy="64" r="22" fill="${f.primary}" opacity=".9"/><path d="M64 18 V38 M64 90 V110 M18 64 H38 M90 64 H110 M31 31 L45 45 M83 83 L97 97 M97 31 L83 45 M45 83 L31 97" stroke="${f.trim}" stroke-width="6" stroke-linecap="round"/><circle cx="64" cy="64" r="34" fill="none" stroke="${f.secondary}" stroke-width="5"/>`,
    iron_meridian: `<path d="M64 14 L103 36 V82 L64 114 L25 82 V36Z" fill="${f.dark}" stroke="${f.primary}" stroke-width="5"/><path d="M64 26 L88 40 V74 L64 94 L40 74 V40Z" fill="${f.primary}" opacity=".9"/><path d="M44 63 H84 M64 39 V89" stroke="${f.secondary}" stroke-width="7" stroke-linecap="round"/>`,
    umbral_veil: `<path d="M64 13 C87 29 101 48 104 73 C84 63 72 75 64 111 C56 75 44 63 24 73 C27 48 41 29 64 13Z" fill="${f.primary}" stroke="${f.secondary}" stroke-width="5"/><circle cx="64" cy="62" r="15" fill="${f.dark}" stroke="${f.trim}" stroke-width="4"/><path d="M64 31 C55 48 55 76 64 94 C73 76 73 48 64 31Z" fill="${f.secondary}" opacity=".75"/>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" fill="none">
  <title>${f.name} emblem</title>
  <rect width="128" height="128" rx="26" fill="${f.dark}"/>
  <circle cx="64" cy="64" r="56" fill="${f.primary}" opacity=".08"/>
  ${marks[factionKey]}
</svg>`;
}

const renderers = {
  solar_accord: solarAvatar,
  iron_meridian: ironAvatar,
  umbral_veil: umbralAvatar,
};

for (const factionKey of Object.keys(factions)) {
  const dir = join(assetRoot, factionKey);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'emblem.svg'), emblem(factionKey));
  for (const gender of ['female', 'male']) {
    for (let index = 1; index <= 6; index += 1) {
      writeFileSync(join(dir, `${gender}-${pad(index)}.svg`), renderers[factionKey](gender, index));
    }
  }
}
