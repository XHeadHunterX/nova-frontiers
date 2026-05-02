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
    tag: 'HUMAN',
    dark: '#060b14',
    primary: '#f5b342',
    secondary: '#285adf',
    trim: '#f7e6b1',
    line: '#11131d',
    suit: '#f4a934',
    skin: ['#7b4a34', '#a76442', '#d29367', '#edbf8e', '#6c3f2f', '#c07a59'],
    hair: ['#17121a', '#4b2c1d', '#d7b56c', '#d9dde6', '#8a2438', '#26344d'],
  },
  iron_meridian: {
    name: 'Iron Meridian',
    species: 'Synthetic',
    tag: 'SYNTH',
    dark: '#070b10',
    primary: '#c8d2da',
    secondary: '#ff8f2e',
    trim: '#63e7ff',
    line: '#05080c',
    metal: ['#9aa5af', '#c7d2da', '#727e89', '#dfe7eb', '#606a73', '#adb7bf'],
    light: ['#ff8f2e', '#63e7ff', '#ffd166', '#8fd6ff', '#ff5f85', '#a7f3d0'],
  },
  umbral_veil: {
    name: 'Umbral Veil',
    species: 'Voidborne',
    tag: 'VOID',
    dark: '#070719',
    primary: '#b174ff',
    secondary: '#42f0ff',
    trim: '#f472b6',
    line: '#08101d',
    skin: ['#75e8e2', '#91a9ff', '#b68aff', '#6bd4ff', '#c084fc', '#69f0cf'],
    crest: ['#241047', '#0d2b47', '#39185c', '#173457', '#2b1550', '#07364a'],
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

function svgWrap(id, faction, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" fill="none">
  <title>${title}</title>
  <defs>
    <radialGradient id="bg-${id}" cx="48%" cy="30%" r="70%">
      <stop offset="0%" stop-color="${faction.primary}" stop-opacity=".30"/>
      <stop offset="55%" stop-color="${faction.dark}" stop-opacity=".98"/>
      <stop offset="100%" stop-color="#01040a"/>
    </radialGradient>
    <linearGradient id="suit-${id}" x1="28" y1="90" x2="101" y2="127">
      <stop offset="0%" stop-color="${faction.primary}"/>
      <stop offset="48%" stop-color="${faction.secondary}"/>
      <stop offset="100%" stop-color="${faction.dark}"/>
    </linearGradient>
    <linearGradient id="shade-${id}" x1="38" y1="31" x2="86" y2="94">
      <stop offset="0%" stop-color="#ffffff" stop-opacity=".28"/>
      <stop offset="100%" stop-color="#000000" stop-opacity=".28"/>
    </linearGradient>
    <filter id="shadow-${id}" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="#000000" flood-opacity=".55"/>
    </filter>
    <filter id="glow-${id}" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="2.2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="128" height="128" rx="10" fill="url(#bg-${id})"/>
  <path d="M7 24 C25 15 46 11 64 13 C92 15 111 27 122 43" stroke="${faction.primary}" stroke-opacity=".24" stroke-width="2"/>
  <path d="M8 98 C33 110 73 114 121 92" stroke="${faction.secondary}" stroke-opacity=".22" stroke-width="3"/>
  <path d="M101 10 L118 22 M110 12 L121 20 M10 109 L24 119 M16 106 L31 117" stroke="#ffffff" stroke-opacity=".11" stroke-width="2" stroke-linecap="round"/>
  <g opacity=".34">
    <path d="M16 30 L30 24 M102 25 L117 34 M14 109 L29 113 M100 113 L117 104" stroke="${faction.trim}" stroke-width="2"/>
    <circle cx="24" cy="67" r="2" fill="${faction.secondary}"/>
    <circle cx="105" cy="69" r="2.5" fill="${faction.primary}"/>
    <circle cx="99" cy="18" r="1.6" fill="${faction.trim}"/>
  </g>
  <rect x="5" y="5" width="118" height="118" rx="8" stroke="${faction.primary}" stroke-opacity=".36" stroke-width="2"/>
  <g transform="translate(64 64) scale(1.08) translate(-64 -64)">
    ${body}
  </g>
</svg>`;
}

function armor(id, faction, gender, index) {
  const shoulder = gender === 'female'
    ? 'M15 129 C21 103 39 86 64 86 C90 86 106 103 113 129Z'
    : 'M11 130 C17 99 37 83 64 83 C93 83 111 99 117 130Z';
  const chest = gender === 'female'
    ? 'M36 87 L50 129 H78 L92 87 C80 96 51 96 36 87Z'
    : 'M30 84 L47 130 H82 L99 84 C83 96 47 96 30 84Z';
  const accent = index % 2 ? faction.secondary : faction.primary;
  return `
  <g filter="url(#shadow-${id})">
    <path d="${shoulder}" fill="url(#suit-${id})" stroke="${faction.line}" stroke-width="4" stroke-linejoin="round"/>
    <path d="${chest}" fill="${faction.dark}" stroke="${faction.trim}" stroke-opacity=".68" stroke-width="2" stroke-linejoin="round"/>
    <path d="M28 101 C43 112 85 112 100 101" stroke="${faction.trim}" stroke-opacity=".54" stroke-width="3" stroke-linecap="round"/>
    <path d="M45 96 L37 130 M83 96 L91 130" stroke="${faction.line}" stroke-opacity=".64" stroke-width="4" stroke-linecap="round"/>
    <path d="M24 111 L39 101 M104 111 L89 101" stroke="${faction.primary}" stroke-opacity=".78" stroke-width="4" stroke-linecap="round"/>
    <circle cx="39" cy="99" r="4.8" fill="${accent}" stroke="${faction.line}" stroke-width="2"/>
    <circle cx="90" cy="99" r="4.8" fill="${accent}" stroke="${faction.line}" stroke-width="2"/>
    <path d="M52 106 H76" stroke="${accent}" stroke-width="3.4" stroke-linecap="round"/>
    <rect x="53" y="112" width="22" height="8" rx="2" fill="${faction.line}" opacity=".72"/>
    <text x="64" y="118" text-anchor="middle" fill="${faction.trim}" font-size="6" font-family="Arial, sans-serif" font-weight="900">${faction.tag}</text>
  </g>`;
}

function headset(faction, side = 'right', y = 62) {
  if (side === 'left') {
    return `<path d="M38 ${y - 19} C24 ${y - 14} 19 ${y} 23 ${y + 18}" stroke="${faction.secondary}" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="${y + 20}" r="4" fill="${faction.primary}" stroke="${faction.line}" stroke-width="2"/><path d="M27 ${y + 21} H40" stroke="${faction.trim}" stroke-width="2" stroke-linecap="round"/>`;
  }
  return `<path d="M90 ${y - 19} C105 ${y - 14} 109 ${y} 105 ${y + 18}" stroke="${faction.secondary}" stroke-width="3" stroke-linecap="round"/><circle cx="104" cy="${y + 20}" r="4" fill="${faction.primary}" stroke="${faction.line}" stroke-width="2"/><path d="M101 ${y + 21} H88" stroke="${faction.trim}" stroke-width="2" stroke-linecap="round"/>`;
}

function solarHair(gender, index, color, faction) {
  const female = [
    `<path d="M35 66 C30 42 42 20 64 19 C88 18 99 39 93 66 C82 51 52 48 35 66Z" fill="${color}" stroke="${faction.line}" stroke-width="4" stroke-linejoin="round"/>`,
    `<path d="M36 70 C31 41 47 19 69 20 C89 21 99 42 91 69 C83 48 58 47 36 70Z" fill="${color}" stroke="${faction.line}" stroke-width="4"/><path d="M39 68 C33 82 35 94 43 102" stroke="${color}" stroke-width="8" stroke-linecap="round"/>`,
    `<path d="M34 61 C36 33 55 16 77 23 C93 28 98 47 91 67 C78 45 52 44 34 61Z" fill="${color}" stroke="${faction.line}" stroke-width="4"/><path d="M50 24 C57 36 74 39 91 35" stroke="${faction.trim}" stroke-opacity=".35" stroke-width="3"/>`,
    `<path d="M39 50 C45 26 62 18 80 24 C93 29 96 44 88 59 C73 47 55 45 39 50Z" fill="${color}" stroke="${faction.line}" stroke-width="4"/><path d="M41 50 C34 69 39 88 49 98" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`,
    `<path d="M36 66 C30 43 39 23 61 19 C86 15 99 38 93 64 C81 50 57 48 36 66Z" fill="${color}" stroke="${faction.line}" stroke-width="4"/><path d="M47 23 C55 33 73 36 91 32" stroke="${faction.primary}" stroke-width="3" stroke-linecap="round"/>`,
    `<path d="M36 60 C34 33 54 17 76 22 C91 26 97 43 89 62 C76 51 55 46 36 60Z" fill="${color}" stroke="${faction.line}" stroke-width="4"/><path d="M84 42 C95 55 95 78 87 94" stroke="${color}" stroke-width="8" stroke-linecap="round"/>`,
  ];
  const male = [
    `<path d="M38 50 C43 30 57 22 72 23 C85 24 94 34 92 49 C76 41 55 42 38 50Z" fill="${color}" stroke="${faction.line}" stroke-width="4"/>`,
    `<path d="M37 49 C47 24 75 16 94 36 C80 36 60 40 39 54Z" fill="${color}" stroke="${faction.line}" stroke-width="4"/><path d="M50 84 C58 94 72 94 80 84 C76 100 69 106 64 106 C58 106 51 99 50 84Z" fill="${color}" opacity=".55"/>`,
    `<path d="M40 45 C48 29 62 23 76 26 C86 28 92 36 93 47 C75 40 56 39 40 45Z" fill="${color}" stroke="${faction.line}" stroke-width="4"/>`,
    `<path d="M38 48 C42 30 55 22 68 22 C84 22 94 34 93 51 C75 43 55 42 38 48Z" fill="${color}" stroke="${faction.line}" stroke-width="4"/><path d="M49 83 C56 92 73 92 81 83 C78 98 70 104 64 104 C57 104 51 98 49 83Z" fill="${color}" opacity=".5"/>`,
    `<path d="M42 46 C44 30 56 23 70 23 C84 24 92 33 92 46 C75 40 58 40 42 46Z" fill="${color}" stroke="${faction.line}" stroke-width="4"/>`,
    `<path d="M39 47 C45 27 63 20 82 26 C89 29 94 36 95 44 C77 38 57 39 39 47Z" fill="${color}" stroke="${faction.line}" stroke-width="4"/><path d="M45 32 C58 27 72 28 86 36" stroke="${faction.trim}" stroke-opacity=".42" stroke-width="3" stroke-linecap="round"/>`,
  ];
  return (gender === 'female' ? female : male)[index - 1];
}

function humanFace(faction, gender, index, skin, hair) {
  const head = gender === 'female'
    ? 'M36 59 C36 35 48 21 65 21 C83 21 94 36 93 60 C92 84 80 99 65 101 C49 99 37 84 36 59Z'
    : 'M34 58 C35 34 48 20 65 20 C84 20 96 35 96 61 C95 85 82 101 65 103 C48 101 35 84 34 58Z';
  const blush = gender === 'female' ? `<circle cx="49" cy="75" r="4.5" fill="#f47272" opacity=".22"/><circle cx="82" cy="75" r="4.5" fill="#f47272" opacity=".22"/>` : '';
  const beard = gender === 'male' && [2, 4, 6].includes(index)
    ? `<path d="M47 80 C55 91 76 91 84 80 C81 98 72 107 65 107 C57 107 50 98 47 80Z" fill="${hair}" opacity=".58"/><path d="M54 90 C60 95 70 95 76 90" stroke="${faction.line}" stroke-opacity=".42" stroke-width="2" stroke-linecap="round"/>`
    : '';
  const brows = index % 2
    ? `<path d="M47 59 L60 56 M72 56 L86 59" stroke="${faction.line}" stroke-width="3.4" stroke-linecap="round"/>`
    : `<path d="M46 58 C52 55 58 55 63 59 M70 59 C76 55 82 55 88 58" stroke="${faction.line}" stroke-width="3.4" stroke-linecap="round"/>`;
  return `
  <path d="M35 61 C28 62 26 72 34 77 M94 61 C102 63 103 73 95 78" fill="${skin}" stroke="${faction.line}" stroke-width="3" stroke-linecap="round"/>
  <path d="${head}" fill="${skin}" stroke="${faction.line}" stroke-width="4" stroke-linejoin="round" filter="url(#shadow-solar-${gender}-${index})"/>
  <path d="${head}" fill="url(#shade-solar-${gender}-${index})" opacity=".26"/>
  ${solarHair(gender, index, hair, faction)}
  ${brows}
  <path d="M47 67 C52 63 59 63 63 67 M70 67 C75 63 82 63 87 67" stroke="#0b1624" stroke-width="2.6" stroke-linecap="round"/>
  <ellipse cx="55" cy="68.5" rx="3.5" ry="2.9" fill="#f7fbff"/><ellipse cx="78" cy="68.5" rx="3.5" ry="2.9" fill="#f7fbff"/>
  <circle cx="55.7" cy="68.5" r="1.35" fill="#11131d"/><circle cx="78.7" cy="68.5" r="1.35" fill="#11131d"/>
  <path d="M65 70 L60 81 H68" stroke="#75432f" stroke-opacity=".66" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M56 87 C62 92 71 92 78 87" stroke="#3b1620" stroke-width="2.7" stroke-linecap="round"/>
  <path d="M46 52 C54 49 75 49 86 53" stroke="#ffffff" stroke-opacity=".17" stroke-width="2" stroke-linecap="round"/>
  ${blush}
  ${beard}`;
}

function solarAvatar(gender, index) {
  const faction = factions.solar_accord;
  const id = `solar-${gender}-${index}`;
  const skin = faction.skin[(index - 1) % faction.skin.length];
  const hair = faction.hair[(index + (gender === 'female' ? 1 : 3)) % faction.hair.length];
  const name = gender === 'female' ? femaleNames.solar_accord[index - 1] : maleNames.solar_accord[index - 1];
  const cap = [1, 3, 5].includes(index)
    ? `<path d="M37 49 C47 34 80 32 94 50 L90 59 C75 53 54 53 40 59Z" fill="${index % 3 === 0 ? '#b51f3d' : '#23395d'}" stroke="${faction.line}" stroke-width="3.2"/><path d="M44 50 H88" stroke="${faction.primary}" stroke-width="3.2" stroke-linecap="round"/><circle cx="64" cy="47" r="3" fill="${faction.trim}" stroke="${faction.line}" stroke-width="1.5"/>`
    : '';
  const side = index % 2 ? 'right' : 'left';
  return svgWrap(id, faction, `${faction.name} ${name}`, `
  ${armor(id, faction, gender, index)}
  <g>
    ${humanFace(faction, gender, index, skin, hair)}
    ${cap}
    ${headset(faction, side, 61)}
    <path d="M29 79 C43 91 85 91 99 79" stroke="${faction.primary}" stroke-width="4" stroke-linecap="round" opacity=".86"/>
    <path d="M25 83 L36 87 M92 87 L103 83" stroke="${faction.secondary}" stroke-width="3" stroke-linecap="round"/>
  </g>`);
}

function robotHeadPath(gender, index) {
  const female = [
    'M39 59 L44 31 L63 19 L84 31 L90 59 L83 88 L65 100 L46 89Z',
    'M36 59 L47 27 L66 18 L88 33 L93 60 L82 93 L64 102 L44 91Z',
    'M41 56 L46 29 L64 16 L82 29 L88 57 L80 89 L64 99 L48 89Z',
    'M37 61 L42 35 L57 21 H72 L88 35 L93 61 L82 91 L64 101 L46 91Z',
    'M40 58 L48 27 L65 17 L84 29 L91 59 L80 92 L63 100 L45 91Z',
    'M38 57 L44 30 L64 18 L86 30 L92 57 L86 85 L64 102 L42 85Z',
  ];
  const male = [
    'M34 58 L42 29 L64 17 L88 29 L96 58 L88 92 L64 105 L40 92Z',
    'M32 60 L39 30 L62 16 L89 27 L99 59 L90 94 L64 108 L38 94Z',
    'M36 56 L44 27 L66 16 L91 33 L96 59 L85 95 L62 105 L39 91Z',
    'M33 59 L42 24 H84 L95 37 L98 60 L88 92 L64 106 L40 92Z',
    'M35 58 L44 28 L64 16 L86 28 L94 58 L84 95 L64 106 L44 95Z',
    'M31 60 L41 31 L64 15 L90 31 L99 60 L86 96 L64 109 L42 96Z',
  ];
  return (gender === 'female' ? female : male)[index - 1];
}

function ironAvatar(gender, index) {
  const faction = factions.iron_meridian;
  const id = `iron-${gender}-${index}`;
  const metal = faction.metal[(index - 1) % faction.metal.length];
  const light = faction.light[(index + 1) % faction.light.length];
  const name = gender === 'female' ? femaleNames.iron_meridian[index - 1] : maleNames.iron_meridian[index - 1];
  const head = robotHeadPath(gender, index);
  const visor = index % 3 === 0
    ? `<path d="M43 55 H86 L81 72 H48Z" fill="#030609" stroke="${light}" stroke-width="3"/><path d="M50 63 H79" stroke="${light}" stroke-width="4" stroke-linecap="round" filter="url(#glow-${id})"/>`
    : `<path d="M44 54 H61 L58 70 H47Z" fill="#030609" stroke="${light}" stroke-width="2.5"/><path d="M68 54 H86 L81 70 H70Z" fill="#030609" stroke="${light}" stroke-width="2.5"/><path d="M50 62 H56 M73 62 H80" stroke="${light}" stroke-width="4" stroke-linecap="round" filter="url(#glow-${id})"/>`;
  const crown = gender === 'female'
    ? `<path d="M54 23 L64 7 L75 23 L70 39 H58Z" fill="${light}" stroke="${faction.line}" stroke-width="2" filter="url(#glow-${id})"/>`
    : `<path d="M43 30 L64 12 L86 30 L82 39 L64 26 L47 39Z" fill="${faction.dark}" stroke="${light}" stroke-width="3"/>`;
  const cables = index % 2
    ? `<path d="M35 42 L22 24 M94 42 L106 24" stroke="${faction.primary}" stroke-width="3" stroke-linecap="round"/><circle cx="21" cy="23" r="3" fill="${light}" filter="url(#glow-${id})"/>`
    : `<path d="M32 67 L15 64 M96 67 L113 64" stroke="${faction.secondary}" stroke-width="3" stroke-linecap="round"/><circle cx="114" cy="64" r="3" fill="${light}" filter="url(#glow-${id})"/>`;
  const maskDetail = [
    `<path d="M52 38 L64 31 L77 38" stroke="${faction.line}" stroke-opacity=".55" stroke-width="2.2" stroke-linecap="round"/><circle cx="64" cy="82" r="4" fill="${faction.dark}" stroke="${light}" stroke-width="2"/>`,
    `<path d="M48 41 H80 M43 76 H86" stroke="${faction.line}" stroke-opacity=".46" stroke-width="2.2" stroke-linecap="round"/><path d="M59 82 H70" stroke="${light}" stroke-width="3" stroke-linecap="round"/>`,
    `<path d="M53 36 L47 48 M76 36 L83 48" stroke="${faction.primary}" stroke-width="2.4" stroke-linecap="round"/><circle cx="64" cy="80" r="5" fill="${faction.dark}" stroke="${faction.secondary}" stroke-width="2"/>`,
    `<path d="M45 40 L56 34 H74 L85 40" stroke="${light}" stroke-opacity=".72" stroke-width="2.3" stroke-linecap="round"/><path d="M53 82 L64 88 L75 82" stroke="${faction.line}" stroke-width="2.4" stroke-linecap="round"/>`,
    `<path d="M42 47 C53 39 76 39 88 47" stroke="${faction.line}" stroke-opacity=".5" stroke-width="2.3" stroke-linecap="round"/><rect x="57" y="78" width="14" height="8" rx="2" fill="${faction.dark}" stroke="${light}" stroke-width="1.8"/>`,
    `<path d="M50 37 H78 M46 84 H82" stroke="${faction.primary}" stroke-width="2.6" stroke-linecap="round"/><path d="M58 80 H70" stroke="${light}" stroke-width="3.4" stroke-linecap="round"/>`,
  ][index - 1];
  return svgWrap(id, faction, `${faction.name} ${name}`, `
  ${armor(id, faction, gender, index)}
  <g filter="url(#shadow-${id})">
    ${cables}
    <path d="${head}" fill="${metal}" stroke="${faction.line}" stroke-width="4" stroke-linejoin="round"/>
    <path d="${head}" fill="url(#shade-${id})" opacity=".26"/>
    <path d="M47 38 H82 M39 53 H48 M81 53 H91" stroke="#ffffff" stroke-opacity=".38" stroke-width="2.4" stroke-linecap="round"/>
    ${maskDetail}
    ${visor}
    <path d="M64 70 L57 80 H71Z" fill="${faction.dark}" stroke="${faction.primary}" stroke-opacity=".55" stroke-width="2"/>
    <path d="${gender === 'female' ? 'M49 80 L64 90 L80 80 L77 92 L64 101 L51 92Z' : 'M46 81 H83 L77 97 L64 105 L51 97Z'}" fill="#182129" stroke="${light}" stroke-opacity=".45" stroke-width="2"/>
    <circle cx="64" cy="45" r="${index % 3 === 0 ? 6 : 4}" fill="${light}" opacity=".95" filter="url(#glow-${id})"/>
    <path d="M42 89 C55 98 74 98 87 89" stroke="${faction.secondary}" stroke-width="3" stroke-linecap="round"/>
    ${crown}
  </g>`);
}

function alienCrown(faction, index) {
  const shapes = [
    `<path d="M42 39 L33 17 L55 30 L64 8 L73 30 L95 17 L86 40" fill="${faction.crest[index % faction.crest.length]}" stroke="${faction.secondary}" stroke-width="3" stroke-linejoin="round"/>`,
    `<path d="M39 46 C42 22 54 15 64 7 C75 15 87 22 90 46 C77 36 53 36 39 46Z" fill="${faction.crest[index % faction.crest.length]}" stroke="${faction.secondary}" stroke-width="3"/>`,
    `<path d="M39 44 L29 28 L49 31 L52 13 L64 29 L77 13 L80 31 L99 28 L89 44" fill="${faction.crest[index % faction.crest.length]}" stroke="${faction.secondary}" stroke-width="3" stroke-linejoin="round"/>`,
    `<path d="M36 47 C38 24 48 14 64 9 C81 14 91 24 93 47 C78 38 52 38 36 47Z" fill="${faction.crest[index % faction.crest.length]}" stroke="${faction.primary}" stroke-width="3"/>`,
    `<path d="M42 44 L24 25 L52 29 L64 10 L76 29 L104 25 L86 44" fill="${faction.crest[index % faction.crest.length]}" stroke="${faction.secondary}" stroke-width="3" stroke-linejoin="round"/>`,
    `<path d="M39 45 C40 25 53 11 64 18 C76 11 90 25 91 45 C80 37 51 37 39 45Z" fill="${faction.crest[index % faction.crest.length]}" stroke="${faction.secondary}" stroke-width="3"/>`,
  ];
  return shapes[index - 1];
}

function umbralAvatar(gender, index) {
  const faction = factions.umbral_veil;
  const id = `umbral-${gender}-${index}`;
  const skin = faction.skin[(index - 1) % faction.skin.length];
  const name = gender === 'female' ? femaleNames.umbral_veil[index - 1] : maleNames.umbral_veil[index - 1];
  const head = gender === 'female'
    ? 'M35 59 C36 33 49 17 64 15 C84 17 96 35 95 60 C94 84 80 101 64 105 C48 101 36 84 35 59Z'
    : 'M32 57 C34 31 49 17 65 15 C85 17 98 34 98 61 C96 86 80 105 64 108 C47 104 34 84 32 57Z';
  const tendrils = gender === 'female'
    ? `<path d="M36 55 C21 70 24 94 36 110 M93 55 C109 72 104 96 93 111" stroke="${faction.primary}" stroke-width="5.5" stroke-linecap="round" opacity=".76"/>`
    : `<path d="M36 52 C24 63 20 80 27 96 M94 52 C108 63 111 80 102 98" stroke="${faction.primary}" stroke-width="5.5" stroke-linecap="round" opacity=".68"/>`;
  const mark = index % 2
    ? `<path d="M64 47 L59 58 L64 70 L69 58Z" fill="${faction.secondary}" opacity=".8" filter="url(#glow-${id})"/>`
    : `<circle cx="64" cy="57" r="5" fill="${faction.secondary}" opacity=".75" filter="url(#glow-${id})"/>`;
  return svgWrap(id, faction, `${faction.name} ${name}`, `
  ${armor(id, faction, gender, index)}
  <g filter="url(#shadow-${id})">
    ${tendrils}
    <path d="${head}" fill="${skin}" stroke="${faction.line}" stroke-width="4" stroke-linejoin="round"/>
    <path d="${head}" fill="url(#shade-${id})" opacity=".22"/>
    ${alienCrown(faction, index)}
    <path d="M44 61 C51 55 59 55 64 62 M69 62 C75 55 84 55 90 61" stroke="${faction.line}" stroke-width="3.2" stroke-linecap="round"/>
    <ellipse cx="55" cy="67" rx="5.1" ry="6.9" fill="${faction.secondary}" filter="url(#glow-${id})"/>
    <ellipse cx="79" cy="67" rx="5.1" ry="6.9" fill="${faction.secondary}" filter="url(#glow-${id})"/>
    <path d="M54 67 H59 M78 67 H83" stroke="#ffffff" stroke-opacity=".9" stroke-width="1.6" stroke-linecap="round"/>
    ${mark}
    <path d="M56 87 C62 92 71 92 78 87" stroke="${faction.line}" stroke-width="2.7" stroke-linecap="round"/>
    <path d="M42 77 C55 84 77 84 90 77" stroke="${faction.primary}" stroke-opacity=".38" stroke-width="2.2"/>
    <path d="M43 70 C39 77 39 84 44 91 M89 70 C94 78 93 85 88 92" stroke="${faction.trim}" stroke-opacity=".44" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="48" cy="52" r="2" fill="${faction.trim}" opacity=".42"/><circle cx="85" cy="52" r="2" fill="${faction.trim}" opacity=".42"/>
    ${headset(faction, index % 2 ? 'right' : 'left', 62)}
  </g>`);
}

function emblem(factionKey) {
  const faction = factions[factionKey];
  const marks = {
    solar_accord: `<circle cx="64" cy="64" r="21" fill="${faction.primary}"/><path d="M64 17 V38 M64 90 V111 M17 64 H38 M90 64 H111 M31 31 L45 45 M83 83 L98 98 M98 31 L83 45 M45 83 L31 98" stroke="${faction.trim}" stroke-width="6" stroke-linecap="round"/><circle cx="64" cy="64" r="35" fill="none" stroke="${faction.secondary}" stroke-width="5"/>`,
    iron_meridian: `<path d="M64 14 L104 36 V82 L64 114 L24 82 V36Z" fill="${faction.dark}" stroke="${faction.primary}" stroke-width="5"/><path d="M64 26 L89 41 V75 L64 96 L39 75 V41Z" fill="${faction.primary}"/><path d="M44 63 H84 M64 39 V89" stroke="${faction.secondary}" stroke-width="7" stroke-linecap="round"/>`,
    umbral_veil: `<path d="M64 13 C88 29 102 48 105 73 C84 63 72 75 64 111 C56 75 44 63 23 73 C26 48 40 29 64 13Z" fill="${faction.primary}" stroke="${faction.secondary}" stroke-width="5"/><circle cx="64" cy="62" r="15" fill="${faction.dark}" stroke="${faction.trim}" stroke-width="4"/><path d="M64 31 C55 48 55 76 64 94 C73 76 73 48 64 31Z" fill="${faction.secondary}" opacity=".75"/>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" fill="none">
  <title>${faction.name} emblem</title>
  <rect width="128" height="128" rx="26" fill="${faction.dark}"/>
  <circle cx="64" cy="64" r="56" fill="${faction.primary}" opacity=".08"/>
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
