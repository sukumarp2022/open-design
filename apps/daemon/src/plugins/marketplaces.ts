// Marketplace registry — plan §3.B4 / spec §6 / §7 / §11.5 / §16 Phase 3
// (entry slice).
//
// Stores user-configured federated catalog indexes in
// `plugin_marketplaces`. The actual `od plugin install <name>` resolution
// through these catalogs lands in Phase 3 alongside the trust UI; this
// module is the storage + refresh half so the desktop / CLI can already
// register and inspect catalogs.
//
// We intentionally treat the catalog body as opaque JSON in v1 — Zod
// validation lives in `@open-design/plugin-runtime`'s parser and we only
// store what the parser returns. Trust default mirrors §9: a freshly
// added user-supplied marketplace is `restricted` (discovery only)
// unless `--trust` is passed.

import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import {
  parseMarketplace,
  type MarketplaceParseResult,
} from '@open-design/plugin-runtime';
import type { MarketplaceManifest } from '@open-design/contracts';

type SqliteDb = Database.Database;

export type MarketplaceTrustTier = 'official' | 'trusted' | 'restricted';

export interface MarketplaceRow {
  id: string;
  url: string;
  trust: MarketplaceTrustTier;
  manifest: MarketplaceManifest;
  addedAt: number;
  refreshedAt: number;
}

export interface AddMarketplaceInput {
  url: string;
  // Pluggable HTTPS fetcher; tests inject a stub. Production injects the
  // global fetch.
  fetcher?: (url: string) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;
  trust?: MarketplaceTrustTier;
}

export interface AddMarketplaceResult {
  ok: true;
  row: MarketplaceRow;
  warnings: string[];
}

export interface AddMarketplaceFailure {
  ok: false;
  status: number;
  message: string;
  errors?: string[];
}

const HTTPS_RE = /^https:\/\//i;

export async function addMarketplace(
  db: SqliteDb,
  input: AddMarketplaceInput,
): Promise<AddMarketplaceResult | AddMarketplaceFailure> {
  if (!HTTPS_RE.test(input.url)) {
    return {
      ok: false,
      status: 400,
      message: 'marketplace url must use https://',
    };
  }
  const fetcher = input.fetcher ?? defaultFetcher;
  let resp;
  try {
    resp = await fetcher(input.url);
  } catch (err) {
    return {
      ok: false,
      status: 502,
      message: `Fetch failed: ${(err as Error).message ?? String(err)}`,
    };
  }
  if (!resp.ok) {
    return {
      ok: false,
      status: 502,
      message: `Marketplace fetch returned ${resp.status}`,
    };
  }
  const text = await resp.text();
  const parsed: MarketplaceParseResult = parseMarketplace(text);
  if (!parsed.ok) {
    return {
      ok: false,
      status: 422,
      message: 'marketplace manifest failed validation',
      errors: parsed.errors,
    };
  }
  const id = randomUUID();
  const now = Date.now();
  const trust = input.trust ?? 'restricted';
  db.prepare(
    `INSERT INTO plugin_marketplaces (id, url, trust, manifest_json, added_at, refreshed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, input.url, trust, text, now, now);
  return {
    ok: true,
    row: { id, url: input.url, trust, manifest: parsed.manifest, addedAt: now, refreshedAt: now },
    warnings: [],
  };
}

export function listMarketplaces(db: SqliteDb): MarketplaceRow[] {
  const rows = db
    .prepare(`SELECT id, url, trust, manifest_json, added_at, refreshed_at FROM plugin_marketplaces ORDER BY added_at ASC`)
    .all() as Array<{
      id: string;
      url: string;
      trust: MarketplaceTrustTier;
      manifest_json: string;
      added_at: number;
      refreshed_at: number;
    }>;
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    trust: r.trust,
    manifest: safeParseManifest(r.manifest_json),
    addedAt: r.added_at,
    refreshedAt: r.refreshed_at,
  }));
}

export function getMarketplace(db: SqliteDb, id: string): MarketplaceRow | null {
  const row = db
    .prepare(`SELECT id, url, trust, manifest_json, added_at, refreshed_at FROM plugin_marketplaces WHERE id = ?`)
    .get(id) as
      | undefined
      | {
          id: string;
          url: string;
          trust: MarketplaceTrustTier;
          manifest_json: string;
          added_at: number;
          refreshed_at: number;
        };
  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    trust: row.trust,
    manifest: safeParseManifest(row.manifest_json),
    addedAt: row.added_at,
    refreshedAt: row.refreshed_at,
  };
}

export function removeMarketplace(db: SqliteDb, id: string): boolean {
  const info = db.prepare(`DELETE FROM plugin_marketplaces WHERE id = ?`).run(id);
  return info.changes > 0;
}

export function setMarketplaceTrust(
  db: SqliteDb,
  id: string,
  trust: MarketplaceTrustTier,
): MarketplaceRow | null {
  const info = db.prepare(`UPDATE plugin_marketplaces SET trust = ? WHERE id = ?`).run(trust, id);
  if (info.changes === 0) return null;
  return getMarketplace(db, id);
}

export interface RefreshMarketplaceResult {
  ok: true;
  row: MarketplaceRow;
}

export async function refreshMarketplace(
  db: SqliteDb,
  id: string,
  fetcher?: AddMarketplaceInput['fetcher'],
): Promise<RefreshMarketplaceResult | AddMarketplaceFailure> {
  const existing = getMarketplace(db, id);
  if (!existing) {
    return { ok: false, status: 404, message: `marketplace ${id} not found` };
  }
  const useFetcher = fetcher ?? defaultFetcher;
  let resp;
  try {
    resp = await useFetcher(existing.url);
  } catch (err) {
    return { ok: false, status: 502, message: `Fetch failed: ${(err as Error).message ?? String(err)}` };
  }
  if (!resp.ok) return { ok: false, status: 502, message: `Marketplace fetch returned ${resp.status}` };
  const text = await resp.text();
  const parsed = parseMarketplace(text);
  if (!parsed.ok) {
    return { ok: false, status: 422, message: 'marketplace manifest failed validation', errors: parsed.errors };
  }
  const now = Date.now();
  db.prepare(`UPDATE plugin_marketplaces SET manifest_json = ?, refreshed_at = ? WHERE id = ?`)
    .run(text, now, id);
  return {
    ok: true,
    row: { ...existing, manifest: parsed.manifest, refreshedAt: now },
  };
}

async function defaultFetcher(url: string) {
  const response = await fetch(url, { redirect: 'follow' });
  return {
    ok: response.ok,
    status: response.status,
    text: () => response.text(),
  };
}

function safeParseManifest(raw: string): MarketplaceManifest {
  try {
    const parsed = parseMarketplace(raw);
    if (parsed.ok) return parsed.manifest;
  } catch {
    // fall through
  }
  // Last-resort fallback: return a minimal shape so the caller doesn't
  // explode if a database row was stored before a schema patch.
  return {
    name: 'unknown',
    plugins: [],
  } as MarketplaceManifest;
}

// Plan §3.F3 / spec §7.2 + §6 — resolve a bare plugin name through
// every configured marketplace. Returns the first match (marketplace
// scan order matches `listMarketplaces` output, which is sorted by
// `added_at` ASC). The match carries the marketplace id (so audit
// trails record which catalog the install came from) and the resolved
// `source` string the installer can re-feed into `installPlugin()`.
//
// `restricted` marketplaces still resolve names — the plugin install
// path does NOT auto-trust the resulting plugin (it stays
// `restricted` per spec §9 unless the marketplace was explicitly
// `trusted` at add-time).
export interface ResolvedPluginEntry {
  marketplaceId: string;
  marketplaceUrl: string;
  marketplaceTrust: MarketplaceTrustTier;
  pluginName: string;
  source: string;
  description?: string;
}

export function resolvePluginInMarketplaces(
  db: SqliteDb,
  pluginName: string,
): ResolvedPluginEntry | null {
  const rows = listMarketplaces(db);
  const target = pluginName.trim().toLowerCase();
  if (!target) return null;
  for (const row of rows) {
    const entries = row.manifest.plugins ?? [];
    for (const entry of entries) {
      if (entry.name && entry.name.toLowerCase() === target) {
        const result: ResolvedPluginEntry = {
          marketplaceId:    row.id,
          marketplaceUrl:   row.url,
          marketplaceTrust: row.trust,
          pluginName:       entry.name,
          source:           entry.source,
        };
        if (entry.description) result.description = entry.description;
        return result;
      }
    }
  }
  return null;
}
