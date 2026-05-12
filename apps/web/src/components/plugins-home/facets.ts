// Facet derivation for the Plugins home section.
//
// The home filter is a single-axis "category" picker over a curated
// list of the major buckets users actually browse by:
//
//   Deck · Prototype · Design system · HyperFrames · Video · Image · Audio
//
// Categories are NOT a free-form taxonomy — they are a small, hand
// authored shortlist so the filter row stays one line and stays
// pickable. Anything outside this list (template / utility / scenario
// / role tags / domain tags / etc.) is intentionally not surfaced as
// a filter; that metadata still lives on each plugin's card and
// detail surface so users can drill in once they pick a category.
//
// Most categories map 1:1 to the manifest's `od.mode` field. The
// HyperFrames category is the one exception: it is a tag-driven
// virtual bucket because HyperFrames plugins all carry mode=video
// and we want to expose them as a discoverable specialised slice
// without flattening them into the generic "Video" pile.
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

function manifestTagSlugs(record: InstalledPluginRecord): string[] {
  const raw = record.manifest?.tags ?? [];
  return raw.map((t) => slugify(String(t))).filter(Boolean);
}

function byMode(mode: string): (record: InstalledPluginRecord) => boolean {
  return (record) => {
    const v = manifestField(record, 'mode');
    return typeof v === 'string' && slugify(v) === mode;
  };
}

function byTag(tag: string): (record: InstalledPluginRecord) => boolean {
  return (record) => manifestTagSlugs(record).includes(tag);
}

// Curated category list. Order is the display order — keep the
// creative scenarios (Deck, Prototype, Design system) up front so
// the eye lands on them first, with the media-generation buckets
// (HyperFrames, Video, Image, Audio) trailing.
//
// HyperFrames is intentionally listed BEFORE Video so the
// specialised motion-graphics bucket is discoverable instead of
// being absorbed into the generic Video count. A plugin tagged
// `hyperframes` will appear in BOTH the HyperFrames and Video
// counts — that's expected: it lets users either drill into the
// specialised bucket or browse all videos including HyperFrames.
const PRIMARY_CATEGORIES: readonly CategoryDef[] = [
  { slug: 'deck', label: 'Deck', test: byMode('deck') },
  { slug: 'prototype', label: 'Prototype', test: byMode('prototype') },
  { slug: 'design-system', label: 'Design system', test: byMode('design-system') },
  { slug: 'hyperframes', label: 'HyperFrames', test: byTag('hyperframes') },
  { slug: 'video', label: 'Video', test: byMode('video') },
  { slug: 'image', label: 'Image', test: byMode('image') },
  { slug: 'audio', label: 'Audio', test: byMode('audio') },
];

// Per-plugin category derivation. Returns the curated category
// slugs the plugin belongs to (preserving curated order). The
// filter UI only ever needs the category slugs; finer-grained
// metadata (surface, scenario, role tags) is not exposed as a
// filter and is rendered on each plugin card instead.
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

// Smart default selection. The Plugins home shipped with no preselection,
// which left first-time visitors staring at an unfiltered grid mixing
// design-system patches with cinematic decks. We now nudge them into
// the most representative creative slice (Deck) when it exists in the
// live catalog. We deliberately fall back to no default when the slug
// is missing so test fixtures and degraded catalogs render cleanly.
export const PREFERRED_DEFAULT_SELECTION: FacetSelection = {
  category: 'deck',
};

export function resolveDefaultSelection(catalog: FacetCatalog): FacetSelection {
  const wantCategory = PREFERRED_DEFAULT_SELECTION.category;
  const hasCategory = wantCategory
    ? catalog.category.some((o) => o.slug === wantCategory)
    : true;
  if (hasCategory) return PREFERRED_DEFAULT_SELECTION;
  return { category: null };
}
