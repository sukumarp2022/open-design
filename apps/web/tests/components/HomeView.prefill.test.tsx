// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomeView } from '../../src/components/HomeView';
import {
  createPluginAuthoringHandoff,
  PLUGIN_AUTHORING_PROMPT,
} from '../../src/components/home-hero/plugin-authoring';

const AUTHORING_PLUGIN = {
  id: 'od-plugin-authoring',
  title: 'Plugin authoring',
  version: '0.1.0',
  trust: 'bundled' as const,
  sourceKind: 'bundled' as const,
  source: '/tmp/plugin-authoring',
  capabilitiesGranted: ['prompt:inject'],
  fsPath: '/tmp/plugin-authoring',
  installedAt: 0,
  updatedAt: 0,
  manifest: {
    name: 'od-plugin-authoring',
    title: 'Plugin authoring',
    version: '0.1.0',
    description: 'Create plugins',
    od: {
      kind: 'scenario',
      taskKind: 'new-generation',
      useCase: { query: 'Create a plugin.' },
    },
  },
};

const DEFAULT_PLUGIN = {
  ...AUTHORING_PLUGIN,
  id: 'od-new-generation',
  title: 'New generation',
  source: '/tmp/new-generation',
  fsPath: '/tmp/new-generation',
  manifest: {
    ...AUTHORING_PLUGIN.manifest,
    name: 'od-new-generation',
    title: 'New generation',
    description: 'Create new design artifacts',
  },
};

const HIDDEN_DEFAULT_PLUGIN = {
  ...DEFAULT_PLUGIN,
  id: 'od-default',
  title: 'Default design router',
  source: '/tmp/default-router',
  fsPath: '/tmp/default-router',
  manifest: {
    ...DEFAULT_PLUGIN.manifest,
    name: 'od-default',
    title: 'Default design router',
    od: {
      ...DEFAULT_PLUGIN.manifest.od,
      hidden: true,
    },
  },
};

// The Prototype / Live-artifact chips now bind to the bundled
// `example-web-prototype` plugin (which ships its own seed +
// layouts + checklist) instead of the generic od-new-generation
// router. Mirror that here so the chip-applies test can find a
// matching plugin record and the apply call resolves to the new id.
const WEB_PROTOTYPE_PLUGIN = {
  ...DEFAULT_PLUGIN,
  id: 'example-web-prototype',
  title: 'Web Prototype',
  source: '/tmp/web-prototype',
  fsPath: '/tmp/web-prototype',
  manifest: {
    ...DEFAULT_PLUGIN.manifest,
    name: 'example-web-prototype',
    title: 'Web Prototype',
    description: 'General-purpose desktop web prototype.',
  },
};

const AUTHORING_APPLY_RESULT = {
  query: 'Create a plugin.',
  contextItems: [],
  inputs: [],
  assets: [],
  mcpServers: [],
  trust: 'trusted',
  capabilitiesGranted: ['prompt:inject'],
  capabilitiesRequired: ['prompt:inject'],
  appliedPlugin: {
    snapshotId: 'snap-authoring',
    pluginId: 'od-plugin-authoring',
    pluginVersion: '0.1.0',
    manifestSourceDigest: 'a'.repeat(64),
    inputs: {},
    resolvedContext: { items: [] },
    capabilitiesGranted: ['prompt:inject'],
    capabilitiesRequired: ['prompt:inject'],
    assetsStaged: [],
    taskKind: 'new-generation',
    appliedAt: 0,
    connectorsRequired: [],
    connectorsResolved: [],
    mcpServers: [],
    status: 'fresh',
  },
  projectMetadata: {},
};

const DEFAULT_APPLY_RESULT = {
  ...AUTHORING_APPLY_RESULT,
  appliedPlugin: {
    ...AUTHORING_APPLY_RESULT.appliedPlugin,
    snapshotId: 'snap-default',
    pluginId: 'od-new-generation',
  },
};

describe('HomeView prompt handoff', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it('consumes a plugin authoring handoff once and focuses the textarea', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => (
      new Response(JSON.stringify({ plugins: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )));
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });

    const { rerender } = render(
      <HomeView
        projects={[]}
        onSubmit={() => undefined}
        onOpenProject={() => undefined}
        onViewAllProjects={() => undefined}
        promptHandoff={createPluginAuthoringHandoff(1)}
      />,
    );

    const input = await screen.findByTestId('home-hero-input');
    await waitFor(() => {
      expect((input as HTMLTextAreaElement).value).toBe(PLUGIN_AUTHORING_PROMPT);
      expect(document.activeElement).toBe(input);
    });

    fireEvent.change(input, { target: { value: 'User edited prompt' } });

    rerender(
      <HomeView
        projects={[]}
        onSubmit={() => undefined}
        onOpenProject={() => undefined}
        onViewAllProjects={() => undefined}
        promptHandoff={createPluginAuthoringHandoff(1)}
      />,
    );

    expect((input as HTMLTextAreaElement).value).toBe('User edited prompt');
  });

  it('uses the same authoring prompt from the Home rail chip', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => (
      new Response(JSON.stringify({ plugins: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )));
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });

    render(
      <HomeView
        projects={[]}
        onSubmit={() => undefined}
        onOpenProject={() => undefined}
        onViewAllProjects={() => undefined}
      />,
    );

    fireEvent.click(await screen.findByTestId('home-hero-rail-create-plugin'));

    const input = await screen.findByTestId('home-hero-input');
    await waitFor(() => {
      expect((input as HTMLTextAreaElement).value).toBe(PLUGIN_AUTHORING_PROMPT);
      expect(document.activeElement).toBe(input);
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('routes free-form submits through the hidden default plugin without applying a visible chip', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      if (typeof url === 'string' && url === '/api/plugins') {
        return new Response(JSON.stringify({ plugins: [HIDDEN_DEFAULT_PLUGIN, DEFAULT_PLUGIN] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const onSubmit = vi.fn();

    render(
      <HomeView
        projects={[]}
        onSubmit={onSubmit}
        onOpenProject={() => undefined}
        onViewAllProjects={() => undefined}
      />,
    );

    const input = await screen.findByTestId('home-hero-input');
    fireEvent.change(input, { target: { value: 'Make a launch page for a robotics studio' } });
    fireEvent.click(screen.getByTestId('home-hero-submit'));

    expect(screen.queryByTestId('home-hero-active-plugin')).toBeNull();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'Make a launch page for a robotics studio',
      pluginId: 'od-default',
      appliedPluginSnapshotId: null,
      pluginInputs: { prompt: 'Make a launch page for a robotics studio' },
      projectKind: 'other',
    }));
  });

  it('falls back to od-new-generation when od-plugin-authoring is not registered yet', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      if (typeof url === 'string' && url === '/api/plugins') {
        return new Response(JSON.stringify({ plugins: [DEFAULT_PLUGIN] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (typeof url === 'string' && url.includes('/apply')) {
        return new Response(JSON.stringify(DEFAULT_APPLY_RESULT), {
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
        onSubmit={onSubmit}
        onOpenProject={() => undefined}
        onViewAllProjects={() => undefined}
      />,
    );

    fireEvent.click(await screen.findByTestId('home-hero-rail-create-plugin'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/plugins/od-new-generation/apply',
      expect.anything(),
    ));
    const applyCall = fetchMock.mock.calls.find(([url]) => (
      typeof url === 'string' && url.includes('/api/plugins/od-new-generation/apply')
    ));
    expect(JSON.parse(String((applyCall?.[1] as RequestInit).body))).toMatchObject({
      inputs: {
        artifactKind: 'Open Design plugin',
        audience: 'Open Design plugin authors',
        topic: 'packaging a reusable workflow as an Open Design plugin',
      },
    });
    await waitFor(() => {
      expect((screen.getByTestId('home-hero-input') as HTMLTextAreaElement).value)
        .toBe(PLUGIN_AUTHORING_PROMPT);
      expect((screen.getByTestId('home-hero-submit') as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(screen.getByTestId('home-hero-submit'));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      prompt: PLUGIN_AUTHORING_PROMPT,
      pluginId: 'od-new-generation',
      appliedPluginSnapshotId: 'snap-default',
      pluginInputs: {
        artifactKind: 'Open Design plugin',
        audience: 'Open Design plugin authors',
        topic: 'packaging a reusable workflow as an Open Design plugin',
      },
      projectKind: 'other',
    }));
  });

  it('applies Home rail Prototype chip against the bundled web-prototype scenario plugin', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      if (typeof url === 'string' && url === '/api/plugins') {
        return new Response(JSON.stringify({ plugins: [WEB_PROTOTYPE_PLUGIN] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (typeof url === 'string' && url.includes('/apply')) {
        return new Response(JSON.stringify(DEFAULT_APPLY_RESULT), {
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

    render(
      <HomeView
        projects={[]}
        onSubmit={() => undefined}
        onOpenProject={() => undefined}
        onViewAllProjects={() => undefined}
      />,
    );

    fireEvent.click(await screen.findByTestId('home-hero-rail-prototype'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/plugins/example-web-prototype/apply',
      expect.anything(),
    ));
    // web-prototype's manifest has no `inputs` field, so the chip
    // doesn't carry artifactKind/audience/topic anymore. The apply
    // body's `inputs` map should be empty (chip passes no inputs and
    // the plugin defines none).
    const applyCall = fetchMock.mock.calls.find(([url]) => (
      typeof url === 'string' && url.includes('/api/plugins/example-web-prototype/apply')
    ));
    expect(JSON.parse(String((applyCall?.[1] as RequestInit).body))).toMatchObject({
      inputs: {},
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('confirms before an explicit plugin use replaces an existing prompt', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      if (typeof url === 'string' && url === '/api/plugins') {
        return new Response(JSON.stringify({ plugins: [WEB_PROTOTYPE_PLUGIN] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (typeof url === 'string' && url.includes('/apply')) {
        return new Response(JSON.stringify(DEFAULT_APPLY_RESULT), {
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

    render(
      <HomeView
        projects={[]}
        onSubmit={() => undefined}
        onOpenProject={() => undefined}
        onViewAllProjects={() => undefined}
      />,
    );

    const input = await screen.findByTestId('home-hero-input');
    fireEvent.change(input, { target: { value: 'Keep my current brief' } });
    fireEvent.click(await screen.findByTestId('home-hero-rail-prototype'));

    expect(await screen.findByRole('dialog', { name: /replace current prompt/i })).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/apply'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/plugins/example-web-prototype/apply',
      expect.anything(),
    ));
  });

  it('binds od-plugin-authoring before submitting the rail create-plugin prompt', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      if (typeof url === 'string' && url === '/api/plugins') {
        return new Response(JSON.stringify({ plugins: [AUTHORING_PLUGIN] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (typeof url === 'string' && url.includes('/apply')) {
        return new Response(JSON.stringify(AUTHORING_APPLY_RESULT), {
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
        onSubmit={onSubmit}
        onOpenProject={() => undefined}
        onViewAllProjects={() => undefined}
      />,
    );

    fireEvent.click(await screen.findByTestId('home-hero-rail-create-plugin'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/plugins/od-plugin-authoring/apply',
      expect.anything(),
    ));
    fireEvent.click(await screen.findByTestId('home-hero-submit'));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      prompt: PLUGIN_AUTHORING_PROMPT,
      pluginId: 'od-plugin-authoring',
      appliedPluginSnapshotId: 'snap-authoring',
      pluginInputs: {},
      projectKind: 'other',
    }));
  });

  it('does not submit the create-plugin prompt before the authoring scenario is applied', async () => {
    let resolveApply: (response: Response) => void = () => undefined;
    const applyResponse = new Promise<Response>((resolve) => {
      resolveApply = resolve;
    });
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      if (typeof url === 'string' && url === '/api/plugins') {
        return new Response(JSON.stringify({ plugins: [AUTHORING_PLUGIN] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (typeof url === 'string' && url.includes('/apply')) {
        return applyResponse;
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
        onSubmit={onSubmit}
        onOpenProject={() => undefined}
        onViewAllProjects={() => undefined}
      />,
    );

    fireEvent.click(await screen.findByTestId('home-hero-rail-create-plugin'));
    fireEvent.click(await screen.findByTestId('home-hero-submit'));
    expect(onSubmit).not.toHaveBeenCalled();

    resolveApply(new Response(JSON.stringify(AUTHORING_APPLY_RESULT), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    await waitFor(() => {
      expect((screen.getByTestId('home-hero-submit') as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(screen.getByTestId('home-hero-submit'));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      pluginId: 'od-plugin-authoring',
      appliedPluginSnapshotId: 'snap-authoring',
    }));
  });
});
