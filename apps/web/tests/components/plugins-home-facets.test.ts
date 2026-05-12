// Facet derivation contract for the plugins-home filter rows. The
// home section is now driven by a 3-axis SURFACE / TYPE / SCENARIO
// model rather than a single tag row; these tests lock the per-axis
// extraction + AND composition so the manifest fields the catalog
// depends on don't silently drift.

import { describe, expect, it } from 'vitest';
import type { InstalledPluginRecord } from '@open-design/contracts';
import {
  applyFacetSelection,
  buildFacetCatalog,
  extractFacets,
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

describe('extractFacets', () => {
  it('reads SURFACE from od.surface', () => {
    const f = extractFacets(
      fixture({ id: 'a', od: { surface: 'web', mode: 'design-system', scenario: 'design' } }),
    );
    expect(f.surface).toEqual(['web']);
  });

  it('falls back to a known surface in tags when od.surface is missing', () => {
    const f = extractFacets(
      fixture({ id: 'a', tags: ['marketing', 'image', 'untitled'], od: { mode: 'image' } }),
    );
    expect(f.surface).toEqual(['image']);
  });

  it('reads TYPE from od.mode and SCENARIO from od.scenario', () => {
    const f = extractFacets(
      fixture({ id: 'a', od: { surface: 'web', mode: 'design-system', scenario: 'design' } }),
    );
    expect(f.type).toEqual(['design-system']);
    expect(f.scenario).toEqual(['design']);
  });

  it('augments SCENARIO with whitelisted role tags', () => {
    const f = extractFacets(
      fixture({
        id: 'a',
        tags: ['marketing', 'engineering', 'random-noise'],
        od: { surface: 'web', mode: 'prototype', scenario: 'product' },
      }),
    );
    expect(f.scenario).toEqual(expect.arrayContaining(['product', 'marketing', 'engineering']));
    expect(f.scenario).not.toContain('random-noise');
  });

  it('drops noise tags from the SCENARIO axis', () => {
    const f = extractFacets(
      fixture({
        id: 'a',
        tags: ['first-party', 'phase-7', 'untitled', 'marketing'],
        od: { surface: 'web', mode: 'deck' },
      }),
    );
    expect(f.scenario).toEqual(['marketing']);
  });
});

describe('buildFacetCatalog', () => {
  it('produces three axes sorted by count desc with stable secondary order', () => {
    const plugins = [
      fixture({ id: 'a', od: { surface: 'web', mode: 'design-system', scenario: 'design' } }),
      fixture({ id: 'b', od: { surface: 'web', mode: 'design-system', scenario: 'design' } }),
      fixture({ id: 'c', od: { surface: 'image', mode: 'image', scenario: 'marketing' } }),
      fixture({ id: 'd', od: { surface: 'video', mode: 'video', scenario: 'marketing' } }),
    ];
    const catalog = buildFacetCatalog(plugins);
    expect(catalog.surface.map((o) => o.slug)).toEqual(['web', 'image', 'video']);
    expect(catalog.surface[0]).toMatchObject({ slug: 'web', label: 'Web', count: 2 });
    expect(catalog.type.map((o) => o.slug)[0]).toBe('design-system');
    expect(catalog.scenario.map((o) => o.slug)).toContain('design');
    expect(catalog.scenario.map((o) => o.slug)).toContain('marketing');
  });

  it('humanises unknown slugs in the SCENARIO axis labels', () => {
    const catalog = buildFacetCatalog([
      fixture({ id: 'a', od: { surface: 'web', mode: 'prototype', scenario: 'mocktail-bar' } }),
    ]);
    expect(catalog.scenario[0]?.label).toBe('Mocktail Bar');
  });
});

describe('applyFacetSelection', () => {
  const plugins = [
    fixture({ id: 'a', od: { surface: 'web', mode: 'design-system', scenario: 'design' } }),
    fixture({ id: 'b', od: { surface: 'web', mode: 'prototype', scenario: 'marketing' } }),
    fixture({ id: 'c', od: { surface: 'image', mode: 'image', scenario: 'marketing' } }),
    fixture({ id: 'd', od: { surface: 'video', mode: 'video', scenario: 'engineering' } }),
  ];

  it('returns everything when no axis is selected', () => {
    expect(
      applyFacetSelection(plugins, { surface: null, type: null, scenario: null }).map((p) => p.id),
    ).toEqual(['a', 'b', 'c', 'd']);
  });

  it('AND-composes selections across axes', () => {
    const out = applyFacetSelection(plugins, {
      surface: 'web',
      type: null,
      scenario: 'marketing',
    }).map((p) => p.id);
    expect(out).toEqual(['b']);
  });

  it('returns an empty list when no plugin satisfies the selection', () => {
    const out = applyFacetSelection(plugins, {
      surface: 'video',
      type: null,
      scenario: 'design',
    });
    expect(out).toEqual([]);
  });
});

describe('isFeaturedPlugin', () => {
  it('returns true only for od.featured === true (strict)', () => {
    expect(isFeaturedPlugin(fixture({ id: 'a', od: { featured: true } }))).toBe(true);
    expect(isFeaturedPlugin(fixture({ id: 'b', od: { featured: 'true' } }))).toBe(false);
    expect(isFeaturedPlugin(fixture({ id: 'c' }))).toBe(false);
  });
});
