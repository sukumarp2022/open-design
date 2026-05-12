// @vitest-environment jsdom
//
// Stage B of plugin-driven-flow-plan — Home intent rail interactions.
// Covers:
//   - Every chip in the catalog renders with its test id.
//   - Clicking a chip forwards the full chip descriptor to onPickChip
//     so the dispatcher in HomeView can route to the right flow.
//   - The active + pending UI states light up the right chip and
//     disable all chips while a plugin is mid-apply.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HomeHero } from '../../src/components/HomeHero';
import {
  HOME_HERO_CHIPS,
  findChip,
} from '../../src/components/home-hero/chips';

afterEach(() => {
  cleanup();
});

function renderHero(overrides: Partial<React.ComponentProps<typeof HomeHero>> = {}) {
  const onPickChip = vi.fn();
  const onPickPlugin = vi.fn();
  render(
    <HomeHero
      prompt=""
      onPromptChange={() => undefined}
      onSubmit={() => undefined}
      activePluginTitle={null}
      activeChipId={null}
      onClearActivePlugin={() => undefined}
      pluginOptions={[]}
      pluginsLoading={false}
      pendingPluginId={null}
      pendingChipId={null}
      onPickPlugin={onPickPlugin}
      onPickChip={onPickChip}
      contextItemCount={0}
      error={null}
      {...overrides}
    />,
  );
  return { onPickChip, onPickPlugin };
}

describe('HomeHero intent rail', () => {
  it('renders one chip per HOME_HERO_CHIPS entry', () => {
    renderHero();
    const rail = screen.getByTestId('home-hero-rail');
    for (const chip of HOME_HERO_CHIPS) {
      const node = screen.getByTestId(`home-hero-rail-${chip.id}`);
      expect(node).toBeTruthy();
      expect(rail.contains(node)).toBe(true);
    }
  });

  it('forwards the matching chip descriptor when clicked', () => {
    const { onPickChip } = renderHero();
    fireEvent.click(screen.getByTestId('home-hero-rail-image'));
    expect(onPickChip).toHaveBeenCalledTimes(1);
    expect(onPickChip).toHaveBeenCalledWith(findChip('image'));
  });

  it('marks the active chip with aria-pressed=true and the is-active class', () => {
    renderHero({ activeChipId: 'video' });
    const node = screen.getByTestId('home-hero-rail-video');
    expect(node.getAttribute('aria-pressed')).toBe('true');
    expect(node.className).toContain('is-active');
  });

  it('disables every chip while a plugin apply is in flight', () => {
    renderHero({ pendingPluginId: 'od-figma-migration', pendingChipId: 'figma' });
    for (const chip of HOME_HERO_CHIPS) {
      const node = screen.getByTestId(`home-hero-rail-${chip.id}`);
      expect((node as HTMLButtonElement).disabled).toBe(true);
    }
    expect(screen.getByTestId('home-hero-rail-figma').className).toContain('is-pending');
  });

  it('migration chips carry the right action discriminator', () => {
    expect(findChip('figma')?.action).toMatchObject({ kind: 'apply-figma-migration' });
    expect(findChip('folder')?.action).toMatchObject({ kind: 'import-folder' });
    expect(findChip('template')?.action).toMatchObject({ kind: 'open-template-picker' });
  });

  it('media chips route to od-media-generation with the matching project kind', () => {
    expect(findChip('image')?.action).toMatchObject({
      kind: 'apply-scenario',
      pluginId: 'od-media-generation',
      projectKind: 'image',
    });
    expect(findChip('video')?.action).toMatchObject({ pluginId: 'od-media-generation', projectKind: 'video' });
    expect(findChip('audio')?.action).toMatchObject({ pluginId: 'od-media-generation', projectKind: 'audio' });
  });

  it('non-media scenario chips route to od-new-generation', () => {
    expect(findChip('prototype')?.action).toMatchObject({ pluginId: 'od-new-generation', projectKind: 'prototype' });
    expect(findChip('deck')?.action).toMatchObject({ pluginId: 'od-new-generation', projectKind: 'deck' });
    expect(findChip('other')?.action).toMatchObject({ pluginId: 'od-new-generation', projectKind: 'other' });
  });
});
