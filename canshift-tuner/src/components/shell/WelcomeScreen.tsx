import type { CSSProperties, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { BrandLockup } from '@/components/brand/BrandLockup'

const SUPPORTED_BROWSERS = ['Chrome 89+', 'Edge 89+', 'Brave', 'Opera']

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: 'Plug your dash',
    body: 'USB-C cable, directly into your computer. No hub.',
  },
  {
    title: 'Pick the port',
    body: 'Click Connect device. Your browser asks which USB port to use.',
  },
  {
    title: 'Start tuning',
    body: 'Edit your dashboard live — your changes preview as you type.',
  },
]

export interface WelcomeScreenProps {
  supported?: boolean
  busy?: boolean
  reconnecting?: boolean
  lastError?: string | null
  onConnect?: () => void
  onExploreSimulation?: () => void
  footerLinks?: ReactNode
}

export const WelcomeScreen = ({
  supported = true,
  busy = false,
  reconnecting = false,
  lastError = null,
  onConnect,
  onExploreSimulation,
  footerLinks,
}: WelcomeScreenProps) => {
  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        <header style={heroStyle}>
          <div style={lockupStyle}>
            <BrandLockup height={78} withBaseline label="CANShift Tuner" />
          </div>
          <h1 style={titleStyle}>Configure your dash, live.</h1>
          <p style={taglineStyle}>
            Edit pages, bind CAN signals, tune OBD-II polling — all in your browser, with the dash
            connected over USB. No install, nothing to deploy.
          </p>
        </header>

        {!supported ? (
          <UnsupportedBrowserCard />
        ) : (
          <>
            <ol style={stepsStyle}>
              {STEPS.map((step, idx) => (
                <li key={step.title} style={stepStyle}>
                  <div style={stepNumberStyle}>{idx + 1}</div>
                  <div>
                    <div style={stepTitleStyle}>{step.title}</div>
                    <div style={stepBodyStyle}>{step.body}</div>
                  </div>
                </li>
              ))}
            </ol>

            <div style={ctaRowStyle}>
              <Button
                type="button"
                disabled={busy}
                onClick={onConnect}
                className="h-auto gap-0"
                style={{
                  ...connectButtonStyle,
                  cursor: busy ? 'wait' : 'pointer',
                  opacity: busy ? 0.7 : 1,
                }}
              >
                {busy ? (
                  <>
                    <Spinner /> {reconnecting ? 'Reconnecting…' : 'Connecting…'}
                  </>
                ) : (
                  'Connect device'
                )}
              </Button>
              {onExploreSimulation && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={onExploreSimulation}
                  className="h-auto gap-0"
                  style={{
                    ...exploreButtonStyle,
                    cursor: busy ? 'wait' : 'pointer',
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  Explore with sample data
                </Button>
              )}
            </div>

            {lastError ? <div style={errorPillStyle}>{lastError}</div> : null}
          </>
        )}

        {footerLinks ? <footer style={footerStyle}>{footerLinks}</footer> : null}
      </div>
    </div>
  )
}

const UnsupportedBrowserCard = () => (
  <div style={unsupportedCardStyle} role="alert">
    <div
      style={{
        fontWeight: 600,
        color: 'hsl(var(--text))',
        marginBottom: 6,
      }}
    >
      WebSerial isn't available in this browser
    </div>
    <div style={{ fontSize: 13, marginBottom: 12 }}>
      CANShift Tuner needs the WebSerial API to talk to the dash over USB. Open this page in one of
      the supported browsers — or copy the URL and paste it into the new one:
    </div>
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13 }}>
      {SUPPORTED_BROWSERS.map((b) => (
        <li key={b} style={{ padding: '2px 0' }}>
          · {b}
        </li>
      ))}
    </ul>
  </div>
)

const Spinner = () => (
  <span
    aria-hidden="true"
    style={{
      display: 'inline-block',
      width: 12,
      height: 12,
      border: '2px solid hsl(var(--brand-ground))',
      borderTopColor: 'transparent',
      borderRadius: '50%',
      animation: 'canshift-tuner-spin 700ms linear infinite',
      marginRight: 8,
      verticalAlign: '-2px',
    }}
  />
)

const containerStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'hsl(var(--bg))',
  padding: '48px 32px',
  overflowY: 'auto',
}

const contentStyle: CSSProperties = {
  width: '100%',
  maxWidth: 540,
  display: 'flex',
  flexDirection: 'column',
  gap: 28,
}

const heroStyle: CSSProperties = {
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
}

const lockupStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  color: 'hsl(var(--text))',
}

const titleStyle: CSSProperties = {
  fontSize: 30,
  fontWeight: 700,
  color: 'hsl(var(--text))',
  letterSpacing: '-0.02em',
  margin: 0,
  lineHeight: 1.15,
}

const taglineStyle: CSSProperties = {
  fontSize: 14,
  color: 'hsl(var(--text-dim))',
  lineHeight: 1.6,
  margin: 0,
  maxWidth: 440,
}

const stepsStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

const stepStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 14,
  padding: '14px 16px',
  background: 'hsl(var(--surface))',
  border: '1px solid hsl(var(--border))',
}

const stepNumberStyle: CSSProperties = {
  width: 28,
  height: 28,
  flexShrink: 0,
  background: 'hsl(var(--brand-accent) / 0.15)',
  color: 'hsl(var(--brand-accent))',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
  fontSize: 13,
  marginTop: 2,
}

const stepTitleStyle: CSSProperties = {
  fontWeight: 600,
  color: 'hsl(var(--text))',
  fontSize: 14,
  marginBottom: 2,
}

const stepBodyStyle: CSSProperties = {
  fontSize: 13,
  color: 'hsl(var(--text-dim))',
  lineHeight: 1.5,
}

const ctaRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  marginTop: 4,
}

const connectButtonStyle: CSSProperties = {
  background: 'hsl(var(--brand-accent))',
  color: 'hsl(var(--brand-ground))',
  border: 'none',
  padding: '14px 28px',
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const exploreButtonStyle: CSSProperties = {
  background: 'transparent',
  color: 'hsl(var(--text-dim))',
  border: '1px solid hsl(var(--border))',
  padding: '13px 22px',
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.04em',
}

const errorPillStyle: CSSProperties = {
  background: 'hsl(var(--bg-inset))',
  border: '1px solid hsl(var(--destructive))',
  color: 'hsl(var(--destructive))',
  padding: '10px 14px',
  fontSize: 13,
  textAlign: 'center',
}

const unsupportedCardStyle: CSSProperties = {
  background: 'hsl(var(--bg-inset))',
  border: '1px solid hsl(var(--border))',
  padding: '18px 20px',
  color: 'hsl(var(--text-dim))',
  textAlign: 'left',
  fontSize: 13,
}

const footerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  paddingTop: 8,
  borderTop: '1px solid hsl(var(--border))',
  marginTop: 8,
}
