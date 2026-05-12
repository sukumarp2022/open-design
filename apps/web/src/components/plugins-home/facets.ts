// Facet derivation for the Plugins home section.
//
// The home filter row is a 3-axis faceted control modeled on the
// surface / type / scenario taxonomy plugin authors already populate
// in `open-design.json`:
//
//   - SURFACE  ← od.surface   (web / image / video / audio)
//   - TYPE     ← od.mode      (design-system / deck / prototype / …)
//   - SCENARIO ← od.scenario  (+ a tag whitelist for legacy plugins
//                              that omit the field)
//
// Centralising the derivation here keeps the categorisation hook pure
// and lets tests assert facet membership without touching React. The
// hook then composes selections across the three axes via AND.
//
// Notes for future maintainers:
//   - All axis values are `slugify`d so any fragment of free-form text
//     ("Design System", "design_system", "design-system") collapses to
//     a single bucket — both at derivation time AND when comparing
//     selections.
//   - Returning a fixed object shape (instead of `Record<string, …>`)
//     keeps the React render path branch-free and mirrors the three
//     pill rows the section paints 1:1.
//   - Counts in each row reflect the catalog *as a whole*, not the
//     post-filter slice. We deliberately avoid recomputing counts
//     after a selection because per-axis counts that "go to zero" as
//     the user clicks make the row visually noisy and obscure how the
//     overall catalog is shaped.

import type { InstalledPluginRecord } from '@open-design/contracts';

export type FacetAxis = 'surface' | 'type' | 'scenario';

export interface PluginFacets {
  surface: string[];
  type: string[];
  scenario: string[];
}

export interface FacetOption {
  slug: string;
  label: string;
  count: number;
}

export interface FacetCatalog {
  surface: FacetOption[];
  type: FacetOption[];
  scenario: FacetOption[];
}

// Tags that bubble up from low-level plugin metadata and never make
// for useful filter chips. Drop them at derivation time so they don't
// pollute the SCENARIO row (which falls back to tags when od.scenario
// is missing).
const NOISE = new Set<string>([
  'first-party',
  'third-party',
  'phase-7',
  'phase-1',
  'atom',
  'bundle',
  'scenario',
  'plugin',
  'untitled',
]);

// Curated SCENARIO vocabulary — a focused set of business / use-case
// tags so the SCENARIO row reads as a domain picker rather than a
// free-form tag cloud. Anything outside this set still surfaces via
// `od.scenario` (the manifest field) which is authored intentionally.
const SCENARIO_TAG_WHITELIST = new Set<string>([
  'engineering',
  'product',
  'design',
  'marketing',
  'sales',
  'finance',
  'hr',
  'operations',
  'education',
  'personal',
  'general',
  'creator',
  'healthcare',
  'planning',
  'legal',
  'support',
  'developer-tools',
  'e-commerce-retail',
  'media-consumer',
  'productivity-saas',
  'creative-artistic',
  'professional-corporate',
  'design-creative',
  'ai-llm',
  'social-media-post',
  'live',
  'live-artifacts',
  'orbit',
]);

const SURFACE_LABELS: Record<string, string> = {
  web: 'Web',
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
};

const TYPE_LABELS: Record<string, string> = {
  'design-system': 'Design system',
  deck: 'Deck',
  prototype: 'Prototype',
  template: 'Template',
  example: 'Example',
  utility: 'Utility',
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  scenario: 'Scenario',
};

const SCENARIO_LABELS: Record<string, string> = {
  engineering: 'Engineering',
  product: 'Product',
  design: 'Design',
  marketing: 'Marketing',
  sales: 'Sales',
  finance: 'Finance',
  hr: 'HR',
  operations: 'Operations',
  education: 'Education',
  personal: 'Personal',
  general: 'General',
  creator: 'Creator',
  healthcare: 'Healthcare',
  planning: 'Planning',
  legal: 'Legal',
  support: 'Support',
  'developer-tools': 'Developer tools',
  'e-commerce-retail': 'E-commerce',
  'media-consumer': 'Media & consumer',
  'productivity-saas': 'Productivity',
  'creative-artistic': 'Creative',
  'professional-corporate': 'Corporate',
  'design-creative': 'Design & creative',
  'ai-llm': 'AI & LLM',
  'social-media-post': 'Social',
  live: 'Live',
  'live-artifacts': 'Live artifact',
  orbit: 'Orbit',
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function humanise(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function manifestField(record: InstalledPluginRecord, key: string): string | undefined {
  const od = (record.manifest?.od ?? {}) as Record<string, unknown>;
  const v = od[key];
  return typeof v === 'string' ? v : undefined;
}

function manifestTags(record: InstalledPluginRecord): string[] {
  const raw = record.manifest?.tags ?? [];
  return raw
    .map((t) => slugify(String(t)))
    .filter((t) => t && !NOISE.has(t));
}

// Per-plugin facet derivation. The result lists each axis as a
// possibly-empty array because:
//   - SURFACE may be missing on legacy manifests (we fall back to
//     scanning tags for one of the four known surface words).
//   - TYPE is single-valued in our manifests but represented as an
//     array so the filter compose path can stay uniform.
//   - SCENARIO can be multi-valued: `od.scenario` plus any tag in
//     SCENARIO_TAG_WHITELIST.
export function extractFacets(record: InstalledPluginRecord): PluginFacets {
  const surface = new Set<string>();
  const type = new Set<string>();
  const scenario = new Set<string>();

  const surfaceRaw = manifestField(record, 'surface');
  if (surfaceRaw) {
    const s = slugify(surfaceRaw);
    if (SURFACE_LABELS[s]) surface.add(s);
  }

  const tags = manifestTags(record);
  if (surface.size === 0) {
    for (const t of tags) {
      if (SURFACE_LABELS[t]) {
        surface.add(t);
        break;
      }
    }
  }

  const modeRaw = manifestField(record, 'mode');
  if (modeRaw) {
    const m = slugify(modeRaw);
    if (m && !NOISE.has(m)) type.add(m);
  }

  const scenarioRaw = manifestField(record, 'scenario');
  if (scenarioRaw) {
    const s = slugify(scenarioRaw);
    if (s && !NOISE.has(s)) scenario.add(s);
  }
  for (const t of tags) {
    if (SCENARIO_TAG_WHITELIST.has(t)) scenario.add(t);
  }

  return {
    surface: [...surface],
    type: [...type],
    scenario: [...scenario],
  };
}

function labelFor(axis: FacetAxis, slug: string): string {
  if (axis === 'surface') return SURFACE_LABELS[slug] ?? humanise(slug);
  if (axis === 'type') return TYPE_LABELS[slug] ?? humanise(slug);
  return SCENARIO_LABELS[slug] ?? humanise(slug);
}

function buildAxis(
  axis: FacetAxis,
  plugins: InstalledPluginRecord[],
): FacetOption[] {
  const counts = new Map<string, number>();
  for (const p of plugins) {
    const facets = extractFacets(p);
    for (const slug of facets[axis]) {
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .map(([slug, count]) => ({ slug, label: labelFor(axis, slug), count }));
}

export function buildFacetCatalog(plugins: InstalledPluginRecord[]): FacetCatalog {
  return {
    surface: buildAxis('surface', plugins),
    type: buildAxis('type', plugins),
    scenario: buildAxis('scenario', plugins),
  };
}

// Filter a plugin set by an active selection in each axis. `null` in
// any axis means "no filter on this axis" (the axis row's "All" pill).
// Filters compose via AND across axes.
export interface FacetSelection {
  surface: string | null;
  type: string | null;
  scenario: string | null;
}

export function applyFacetSelection(
  plugins: InstalledPluginRecord[],
  selection: FacetSelection,
): InstalledPluginRecord[] {
  if (!selection.surface && !selection.type && !selection.scenario) return plugins;
  return plugins.filter((p) => {
    const facets = extractFacets(p);
    if (selection.surface && !facets.surface.includes(selection.surface)) return false;
    if (selection.type && !facets.type.includes(selection.type)) return false;
    if (selection.scenario && !facets.scenario.includes(selection.scenario)) return false;
    return true;
  });
}

export function isFeaturedPlugin(record: InstalledPluginRecord): boolean {
  const od = (record.manifest?.od ?? {}) as Record<string, unknown>;
  return od.featured === true;
}
