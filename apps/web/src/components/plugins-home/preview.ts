// Preview-kind classifier for the plugins-home gallery.
//
// Each card variant in the home gallery wants different content
// in its hero region:
//   - `media`  → poster image (image-template plugins) or video
//                poster with optional hover-play (video-template)
//   - `html`   → sandboxed iframe rendering the plugin's example
//                output / preview entry (examples + scenarios that
//                ship a `od.preview.entry` or `exampleOutputs[]`)
//   - `design` → stylized "X feels like X" tile (design-system
//                plugins, which do not ship a runnable preview)
//   - `text`   → fallback layout (other scenario plugins, atoms
//                that slip through the visiblePlugins filter, …)
//
// Keeping the classifier in its own pure module lets the renderer
// branch on a single discriminator and lets the unit tests assert
// classification without touching React.

import type { InstalledPluginRecord } from '@open-design/contracts';

export type PluginPreviewKind = 'media' | 'html' | 'design' | 'text';

export interface MediaPreviewSpec {
  kind: 'media';
  /** 'image' (poster) or 'video' (poster + optional autoplay video). */
  mediaType: 'image' | 'video';
  poster: string | null;
  videoUrl: string | null;
  /** True when the plugin only ships a still image, no video stream. */
  imageOnly: boolean;
}

export interface HtmlPreviewSpec {
  kind: 'html';
  /** URL the iframe should load — daemon-served sandboxed HTML. */
  src: string;
  /** Display label used in the chrome strip of the preview frame. */
  label: string;
}

export interface DesignPreviewSpec {
  kind: 'design';
  brand: string;
  swatches: string[];
}

export interface TextPreviewSpec {
  kind: 'text';
}

export type PluginPreviewSpec =
  | MediaPreviewSpec
  | HtmlPreviewSpec
  | DesignPreviewSpec
  | TextPreviewSpec;

interface PreviewBlock {
  type?: unknown;
  poster?: unknown;
  video?: unknown;
  gif?: unknown;
  entry?: unknown;
}

interface ExampleOutputEntry {
  path?: unknown;
  title?: unknown;
}

function readPreview(record: InstalledPluginRecord): PreviewBlock | null {
  const od = record.manifest?.od as { preview?: unknown } | undefined;
  if (!od || typeof od.preview !== 'object' || od.preview === null) return null;
  return od.preview as PreviewBlock;
}

function readExamples(record: InstalledPluginRecord): ExampleOutputEntry[] {
  const od = record.manifest?.od as
    | { useCase?: { exampleOutputs?: unknown } }
    | undefined;
  const list = od?.useCase?.exampleOutputs;
  if (!Array.isArray(list)) return [];
  return list as ExampleOutputEntry[];
}

function exampleStem(entry: ExampleOutputEntry): string | null {
  if (typeof entry.path !== 'string') return null;
  const segments = entry.path.split(/[\\/]/).filter(Boolean);
  const base = segments[segments.length - 1] ?? '';
  const stem = base.replace(/\.[^.]+$/, '');
  return stem || null;
}

function isDesignSystemPlugin(record: InstalledPluginRecord): boolean {
  const od = record.manifest?.od as { mode?: unknown } | undefined;
  if (typeof od?.mode === 'string' && od.mode.toLowerCase() === 'design-system') {
    return true;
  }
  const tags = record.manifest?.tags ?? [];
  return tags.some((t) => t.toLowerCase() === 'design-system');
}

// Synthetic colour swatches derived from the plugin id so cards stay
// visually distinct without dragging in the real DESIGN.md content.
// Hue is pinned per-plugin (stable across renders) but lightness /
// saturation rotate so each design-system tile reads as a brand
// patch rather than a random gradient.
function deriveSwatches(record: InstalledPluginRecord): string[] {
  const seed = hashString(record.id);
  const hue = seed % 360;
  return [
    `hsl(${hue}, 78%, 56%)`,
    `hsl(${(hue + 32) % 360}, 64%, 48%)`,
    `hsl(${(hue + 200) % 360}, 36%, 22%)`,
  ];
}

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function brandLabel(record: InstalledPluginRecord): string {
  const title = record.title ?? record.manifest?.title ?? record.id;
  // Strip the tooling prefix so design-system plugin titles ("Airbnb",
  // "Cursor", "Apple") read as bare brand names on the tile. Falls back
  // to the raw title when there's no decoration.
  return title.replace(/^design[\s-]?system[:\s-]*/i, '').trim() || title;
}

export function inferPluginPreview(
  record: InstalledPluginRecord,
): PluginPreviewSpec {
  const preview = readPreview(record);
  const examples = readExamples(record);

  if (preview) {
    const t = typeof preview.type === 'string' ? preview.type.toLowerCase() : '';
    const poster = typeof preview.poster === 'string' ? preview.poster : null;
    const video = typeof preview.video === 'string' ? preview.video : null;
    const gif = typeof preview.gif === 'string' ? preview.gif : null;
    const entry = typeof preview.entry === 'string' ? preview.entry : null;

    if (t === 'video' || video) {
      return {
        kind: 'media',
        mediaType: 'video',
        poster: poster ?? gif ?? null,
        videoUrl: video,
        imageOnly: !video,
      };
    }
    if (t === 'image' || poster || gif) {
      return {
        kind: 'media',
        mediaType: 'image',
        poster: poster ?? gif ?? null,
        videoUrl: null,
        imageOnly: true,
      };
    }
    if (t === 'html' && entry) {
      return {
        kind: 'html',
        src: `/api/plugins/${encodeURIComponent(record.id)}/preview`,
        label: entry.replace(/^\.\//, '').split(/[\\/]/).pop() ?? entry,
      };
    }
  }

  if (examples.length > 0) {
    const stem = exampleStem(examples[0]!);
    if (stem) {
      const title =
        typeof examples[0]!.title === 'string' ? (examples[0]!.title as string) : stem;
      return {
        kind: 'html',
        src: `/api/plugins/${encodeURIComponent(record.id)}/example/${encodeURIComponent(stem)}`,
        label: title,
      };
    }
  }

  if (isDesignSystemPlugin(record)) {
    return {
      kind: 'design',
      brand: brandLabel(record),
      swatches: deriveSwatches(record),
    };
  }

  return { kind: 'text' };
}
