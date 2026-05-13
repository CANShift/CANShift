// parse-realdash-xml.test.ts

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRealDashXML } from '../realdash/parse-realdash-xml'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function xml(frames: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<RealDashCAN version="2">
  <frames>
    ${frames}
  </frames>
</RealDashCAN>`
}

function frame(id: string, values: string, extra = ''): string {
  return `<frame id="${id}" timeout="2000"${extra}>${values}</frame>`
}

// ---------------------------------------------------------------------------
// Not a RealDash file
// ---------------------------------------------------------------------------

describe('non-RealDash input', () => {
  it('returns a warning for empty string', () => {
    const { signals, warnings } = parseRealDashXML('')
    expect(signals).toHaveLength(0)
    expect(warnings[0]).toMatch(/RealDashCAN/)
  })

  it('returns a warning for arbitrary XML', () => {
    const { signals, warnings } = parseRealDashXML('<config><item/></config>')
    expect(signals).toHaveLength(0)
    expect(warnings).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Name generation
// ---------------------------------------------------------------------------

describe('name generation', () => {
  it('snake_cases the name attribute', () => {
    const { signals } = parseRealDashXML(
      xml(frame('0x520', '<value name="MaxxECU: Driven wheels avg spd" offset="0" length="2"/>'))
    )
    expect(signals[0]?.name).toBe('maxxecu_driven_wheels_avg_spd')
  })

  it('uses channel_{targetId} when no name attr', () => {
    const { signals } = parseRealDashXML(
      xml(frame('0x520', '<value targetId="37" offset="0" length="2"/>'))
    )
    expect(signals[0]?.name).toBe('channel_37')
  })

  it('uses positional fallback when neither name nor targetId', () => {
    const { signals } = parseRealDashXML(
      xml(frame('0x520', '<value offset="0" length="2"/>'))
    )
    expect(signals[0]?.name).toBe('signal_520_0')
  })
})

// ---------------------------------------------------------------------------
// Conversion formulas
// ---------------------------------------------------------------------------

describe('conversion parsing', () => {
  function singleSignal(conversion: string) {
    return parseRealDashXML(
      xml(
        frame(
          '0x520',
          `<value name="test" offset="0" length="2" conversion="${conversion}"/>`
        )
      )
    ).signals[0]
  }

  it('empty conversion → scale=1 offset=0', () => {
    const { signals } = parseRealDashXML(
      xml(frame('0x520', '<value name="test" offset="0" length="2"/>'))
    )
    expect(signals[0]?.scale).toBe(1)
    expect(signals[0]?.offset).toBe(0)
  })

  it('V*0.1', () => {
    const s = singleSignal('V*0.1')
    expect(s?.scale).toBeCloseTo(0.1)
    expect(s?.offset).toBe(0)
  })

  it('V*0.001', () => {
    const s = singleSignal('V*0.001')
    expect(s?.scale).toBeCloseTo(0.001)
    expect(s?.offset).toBe(0)
  })

  it('V*0.1-100', () => {
    const s = singleSignal('V*0.1-100')
    expect(s?.scale).toBeCloseTo(0.1)
    expect(s?.offset).toBe(-100)
  })

  it('V*0.1 - 101.3 (spaces)', () => {
    const s = singleSignal('V*0.1 - 101.3')
    expect(s?.scale).toBeCloseTo(0.1)
    expect(s?.offset).toBeCloseTo(-101.3)
  })

  it('V*-0.1 (negative scale)', () => {
    const s = singleSignal('V*-0.1')
    expect(s?.scale).toBeCloseTo(-0.1)
    expect(s?.offset).toBe(0)
  })

  it('V-50 (offset only)', () => {
    const s = singleSignal('V-50')
    expect(s?.scale).toBe(1)
    expect(s?.offset).toBe(-50)
  })

  it('V/10', () => {
    const s = singleSignal('V/10')
    expect(s?.scale).toBeCloseTo(0.1)
    expect(s?.offset).toBe(0)
  })

  it('V*10/100', () => {
    const s = singleSignal('V*10/100')
    expect(s?.scale).toBeCloseTo(0.1)
    expect(s?.offset).toBe(0)
  })

  it('V>>0 → bitMask 0x01, scale=1, min=0, max=1', () => {
    const s = singleSignal('V>>0')
    expect(s?.bitMask).toBe('0x01')
    expect(s?.scale).toBe(1)
    expect(s?.min).toBe(0)
    expect(s?.max).toBe(1)
  })

  it('V>>3 → bitMask 0x08', () => {
    const s = singleSignal('V>>3')
    expect(s?.bitMask).toBe('0x08')
  })

  it('V>>7 → bitMask 0x80', () => {
    const s = singleSignal('V>>7')
    expect(s?.bitMask).toBe('0x80')
  })

  it('no conversion + units="bit" → bitMask 0x01', () => {
    const { signals } = parseRealDashXML(
      xml(frame('0x526', '<value name="flag" offset="0" length="1" units="bit"/>'))
    )
    expect(signals[0]?.bitMask).toBe('0x01')
    expect(signals[0]?.unit).toBe('')
  })

  it('warns and skips complex formula (B0+...)', () => {
    const { signals, warnings } = parseRealDashXML(
      xml(frame('0x520', '<value name="complex" offset="0" length="2" conversion="B0+15*(B1-43)"/>'))
    )
    expect(signals).toHaveLength(0)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/Skipped/)
  })

  it('warns and skips V+ID formula', () => {
    const { signals, warnings } = parseRealDashXML(
      xml(frame('0x520', '<value name="ref" offset="0" length="2" conversion="V+ID200-74.3"/>'))
    )
    expect(signals).toHaveLength(0)
    expect(warnings).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Endianness
// ---------------------------------------------------------------------------

describe('endianness', () => {
  it('defaults to little-endian when absent', () => {
    const { signals } = parseRealDashXML(
      xml(frame('0x520', '<value name="s" offset="0" length="2"/>'))
    )
    expect(signals[0]?.bigEndian).toBe(false)
  })

  it('endianess="big" (RealDash typo) → bigEndian=true', () => {
    const { signals } = parseRealDashXML(
      xml(frame('0x360', '<value name="s" offset="0" length="2"/>', ' endianess="big"'))
    )
    expect(signals[0]?.bigEndian).toBe(true)
  })

  it('endianness="big" (correct spelling) → bigEndian=true', () => {
    const { signals } = parseRealDashXML(
      xml(frame('0x360', '<value name="s" offset="0" length="2"/>', ' endianness="big"'))
    )
    expect(signals[0]?.bigEndian).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Signed flag
// ---------------------------------------------------------------------------

describe('signed attribute', () => {
  it('signed="true" → signed=true', () => {
    const { signals } = parseRealDashXML(
      xml(frame('0x521', '<value name="s" offset="4" length="2" signed="true" conversion="V*0.1"/>'))
    )
    expect(signals[0]?.signed).toBe(true)
  })

  it('absent signed → signed=false', () => {
    const { signals } = parseRealDashXML(
      xml(frame('0x521', '<value name="s" offset="0" length="2"/>'))
    )
    expect(signals[0]?.signed).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Min/max computation
// ---------------------------------------------------------------------------

describe('min/max computation', () => {
  it('2-byte unsigned V*0.1 → max=6553.5', () => {
    const { signals } = parseRealDashXML(
      xml(frame('0x520', '<value name="s" offset="0" length="2" conversion="V*0.1"/>'))
    )
    expect(signals[0]?.min).toBe(0)
    expect(signals[0]?.max).toBeCloseTo(6553.5)
  })

  it('1-byte signed V*1 → range -128..127', () => {
    const { signals } = parseRealDashXML(
      xml(frame('0x520', '<value name="s" offset="0" length="1" signed="true"/>'))
    )
    expect(signals[0]?.min).toBe(-128)
    expect(signals[0]?.max).toBe(127)
  })

  it('2-byte unsigned with offset V*0.1-40 → min=-40', () => {
    const { signals } = parseRealDashXML(
      xml(frame('0x520', '<value name="s" offset="0" length="2" conversion="V*0.1-40"/>'))
    )
    expect(signals[0]?.min).toBe(-40)
  })
})

// ---------------------------------------------------------------------------
// Timeout passthrough
// ---------------------------------------------------------------------------

describe('timeout', () => {
  it('picks up timeout from frame attr', () => {
    const { signals } = parseRealDashXML(
      `<RealDashCAN version="2"><frames><frame id="0x520" timeout="5000"><value name="s" offset="0" length="2"/></frame></frames></RealDashCAN>`
    )
    expect(signals[0]?.timeoutMs).toBe(5000)
  })

  it('defaults timeout to 2000 when absent', () => {
    const { signals } = parseRealDashXML(
      `<RealDashCAN version="2"><frames><frame id="0x520"><value name="s" offset="0" length="2"/></frame></frames></RealDashCAN>`
    )
    expect(signals[0]?.timeoutMs).toBe(2000)
  })
})

// ---------------------------------------------------------------------------
// byteLength clamping
// ---------------------------------------------------------------------------

describe('byteLength clamping', () => {
  it('length=3 is clamped to 1', () => {
    const { signals } = parseRealDashXML(
      xml(frame('0x520', '<value name="s" offset="0" length="3"/>'))
    )
    expect(signals[0]?.byteLength).toBe(1)
  })

  it('length=4 passes through', () => {
    const { signals } = parseRealDashXML(
      xml(frame('0x520', '<value name="s" offset="0" length="4"/>'))
    )
    expect(signals[0]?.byteLength).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// Multiple frames
// ---------------------------------------------------------------------------

describe('multiple frames', () => {
  it('collects signals from all frames', () => {
    const { signals } = parseRealDashXML(
      xml(
        frame('0x520', '<value name="rpm" offset="0" length="2"/>') +
          frame('0x521', '<value name="lambda" offset="0" length="2" conversion="V*0.001"/>')
      )
    )
    expect(signals).toHaveLength(2)
    expect(signals[0]?.canFrameId).toBe('0x520')
    expect(signals[1]?.canFrameId).toBe('0x521')
  })
})

// ---------------------------------------------------------------------------
// Real MaxxECU fixture (integration)
// ---------------------------------------------------------------------------

describe('MaxxECU fixture', () => {
  const fixturePath = path.resolve(
    __dirname,
    '../../../../RealDash-extras/RealDash-CAN/XML-files/MaxxECU/maxxecu_default_can.xml'
  )

  // Skip if the extras repo is not checked out alongside CANShift.
  const maybeIt = fs.existsSync(fixturePath) ? it : it.skip

  maybeIt('parses at least 30 signals with no invalid-response warning', () => {
    const content = fs.readFileSync(fixturePath, 'utf-8')
    const { signals, warnings } = parseRealDashXML(content)

    expect(signals.length).toBeGreaterThan(30)

    // None of the warnings should be "Not a RealDash CAN XML file"
    expect(warnings.every((w) => !w.startsWith('Not a'))).toBe(true)

    // All signals must have valid canFrameId format
    for (const s of signals) {
      expect(s.canFrameId).toMatch(/^0x[0-9a-f]+$/)
    }
  })

  maybeIt('correctly extracts the bit-shift signals from frame 0x526', () => {
    const content = fs.readFileSync(fixturePath, 'utf-8')
    const { signals } = parseRealDashXML(content)

    const frame526 = signals.filter((s) => s.canFrameId === '0x526')
    expect(frame526.length).toBeGreaterThan(4)

    // First signal in 0x526 has no conversion → bitMask=0x01
    const first = frame526[0]
    expect(first?.bitMask).toBe('0x01')
    expect(first?.min).toBe(0)
    expect(first?.max).toBe(1)

    // V>>3 signal should have bitMask=0x08
    const shiftBy3 = frame526.find((s) => s.bitMask === '0x08')
    expect(shiftBy3).toBeDefined()
  })

  maybeIt('defaults to little-endian (MaxxECU uses no endian attr)', () => {
    const content = fs.readFileSync(fixturePath, 'utf-8')
    const { signals } = parseRealDashXML(content)
    expect(signals.every((s) => s.bigEndian === false)).toBe(true)
  })
})
