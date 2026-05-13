// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_UNSELECTED_SCENARIO_PLUGIN_ID,
  type SkillSummary,
} from '@open-design/contracts';
import { HomeView } from '../../src/components/HomeView';

const SKILL: SkillSummary = {
  id: 'prototype-lab',
  name: 'Prototype Lab',
  description: 'Create a focused prototype.',
  triggers: ['prototype', 'flow'],
  mode: 'prototype',
  previewType: 'html',
  designSystemRequired: false,
  defaultFor: [],
  upstream: null,
  hasBody: true,
  examplePrompt: 'Design a focused onboarding prototype.',
  aggregatesExamples: false,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('HomeView context picker', () => {
  it('binds a selected home skill to the created project payload', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      if (typeof url === 'string' && url === '/api/plugins') {
        return new Response(JSON.stringify({ plugins: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (typeof url === 'string' && url === '/api/mcp/servers') {
        return new Response(JSON.stringify({ servers: [], templates: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const onSubmit = vi.fn();

    render(
      <HomeView
        projects={[]}
        skills={[SKILL]}
        onSubmit={onSubmit}
        onOpenProject={() => undefined}
        onViewAllProjects={() => undefined}
      />,
    );

    const input = await screen.findByTestId('home-hero-input');
    fireEvent.change(input, { target: { value: '@proto' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /prototype lab/i }));

    await waitFor(() => {
      expect((input as HTMLTextAreaElement).value).toBe(SKILL.examplePrompt);
      expect(screen.getByTestId('home-hero-active-skill')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('home-hero-submit'));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      prompt: SKILL.examplePrompt,
      pluginId: DEFAULT_UNSELECTED_SCENARIO_PLUGIN_ID,
      skillId: SKILL.id,
      projectKind: 'prototype',
    }));
  });
});
