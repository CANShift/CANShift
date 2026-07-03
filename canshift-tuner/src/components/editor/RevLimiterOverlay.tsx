const REV_LIMIT_BORDER_PX = 8

export interface RevLimiterOverlayProps {
  canvasW: number
  flashPhase: boolean
  scale: number
}

export const RevLimiterOverlay = ({ canvasW, flashPhase, scale }: RevLimiterOverlayProps) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        border: `${Math.round(REV_LIMIT_BORDER_PX * scale)}px solid #FF0000`,
        opacity: flashPhase ? 1 : 0.5,
        transition: 'opacity 0.1s',
        pointerEvents: 'none',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={canvasW * 0.28} height={canvasW * 0.28} viewBox="0 0 100 100">
        <polygon
          points="50,8 96,90 4,90"
          fill="none"
          stroke="#FF4444"
          strokeWidth="7"
          strokeLinejoin="round"
        />
        <text
          x="50"
          y="80"
          textAnchor="middle"
          fill="#FF4444"
          fontSize="52"
          fontWeight="900"
          fontFamily="monospace"
        >
          !
        </text>
      </svg>
    </div>
  )
}
