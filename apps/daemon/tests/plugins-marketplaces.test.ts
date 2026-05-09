// Plan §3.B4 — marketplaces add / list / refresh / remove / trust unit tests.
//
// Locks the storage half of the federated catalog story. The Phase 3
// follow-up will layer on `od plugin install <name>` resolution +
// trust UI, but the storage layout here is the contract that lookup
// will read against.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { migratePlugins } from '../src/plugins/persistence.js';
import {
  addMarketplace,
  getMarketplace,
  listMarketplaces,
  refreshMarketplace,
  removeMarketplace,
  resolvePluginInMarketplaces,
  setMarketplaceTrust,
} from '../src/plugins/marketplaces.js';

let db: Database.Database;
let tmpDir: string;

const VALID_MANIFEST = JSON.stringify({
  name: 'test-marketplace',
  metadata: { description: 'fixture', version: '1.0.0' },
  plugins: [
    { name: 'sample-plugin', source: 'github:open-design/sample-plugin' },
  ],
});

function fixtureFetcher(text: string, ok = true) {
  return async () => ({
    ok,
    status: ok ? 200 : 502,
    text: async () => text,
  });
}

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'od-mp-'));
  db = new Database(path.join(tmpDir, 'test.sqlite'));
  db.exec(`
    CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT);
    CREATE TABLE conversations (id TEXT PRIMARY KEY, project_id TEXT, title TEXT);
  `);
  migratePlugins(db);
});

afterEach(async () => {
  db.close();
  await rm(tmpDir, { recursive: true, force: true });
});

describe('marketplaces', () => {
  it('addMarketplace fetches, validates, stores, and returns the row', async () => {
    const result = await addMarketplace(db, {
      url: 'https://example.com/marketplace.json',
      fetcher: fixtureFetcher(VALID_MANIFEST),
    });
    if (!result.ok) {
      throw new Error(`expected ok: ${JSON.stringify(result)}`);
    }
    expect(result.row.url).toBe('https://example.com/marketplace.json');
    expect(result.row.trust).toBe('restricted');
    expect(result.row.manifest.plugins).toHaveLength(1);
    expect(listMarketplaces(db)).toHaveLength(1);
  });

  it('addMarketplace rejects non-https urls', async () => {
    const result = await addMarketplace(db, {
      url: 'http://example.com/marketplace.json',
      fetcher: fixtureFetcher(VALID_MANIFEST),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.message).toMatch(/https/);
    }
  });

  it('addMarketplace surfaces parse failures', async () => {
    const result = await addMarketplace(db, {
      url: 'https://example.com/marketplace.json',
      fetcher: fixtureFetcher('{}'),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(422);
    }
  });

  it('refresh re-fetches and updates refreshed_at', async () => {
    const added = await addMarketplace(db, {
      url: 'https://example.com/marketplace.json',
      fetcher: fixtureFetcher(VALID_MANIFEST),
    });
    if (!added.ok) throw new Error('add failed');
    const updatedManifest = JSON.parse(VALID_MANIFEST);
    updatedManifest.plugins.push({
      name: 'new-plugin',
      source: 'github:open-design/new-plugin',
    });
    const refreshed = await refreshMarketplace(
      db,
      added.row.id,
      fixtureFetcher(JSON.stringify(updatedManifest)),
    );
    if (!refreshed.ok) throw new Error('refresh failed');
    expect(refreshed.row.manifest.plugins).toHaveLength(2);
    expect(refreshed.row.refreshedAt).toBeGreaterThanOrEqual(added.row.refreshedAt);
  });

  it('setMarketplaceTrust updates the trust tier and remove deletes the row', async () => {
    const added = await addMarketplace(db, {
      url: 'https://example.com/marketplace.json',
      fetcher: fixtureFetcher(VALID_MANIFEST),
    });
    if (!added.ok) throw new Error('add failed');
    const trusted = setMarketplaceTrust(db, added.row.id, 'trusted');
    expect(trusted?.trust).toBe('trusted');
    expect(removeMarketplace(db, added.row.id)).toBe(true);
    expect(getMarketplace(db, added.row.id)).toBeNull();
  });
});

describe('resolvePluginInMarketplaces', () => {
  it('returns the canonical source string for a known plugin name', async () => {
    await addMarketplace(db, {
      url: 'https://example.com/marketplace.json',
      fetcher: fixtureFetcher(VALID_MANIFEST),
    });
    const resolved = resolvePluginInMarketplaces(db, 'sample-plugin');
    expect(resolved).not.toBeNull();
    expect(resolved!.source).toBe('github:open-design/sample-plugin');
    expect(resolved!.marketplaceTrust).toBe('restricted');
  });

  it('matches case-insensitively', async () => {
    await addMarketplace(db, {
      url: 'https://example.com/marketplace.json',
      fetcher: fixtureFetcher(VALID_MANIFEST),
    });
    const resolved = resolvePluginInMarketplaces(db, 'SAMPLE-PLUGIN');
    expect(resolved?.pluginName).toBe('sample-plugin');
  });

  it('returns null when no marketplace knows the name', async () => {
    expect(resolvePluginInMarketplaces(db, 'mystery')).toBeNull();
    await addMarketplace(db, {
      url: 'https://example.com/marketplace.json',
      fetcher: fixtureFetcher(VALID_MANIFEST),
    });
    expect(resolvePluginInMarketplaces(db, 'mystery')).toBeNull();
  });

  it('walks marketplaces in registration order, first hit wins', async () => {
    const otherManifest = JSON.stringify({
      name: 'other',
      plugins: [{ name: 'sample-plugin', source: 'github:other/sample' }],
    });
    const first = await addMarketplace(db, {
      url: 'https://first.example/marketplace.json',
      fetcher: fixtureFetcher(otherManifest),
    });
    const second = await addMarketplace(db, {
      url: 'https://second.example/marketplace.json',
      fetcher: fixtureFetcher(VALID_MANIFEST),
    });
    if (!first.ok || !second.ok) throw new Error('setup failed');
    const resolved = resolvePluginInMarketplaces(db, 'sample-plugin');
    expect(resolved?.source).toBe('github:other/sample');
  });
});
