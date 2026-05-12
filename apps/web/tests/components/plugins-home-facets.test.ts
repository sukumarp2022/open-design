// Facet derivation contract for the plugins-home filter row. The
// home section is driven by a single curated workflow axis (Import /
// Create / Export / Refine / Extend). These tests lock the per-record
// category extraction, the catalog build (preserves curated order,
// drops empty buckets), and the selection-based filtering so the
// manifest fields the catalog depends on don't silently drift.

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
  it('maps generation modes to the single Create lane', () => {
    expect(extractCategories(fixture({ id: 'a', od: { mode: 'deck' } }))).toEqual(['create']);
    expect(extractCategories(fixture({ id: 'b', od: { mode: 'prototype' } }))).toEqual(['create']);
    expect(extractCategories(fixture({ id: 'c', od: { mode: 'design-system' } }))).toEqual(['create']);
    expect(extractCategories(fixture({ id: 'd', od: { mode: 'image' } }))).toEqual(['create']);
    expect(extractCategories(fixture({ id: 'e', od: { mode: 'video' } }))).toEqual(['create']);
    expect(extractCategories(fixture({ id: 'f', od: { mode: 'audio' } }))).toEqual(['create']);
  });

  it('maps workflow scenario plugins to a single semantic lane', () => {
    expect(
      extractCategories(fixture({ id: 'figma', od: { taskKind: 'figma-migration', mode: 'scenario' } })),
    ).toEqual(['import']);
    expect(
      extractCategories(fixture({ id: 'folder', od: { taskKind: 'code-migration', mode: 'scenario' } })),
    ).toEqual(['import']);
    expect(
      extractCategories(fixture({ id: 'new', od: { taskKind: 'new-generation', mode: 'scenario' } })),
    ).toEqual(['create']);
    expect(
      extractCategories(fixture({ id: 'react-export', tags: ['export', 'react'], od: { mode: 'export' } })),
    ).toEqual(['export']);
    expect(
      extractCategories(fixture({ id: 'tune', od: { taskKind: 'tune-collab', mode: 'scenario' } })),
    ).toEqual(['refine']);
    expect(
      extractCategories(fixture({ id: 'author', tags: ['plugin-authoring'], od: { taskKind: 'new-generation', mode: 'scenario' } })),
    ).toEqual(['extend']);
  });

  it('keeps concrete create types under Create instead of duplicating child tabs', () => {
    const f = extractCategories(
      fixture({ id: 'a', tags: ['hyperframes', 'cinematic'], od: { mode: 'video' } }),
    );
    expect(f).toEqual(['create']);
  });

  it('returns no curated categories for plugins outside the shortlist', () => {
    expect(extractCategories(fixture({ id: 'a', od: { mode: 'utility' } }))).toEqual([]);
    expect(extractCategories(fixture({ id: 'b', od: { mode: 'template' } }))).toEqual([]);
    expect(extractCategories(fixture({ id: 'c', od: { mode: 'scenario' } }))).toEqual([]);
    expect(extractCategories(fixture({ id: 'd', od: {} }))).toEqual([]);
  });

  it('normalises mode casing / formatting via slugify before matching', () => {
    expect(extractCategories(fixture({ id: 'a', od: { mode: 'Design System' } }))).toEqual(['create']);
    expect(extractCategories(fixture({ id: 'b', od: { mode: 'design_system' } }))).toEqual(['create']);
  });
});

describe('buildFacetCatalog', () => {
  it('produces a single category axis with curated order preserved and empty buckets dropped', () => {
    const plugins = [
      fixture({ id: 'source', od: { taskKind: 'figma-migration', mode: 'scenario' } }),
      fixture({ id: 'a', od: { mode: 'design-system' } }),
      fixture({ id: 'b', od: { mode: 'design-system' } }),
      fixture({ id: 'c', od: { mode: 'deck' } }),
      fixture({ id: 'd', od: { mode: 'image' } }),
      fixture({ id: 'e', od: { mode: 'video' } }),
      fixture({ id: 'f', tags: ['hyperframes'], od: { mode: 'video' } }),
      fixture({ id: 'react-export', tags: ['export', 'react'], od: { mode: 'export' } }),
      fixture({ id: 'tune', od: { taskKind: 'tune-collab', mode: 'scenario' } }),
      fixture({ id: 'author', tags: ['plugin-authoring'], od: { taskKind: 'new-generation', mode: 'scenario' } }),
      // Plugins outside the shortlist do not surface as filter pills.
      fixture({ id: 'g', od: { mode: 'utility' } }),
    ];
    const catalog = buildFacetCatalog(plugins);
    expect(catalog.category.map((o) => o.slug)).toEqual([
      'import',
      'create',
      'export',
      'refine',
      'extend',
    ]);
    expect(catalog.category.find((o) => o.slug === 'create')?.count).toBe(6);
    expect(catalog.category.find((o) => o.slug === 'import')?.count).toBe(1);
    expect(catalog.category.find((o) => o.slug === 'export')?.count).toBe(1);
    expect(catalog.category.find((o) => o.slug === 'refine')?.count).toBe(1);
    expect(catalog.category.find((o) => o.slug === 'extend')?.count).toBe(1);
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
    fixture({ id: 'f', tags: ['export', 'react'], od: { mode: 'export' } }),
    fixture({ id: 'g', od: { taskKind: 'code-migration', mode: 'scenario' } }),
  ];

  it('returns everything when no category is selected', () => {
    expect(
      applyFacetSelection(plugins, { category: null }).map((p) => p.id),
    ).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });

  it('filters by the selected category slug', () => {
    expect(
      applyFacetSelection(plugins, { category: 'create' }).map((p) => p.id),
    ).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(
      applyFacetSelection(plugins, { category: 'export' }).map((p) => p.id),
    ).toEqual(['f']);
    expect(
      applyFacetSelection(plugins, { category: 'import' }).map((p) => p.id),
    ).toEqual(['g']);
  });

  it('returns an empty list when no plugin matches the selected category', () => {
    expect(
      applyFacetSelection(plugins, { category: 'refine' }).map((p) => p.id),
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
