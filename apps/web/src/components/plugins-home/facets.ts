// Facet derivation for the Plugins home section.
//
// The filter is a single-axis workflow picker. It intentionally mirrors
// the Home hero rail's mental model instead of exposing raw manifest
// modes:
//
//   From source · Generate · Export · From Figma · From folder · ...
//
// The first three buckets describe the platform loop: migrate upstream
// sources into Open Design, generate new artifacts, then hand artifacts
// off to downstream frameworks. The remaining buckets are concrete
// starter plugins inside that loop, so official plugins can seed the
// catalog while community plugins can join later by using tags, task
// kinds, modes, or pipeline atoms.
//
// Counts reflect overlapping membership. For example, an export plugin
// can count under both Export and React, and a HyperFrames plugin can
// count under both Generate and Video. This is deliberate: workflow
// categories are browse affordances, not a mutually-exclusive taxonomy.
//
// Counts in each category reflect the catalog *as a whole*, not the
// post-filter slice. We deliberately avoid recomputing counts after
// a selection because per-axis counts that "go to zero" as the user
// clicks make the row visually noisy and obscure how the overall
// catalog is shaped.

import type { InstalledPluginRecord } from '@open-design/contracts';

export type FacetAxis = 'category';

export interface FacetOption {
  slug: string;
  label: string;
  count: number;
}

export interface FacetCatalog {
  category: FacetOption[];
}

export interface FacetSelection {
  category: string | null;
}

interface CategoryDef {
  slug: string;
  label: string;
  test: (record: InstalledPluginRecord) => boolean;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function manifestField(record: InstalledPluginRecord, key: string): string | undefined {
  const od = (record.manifest?.od ?? {}) as Record<string, unknown>;
  const v = od[key];
  return typeof v === 'string' ? v : undefined;
}

function manifestTaskKind(record: InstalledPluginRecord): string | undefined {
  return manifestField(record, 'taskKind');
}

function manifestTagSlugs(record: InstalledPluginRecord): string[] {
  const raw = record.manifest?.tags ?? [];
  return raw.map((t) => slugify(String(t))).filter(Boolean);
}

function pipelineAtomSlugs(record: InstalledPluginRecord): string[] {
  const stages = record.manifest?.od?.pipeline?.stages ?? [];
  return stages.flatMap((stage) => stage.atoms.map(slugify));
}

function recordSlugs(record: InstalledPluginRecord): Set<string> {
  return new Set([
    slugify(record.id),
    slugify(record.manifest?.name ?? ''),
    slugify(record.title ?? ''),
    slugify(manifestTaskKind(record) ?? ''),
    slugify(manifestField(record, 'mode') ?? ''),
    slugify(manifestField(record, 'scenario') ?? ''),
    slugify(manifestField(record, 'surface') ?? ''),
    ...manifestTagSlugs(record),
    ...pipelineAtomSlugs(record),
  ].filter(Boolean));
}

function byMode(mode: string): (record: InstalledPluginRecord) => boolean {
  return (record) => {
    const v = manifestField(record, 'mode');
    return typeof v === 'string' && slugify(v) === mode;
  };
}

function hasAnySlug(record: InstalledPluginRecord, slugs: readonly string[]): boolean {
  const haystack = recordSlugs(record);
  return slugs.some((slug) => haystack.has(slug));
}

function byAnySlug(...slugs: string[]): (record: InstalledPluginRecord) => boolean {
  return (record) => hasAnySlug(record, slugs);
}

function byTaskKind(taskKind: string): (record: InstalledPluginRecord) => boolean {
  return (record) => slugify(manifestTaskKind(record) ?? '') === taskKind;
}

function matchesAny(record: InstalledPluginRecord, tests: Array<(record: InstalledPluginRecord) => boolean>): boolean {
  return tests.some((test) => test(record));
}

const SOURCE_TESTS = [
  byTaskKind('figma-migration'),
  byTaskKind('code-migration'),
  byAnySlug('import', 'source-import', 'from-source', 'migration', 'figma-migration', 'code-migration'),
];

const GENERATE_TESTS = [
  byTaskKind('new-generation'),
  byAnySlug('generate', 'generation', 'new-generation', 'media-generation', 'plugin-authoring'),
  byMode('deck'),
  byMode('prototype'),
  byMode('design-system'),
  byMode('image'),
  byMode('video'),
  byMode('audio'),
];

const EXPORT_TESTS = [
  byAnySlug('export', 'downstream', 'handoff', 'react', 'reactjs', 'next', 'nextjs', 'vue', 'vuejs'),
];

// Curated workflow list. The top-level loop comes first, followed by
// specific starter buckets that mirror the Home rail and the requested
// downstream framework targets.
const PRIMARY_CATEGORIES: readonly CategoryDef[] = [
  { slug: 'from-source', label: 'From source', test: (record) => matchesAny(record, SOURCE_TESTS) },
  { slug: 'generate', label: 'Generate', test: (record) => matchesAny(record, GENERATE_TESTS) },
  { slug: 'export', label: 'Export', test: (record) => matchesAny(record, EXPORT_TESTS) },
  { slug: 'from-figma', label: 'From Figma', test: byTaskKind('figma-migration') },
  { slug: 'from-folder', label: 'From folder', test: byTaskKind('code-migration') },
  { slug: 'create-plugin', label: 'Create plugin', test: byAnySlug('plugin-authoring') },
  { slug: 'deck', label: 'Slides', test: byMode('deck') },
  { slug: 'prototype', label: 'Prototype', test: byMode('prototype') },
  { slug: 'design-system', label: 'Design system', test: byMode('design-system') },
  { slug: 'hyperframes', label: 'HyperFrames', test: byAnySlug('hyperframes') },
  { slug: 'video', label: 'Video', test: byMode('video') },
  { slug: 'image', label: 'Image', test: byMode('image') },
  { slug: 'audio', label: 'Audio', test: byMode('audio') },
  { slug: 'react', label: 'React', test: byAnySlug('react', 'reactjs') },
  { slug: 'nextjs', label: 'Next.js', test: byAnySlug('next', 'nextjs') },
  { slug: 'vue', label: 'Vue', test: byAnySlug('vue', 'vuejs') },
];

// Per-plugin category derivation. Returns the curated category slugs
// the plugin belongs to, preserving display order.
export function extractCategories(record: InstalledPluginRecord): string[] {
  return PRIMARY_CATEGORIES.filter((c) => c.test(record)).map((c) => c.slug);
}

export function buildCategoryCatalog(plugins: InstalledPluginRecord[]): FacetOption[] {
  const counts = new Map<string, number>();
  for (const p of plugins) {
    for (const slug of extractCategories(p)) {
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }
  return PRIMARY_CATEGORIES.map((c) => ({
    slug: c.slug,
    label: c.label,
    count: counts.get(c.slug) ?? 0,
  })).filter((opt) => opt.count > 0);
}

export function buildFacetCatalog(plugins: InstalledPluginRecord[]): FacetCatalog {
  return { category: buildCategoryCatalog(plugins) };
}

export function applyFacetSelection(
  plugins: InstalledPluginRecord[],
  selection: FacetSelection,
): InstalledPluginRecord[] {
  if (!selection.category) return plugins;
  const want = selection.category;
  return plugins.filter((p) => extractCategories(p).includes(want));
}

export function isFeaturedPlugin(record: InstalledPluginRecord): boolean {
  const od = (record.manifest?.od ?? {}) as Record<string, unknown>;
  return od.featured === true;
}

// Free-text search across the obvious user-facing surface area: title,
// description, id, and tags. Composed with the category selection via
// AND inside the hook so the search narrows whatever the user has
// already filtered to. Multi-word queries are required to all match
// somewhere in the haystack so phrase fragments like "design slides"
// don't surface unrelated plugins.
export function filterByQuery(
  plugins: InstalledPluginRecord[],
  query: string,
): InstalledPluginRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return plugins;
  const terms = q.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return plugins;
  return plugins.filter((p) => {
    const haystack = [
      p.title ?? '',
      p.id,
      p.manifest?.description ?? '',
      (p.manifest?.tags ?? []).join(' '),
    ]
      .join(' ')
      .toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}

// Smart default selection. Lead users into the broad creation lane so
// the first grid feels useful without hiding the source/import/export
// lanes one tap away.
export const PREFERRED_DEFAULT_SELECTION: FacetSelection = {
  category: 'generate',
};

export function resolveDefaultSelection(catalog: FacetCatalog): FacetSelection {
  const wantCategory = PREFERRED_DEFAULT_SELECTION.category;
  const hasCategory = wantCategory
    ? catalog.category.some((o) => o.slug === wantCategory)
    : true;
  if (hasCategory) return PREFERRED_DEFAULT_SELECTION;
  return { category: null };
}
