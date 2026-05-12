// Facet derivation contract for the plugins-home filter row. The
// home section is driven by a single curated "category" axis (Slides /
// Prototype / Design system / HyperFrames / Video / Image / Audio).
// These tests lock the per-record category extraction, the catalog
// build (preserves curated order, drops empty buckets), and the
// selection-based filtering so the manifest fields the catalog
// depends on don't silently drift.

import { describe, expect, it } from 'vitest';
import type { InstalledPluginRecord } from '@open-design/contracts';
import {
  applyFacetSelection,
  buildFacetCatalog,
  extractCategories,
  isFeaturedPlugin,
} from '../../src/components/plugins-home/facets';

function fixture(overrides: {
  id: string;
  title?: string;
  tags?: string[];
  od?: Record<string, unknown>;
}): InstalledPluginRecord {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    version: '0.1.0',
    sourceKind: 'bundled',
    source: '/tmp',
    trust: 'bundled',
    capabilitiesGranted: ['prompt:inject'],
    manifest: {
      name: overrides.id,
      version: '0.1.0',
      ...(overrides.tags ? { tags: overrides.tags } : {}),
      ...(overrides.od ? { od: overrides.od } : {}),
    },
    fsPath: '/tmp',
    installedAt: 0,
    updatedAt: 0,
  };
}

describe('extractCategories', () => {
  it('maps od.mode to the matching curated category', () => {
    expect(extractCategories(fixture({ id: 'a', od: { mode: 'deck' } }))).toEqual(['deck']);
    expect(extractCategories(fixture({ id: 'b', od: { mode: 'prototype' } }))).toEqual(['prototype']);
    expect(extractCategories(fixture({ id: 'c', od: { mode: 'design-system' } }))).toEqual(['design-system']);
    expect(extractCategories(fixture({ id: 'd', od: { mode: 'image' } }))).toEqual(['image']);
    expect(extractCategories(fixture({ id: 'e', od: { mode: 'video' } }))).toEqual(['video']);
    expect(extractCategories(fixture({ id: 'f', od: { mode: 'audio' } }))).toEqual(['audio']);
  });

  it('places hyperframes-tagged video plugins in BOTH HyperFrames and Video buckets', () => {
    const f = extractCategories(
      fixture({ id: 'a', tags: ['hyperframes', 'cinematic'], od: { mode: 'video' } }),
    );
    expect(f).toEqual(expect.arrayContaining(['hyperframes', 'video']));
    expect(f).toHaveLength(2);
  });

  it('returns no curated categories for plugins outside the shortlist', () => {
    expect(extractCategories(fixture({ id: 'a', od: { mode: 'utility' } }))).toEqual([]);
    expect(extractCategories(fixture({ id: 'b', od: { mode: 'template' } }))).toEqual([]);
    expect(extractCategories(fixture({ id: 'c', od: { mode: 'scenario' } }))).toEqual([]);
    expect(extractCategories(fixture({ id: 'd', od: {} }))).toEqual([]);
  });

  it('normalises mode casing / formatting via slugify before matching', () => {
    expect(extractCategories(fixture({ id: 'a', od: { mode: 'Design System' } }))).toEqual(['design-system']);
    expect(extractCategories(fixture({ id: 'b', od: { mode: 'design_system' } }))).toEqual(['design-system']);
  });
});

describe('buildFacetCatalog', () => {
  it('produces a single category axis with curated order preserved and empty buckets dropped', () => {
    const plugins = [
      fixture({ id: 'a', od: { mode: 'design-system' } }),
      fixture({ id: 'b', od: { mode: 'design-system' } }),
      fixture({ id: 'c', od: { mode: 'deck' } }),
      fixture({ id: 'd', od: { mode: 'image' } }),
      fixture({ id: 'e', od: { mode: 'video' } }),
      fixture({ id: 'f', tags: ['hyperframes'], od: { mode: 'video' } }),
      // Plugins outside the shortlist do not surface as filter pills.
      fixture({ id: 'g', od: { mode: 'utility' } }),
    ];
    const catalog = buildFacetCatalog(plugins);
    expect(catalog.category.map((o) => o.slug)).toEqual([
      'deck',
      'design-system',
      'hyperframes',
      'video',
      'image',
    ]);
    expect(catalog.category.find((o) => o.slug === 'design-system')?.count).toBe(2);
    // The hyperframes-tagged video plugin counts toward BOTH buckets.
    expect(catalog.category.find((o) => o.slug === 'hyperframes')?.count).toBe(1);
    expect(catalog.category.find((o) => o.slug === 'video')?.count).toBe(2);
  });

  it('returns an empty category axis when no plugin matches a curated bucket', () => {
    const catalog = buildFacetCatalog([
      fixture({ id: 'a', od: { mode: 'utility' } }),
      fixture({ id: 'b', od: { mode: 'template' } }),
    ]);
    expect(catalog.category).toEqual([]);
  });
});

describe('applyFacetSelection', () => {
  const plugins = [
    fixture({ id: 'a', od: { mode: 'design-system' } }),
    fixture({ id: 'b', od: { mode: 'prototype' } }),
    fixture({ id: 'c', od: { mode: 'image' } }),
    fixture({ id: 'd', od: { mode: 'video' } }),
    fixture({ id: 'e', tags: ['hyperframes'], od: { mode: 'video' } }),
  ];

  it('returns everything when no category is selected', () => {
    expect(
      applyFacetSelection(plugins, { category: null }).map((p) => p.id),
    ).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('filters by the selected category slug', () => {
    expect(
      applyFacetSelection(plugins, { category: 'design-system' }).map((p) => p.id),
    ).toEqual(['a']);
    expect(
      applyFacetSelection(plugins, { category: 'video' }).map((p) => p.id).sort(),
    ).toEqual(['d', 'e']);
  });

  it('returns the hyperframes subset when HyperFrames is picked', () => {
    expect(
      applyFacetSelection(plugins, { category: 'hyperframes' }).map((p) => p.id),
    ).toEqual(['e']);
  });

  it('returns an empty list when no plugin matches the selected category', () => {
    expect(
      applyFacetSelection(plugins, { category: 'audio' }).map((p) => p.id),
    ).toEqual([]);
  });
});

describe('isFeaturedPlugin', () => {
  it('returns true only for od.featured === true (strict)', () => {
    expect(isFeaturedPlugin(fixture({ id: 'a', od: { featured: true } }))).toBe(true);
    expect(isFeaturedPlugin(fixture({ id: 'b', od: { featured: 'true' } }))).toBe(false);
    expect(isFeaturedPlugin(fixture({ id: 'c' }))).toBe(false);
  });
});
