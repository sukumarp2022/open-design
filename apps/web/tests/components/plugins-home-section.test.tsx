// @vitest-environment jsdom

// Plugins home section — UI contract.
//
// The section renders a 3-axis SURFACE / TYPE / SCENARIO faceted
// filter and AND-composes selections across axes. A small Featured
// chip sits orthogonal to the facet rows. This suite locks in:
//
//   1. All three facet rows render with axis-specific pills.
//   2. Picking a Surface pill filters the grid to plugins on that
//      surface.
//   3. Selections compose via AND across axes (Web + Marketing only
//      shows plugins that match both).
//   4. Featured chip overrides the facet selection and only shows
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
  surface?: string;
  scenario?: string;
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
        ...(overrides.surface ? { surface: overrides.surface } : {}),
        ...(overrides.scenario ? { scenario: overrides.scenario } : {}),
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
  makePlugin({ id: 'a', surface: 'web', mode: 'design-system', scenario: 'design' }),
  makePlugin({ id: 'b', surface: 'web', mode: 'prototype', scenario: 'marketing' }),
  makePlugin({ id: 'c', surface: 'image', mode: 'image', scenario: 'marketing' }),
  makePlugin({ id: 'd', surface: 'video', mode: 'video', scenario: 'engineering' }),
];

describe('PluginsHomeSection (faceted)', () => {
  it('renders the three facet rows and an "All" pill in each', () => {
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
    expect(screen.getByTestId('plugins-home-row-surface')).toBeTruthy();
    expect(screen.getByTestId('plugins-home-row-type')).toBeTruthy();
    expect(screen.getByTestId('plugins-home-row-scenario')).toBeTruthy();
    expect(screen.getByTestId('plugins-home-pill-surface-all')).toBeTruthy();
    expect(screen.getByTestId('plugins-home-pill-type-all')).toBeTruthy();
    expect(screen.getByTestId('plugins-home-pill-scenario-all')).toBeTruthy();
  });

  it('filters by a Surface pill when clicked', () => {
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
    fireEvent.click(screen.getByTestId('plugins-home-pill-surface-web'));
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((i) => i.getAttribute('data-plugin-id')).sort()).toEqual(['a', 'b']);
  });

  it('AND-composes Surface + Scenario selections', () => {
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
    fireEvent.click(screen.getByTestId('plugins-home-pill-surface-web'));
    fireEvent.click(screen.getByTestId('plugins-home-pill-scenario-marketing'));
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((i) => i.getAttribute('data-plugin-id'))).toEqual(['b']);
  });

  it('Featured chip overrides facet selection and shows only featured plugins', () => {
    const plugins = [
      makePlugin({ id: 'star', surface: 'web', mode: 'design-system', scenario: 'design', featured: true }),
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
    fireEvent.click(screen.getByTestId('plugins-home-pill-surface-image'));
    fireEvent.click(screen.getByTestId('plugins-home-chip-featured'));
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((i) => i.getAttribute('data-plugin-id'))).toEqual(['star']);
  });
});
