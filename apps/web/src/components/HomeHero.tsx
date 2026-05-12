// Lovart-style centered hero for the entry Home view.
//
// The prompt textarea is the canonical creation surface: the user
// either types freely or selects a plugin below to load an example
// query, then presses Run / Enter to spawn a project. The hero is
// kept dependency-free (no plugin list / project list) so it can be
// composed with the recent-projects strip and plugins section
// without owning their data lifecycles.

import { forwardRef, useMemo, useState } from 'react';
import type { InstalledPluginRecord } from '@open-design/contracts';
import { Icon } from './Icon';
import {
  chipsForGroup,
  type ChipGroup,
  type HomeHeroChip,
} from './home-hero/chips';

export interface HomeHeroSubmitHandler {
  (): void;
}

interface Props {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmit: HomeHeroSubmitHandler;
  activePluginTitle: string | null;
  activeChipId: string | null;
  onClearActivePlugin: () => void;
  pluginOptions: InstalledPluginRecord[];
  pluginsLoading: boolean;
  pendingPluginId: string | null;
  pendingChipId: string | null;
  onPickPlugin: (record: InstalledPluginRecord, nextPrompt: string | null) => void;
  onPickChip: (chip: HomeHeroChip) => void;
  contextItemCount: number;
  error: string | null;
}

export const HomeHero = forwardRef<HTMLTextAreaElement, Props>(function HomeHero(
  {
    prompt,
    onPromptChange,
    onSubmit,
    activePluginTitle,
    activeChipId,
    onClearActivePlugin,
    pluginOptions,
    pluginsLoading,
    pendingPluginId,
    pendingChipId,
    onPickPlugin,
    onPickChip,
    contextItemCount,
    error,
  },
  ref,
) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const canSubmit = prompt.trim().length > 0;
  const placeholder = activePluginTitle
    ? 'Edit the example query or write your own…'
    : 'What do you want to design? Type a prompt, @search a plugin, or pick one below…';
  const mention = getPluginMention(prompt);
  const pickerOptions = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return pluginOptions
      .filter((plugin) => {
        if (!q) return true;
        return [
          plugin.title,
          plugin.id,
          plugin.manifest?.description ?? '',
          ...(plugin.manifest?.tags ?? []),
        ]
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .slice(0, 6);
  }, [mention, pluginOptions]);
  const pickerOpen = Boolean(mention) && (pluginsLoading || pickerOptions.length > 0);

  function pickPlugin(record: InstalledPluginRecord) {
    const nextPrompt = mention ? replaceMentionToken(prompt, mention) : null;
    onPickPlugin(record, nextPrompt);
  }

  return (
    <section className="home-hero" data-testid="home-hero">
      <div className="home-hero__brand" aria-hidden>
        <span className="home-hero__brand-mark">
          <img src="/app-icon.svg" alt="" draggable={false} />
        </span>
        <span className="home-hero__brand-name">Open Design</span>
      </div>
      <h1 className="home-hero__title">What do you want to design?</h1>
      <p className="home-hero__subtitle">
        Pick a plugin below to load an example query, or just type freely
        and press <kbd>Enter</kbd>.
      </p>

      <div className="home-hero__input-card">
        {activePluginTitle ? (
          <div className="home-hero__active" data-testid="home-hero-active-plugin">
            <span className="home-hero__active-chip">
              <span className="home-hero__active-dot" aria-hidden />
              <span>Plugin: {activePluginTitle}</span>
              <button
                type="button"
                className="home-hero__active-clear"
                onClick={onClearActivePlugin}
                aria-label="Clear active plugin"
                title="Clear active plugin"
              >
                ×
              </button>
            </span>
            {contextItemCount > 0 ? (
              <span className="home-hero__context-summary">
                {contextItemCount} context items resolved
              </span>
            ) : null}
          </div>
        ) : null}
        <textarea
          ref={ref}
          className="home-hero__input"
          data-testid="home-hero-input"
          value={prompt}
          onChange={(e) => {
            onPromptChange(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={(e) => {
            if (pickerOpen && pickerOptions.length > 0) {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((idx) => (idx + 1) % pickerOptions.length);
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((idx) => (idx - 1 + pickerOptions.length) % pickerOptions.length);
                return;
              }
              if (e.key === 'Tab') {
                e.preventDefault();
                const selected = pickerOptions[selectedIndex] ?? pickerOptions[0];
                if (selected) pickPlugin(selected);
                return;
              }
            }
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.metaKey &&
              !e.ctrlKey &&
              !e.altKey
            ) {
              e.preventDefault();
              if (pickerOpen && pickerOptions.length > 0) {
                const selected = pickerOptions[selectedIndex] ?? pickerOptions[0];
                if (selected) pickPlugin(selected);
                return;
              }
              if (canSubmit) onSubmit();
            }
          }}
          placeholder={placeholder}
          rows={3}
          aria-controls={pickerOpen ? 'home-hero-plugin-picker' : undefined}
          aria-expanded={pickerOpen}
        />
        {pickerOpen ? (
          <div
            id="home-hero-plugin-picker"
            className="home-hero__plugin-picker"
            role="listbox"
            aria-label="Plugin search results"
            data-testid="home-hero-plugin-picker"
          >
            {pluginsLoading ? (
              <div className="home-hero__plugin-picker-empty">Loading plugins…</div>
            ) : (
              pickerOptions.map((plugin, idx) => (
                <button
                  key={plugin.id}
                  type="button"
                  role="option"
                  aria-selected={idx === selectedIndex}
                  className={`home-hero__plugin-option${idx === selectedIndex ? ' is-active' : ''}`}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pickPlugin(plugin);
                  }}
                  disabled={pendingPluginId !== null}
                >
                  <span className="home-hero__plugin-option-main">
                    <span>{plugin.title}</span>
                    <span>{plugin.manifest?.description ?? plugin.id}</span>
                  </span>
                  <span className="home-hero__plugin-option-meta">
                    {pendingPluginId === plugin.id ? 'Applying…' : getPluginSourceLabel(plugin)}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : null}
        <div className="home-hero__input-foot">
          <span className="home-hero__hint">
            <kbd>↵</kbd> to run · <kbd>Shift</kbd>+<kbd>↵</kbd> for new line
          </span>
          <button
            type="button"
            className="home-hero__submit"
            data-testid="home-hero-submit"
            onClick={onSubmit}
            disabled={!canSubmit}
            title={canSubmit ? 'Run' : 'Type something to run'}
            aria-label="Run"
          >
            <Icon name="arrow-up" size={18} />
          </button>
        </div>
      </div>

      <div
        className="home-hero__rail"
        role="toolbar"
        aria-label="Pick a project category or migration shortcut"
        data-testid="home-hero-rail"
      >
        <RailGroup
          group="create"
          activeChipId={activeChipId}
          pendingChipId={pendingChipId}
          pendingPluginId={pendingPluginId}
          onPickChip={onPickChip}
        />
        <span className="home-hero__rail-divider" aria-hidden />
        <RailGroup
          group="migrate"
          activeChipId={activeChipId}
          pendingChipId={pendingChipId}
          pendingPluginId={pendingPluginId}
          onPickChip={onPickChip}
        />
      </div>

      {error ? (
        <div role="alert" className="home-hero__error">
          {error}
        </div>
      ) : null}
    </section>
  );
});

interface PluginMention {
  start: number;
  end: number;
  query: string;
}

function getPluginMention(value: string): PluginMention | null {
  const start = value.lastIndexOf('@');
  if (start < 0) return null;
  const before = value[start - 1];
  if (before && !/\s/.test(before)) return null;
  const tail = value.slice(start + 1);
  const match = /^[^\s@]*/.exec(tail);
  if (!match) return null;
  return {
    start,
    end: start + 1 + match[0].length,
    query: match[0],
  };
}

function replaceMentionToken(value: string, mention: PluginMention): string | null {
  const before = value.slice(0, mention.start).trimEnd();
  const after = value.slice(mention.end).trimStart();
  const next = [before, after].filter(Boolean).join(' ').trim();
  return next.length > 0 ? next : null;
}

function getPluginSourceLabel(plugin: InstalledPluginRecord): string {
  return plugin.sourceKind === 'bundled' ? 'Community' : 'My plugin';
}

interface RailGroupProps {
  group: ChipGroup;
  activeChipId: string | null;
  pendingChipId: string | null;
  pendingPluginId: string | null;
  onPickChip: (chip: HomeHeroChip) => void;
}

function RailGroup({
  group,
  activeChipId,
  pendingChipId,
  pendingPluginId,
  onPickChip,
}: RailGroupProps) {
  const chips = useMemo(() => chipsForGroup(group), [group]);
  return (
    <div
      className={`home-hero__rail-group home-hero__rail-group--${group}`}
      data-rail-group={group}
    >
      {chips.map((chip) => {
        const isActive = activeChipId === chip.id;
        const isPending = pendingChipId === chip.id;
        const cls = ['home-hero__rail-chip', `home-hero__rail-chip--${group}`];
        if (isActive) cls.push('is-active');
        if (isPending) cls.push('is-pending');
        return (
          <button
            key={chip.id}
            type="button"
            className={cls.join(' ')}
            data-chip-id={chip.id}
            data-testid={`home-hero-rail-${chip.id}`}
            onClick={() => onPickChip(chip)}
            disabled={isPending || pendingPluginId !== null}
            aria-pressed={isActive}
            title={chip.hint ?? chip.label}
          >
            <Icon name={chip.icon} size={14} className="home-hero__rail-chip-icon" />
            <span className="home-hero__rail-chip-label">{chip.label}</span>
          </button>
        );
      })}
    </div>
  );
}
