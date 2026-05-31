// parse-realdash-xml.test.ts

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRealDashXML } from '../realdash/parse-realdash-xml.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function xml(framesAttrs: string, content: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<RealDashCAN version="2">
  <frames${framesAttrs ? ` ${framesAttrs}` : ''}>
    ${content}
  </frames>
</RealDashCAN>`
}

function frame(id: string, values: string, frameAttrs = ''): string {
  return `<frame id="${id}" timeout="2000"${frameAttrs ? ` ${frameAttrs}` : ''}>${values}</frame>`
}

function simpleXml(values: string, frameAttrs = '', framesAttrs = ''): string {
  return xml(framesAttrs, frame('0x520', values, frameAttrs))
}

// ---------------------------------------------------------------------------
// Non-RealDash input
// ---------------------------------------------------------------------------

describe('non-RealDash input', () => {
  it('returns a warning for empty string', () => {
    const { signals, warnings } = parseRealDashXML('')
    expect(signals).toHaveLength(0)
    expect(warnings[0]).toMatch(/RealDashCAN/)
  })

  it('returns a warning for arbitrary XML', () => {
    const { signals } = parseRealDashXML('<config><item/></config>')
    expect(signals).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Name generation
// ---------------------------------------------------------------------------

describe('name generation', () => {
  it('snake_cases the name attribute', () => {
    const { signals } = parseRealDashXML(
      simpleXml('<value name="MaxxECU: Driven wheels avg spd" offset="0" length="2"/>')
    )
    expect(signals[0]?.name).toBe('maxxecu_driven_wheels_avg_spd')
  })

  it('uses channel_{targetId} when no name attr', () => {
    const { signals } = parseRealDashXML(simpleXml('<value targetId="37" offset="0" length="2"/>'))
    expect(signals[0]?.name).toBe('channel_37')
  })

  it('uses positional fallback when neither name nor targetId', () => {
    const { signals } = parseRealDashXML(simpleXml('<value offset="0" length="2"/>'))
    expect(signals[0]?.name).toBe('signal_520_0')
  })
})

// ---------------------------------------------------------------------------
// baseId on <frames>
// ---------------------------------------------------------------------------

describe('frames baseId', () => {
  it('adds decimal baseId to frame id', () => {
    const { signals } = parseRealDashXML(
      xml('baseId="3200"', frame('1', '<value name="s" offset="0" length="2"/>'))
    )
    // 3200 + 1 = 3201 = 0xc81
    expect(signals[0]?.canFrameId).toBe('0xc81')
  })

  it('adds hex baseId to frame id', () => {
    const { signals } = parseRealDashXML(
      xml('baseId="0xc80"', frame('0x10', '<value name="s" offset="0" length="2"/>'))
    )
    // 0xc80 + 0x10 = 0xc90
    expect(signals[0]?.canFrameId).toBe('0xc90')
  })

  it('leaves frame id unchanged when baseId is absent', () => {
    const { signals } = parseRealDashXML(simpleXml('<value name="s" offset="0" length="2"/>'))
    expect(signals[0]?.canFrameId).toBe('0x520')
  })
})

// ---------------------------------------------------------------------------
// Conversion formulas
// ---------------------------------------------------------------------------

describe('conversion parsing', () => {
  function singleSignal(conversion: string) {
    return parseRealDashXML(
      simpleXml(`<value name="test" offset="0" length="2" conversion="${conversion}"/>`)
    ).signals[0]
  }

  it('empty conversion → scale=1 offset=0', () => {
    const { signals } = parseRealDashXML(simpleXml('<value name="test" offset="0" length="2"/>'))
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

  it('V>>0 → bitMask 0x01', () => {
    const s = singleSignal('V>>0')
    expect(s?.bitMask).toBe('0x01')
    expect(s?.min).toBe(0)
    expect(s?.max).toBe(1)
  })

  it('V>>3 → bitMask 0x08', () => {
    expect(singleSignal('V>>3')?.bitMask).toBe('0x08')
  })

  it('V>>7 → bitMask 0x80', () => {
    expect(singleSignal('V>>7')?.bitMask).toBe('0x80')
  })

  it('no conversion + units="bit" → bitMask 0x01', () => {
    const { signals } = parseRealDashXML(
      simpleXml('<value name="flag" offset="0" length="1" units="bit"/>')
    )
    expect(signals[0]?.bitMask).toBe('0x01')
    expect(signals[0]?.unit).toBe('')
  })

  it('warns and skips complex formula (B0+...)', () => {
    const { signals, warnings } = parseRealDashXML(
      simpleXml('<value name="c" offset="0" length="2" conversion="B0+15*(B1-43)"/>')
    )
    expect(signals).toHaveLength(0)
    expect(warnings[0]).toMatch(/Skipped/)
  })

  it('warns and skips V+ID formula', () => {
    const { signals, warnings } = parseRealDashXML(
      simpleXml('<value name="r" offset="0" length="2" conversion="V+ID200-74.3"/>')
    )
    expect(signals).toHaveLength(0)
    expect(warnings).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// XML entity decoding in conversion attribute
// ---------------------------------------------------------------------------

describe('XML entity decoding', () => {
  it('decodes &gt;&gt; in conversion to >> (bit shift)', () => {
    const { signals } = parseRealDashXML(
      simpleXml('<value name="flag" offset="0" length="1" conversion="V&gt;&gt;3"/>')
    )
    // V>>3 after entity decode → bitMask 0x08
    expect(signals[0]?.bitMask).toBe('0x08')
  })

  it('decodes &amp; in conversion to & (treated as complex and warned)', () => {
    const { signals, warnings } = parseRealDashXML(
      simpleXml('<value name="mask" offset="0" length="1" conversion="V&amp;15"/>')
    )
    // "V&15" is a complex formula — should warn and skip
    expect(signals).toHaveLength(0)
    expect(warnings[0]).toMatch(/Skipped/)
  })
})

// ---------------------------------------------------------------------------
// Endianness
// ---------------------------------------------------------------------------

describe('endianness', () => {
  it('defaults to little-endian when absent', () => {
    const { signals } = parseRealDashXML(simpleXml('<value name="s" offset="0" length="2"/>'))
    expect(signals[0]?.bigEndian).toBe(false)
  })

  it('frame endianess="big" (typo spelling) → bigEndian=true for all values', () => {
    const { signals } = parseRealDashXML(
      simpleXml('<value name="s" offset="0" length="2"/>', 'endianess="big"')
    )
    expect(signals[0]?.bigEndian).toBe(true)
  })

  it('frame endianness="big" (correct spelling) → bigEndian=true', () => {
    const { signals } = parseRealDashXML(
      simpleXml('<value name="s" offset="0" length="2"/>', 'endianness="big"')
    )
    expect(signals[0]?.bigEndian).toBe(true)
  })

  it('per-value endianness overrides frame default', () => {
    const { signals } = parseRealDashXML(
      simpleXml(
        '<value name="be" offset="0" length="2" endianness="big"/>' +
          '<value name="le" offset="2" length="2" endianness="little"/>',
        'endianness="big"'
      )
    )
    expect(signals[0]?.bigEndian).toBe(true)
    expect(signals[1]?.bigEndian).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Frame-level signed default
// ---------------------------------------------------------------------------

describe('frame-level signed', () => {
  it('frame signed="true" applies to all values', () => {
    const { signals } = parseRealDashXML(
      simpleXml(
        '<value name="a" offset="0" length="2"/><value name="b" offset="2" length="2"/>',
        'signed="true"'
      )
    )
    expect(signals[0]?.signed).toBe(true)
    expect(signals[1]?.signed).toBe(true)
  })

  it('per-value signed overrides frame default', () => {
    const { signals } = parseRealDashXML(
      simpleXml('<value name="a" offset="0" length="2" signed="false"/>', 'signed="true"')
    )
    expect(signals[0]?.signed).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// rangeMin / rangeMax
// ---------------------------------------------------------------------------

describe('rangeMin / rangeMax', () => {
  it('uses rangeMin/rangeMax when present', () => {
    const { signals } = parseRealDashXML(
      simpleXml(
        '<value name="s" offset="0" length="2" conversion="V*0.1" rangeMin="0" rangeMax="500"/>'
      )
    )
    expect(signals[0]?.min).toBe(0)
    expect(signals[0]?.max).toBe(500)
  })

  it('falls back to computed range when absent', () => {
    const { signals } = parseRealDashXML(
      simpleXml('<value name="s" offset="0" length="2" conversion="V*0.1"/>')
    )
    // 2-byte unsigned * 0.1 → max ≈ 6553.5
    expect(signals[0]?.max).toBeCloseTo(6553.5)
  })
})

// ---------------------------------------------------------------------------
// Signed attribute
// ---------------------------------------------------------------------------

describe('signed attribute', () => {
  it('signed="true" on value → signed=true', () => {
    const { signals } = parseRealDashXML(
      simpleXml('<value name="s" offset="4" length="2" signed="true" conversion="V*0.1"/>')
    )
    expect(signals[0]?.signed).toBe(true)
  })

  it('absent signed → signed=false', () => {
    const { signals } = parseRealDashXML(simpleXml('<value name="s" offset="0" length="2"/>'))
    expect(signals[0]?.signed).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Min/max computation (no rangeMin/rangeMax)
// ---------------------------------------------------------------------------

describe('min/max computation', () => {
  it('2-byte unsigned V*0.1 → max≈6553.5', () => {
    const { signals } = parseRealDashXML(
      simpleXml('<value name="s" offset="0" length="2" conversion="V*0.1"/>')
    )
    expect(signals[0]?.min).toBe(0)
    expect(signals[0]?.max).toBeCloseTo(6553.5)
  })

  it('1-byte signed → range -128..127', () => {
    const { signals } = parseRealDashXML(
      simpleXml('<value name="s" offset="0" length="1" signed="true"/>')
    )
    expect(signals[0]?.min).toBe(-128)
    expect(signals[0]?.max).toBe(127)
  })

  it('2-byte unsigned V*0.1-40 → min=-40', () => {
    const { signals } = parseRealDashXML(
      simpleXml('<value name="s" offset="0" length="2" conversion="V*0.1-40"/>')
    )
    expect(signals[0]?.min).toBe(-40)
  })
})

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

describe('timeout', () => {
  it('picks up timeout from frame attr', () => {
    const { signals } = parseRealDashXML(
      `<RealDashCAN version="2"><frames><frame id="0x520" timeout="5000"><value name="s" offset="0" length="2"/></frame></frames></RealDashCAN>`
    )
    expect(signals[0]?.timeoutMs).toBe(5000)
  })

  it('defaults to 2000 when absent', () => {
    const { signals } = parseRealDashXML(
      `<RealDashCAN version="2"><frames><frame id="0x520"><value name="s" offset="0" length="2"/></frame></frames></RealDashCAN>`
    )
    expect(signals[0]?.timeoutMs).toBe(2000)
  })
})

// ---------------------------------------------------------------------------
// Schema validation (issue #1016 / C-HI-1) — invalid rows divert to warnings
// ---------------------------------------------------------------------------

describe('schema validation', () => {
  it('length=3 is rejected and emits a warning (no silent coercion)', () => {
    const { signals, warnings } = parseRealDashXML(
      simpleXml('<value name="bad" offset="0" length="3"/>')
    )
    expect(signals).toHaveLength(0)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/Rejected signal "bad"/)
    expect(warnings[0]).toMatch(/frame 0x520/)
    expect(warnings[0]).toMatch(/byteLength/)
  })

  it('length=4 passes through unchanged', () => {
    const { signals, warnings } = parseRealDashXML(
      simpleXml('<value name="s" offset="0" length="4"/>')
    )
    expect(signals).toHaveLength(1)
    expect(signals[0]?.byteLength).toBe(4)
    expect(warnings).toHaveLength(0)
  })

  it('length=1 and length=2 pass through unchanged', () => {
    const { signals, warnings } = parseRealDashXML(
      simpleXml(
        '<value name="a" offset="0" length="1"/>' + '<value name="b" offset="1" length="2"/>'
      )
    )
    expect(signals).toHaveLength(2)
    expect(signals[0]?.byteLength).toBe(1)
    expect(signals[1]?.byteLength).toBe(2)
    expect(warnings).toHaveLength(0)
  })

  it('multiple invalid rows produce multiple warnings and zero signals', () => {
    const { signals, warnings } = parseRealDashXML(
      simpleXml(
        '<value name="bad_a" offset="0" length="3"/>' +
          '<value name="bad_b" offset="3" length="5"/>' +
          '<value name="bad_c" offset="8" length="7"/>'
      )
    )
    expect(signals).toHaveLength(0)
    expect(warnings).toHaveLength(3)
    expect(warnings[0]).toMatch(/bad_a/)
    expect(warnings[1]).toMatch(/bad_b/)
    expect(warnings[2]).toMatch(/bad_c/)
  })

  it('mix of valid and invalid rows keeps the valid ones', () => {
    const { signals, warnings } = parseRealDashXML(
      simpleXml(
        '<value name="good" offset="0" length="2"/>' +
          '<value name="bad" offset="2" length="3"/>' +
          '<value name="also_good" offset="4" length="4"/>'
      )
    )
    expect(signals).toHaveLength(2)
    expect(signals.map((s) => s.name)).toEqual(['good', 'also_good'])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/Rejected signal "bad"/)
  })

  it('warning string includes the zod path and message', () => {
    const { warnings } = parseRealDashXML(simpleXml('<value name="bad" offset="0" length="8"/>'))
    expect(warnings[0]).toMatch(/byteLength:/)
  })

  it('result still satisfies ParseRealDashXMLResult (string[] warnings)', () => {
    const result = parseRealDashXML(simpleXml('<value name="bad" offset="0" length="3"/>'))
    expect(Array.isArray(result.signals)).toBe(true)
    expect(Array.isArray(result.warnings)).toBe(true)
    expect(result.warnings.every((w) => typeof w === 'string')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Multiple frames
// ---------------------------------------------------------------------------

describe('multiple frames', () => {
  it('collects signals from all frames', () => {
    const { signals } = parseRealDashXML(
      xml(
        '',
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
  const maybeIt = fs.existsSync(fixturePath) ? it : it.skip

  maybeIt('parses at least 30 signals with no root-level warning', () => {
    const content = fs.readFileSync(fixturePath, 'utf-8')
    const { signals, warnings } = parseRealDashXML(content)
    expect(signals.length).toBeGreaterThan(30)
    expect(warnings.every((w) => !w.startsWith('Not a'))).toBe(true)
    for (const s of signals) {
      expect(s.canFrameId).toMatch(/^0x[0-9a-f]+$/)
    }
  })

  maybeIt('extracts bit-shift signals from frame 0x526', () => {
    const content = fs.readFileSync(fixturePath, 'utf-8')
    const { signals } = parseRealDashXML(content)
    const frame526 = signals.filter((s) => s.canFrameId === '0x526')
    expect(frame526.length).toBeGreaterThan(4)
    expect(frame526[0]?.bitMask).toBe('0x01')
    expect(frame526.find((s) => s.bitMask === '0x08')).toBeDefined()
  })

  maybeIt('defaults to little-endian (MaxxECU uses no endian attr)', () => {
    const content = fs.readFileSync(fixturePath, 'utf-8')
    const { signals } = parseRealDashXML(content)
    expect(signals.every((s) => !s.bigEndian)).toBe(true)
  })
})
