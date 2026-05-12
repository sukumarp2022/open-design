// Sandboxed HTML preview surface — used for `examples/*` plugins
// and any scenario plugin that ships a runnable `od.preview.entry`.
//
// The iframe is mounted only after the card scrolls into view. We
// further guard the iframe behind a one-shot pointer hover (`armed`)
// for tiles that contain heavy interactive content; once armed it
// stays mounted so cursor flicker doesn't tear down the preview.
//
// The iframe is rendered tiny inside the card and visually scaled
// up via CSS `transform: scale(...)` so a full-size HTML doc reads
// as a thumbnail without needing a server-rendered screenshot. The
// daemon already enforces a strict CSP on the asset response.

import { useEffect, useState } from 'react';
import type { HtmlPreviewSpec } from '../preview';

interface Props {
  preview: HtmlPreviewSpec;
  pluginId: string;
  pluginTitle: string;
  inView: boolean;
}

export function HtmlSurface({ preview, pluginId, pluginTitle, inView }: Props) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!inView) return;
    // Auto-arm after a short visibility window so the user can scroll
    // past tiles without paying for an iframe per tile, but tiles that
    // linger get the live preview without requiring hover.
    const id = window.setTimeout(() => setArmed(true), 280);
    return () => window.clearTimeout(id);
  }, [inView]);

  return (
    <div
      className="plugins-home__html"
      data-plugin-id={pluginId}
      onMouseEnter={() => setArmed(true)}
    >
      <div className="plugins-home__html-frame">
        {armed ? (
          <iframe
            title={`${pluginTitle} preview`}
            src={preview.src}
            sandbox="allow-scripts"
            loading="lazy"
            tabIndex={-1}
            aria-hidden
            className="plugins-home__html-iframe"
          />
        ) : (
          <div className="plugins-home__html-skeleton" aria-hidden>
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
      <div className="plugins-home__html-chrome" aria-hidden>
        <span className="plugins-home__html-dot" />
        <span className="plugins-home__html-dot" />
        <span className="plugins-home__html-dot" />
        <span className="plugins-home__html-url">{preview.label}</span>
      </div>
    </div>
  );
}
