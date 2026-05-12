// Single plugin card rendered inside the plugins-home grid.
//
// Each card is a hero preview tile + a small metadata footer. The
// hero region adapts to the plugin type (image / video poster,
// sandboxed HTML iframe, design-system patch, plain text) — the
// classifier in `./preview.ts` picks the right surface and the
// shared `PreviewSurface` switchboard mounts it lazily so a
// 350-tile grid stays cheap.
//
// Hover reveals an overlay with the plugin description, tag chips,
// and primary actions (Use / Details), so the resting state stays
// gallery-clean while the active state surfaces everything the user
// needs to commit.

import { useMemo } from 'react';
import type { InstalledPluginRecord } from '@open-design/contracts';
import { Icon } from '../Icon';
import { PreviewSurface } from './cards/PreviewSurface';
import { inferPluginPreview } from './preview';

interface Props {
  record: InstalledPluginRecord;
  isActive: boolean;
  isPending: boolean;
  pendingAny: boolean;
  isFeatured: boolean;
  onUse: (record: InstalledPluginRecord) => void;
  onOpenDetails: (record: InstalledPluginRecord) => void;
}

const MAX_VISIBLE_TAGS = 3;

export function PluginCard({
  record,
  isActive,
  isPending,
  pendingAny,
  isFeatured,
  onUse,
  onOpenDetails,
}: Props) {
  const preview = useMemo(() => inferPluginPreview(record), [record]);
  const description = record.manifest?.description ?? '';
  const tags = useMemo(
    () =>
      (record.manifest?.tags ?? [])
        .filter((t) => !NOISE_TAGS.has(t.toLowerCase()))
        .slice(0, MAX_VISIBLE_TAGS),
    [record.manifest?.tags],
  );
  const hasQuery = Boolean(record.manifest?.od?.useCase?.query);

  return (
    <article
      role="listitem"
      className={[
        'plugins-home__card',
        `plugins-home__card--${preview.kind}`,
        isActive ? 'is-active' : '',
        isFeatured ? 'is-featured' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-plugin-id={record.id}
      data-preview-kind={preview.kind}
      {...(isFeatured ? { 'data-featured': 'true' } : {})}
    >
      <PreviewSurface
        pluginId={record.id}
        pluginTitle={record.title}
        preview={preview}
      />

      <div className="plugins-home__card-overlay">
        <div className="plugins-home__card-overlay-top">
          <span className={`plugins-home__trust trust-${record.trust}`}>
            {record.trust}
          </span>
          {isFeatured ? (
            <span className="plugins-home__overlay-featured" aria-hidden>
              <Icon name="star" size={11} />
            </span>
          ) : null}
        </div>
        <div className="plugins-home__card-overlay-body">
          <span className="plugins-home__overlay-title" title={record.title}>
            {record.title}
          </span>
          {description ? (
            <p className="plugins-home__overlay-desc">{description}</p>
          ) : null}
          {tags.length > 0 ? (
            <div className="plugins-home__overlay-tags">
              {tags.map((t) => (
                <span key={t} className="plugins-home__overlay-tag">
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="plugins-home__overlay-actions">
          <button
            type="button"
            className="plugins-home__action plugins-home__action--secondary"
            onClick={() => onOpenDetails(record)}
            aria-label={`View details for ${record.title}`}
            data-testid={`plugins-home-details-${record.id}`}
          >
            <Icon name="eye" size={12} />
            <span>Details</span>
          </button>
          <button
            type="button"
            className="plugins-home__action plugins-home__action--primary"
            onClick={() => onUse(record)}
            disabled={isPending || pendingAny}
            aria-busy={isPending ? 'true' : undefined}
            data-testid={`plugins-home-use-${record.id}`}
          >
            {isPending
              ? 'Applying…'
              : hasQuery
                ? isActive
                  ? 'Reload'
                  : 'Use'
                : isActive
                  ? 'Active'
                  : 'Use'}
          </button>
        </div>
      </div>

      <div className="plugins-home__card-foot">
        <span className="plugins-home__card-title" title={record.title}>
          {isFeatured ? (
            <Icon
              name="star"
              size={11}
              className="plugins-home__card-featured-mark"
            />
          ) : null}
          {record.title}
        </span>
        <span className={`plugins-home__trust trust-${record.trust}`}>
          {record.trust}
        </span>
      </div>
    </article>
  );
}

const NOISE_TAGS = new Set<string>([
  'first-party',
  'third-party',
  'phase-1',
  'phase-7',
  'untitled',
  'plugin',
]);
