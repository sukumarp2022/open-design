// Design-system preview surface — a stylised "X feels like X" tile.
//
// Design-system plugins do not ship a runnable preview entry, so we
// synthesise a brand patch from the manifest:
//   - large serif headline using the bare brand label
//   - three colour swatches derived deterministically from the
//     plugin id (so each system gets a stable visual fingerprint)
//   - subtle typographic specimen ("Aa Bb Cc") for character
//
// This mirrors the look of the design-systems gallery in the
// project view without requiring the daemon to render a real
// HTML preview for every system at home-load time.

import type { DesignPreviewSpec } from '../preview';

interface Props {
  preview: DesignPreviewSpec;
}

export function DesignSystemSurface({ preview }: Props) {
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
