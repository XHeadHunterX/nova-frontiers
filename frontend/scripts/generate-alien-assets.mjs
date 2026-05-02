import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const generatedDir = join(root, 'src', 'assets', 'generated');
const shipDir = join(generatedDir, 'ships');
const moduleDir = join(generatedDir, 'modules');

const ships = [
  ['alien_spore_skiff', '#72ff9c', '#d6ffd3'],
  ['alien_chitin_interceptor', '#55f2ff', '#f06dff'],
  ['alien_void_manta', '#7f8cff', '#68ffcf'],
  ['alien_neural_frigate', '#ff64c8', '#7fffd4'],
  ['alien_hive_carrier', '#f3ff63', '#6cff9a'],
  ['alien_gravemind_dreadnought', '#b56cff', '#ff6a9e'],
  ['alien_singularity_leviathan', '#ffffff', '#8b5cff'],
];

const slotLabels = {
  weapon: ['Spore Lance', 'Needle Flak', 'Bioplasma Maw', 'Tendril Rail', 'Chorus Swarm', 'Venom Prism', 'Mitosis Beam', 'Abyssal Quill', 'Resonance Fang', 'Cyst Mortar', 'Neural Cutter', 'Star Leech', 'Hive Volley', 'Void Thorn', 'Singularity Stinger'],
  shield: ['Membrane Veil', 'Pearl Aegis', 'Brood Bulwark', 'Ichor Screen', 'Astral Shell', 'Spore Barrier', 'Chorus Ward', 'Void Bloom Shield', 'Carapace Halo', 'Neural Mirror', 'Gravitic Cowl', 'Hive Envelope', 'Leeching Veil', 'Maw Screen', 'Singularity Mantle'],
  armor: ['Chitin Weave', 'Bone Laminate', 'Iridescent Plate', 'Spine Ribbing', 'Maw Carapace', 'Void Bark', 'Hive Bulkhead', 'Abyssal Husk', 'Living Alloy', 'Neural Scale', 'Brood Plating', 'Leviathan Dermis', 'Gravity Shell', 'Prism Hide', 'Singularity Carapace'],
  engine: ['Cilia Drive', 'Pulse Siphon', 'Spore Sail', 'Manta Wake', 'Ichor Thruster', 'Void Fin', 'Synapse Drive', 'Chorus Impeller', 'Grav Tendril', 'Brood Wake', 'Star Current', 'Leech Reactor Drive', 'Hive Slipstream', 'Abyssal Cilia', 'Singularity Propulsor'],
  cargo: ['Spore Sac', 'Brood Hold', 'Resin Vault', 'Ichor Cellar', 'Void Maw Cache', 'Manta Pouch', 'Chitin Cradle', 'Hive Larder', 'Neural Archive', 'Pearl Silo', 'Bone Locker', 'Leech Chamber', 'Grav Cyst', 'Starseed Womb', 'Singularity Gullet'],
  scanner: ['Antenna Crown', 'Neural Lens', 'Spore Chorus Array', 'Void Eye', 'Manta Whisker', 'Ichor Prism', 'Hive Echo Organ', 'Synapse Web', 'Grav Sense Node', 'Leech Seer', 'Abyssal Ocellus', 'Pearl Surveyor', 'Starfield Palp', 'Cyst Cartographer', 'Singularity Retina'],
  stealth: ['Shadow Membrane', 'Chameleon Spores', 'Null Scent Gland', 'Void Ink Sac', 'Whisper Carapace', 'Phase Cilia', 'Manta Shade', 'Neural Fog', 'Hive Silence Mesh', 'Leech Dampener', 'Pearl Mirage', 'Abyssal Hush', 'Starless Veil', 'Grav Quiet Organ', 'Singularity Cloak'],
  utility: ['Brood Relay', 'Neural Command Node', 'Cyst Harvester', 'Resin Loom', 'Spore Beacon', 'Ichor Stabilizer', 'Manta Docking Tendril', 'Hive Pulse Organ', 'Pearl Mediator', 'Void Anchor', 'Chorus Router', 'Leech Distributor', 'Abyssal Winch', 'Starseed Cradle', 'Singularity Organ'],
  repair: ['Regrowth Vat', 'Ichor Sutures', 'Brood Nurse', 'Spore Patch', 'Living Riveter', 'Pearl Knit Organ', 'Neural Tissue Loom', 'Carapace Mender', 'Void Clot Gland', 'Hive Healer', 'Leech Graft', 'Manta Regenerator', 'Abyssal Stitcher', 'Starseed Infuser', 'Singularity Rebuilder'],
  fuel: ['Nectar Cell', 'Ichor Reservoir', 'Spore Furnace', 'Void Nutrient Pod', 'Brood Catalyzer', 'Manta Bladder', 'Star Sap Tank', 'Leech Fuel Organ', 'Hive Digestor', 'Grav Nectar Cell', 'Pearl Reactor Sac', 'Abyssal Biotank', 'Chorus Cell', 'Cyst Distiller', 'Singularity Heart'],
  energy: ['Synapse Dynamo', 'Pearl Capacitor', 'Ichor Battery', 'Void Nerve Core', 'Brood Capacitor', 'Manta Pulse Heart', 'Chorus Reactor', 'Leech Dynamo', 'Hive Nucleus', 'Spore Alternator', 'Abyssal Coil', 'Grav Ganglion', 'Star Current Core', 'Cyst Capacitor', 'Singularity Nerve'],
  mining: ['Acid Drill', 'Spore Bore', 'Maw Extractor', 'Tendril Auger', 'Leech Harvester', 'Ichor Sluice', 'Chitin Grinder', 'Void Prospector', 'Brood Quarry Organ', 'Manta Sifter', 'Pearl Refining Tooth', 'Abyssal Burrower', 'Starseed Rasp', 'Grav Claw', 'Singularity Mandible'],
};

const slotColors = {
  weapon: ['#ff5cc8', '#ffe66f'],
  shield: ['#55f2ff', '#8dffbf'],
  armor: ['#b56cff', '#f3ff63'],
  engine: ['#7f8cff', '#72ff9c'],
  cargo: ['#f0b35c', '#ff64c8'],
  scanner: ['#63ffe7', '#ffffff'],
  stealth: ['#725cff', '#47f0ff'],
  utility: ['#a7ff55', '#ff6de3'],
  repair: ['#64ff8f', '#d6ffd3'],
  fuel: ['#f3ff63', '#ff8a4d'],
  energy: ['#ffffff', '#55f2ff'],
  mining: ['#ffcf5c', '#72ff9c'],
};

function slug(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function shipSvg(key, glow, core) {
  const seed = [...key].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const wing = 44 + (seed % 20);
  const spine = 92 + (seed % 34);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 320">
  <defs>
    <radialGradient id="bg" cx="48%" cy="45%" r="60%"><stop offset="0%" stop-color="${glow}" stop-opacity=".26"/><stop offset="62%" stop-color="#06131a"/><stop offset="100%" stop-color="#010307"/></radialGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>
  <rect width="512" height="320" rx="0" fill="url(#bg)"/>
  <g filter="url(#blur)" opacity=".68">
    <ellipse cx="256" cy="162" rx="${spine + 40}" ry="54" fill="${glow}"/>
    <ellipse cx="256" cy="164" rx="${wing + 110}" ry="24" fill="${core}"/>
  </g>
  <path d="M58 168 C142 78 215 90 256 28 C297 90 370 78 454 168 C362 153 309 220 256 292 C203 220 150 153 58 168Z" fill="#06131a" stroke="${glow}" stroke-width="7" stroke-linejoin="round"/>
  <path d="M88 168 C170 130 213 145 256 72 C299 145 342 130 424 168 C340 178 304 211 256 264 C208 211 172 178 88 168Z" fill="${core}" opacity=".22"/>
  <path d="M158 167 C210 128 231 124 256 76 C281 124 302 128 354 167 C315 181 285 211 256 252 C227 211 197 181 158 167Z" fill="${glow}" opacity=".34"/>
  <circle cx="256" cy="160" r="32" fill="#010307" stroke="${core}" stroke-width="6"/>
  <circle cx="256" cy="160" r="12" fill="${core}"/>
  <path d="M256 48 L245 118 L256 104 L267 118 Z M256 272 L245 202 L256 216 L267 202 Z" fill="${core}" opacity=".82"/>
  <path d="M118 156 C169 184 213 184 244 164 M394 156 C343 184 299 184 268 164" fill="none" stroke="${glow}" stroke-width="5" stroke-linecap="round" opacity=".78"/>
</svg>`;
}

function moduleSvg(slot, label, index) {
  const [a, b] = slotColors[slot] || ['#55f2ff', '#ffffff'];
  const points = 5 + (index % 5);
  const radius = 35 + (index % 4) * 5;
  const path = Array.from({ length: points }, (_, i) => {
    const angle = (-Math.PI / 2) + (i / points) * Math.PI * 2;
    const r = i % 2 ? radius * 0.58 : radius;
    return `${96 + Math.cos(angle) * r},${96 + Math.sin(angle) * r}`;
  }).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <defs>
    <radialGradient id="g" cx="42%" cy="30%" r="70%"><stop offset="0%" stop-color="${b}" stop-opacity=".7"/><stop offset="52%" stop-color="${a}" stop-opacity=".34"/><stop offset="100%" stop-color="#010307"/></radialGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="3"/></filter>
  </defs>
  <rect width="192" height="192" rx="26" fill="#010307"/>
  <circle cx="96" cy="96" r="74" fill="url(#g)" stroke="${a}" stroke-opacity=".55" stroke-width="3"/>
  <polygon points="${path}" fill="#06131a" stroke="${b}" stroke-width="5" stroke-linejoin="round"/>
  <circle cx="96" cy="96" r="${18 + (index % 3) * 4}" fill="${a}" opacity=".42" filter="url(#blur)"/>
  <circle cx="96" cy="96" r="12" fill="${b}"/>
  <path d="M39 96 C58 ${60 + index} 78 ${52 + index} 96 34 C114 ${52 + index} 134 ${60 + index} 153 96 C134 ${132 - index} 114 ${140 - index} 96 158 C78 ${140 - index} 58 ${132 - index} 39 96Z" fill="none" stroke="${a}" stroke-width="3" opacity=".68"/>
  <title>Xeno ${label}</title>
</svg>`;
}

mkdirSync(shipDir, { recursive: true });
mkdirSync(moduleDir, { recursive: true });

for (const [key, glow, core] of ships) {
  writeFileSync(join(shipDir, `${key}.svg`), shipSvg(key, glow, core));
}

let moduleCount = 0;
for (const [slot, labels] of Object.entries(slotLabels)) {
  labels.forEach((label, index) => {
    const code = `alien_${slot}_${slug(label)}`;
    writeFileSync(join(moduleDir, `${code}.svg`), moduleSvg(slot, label, index + 1));
    moduleCount += 1;
  });
}

console.log(`Generated ${ships.length} alien ship SVGs and ${moduleCount} alien module SVGs.`);
