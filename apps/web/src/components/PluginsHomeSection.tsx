// Plugins discovery section on Home.
//
// Renders a single curated "category bar" (Lovart-style) over the
// bundled plugin catalog: Slides · Prototype · Design system ·
// HyperFrames · Video · Image · Audio. Picking a category filters
// the grid; "All" shows everything visible. A small Featured chip
// sits orthogonal to the row for quick access to curator-promoted
// picks.
//
// The category list is intentionally short and curated — finer
// metadata (surface, role tags, scenario domains) lives on each
// plugin card and detail surface, not in the filter bar.
//
// Derivation, catalog building and category-based filtering live in
// `./plugins-home/facets.ts`; selection state and the Featured
// override live in `./plugins-home/usePluginFacets.ts`. This file
// owns layout only.

import type { InstalledPluginRecord } from '@open-design/contracts';
import { Icon } from './Icon';
import { PluginCard } from './plugins-home/PluginCard';
import {
  usePluginFacets,
  type FilterMode,
} from './plugins-home/usePluginFacets';
import type { FacetOption } from './plugins-home/facets';

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
    pickCategory,
    clearFacets,
    hasActiveFacet,
    mode,
    setMode,
    query,
    setQuery,
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
        <div className="plugins-home__head-tools">
          <SearchInput value={query} onChange={setQuery} />
          <span className="plugins-home__count">
            {loading ? '…' : `${filtered.length} of ${totalVisible}`}
          </span>
        </div>
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
          <CategoryRow
            options={catalog.category}
            selectedSlug={selection.category}
            totalVisible={totalVisible}
            onPick={pickCategory}
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

// Tiny strip above the category row: Featured override + a clear-link
// when at least one filter is active. Kept compact so the category
// bar is what the eye lands on first.
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

interface CategoryRowProps {
  options: FacetOption[];
  selectedSlug: string | null;
  totalVisible: number;
  onPick: (slug: string | null) => void;
}

function CategoryRow({ options, selectedSlug, totalVisible, onPick }: CategoryRowProps) {
  if (options.length === 0) return null;
  return (
    <div
      className="plugins-home__facets"
      role="group"
      aria-label="Plugin filters"
    >
      <div
        className="plugins-home__facet-row plugins-home__facet-row--inline"
        data-testid="plugins-home-row-category"
      >
        <div
          className="plugins-home__facet-pills"
          role="tablist"
          aria-label="Category filter"
        >
          <CategoryPill
            slug={null}
            label="All"
            count={totalVisible}
            active={selectedSlug === null}
            onPick={onPick}
            variant="all"
          />
          {options.map((opt) => (
            <CategoryPill
              key={opt.slug}
              slug={opt.slug}
              label={opt.label}
              count={opt.count}
              active={selectedSlug === opt.slug}
              onPick={onPick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface CategoryPillProps {
  slug: string | null;
  label: string;
  count: number;
  active: boolean;
  variant?: 'all';
  onPick: (slug: string | null) => void;
}

function CategoryPill({ slug, label, count, active, variant, onPick }: CategoryPillProps) {
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
      data-testid={`plugins-home-pill-category-${slug ?? 'all'}`}
    >
      <span>{label}</span>
      <span className="plugins-home__pill-count">{count}</span>
    </button>
  );
}

interface SearchInputProps {
  value: string;
  onChange: (next: string) => void;
}

// Compact search field that lives in the section head. Search composes
// with the category selection via AND inside the hook, so a query
// narrows whatever category the user has already picked rather than
// discarding the category context. We keep the UI a single text input
// with an optional clear button so it sits inside the existing head
// row without a heavyweight toolbar.
function SearchInput({ value, onChange }: SearchInputProps) {
  return (
    <div className="plugins-home__search">
      <Icon name="search" size={12} className="plugins-home__search-icon" />
      <input
        type="search"
        className="plugins-home__search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search plugins…"
        aria-label="Search plugins"
        data-testid="plugins-home-search"
        spellCheck={false}
        autoComplete="off"
      />
      {value ? (
        <button
          type="button"
          className="plugins-home__search-clear"
          onClick={() => onChange('')}
          aria-label="Clear search"
          data-testid="plugins-home-search-clear"
        >
          <Icon name="close" size={12} />
        </button>
      ) : null}
    </div>
  );
}
