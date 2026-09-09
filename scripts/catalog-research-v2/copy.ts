// ============================================================
// E-com.casa — V2 original copy generation (§15/§32/§33/§34)
// ------------------------------------------------------------
// Generates ORIGINAL E-com.casa product titles and descriptions
// from factual extracted attributes only. Source brand names are
// never used as E-com.casa brands (§34) and source descriptions
// are never published verbatim (§15). LLM-first (original copy),
// deterministic template fallback when the SDK is unavailable.
// Facts not present in the source are never claimed (§20/§33).
// ============================================================

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { V2_CONFIG } from './config';

export interface CopyInput {
  facts: {
    category: string;
    categoryLabel: string;
    material?: string | null;
    colour?: string | null;
    dimsText?: string | null;
    spaces: string[];
    isElectrical: boolean;
    isBattery: boolean;
    isOutdoor: boolean;
    variantNames: string[];
    /** object-type noun phrase from the source product (no brands) — keeps names distinct */
    typeHint?: string;
  };
}

export interface GeneratedCopy {
  name: string;
  shortDescription: string;
  description: string;
  generator: 'llm' | 'template';
}

// ---------------- LLM layer ----------------

const COPY_CACHE: Record<string, GeneratedCopy> = (() => {
  try {
    const p = path.join(process.cwd(), V2_CONFIG.copy.cacheFile);
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf-8'));
  } catch {
    /* fresh cache */
  }
  return {};
})();

function saveCopyCache(): void {
  try {
    const p = path.join(process.cwd(), V2_CONFIG.copy.cacheFile);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(COPY_CACHE, null, 2), 'utf-8');
  } catch {
    /* best effort */
  }
}

function factsSignature(input: CopyInput): string {
  const f = input.facts;
  return [f.category, f.material ?? '', f.colour ?? '', f.dimsText ?? '', f.spaces.join(','), f.isElectrical ? 'e' : '', f.isBattery ? 'b' : '', f.isOutdoor ? 'o' : '', f.variantNames.slice(0, 4).join(','), f.typeHint ?? '']
    .join('|')
    .toLowerCase();
}

async function llmCopy(input: CopyInput): Promise<GeneratedCopy | null> {
  const f = input.facts;
  const factLines: string[] = [
    `product type: ${f.categoryLabel}`,
    f.material ? `material: ${f.material}` : '',
    f.colour ? `colour: ${f.colour}` : '',
    f.dimsText ? `dimensions: ${f.dimsText}` : '',
    f.isElectrical ? 'electrical: yes' : 'electrical: no',
    f.isBattery ? 'battery powered: yes' : '',
    f.isOutdoor ? 'suitable for outdoor use: yes' : '',
    f.spaces.length ? `typical rooms: ${f.spaces.join(', ')}` : '',
    f.variantNames.length ? `available variants: ${f.variantNames.slice(0, 6).join(', ')}` : '',
    f.typeHint ? `object type (use this kind of wording for the name): ${f.typeHint}` : '',
  ].filter(Boolean);

  const prompt = `You write original product copy for E-com.casa, a European home & garden store.
Create an ORIGINAL product presentation from ONLY these verified facts — never invent extra specifications, dimensions, materials, certifications or claims:

${factLines.join('\n')}

Rules:
- English, warm minimal-brand tone, no exclamation marks, no superlatives that imply unverified quality.
- name: 3-6 words, describes the object (material/type/shape if known). Do NOT mention any brand.
- shortDescription: one sentence, max 110 characters.
- description: 2-3 sentences, only fact-supported statements, mention dimensions/material only if listed above.
- Reply with strict JSON only: {"name":"...","shortDescription":"...","description":"..."}`;

  try {
    const { default: ZAI } = await import('z-ai-web-dev-sdk');
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a concise e-commerce copywriter. Reply with strict JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    });
    const text = completion.choices[0]?.message?.content ?? '';
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<GeneratedCopy>;
      if (parsed.name && parsed.description && parsed.shortDescription) {
        return {
          name: parsed.name.slice(0, 80),
          shortDescription: parsed.shortDescription.slice(0, 160),
          description: parsed.description.slice(0, 700),
          generator: 'llm',
        };
      }
    }
  } catch {
    /* SDK unavailable — fallback below */
  }
  return null;
}

// ---------------- Deterministic fallback ----------------

const CATEGORY_LABELS: Record<string, string> = {
  lighting: 'Lamp',
  'wall-panels': 'Wall Panel',
  decoration: 'Decorative Accent',
  garden: 'Garden Accent',
  outdoor: 'Outdoor Piece',
  planters: 'Planter',
  'outdoor-privacy': 'Outdoor Screen',
  organisation: 'Storage Piece',
  'kitchen-dining': 'Table Essential',
  'gadgets-smart-home': 'Smart Home Piece',
  accessories: 'Home Accessory',
};

const SHAPE_BY_CATEGORY: Record<string, string[]> = {
  lighting: ['Glow', 'Ambient', 'Halo', 'Beacon'],
  'wall-panels': ['Texture', 'Slats', 'Rhythm', 'Relief'],
  decoration: ['Form', 'Curve', 'Still', 'Echo'],
  garden: ['Glow', 'Hearth', 'Bloom', 'Nest'],
  outdoor: ['Terrace', 'Haven', 'Breeze', 'Shade'],
  planters: ['Vessel', 'Planter', 'Pot', 'Basin'],
  'outdoor-privacy': ['Screen', 'Shield', 'Veil', 'Panel'],
  organisation: ['Keep', 'Hold', 'Stack', 'Tidy'],
  'kitchen-dining': ['Serve', 'Table', 'Share', 'Gather'],
  'gadgets-smart-home': ['Pulse', 'Sense', 'Glow', 'Smart'],
  accessories: ['Touch', 'Soft', 'Layer', 'Weave'],
};

const OPENERS = [
  'Bring quiet character into the home with',
  'A considered take on everyday living:',
  'Designed for calmer corners,',
  'With an easy, lived-in feel,',
  'A soft, grounded presence —',
  'Made for slow mornings and long evenings,',
  'Understated and adaptable,',
];

const CLOSERS_BY_SPACE: Record<string, string> = {
  'living-room': 'a natural fit for living rooms and reading corners.',
  bedroom: 'an easy match for calm, restful bedrooms.',
  kitchen: 'equally at home in kitchens and dining corners.',
  garden: 'made for gardens, patios and quiet outdoor corners.',
  terrace: 'a natural addition to terraces and covered outdoor spots.',
  balcony: 'well suited to balconies and compact outdoor spaces.',
  'outdoor-lounge': 'made for relaxed outdoor lounging.',
  entrance: 'a welcoming touch for entrances and hallways.',
  'home-office': 'a grounding detail for home offices.',
  dining: 'a considered finishing touch for dining tables.',
  bathroom: 'suited to bright, well-ventilated spaces.',
  patio: 'at ease on patios and sheltered outdoor settings.',
};

function templateCopy(input: CopyInput): GeneratedCopy {
  const f = input.facts;
  const label = f.typeHint ? titleCase(f.typeHint) : (CATEGORY_LABELS[f.category] ?? 'Home Piece');
  const shapes = SHAPE_BY_CATEGORY[f.category] ?? ['Piece'];
  const materialWord = f.material ?? '';
  const colourWord = f.colour ?? '';

  const nameParts = [materialWord, colourWord && materialWord.toLowerCase() !== colourWord.toLowerCase() ? colourWord : '', shapes[Math.abs(hash(label + materialWord + colourWord)) % shapes.length]].filter(Boolean);
  const name = `${nameParts.join(' ')} ${label}`;

  const opener = OPENERS[Math.abs(hash(name)) % OPENERS.length];
  const space = f.spaces[0] ?? 'living-room';
  const closer = CLOSERS_BY_SPACE[space] ?? 'an easy fit for everyday spaces.';

  const factBits: string[] = [];
  if (materialWord) factBits.push(`crafted in ${materialWord.toLowerCase()}`);
  if (f.dimsText) factBits.push(`measuring ${f.dimsText}`);
  if (f.isOutdoor) factBits.push('intended for outdoor use');
  if (f.isBattery) factBits.push('battery powered for flexible placement');
  const mid = factBits.length > 0 ? `, ${factBits.join(' and ')}` : '';

  const variantLine =
    f.variantNames.length > 1
      ? ` Available in several options: ${f.variantNames.slice(0, 4).join(', ')}.`
      : '';

  const shortDescription = `${name} — ${materialWord ? `${materialWord.toLowerCase()} ` : ''}${f.category.replace(/-/g, ' ')} for ${space.replace(/-/g, ' ')}.`.slice(0, 150);

  return {
    name: name.slice(0, 80),
    shortDescription,
    description: `${opener} this ${f.category.replace(/-/g, ' ')}${mid}. ${closer.charAt(0).toUpperCase()}${closer.slice(1)}${variantLine}`,
    generator: 'template',
  };
}

function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase()).slice(0, 48);
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}

// ---------------- Public API ----------------

export async function generateCopy(input: CopyInput): Promise<GeneratedCopy> {
  const sig = factsSignature(input);
  if (COPY_CACHE[sig]) return COPY_CACHE[sig];

  let copy: GeneratedCopy | null = null;
  if (V2_CONFIG.copy.useLlm) {
    copy = await llmCopy(input);
  }
  if (!copy) copy = templateCopy(input);

  COPY_CACHE[sig] = copy;
  saveCopyCache(); // flush per generation — interrupted runs keep all progress
  return copy;
}

export function flushCopyCache(): void {
  saveCopyCache();
}
