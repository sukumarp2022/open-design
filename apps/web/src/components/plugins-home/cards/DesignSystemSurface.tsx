// Design-system preview surface — showcase thumbnail with a brand-patch fallback.
//
// Most design-system plugins reference an upstream design system in
// `od.context.designSystem.ref`. When available, reuse the same
// showcase HTML as the detail modal so the home grid reads like real
// website thumbnails rather than synthetic color swatches. The fetch
// is lazy and cached to keep the 100+ design-system catalog cheap.

import { useEffect, useState } from 'react';
import type { DesignPreviewSpec } from '../preview';
import { fetchDesignSystemShowcase } from '../../../providers/registry';
import { buildSrcdoc } from '../../../runtime/srcdoc';

interface Props {
  preview: DesignPreviewSpec;
  inView: boolean;
}

const showcaseCache = new Map<string, string | null>();
const showcaseInflight = new Map<string, Promise<string | null>>();

function fetchCachedShowcase(id: string): Promise<string | null> {
  const cached = showcaseCache.get(id);
  if (cached !== undefined) return Promise.resolve(cached);
  const existing = showcaseInflight.get(id);
  if (existing) return existing;
  const run = fetchDesignSystemShowcase(id).then((html) => {
    showcaseCache.set(id, html);
    showcaseInflight.delete(id);
    return html;
  });
  showcaseInflight.set(id, run);
  return run;
}

function useShowcaseHtml(
  designSystemId: string | null,
  inView: boolean,
): string | null | undefined {
  const [html, setHtml] = useState<string | null | undefined>(() =>
    designSystemId ? showcaseCache.get(designSystemId) : undefined,
  );

  useEffect(() => {
    if (!designSystemId) {
      setHtml(undefined);
      return;
    }
    const cached = showcaseCache.get(designSystemId);
    if (cached !== undefined) {
      setHtml(cached);
      return;
    }
    if (!inView) return;
    let cancelled = false;
    setHtml(null);
    fetchCachedShowcase(designSystemId).then((next) => {
      if (!cancelled) setHtml(next);
    });
    return () => {
      cancelled = true;
    };
  }, [designSystemId, inView]);

  return html;
}

export function DesignSystemSurface({ preview, inView }: Props) {
  const showcaseHtml = useShowcaseHtml(preview.designSystemId, inView);

  if (showcaseHtml) {
    return (
      <div className="plugins-home__design plugins-home__design--showcase">
        <div className="plugins-home__design-showcase">
          <iframe
            title={`${preview.brand} showcase preview`}
            sandbox="allow-scripts"
            srcDoc={buildSrcdoc(showcaseHtml)}
            tabIndex={-1}
            aria-hidden
            className="plugins-home__design-iframe"
          />
        </div>
      </div>
    );
  }

  const [primary, secondary, ink] = preview.swatches;
  return (
    <div
      className="plugins-home__design"
      style={{
        background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
        color: ink,
      }}
    >
      <div className="plugins-home__design-headline">
        The system that <br />
        makes <strong>{preview.brand}</strong> <br />
        feel like {preview.brand}.
      </div>
      <div className="plugins-home__design-specimen" aria-hidden>
        <span>Aa</span>
        <span>Bb</span>
        <span>Cc</span>
      </div>
      <div className="plugins-home__design-swatches" aria-hidden>
        {preview.swatches.map((c, i) => (
          <span key={i} style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}
