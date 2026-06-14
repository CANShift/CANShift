import type { Widget } from '@tmbk/canshift-core'

import { SIZE_TOKENS, STANDARD_TOKEN_IDS, tokenFromDimensions } from '../../../../utils/size-tokens'
import { Field } from '../shared'

const PANEL_LABEL = '#AAAAAA'
const TOKEN_TILE_BG = '#111111'
const TOKEN_TILE_BORDER = '#2A2A2A'
const TOKEN_TILE_ACTIVE_BG = '#1A2A1A'
const TOKEN_TILE_ACTIVE_BORDER = '#448844'
const TOKEN_TILE_ACTIVE_FG = '#66AA66'

interface SizeTokenPickerProps {
  widget: Widget
  onChange: (patch: Partial<Widget>) => void
}

export const SizeTokenPicker = ({ widget, onChange }: SizeTokenPickerProps) => {
  const activeTokenId =
    tokenFromDimensions(widget.layout.w, widget.layout.h) ?? STANDARD_TOKEN_IDS[0] ?? null

  return (
    <Field label="Size">
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {STANDARD_TOKEN_IDS.map((tokenId) => {
          const token = SIZE_TOKENS[tokenId]
          const isActive = tokenId === activeTokenId
          return (
            <button
              key={tokenId}
              onClick={() => {
                onChange({ layout: { ...widget.layout, w: token.w, h: token.h } })
              }}
              title={token.description}
              style={{
                flex: 1,
                padding: '3px 0',
                background: isActive ? TOKEN_TILE_ACTIVE_BG : TOKEN_TILE_BG,
                border: `1px solid ${isActive ? TOKEN_TILE_ACTIVE_BORDER : TOKEN_TILE_BORDER}`,
                borderRadius: 3,
                color: isActive ? TOKEN_TILE_ACTIVE_FG : PANEL_LABEL,
                cursor: 'pointer',
                fontSize: 10,
                fontWeight: isActive ? 700 : 400,
              }}
            >
              {token.label}
            </button>
          )
        })}
      </div>
    </Field>
  )
}
