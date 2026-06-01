// PageThumbnail.tsx — Mini read-only render of one dashboard page.
// The page is rendered at its full target-profile resolution into an
// absolutely-sized container, then a single CSS `transform: scale()` shrinks
// it to thumbnail size. Avoids the broken-proportions problem where each
// widget's font-size formula has `Math.max(N, ...)` floors that don't scale
// down — the full-render-then-scale approach keeps every typographic ratio
// identical to the live canvas.

import type { PageConfig, ScreenProfile, TopBarConfig } from '@tmbk/canshift-core'
import { DEFAULT_PAGE_PALETTE, resolveScreenProfile } from '@tmbk/canshift-core'
import { useDashboardStore } from '../stores/dashboard.store'
import { CruiseControlPreview } from '../components/editor/CruiseControlPreview'
import { WidgetPreview } from '../components/editor/WidgetPreview'

export const THUMB_W = 128 // px

export interface PageThumbnailProps {
  page: PageConfig
  topBar: TopBarConfig
}

export function PageThumbnail({ page, topBar }: PageThumbnailProps) {
  const targetProfileId = useDashboardStore((s) => s.config?.targetProfile)
  // The active target screen profile drives the thumbnail aspect ratio so
  // every thumbnail matches what the live canvas would render (issue #548).
  // Undefined falls back to the default catalog entry (`crowpanel-28`).
  const profile: ScreenProfile = resolveScreenProfile(targetProfileId)
  const thumbH = Math.round((THUMB_W * profile.height) / profile.width)
  const thumbScale = THUMB_W / profile.width
  const fullBarH = page.showTopBar ? topBar.height : 0
  const isCruiseTemplate = page.template === 'cruise_control'

  return (
    <div
      style={{
        width: THUMB_W,
        height: thumbH,
        background: page.backgroundColor,
        overflow: 'hidden',
        position: 'relative',
        borderRadius: 2,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: profile.width,
          height: profile.height,
          position: 'absolute',
          top: 0,
          left: 0,
          background: page.backgroundColor,
          transform: `scale(${String(thumbScale)})`,
          transformOrigin: 'top left',
        }}
      >
        {/* Top bar stripe */}
        {page.showTopBar && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: fullBarH,
              background: topBar.bgColor,
              borderBottom: '1px solid #1E1E1E',
            }}
          />
        )}

        {/* Body — template-rendered pages render via CruiseControlPreview
            (same component the live canvas uses); custom pages render each
            widget at its native firmware-px dimensions. Both paths share the
            outer scale transform so the thumbnail mirrors the canvas
            pixel-for-pixel. */}
        {isCruiseTemplate ? (
          <CruiseControlPreview
            scale={1}
            canvasW={profile.width}
            contentH={profile.height - fullBarH}
            palette={page.palette ?? DEFAULT_PAGE_PALETTE}
          />
        ) : (
          page.widgets.map((widget) => (
            <div
              key={widget.id}
              style={{
                position: 'absolute',
                left: widget.layout.x,
                top: fullBarH + widget.layout.y,
                width: widget.layout.w,
                height: widget.layout.h,
                overflow: 'hidden',
              }}
            >
              <WidgetPreview
                widget={widget}
                displayW={widget.layout.w}
                displayH={widget.layout.h}
                noAnimate
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
