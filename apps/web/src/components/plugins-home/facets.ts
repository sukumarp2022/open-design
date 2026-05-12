// Facet derivation for the Plugins home section.
//
// The filter is a single-axis workflow picker. It intentionally
// summarizes the Home hero rail's mental model instead of exposing raw
// manifest modes or every concrete artifact kind:
//
//   Import · Create · Export · Refine · Extend
//
// Those five lanes describe the platform loop: bring upstream sources
// into Open Design, create new artifacts, ship downstream framework
// handoffs, improve existing work, and extend the system with new
// plugins. Concrete things like Slides, Prototype, React, or Figma
// remain searchable card metadata instead of becoming duplicate tabs
// beside their parent lane.
//
// Each plugin belongs to at most one lane. A second, scoped subcategory
// row appears inside the active lane so Create can still expose the
// accumulated Prototype / Slides / Design system / Media buckets without
// making them peers of Create.
//
// Counts in each category reflect the catalog *as a whole*, not the
// post-filter slice. We deliberately avoid recomputing counts after
// a selection because per-axis counts that "go to zero" as the user
// clicks make the row visually noisy and obscure how the overall
// catalog is shaped.

import type { InstalledPluginRecord } from '@open-design/contracts';

export type FacetAxis = 'category' | 'subcategory';

export interface FacetOption {
  slug: string;
  label: string;
  count: number;
}

export interface FacetCatalog {
  category: FacetOption[];
  subcategory: Record<string, FacetOption[]>;
}

export interface FacetSelection {
  category: string | null;
  subcategory: string | null;
}

interface CategoryDef {
  slug: string;
  label: string;
  test: (record: InstalledPluginRecord) => boolean;
}

interface SubcategoryDef extends CategoryDef {
  parent: string;
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

const EXTEND_TESTS = [
  byAnySlug('plugin-authoring', 'create-plugin', 'extension', 'marketplace', 'community-plugin'),
];

const GENERATE_TESTS = [
  byTaskKind('new-generation'),
  byAnySlug('generate', 'generation', 'new-generation', 'media-generation'),
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

const REFINE_TESTS = [
  byTaskKind('tune-collab'),
  byAnySlug('tune-collab', 'refine', 'improve', 'critique', 'review', 'patch-edit'),
];

function isSourcePlugin(record: InstalledPluginRecord): boolean {
  return matchesAny(record, SOURCE_TESTS);
}

function isExportPlugin(record: InstalledPluginRecord): boolean {
  return matchesAny(record, EXPORT_TESTS);
}

function isExtendPlugin(record: InstalledPluginRecord): boolean {
  return matchesAny(record, EXTEND_TESTS);
}

function isRefinePlugin(record: InstalledPluginRecord): boolean {
  return matchesAny(record, REFINE_TESTS) && !isExportPlugin(record);
}

function isCreatePlugin(record: InstalledPluginRecord): boolean {
  return matchesAny(record, GENERATE_TESTS) && !isExtendPlugin(record);
}

// Curated workflow list. Keep this intentionally small: these are
// semantic lanes, not artifact kinds or framework names.
const PRIMARY_CATEGORIES: readonly CategoryDef[] = [
  { slug: 'import', label: 'Import', test: isSourcePlugin },
  { slug: 'create', label: 'Create', test: isCreatePlugin },
  { slug: 'export', label: 'Export', test: isExportPlugin },
  { slug: 'refine', label: 'Refine', test: isRefinePlugin },
  { slug: 'extend', label: 'Extend', test: isExtendPlugin },
];

// Scoped child buckets. These are deliberately parented so the row can
// say "Create" first, then reveal the user's accumulated concrete modes
// only after that lane is active.
const SUBCATEGORIES: readonly SubcategoryDef[] = [
  { parent: 'import', slug: 'from-figma', label: 'Figma', test: byTaskKind('figma-migration') },
  { parent: 'import', slug: 'from-code', label: 'Code / folder', test: byTaskKind('code-migration') },
  { parent: 'create', slug: 'prototype', label: 'Prototype', test: byMode('prototype') },
  { parent: 'create', slug: 'deck', label: 'Slides', test: byMode('deck') },
  { parent: 'create', slug: 'design-system', label: 'Design system', test: byMode('design-system') },
  { parent: 'create', slug: 'hyperframes', label: 'HyperFrames', test: byAnySlug('hyperframes') },
  { parent: 'create', slug: 'image', label: 'Image', test: byMode('image') },
  { parent: 'create', slug: 'video', label: 'Video', test: byMode('video') },
  { parent: 'create', slug: 'audio', label: 'Audio', test: byMode('audio') },
  { parent: 'export', slug: 'nextjs', label: 'Next.js', test: byAnySlug('next', 'nextjs') },
  { parent: 'export', slug: 'react', label: 'React', test: byAnySlug('react', 'reactjs') },
  { parent: 'export', slug: 'vue', label: 'Vue', test: byAnySlug('vue', 'vuejs') },
  { parent: 'refine', slug: 'tune', label: 'Tune', test: byAnySlug('tune-collab') },
  { parent: 'refine', slug: 'review', label: 'Review', test: byAnySlug('critique', 'review', 'diff-review') },
  { parent: 'extend', slug: 'plugin-authoring', label: 'Plugin authoring', test: byAnySlug('plugin-authoring') },
];

function extractPrimaryCategory(record: InstalledPluginRecord): string | null {
  return PRIMARY_CATEGORIES.find((c) => c.test(record))?.slug ?? null;
}

// Per-plugin category derivation. Returns at most one curated primary
// category, preserving display order.
export function extractCategories(record: InstalledPluginRecord): string[] {
  const primary = extractPrimaryCategory(record);
  return primary ? [primary] : [];
}

export function extractSubcategories(record: InstalledPluginRecord, parent?: string | null): string[] {
  const primary = parent ?? extractPrimaryCategory(record);
  if (!primary) return [];
  const match = SUBCATEGORIES.find((c) => c.parent === primary && c.test(record));
  return match ? [match.slug] : [];
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

export function buildSubcategoryCatalog(plugins: InstalledPluginRecord[]): Record<string, FacetOption[]> {
  const counts = new Map<string, number>();
  for (const p of plugins) {
    const parent = extractPrimaryCategory(p);
    if (!parent) continue;
    for (const slug of extractSubcategories(p, parent)) {
      counts.set(`${parent}:${slug}`, (counts.get(`${parent}:${slug}`) ?? 0) + 1);
    }
  }
  return PRIMARY_CATEGORIES.reduce<Record<string, FacetOption[]>>((acc, category) => {
    const options = SUBCATEGORIES.filter((c) => c.parent === category.slug)
      .map((c) => ({
        slug: c.slug,
        label: c.label,
        count: counts.get(`${category.slug}:${c.slug}`) ?? 0,
      }))
      .filter((opt) => opt.count > 0);
    if (options.length > 0) acc[category.slug] = options;
    return acc;
  }, {});
}

export function buildFacetCatalog(plugins: InstalledPluginRecord[]): FacetCatalog {
  return {
    category: buildCategoryCatalog(plugins),
    subcategory: buildSubcategoryCatalog(plugins),
  };
}

export function applyFacetSelection(
  plugins: InstalledPluginRecord[],
  selection: FacetSelection,
): InstalledPluginRecord[] {
  if (!selection.category) return plugins;
  const want = selection.category;
  const inCategory = plugins.filter((p) => extractCategories(p).includes(want));
  if (!selection.subcategory) return inCategory;
  return inCategory.filter((p) => extractSubcategories(p, want).includes(selection.subcategory!));
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
  category: 'create',
  subcategory: null,
};

export function resolveDefaultSelection(catalog: FacetCatalog): FacetSelection {
  const wantCategory = PREFERRED_DEFAULT_SELECTION.category;
  const hasCategory = wantCategory
    ? catalog.category.some((o) => o.slug === wantCategory)
    : true;
  if (hasCategory) return PREFERRED_DEFAULT_SELECTION;
  return { category: null, subcategory: null };
}
