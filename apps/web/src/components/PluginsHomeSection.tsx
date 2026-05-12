// Plugins discovery section on Home.
//
// Renders a 3-axis faceted filter (SURFACE / TYPE / SCENARIO) over
// the bundled plugin catalog. Each axis is independent and the
// selections compose via AND, so users dial in scope one dimension at
// a time. A small Featured chip sits orthogonal to the facet rows for
// quick access to curator-promoted picks.
//
// Derivation, catalog building and AND-composition live in
// `./plugins-home/facets.ts`; per-axis selection state and the
// Featured override live in `./plugins-home/usePluginFacets.ts`. This
// file owns layout only.

import type { InstalledPluginRecord } from '@open-design/contracts';
import { Icon } from './Icon';
import { PluginCard } from './plugins-home/PluginCard';
import {
  usePluginFacets,
  type FilterMode,
} from './plugins-home/usePluginFacets';
import type {
  FacetAxis,
  FacetOption,
  FacetSelection,
} from './plugins-home/facets';

interface Props {
  plugins: InstalledPluginRecord[];
  loading: boolean;
  activePluginId: string | null;
  pendingApplyId: string | null;
  onUse: (record: InstalledPluginRecord) => void;
  onOpenDetails: (record: InstalledPluginRecord) => void;
}

export function PluginsHomeSection({
  plugins,
  loading,
  activePluginId,
  pendingApplyId,
  onUse,
  onOpenDetails,
}: Props) {
  const {
    visiblePlugins,
    featuredList,
    filtered,
    catalog,
    selection,
    pickFacet,
    clearFacets,
    hasActiveFacet,
    mode,
    setMode,
    totalVisible,
  } = usePluginFacets({ plugins });

  return (
    <section className="plugins-home" data-testid="plugins-home-section">
      <header className="plugins-home__head">
        <div className="plugins-home__heading">
          <h2 className="plugins-home__title">Community</h2>
          <p className="plugins-home__subtitle">
            Things you can do and tasks to complete — packaged as plugins. Pick one to load a starter prompt, or type freely above.
          </p>
        </div>
        <span className="plugins-home__count">
          {loading ? '…' : `${filtered.length} of ${totalVisible}`}
        </span>
      </header>

      {loading ? (
        <div className="plugins-home__empty">Loading catalog…</div>
      ) : visiblePlugins.length === 0 ? (
        <div className="plugins-home__empty">
          Catalog is empty. Bundled plugins ship with Open Design and should appear
          here automatically — try restarting the daemon if this persists.
        </div>
      ) : (
        <>
          <ModeRow
            mode={mode}
            featuredCount={featuredList.length}
            totalVisible={totalVisible}
            hasActiveFacet={hasActiveFacet}
            onModeChange={setMode}
            onClearFacets={clearFacets}
          />
          <FacetTable
            catalog={catalog}
            selection={selection}
            totalVisible={totalVisible}
            onPick={pickFacet}
          />

          {filtered.length === 0 ? (
            <div className="plugins-home__empty plugins-home__empty--filtered">
              No plugins match the current filters.{' '}
              <button
                type="button"
                className="plugins-home__linkbtn"
                onClick={clearFacets}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="plugins-home__grid" role="list">
              {filtered.map((p) => (
                <PluginCard
                  key={p.id}
                  record={p}
                  isActive={activePluginId === p.id}
                  isPending={pendingApplyId === p.id}
                  pendingAny={pendingApplyId !== null}
                  isFeatured={featuredList.some((f) => f.id === p.id)}
                  onUse={onUse}
                  onOpenDetails={onOpenDetails}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

interface ModeRowProps {
  mode: FilterMode;
  featuredCount: number;
  totalVisible: number;
  hasActiveFacet: boolean;
  onModeChange: (next: FilterMode) => void;
  onClearFacets: () => void;
}

// Tiny strip above the facet table: Featured override + a clear-link
// when at least one facet is active. Kept compact so the SURFACE row
// is what the eye lands on first.
function ModeRow({
  mode,
  featuredCount,
  totalVisible,
  hasActiveFacet,
  onModeChange,
  onClearFacets,
}: ModeRowProps) {
  return (
    <div className="plugins-home__mode" role="group" aria-label="Plugin mode">
      {featuredCount > 0 ? (
        <button
          type="button"
          className={[
            'plugins-home__chip',
            'plugins-home__chip--featured',
            mode === 'featured' ? 'is-active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onModeChange(mode === 'featured' ? 'all' : 'featured')}
          aria-pressed={mode === 'featured'}
          data-testid="plugins-home-chip-featured"
        >
          <Icon name="star" size={11} />
          <span>Featured</span>
          <span className="plugins-home__chip-count">{featuredCount}</span>
        </button>
      ) : null}
      <span className="plugins-home__mode-total">
        {totalVisible} in catalog
      </span>
      {hasActiveFacet ? (
        <button
          type="button"
          className="plugins-home__linkbtn"
          onClick={onClearFacets}
          data-testid="plugins-home-clear"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}

interface FacetTableProps {
  catalog: ReturnType<typeof usePluginFacets>['catalog'];
  selection: FacetSelection;
  totalVisible: number;
  onPick: (axis: FacetAxis, slug: string | null) => void;
}

function FacetTable({ catalog, selection, totalVisible, onPick }: FacetTableProps) {
  return (
    <div className="plugins-home__facets" role="group" aria-label="Plugin filters">
      <FacetRow
        axis="surface"
        label="Surface"
        options={catalog.surface}
        selectedSlug={selection.surface}
        totalVisible={totalVisible}
        onPick={onPick}
      />
      <FacetRow
        axis="type"
        label="Type"
        options={catalog.type}
        selectedSlug={selection.type}
        totalVisible={totalVisible}
        onPick={onPick}
      />
      <FacetRow
        axis="scenario"
        label="Scenario"
        options={catalog.scenario}
        selectedSlug={selection.scenario}
        totalVisible={totalVisible}
        onPick={onPick}
      />
    </div>
  );
}

interface FacetRowProps {
  axis: FacetAxis;
  label: string;
  options: FacetOption[];
  selectedSlug: string | null;
  totalVisible: number;
  onPick: (axis: FacetAxis, slug: string | null) => void;
}

function FacetRow({ axis, label, options, selectedSlug, totalVisible, onPick }: FacetRowProps) {
  if (options.length === 0) return null;
  return (
    <div className="plugins-home__facet-row" data-testid={`plugins-home-row-${axis}`}>
      <span className="plugins-home__facet-label">{label}</span>
      <div className="plugins-home__facet-pills" role="tablist" aria-label={`${label} filter`}>
        <FacetPill
          slug={null}
          label="All"
          count={totalVisible}
          active={selectedSlug === null}
          onPick={(slug) => onPick(axis, slug)}
          axis={axis}
          variant="all"
        />
        {options.map((opt) => (
          <FacetPill
            key={opt.slug}
            slug={opt.slug}
            label={opt.label}
            count={opt.count}
            active={selectedSlug === opt.slug}
            onPick={(slug) => onPick(axis, slug)}
            axis={axis}
          />
        ))}
      </div>
    </div>
  );
}

interface FacetPillProps {
  axis: FacetAxis;
  slug: string | null;
  label: string;
  count: number;
  active: boolean;
  variant?: 'all';
  onPick: (slug: string | null) => void;
}

function FacetPill({ axis, slug, label, count, active, variant, onPick }: FacetPillProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={[
        'plugins-home__pill',
        active ? 'is-active' : '',
        variant === 'all' ? 'plugins-home__pill--all' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onPick(slug)}
      data-testid={`plugins-home-pill-${axis}-${slug ?? 'all'}`}
    >
      <span>{label}</span>
      <span className="plugins-home__pill-count">{count}</span>
    </button>
  );
}
