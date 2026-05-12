// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InstalledPluginRecord, PluginSourceKind, TrustTier } from '@open-design/contracts';
import { HomeHero } from '../../src/components/HomeHero';

function makePlugin(
  id: string,
  title: string,
  sourceKind: PluginSourceKind = 'bundled',
  trust: TrustTier = 'bundled',
): InstalledPluginRecord {
  return {
    id,
    title,
    version: '1.0.0',
    sourceKind,
    source: '/tmp',
    trust,
    capabilitiesGranted: ['prompt:inject'],
    manifest: {
      name: id,
      version: '1.0.0',
      title,
      description: 'A plugin fixture',
      tags: ['fixture'],
    },
    fsPath: '/tmp',
    installedAt: 0,
    updatedAt: 0,
  };
}

afterEach(() => {
  cleanup();
});

describe('HomeHero plugin picker', () => {
  it('opens plugin search from an @ token across community and my plugins', () => {
    const onPromptChange = vi.fn();
    const onPickPlugin = vi.fn();
    render(
      <HomeHero
        prompt="Make @sam"
        onPromptChange={onPromptChange}
        onSubmit={() => undefined}
        activePluginTitle={null}
        activeChipId={null}
        onClearActivePlugin={() => undefined}
        pluginOptions={[
          makePlugin('sample-plugin', 'Sample Plugin'),
          makePlugin('sample-user-plugin', 'Sample User Plugin', 'github', 'restricted'),
        ]}
        pluginsLoading={false}
        pendingPluginId={null}
        pendingChipId={null}
        onPickPlugin={onPickPlugin}
        onPickChip={() => undefined}
        contextItemCount={0}
        error={null}
      />,
    );

    expect(screen.getByTestId('home-hero-plugin-picker')).toBeTruthy();
    expect(screen.getByText('Community')).toBeTruthy();
    expect(screen.getByText('My plugin')).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole('option', { name: /sample user plugin/i }));

    expect(onPickPlugin).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sample-user-plugin' }),
      'Make',
    );
  });
});
