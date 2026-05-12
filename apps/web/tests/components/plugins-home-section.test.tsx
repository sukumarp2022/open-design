// @vitest-environment jsdom

// Plugins home section — UI contract.
//
// The section renders a single curated "category bar" (Deck /
// Prototype / Design system / HyperFrames / Video / Image / Audio).
// Picking a category filters the grid; the All pill clears the
// category filter. A Featured chip sits orthogonal to the row and
// overrides the category selection. This suite locks in:
//
//   1. The category row renders with All + the curated buckets that
//      have at least one plugin.
//   2. Picking a category filters the grid to plugins in that
//      bucket.
//   3. HyperFrames is a tag-driven bucket — picking it filters to
//      hyperframes-tagged plugins even though they share mode=video.
//   4. Featured chip overrides the category selection and only shows
//      curator-promoted plugins.

import { describe, expect, it, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { InstalledPluginRecord } from '@open-design/contracts';
import { PluginsHomeSection } from '../../src/components/PluginsHomeSection';

function makePlugin(overrides: {
  id: string;
  title?: string;
  tags?: string[];
  featured?: boolean;
  mode?: string;
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
      title: overrides.title ?? overrides.id,
      ...(overrides.tags ? { tags: overrides.tags } : {}),
      od: {
        kind: 'scenario',
        ...(overrides.mode ? { mode: overrides.mode } : {}),
        ...(overrides.featured ? { featured: true } : {}),
      },
    },
    fsPath: '/tmp',
    installedAt: 0,
    updatedAt: 0,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const sample: InstalledPluginRecord[] = [
  makePlugin({ id: 'a', mode: 'design-system' }),
  makePlugin({ id: 'b', mode: 'prototype' }),
  makePlugin({ id: 'c', mode: 'image' }),
  makePlugin({ id: 'd', mode: 'video' }),
  makePlugin({ id: 'e', mode: 'video', tags: ['hyperframes'] }),
  makePlugin({ id: 'f', mode: 'deck' }),
];

describe('PluginsHomeSection (category bar)', () => {
  it('renders a single category row with All + curated buckets', () => {
    render(
      <PluginsHomeSection
        plugins={sample}
        loading={false}
        activePluginId={null}
        pendingApplyId={null}
        onUse={() => {}}
        onOpenDetails={() => {}}
      />,
    );
    expect(screen.getByTestId('plugins-home-row-category')).toBeTruthy();
    expect(screen.getByTestId('plugins-home-pill-category-all')).toBeTruthy();
    expect(screen.getByTestId('plugins-home-pill-category-deck')).toBeTruthy();
    expect(screen.getByTestId('plugins-home-pill-category-prototype')).toBeTruthy();
    expect(screen.getByTestId('plugins-home-pill-category-design-system')).toBeTruthy();
    expect(screen.getByTestId('plugins-home-pill-category-hyperframes')).toBeTruthy();
    expect(screen.getByTestId('plugins-home-pill-category-video')).toBeTruthy();
    expect(screen.getByTestId('plugins-home-pill-category-image')).toBeTruthy();
    // Surface / Type / Scenario rows and the More disclosure are gone.
    expect(screen.queryByTestId('plugins-home-row-surface')).toBeNull();
    expect(screen.queryByTestId('plugins-home-row-type')).toBeNull();
    expect(screen.queryByTestId('plugins-home-row-scenario')).toBeNull();
    expect(screen.queryByTestId('plugins-home-more')).toBeNull();
  });

  it('omits curated buckets that have zero plugins', () => {
    render(
      <PluginsHomeSection
        plugins={sample}
        loading={false}
        activePluginId={null}
        pendingApplyId={null}
        onUse={() => {}}
        onOpenDetails={() => {}}
      />,
    );
    // The sample fixture has no audio plugin, so the audio pill must
    // not render.
    expect(screen.queryByTestId('plugins-home-pill-category-audio')).toBeNull();
  });

  it('filters by a category pill when clicked', () => {
    render(
      <PluginsHomeSection
        plugins={sample}
        loading={false}
        activePluginId={null}
        pendingApplyId={null}
        onUse={() => {}}
        onOpenDetails={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('plugins-home-pill-category-image'));
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((i) => i.getAttribute('data-plugin-id'))).toEqual(['c']);
  });

  it('HyperFrames pill filters to hyperframes-tagged plugins (subset of video)', () => {
    render(
      <PluginsHomeSection
        plugins={sample}
        loading={false}
        activePluginId={null}
        pendingApplyId={null}
        onUse={() => {}}
        onOpenDetails={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('plugins-home-pill-category-hyperframes'));
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((i) => i.getAttribute('data-plugin-id'))).toEqual(['e']);
  });

  it('All pill clears the category filter', () => {
    render(
      <PluginsHomeSection
        plugins={sample}
        loading={false}
        activePluginId={null}
        pendingApplyId={null}
        onUse={() => {}}
        onOpenDetails={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('plugins-home-pill-category-prototype'));
    fireEvent.click(screen.getByTestId('plugins-home-pill-category-all'));
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((i) => i.getAttribute('data-plugin-id')).sort()).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
    ]);
  });

  it('Featured chip overrides the category selection and shows only featured plugins', () => {
    const plugins = [
      makePlugin({ id: 'star', mode: 'design-system', featured: true }),
      ...sample,
    ];
    render(
      <PluginsHomeSection
        plugins={plugins}
        loading={false}
        activePluginId={null}
        pendingApplyId={null}
        onUse={() => {}}
        onOpenDetails={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('plugins-home-pill-category-image'));
    fireEvent.click(screen.getByTestId('plugins-home-chip-featured'));
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((i) => i.getAttribute('data-plugin-id'))).toEqual(['star']);
  });
});
