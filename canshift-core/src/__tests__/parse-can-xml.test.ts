import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCanXml } from '../can-xml/parse-can-xml.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const xml = (framesAttrs: string, content: string): string =>
  `<?xml version="1.0" encoding="utf-8"?>
<RealDashCAN version="2">
  <frames${framesAttrs ? ` ${framesAttrs}` : ''}>
    ${content}
  </frames>
</RealDashCAN>`

const frame = (id: string, values: string, frameAttrs = ''): string =>
  `<frame id="${id}" timeout="2000"${frameAttrs ? ` ${frameAttrs}` : ''}>${values}</frame>`

const simpleXml = (values: string, frameAttrs = '', framesAttrs = ''): string =>
  xml(framesAttrs, frame('0x520', values, frameAttrs))

describe('non-CAN-XML input', () => {
  it('returns a warning for empty string', () => {
    const { signals, warnings } = parseCanXml('')
    expect(signals).toHaveLength(0)
    expect(warnings[0]).toMatch(/CAN XML/)
  })

  it('returns a warning for arbitrary XML', () => {
    const { signals } = parseCanXml('<config><item/></config>')
    expect(signals).toHaveLength(0)
  })
})

describe('name generation', () => {
  it('snake_cases the name attribute', () => {
    const { signals } = parseCanXml(
      simpleXml('<value name="MaxxECU: Driven wheels avg spd" offset="0" length="2"/>')
    )
    expect(signals[0]?.name).toBe('maxxecu_driven_wheels_avg_spd')
  })

  it('uses channel_{targetId} when no name attr', () => {
    const { signals } = parseCanXml(simpleXml('<value targetId="37" offset="0" length="2"/>'))
    expect(signals[0]?.name).toBe('channel_37')
  })

  it('uses positional fallback when neither name nor targetId', () => {
    const { signals } = parseCanXml(simpleXml('<value offset="0" length="2"/>'))
    expect(signals[0]?.name).toBe('signal_520_0')
  })
})

describe('frames baseId', () => {
  it('adds decimal baseId to frame id', () => {
    const { signals } = parseCanXml(
      xml('baseId="3200"', frame('1', '<value name="s" offset="0" length="2"/>'))
    )
    expect(signals[0]?.canFrameId).toBe('0xc81')
  })

  it('adds hex baseId to frame id', () => {
    const { signals } = parseCanXml(
      xml('baseId="0xc80"', frame('0x10', '<value name="s" offset="0" length="2"/>'))
    )
    expect(signals[0]?.canFrameId).toBe('0xc90')
  })

  it('leaves frame id unchanged when baseId is absent', () => {
    const { signals } = parseCanXml(simpleXml('<value name="s" offset="0" length="2"/>'))
    expect(signals[0]?.canFrameId).toBe('0x520')
  })
})

describe('conversion parsing', () => {
  const singleSignal = (conversion: string) =>
    parseCanXml(simpleXml(`<value name="test" offset="0" length="2" conversion="${conversion}"/>`))
      .signals[0]

  it('empty conversion → scale=1 offset=0', () => {
    const { signals } = parseCanXml(simpleXml('<value name="test" offset="0" length="2"/>'))
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

  it('V alone → identity', () => {
    const s = singleSignal('V')
    expect(s?.scale).toBe(1)
    expect(s?.offset).toBe(0)
  })

  it('1-V → scale -1, offset 1', () => {
    const s = singleSignal('1-V')
    expect(s?.scale).toBe(-1)
    expect(s?.offset).toBe(1)
  })

  it('100-V → scale -1, offset 100', () => {
    const s = singleSignal('100-V')
    expect(s?.scale).toBe(-1)
    expect(s?.offset).toBe(100)
  })

  it('V*0.00390625*0.06894757 → chained mul', () => {
    const s = singleSignal('V*0.00390625*0.06894757')
    expect(s?.scale).toBeCloseTo(0.00390625 * 0.06894757)
    expect(s?.offset).toBe(0)
  })

  it('V/255*100 → scale 100/255', () => {
    const s = singleSignal('V/255*100')
    expect(s?.scale).toBeCloseTo(100 / 255)
    expect(s?.offset).toBe(0)
  })

  it('(V/255)*100 → scale 100/255 (parens stripped)', () => {
    const s = singleSignal('(V/255)*100')
    expect(s?.scale).toBeCloseTo(100 / 255)
    expect(s?.offset).toBe(0)
  })

  it('(V*0.1)/2 → scale 0.05', () => {
    const s = singleSignal('(V*0.1)/2')
    expect(s?.scale).toBeCloseTo(0.05)
    expect(s?.offset).toBe(0)
  })

  it('(V*0.1) → scale 0.1 (outer parens stripped)', () => {
    const s = singleSignal('(V*0.1)')
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
    const { signals } = parseCanXml(
      simpleXml('<value name="flag" offset="0" length="1" units="bit"/>')
    )
    expect(signals[0]?.bitMask).toBe('0x01')
    expect(signals[0]?.unit).toBe('')
  })

  it('warns and skips complex formula (B0+...)', () => {
    const { signals, warnings } = parseCanXml(
      simpleXml('<value name="c" offset="0" length="2" conversion="B0+15*(B1-43)"/>')
    )
    expect(signals).toHaveLength(0)
    expect(warnings[0]).toMatch(/Skipped/)
  })

  it('warns and skips V+ID formula', () => {
    const { signals, warnings } = parseCanXml(
      simpleXml('<value name="r" offset="0" length="2" conversion="V+ID200-74.3"/>')
    )
    expect(signals).toHaveLength(0)
    expect(warnings).toHaveLength(1)
  })
})

describe('XML entity decoding', () => {
  it('decodes &gt;&gt; in conversion to >> (bit shift)', () => {
    const { signals } = parseCanXml(
      simpleXml('<value name="flag" offset="0" length="1" conversion="V&gt;&gt;3"/>')
    )
    expect(signals[0]?.bitMask).toBe('0x08')
  })

  it('decodes &amp; in conversion to & (treated as complex and warned)', () => {
    const { signals, warnings } = parseCanXml(
      simpleXml('<value name="mask" offset="0" length="1" conversion="V&amp;15"/>')
    )
    expect(signals).toHaveLength(0)
    expect(warnings[0]).toMatch(/Skipped/)
  })
})

describe('endianness', () => {
  it('defaults to little-endian when absent', () => {
    const { signals } = parseCanXml(simpleXml('<value name="s" offset="0" length="2"/>'))
    expect(signals[0]?.bigEndian).toBe(false)
  })

  it('frame endianess="big" (typo spelling) → bigEndian=true for all values', () => {
    const { signals } = parseCanXml(
      simpleXml('<value name="s" offset="0" length="2"/>', 'endianess="big"')
    )
    expect(signals[0]?.bigEndian).toBe(true)
  })

  it('frame endianness="big" (correct spelling) → bigEndian=true', () => {
    const { signals } = parseCanXml(
      simpleXml('<value name="s" offset="0" length="2"/>', 'endianness="big"')
    )
    expect(signals[0]?.bigEndian).toBe(true)
  })

  it('per-value endianness overrides frame default', () => {
    const { signals } = parseCanXml(
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

describe('frame-level signed', () => {
  it('frame signed="true" applies to all values', () => {
    const { signals } = parseCanXml(
      simpleXml(
        '<value name="a" offset="0" length="2"/><value name="b" offset="2" length="2"/>',
        'signed="true"'
      )
    )
    expect(signals[0]?.signed).toBe(true)
    expect(signals[1]?.signed).toBe(true)
  })

  it('per-value signed overrides frame default', () => {
    const { signals } = parseCanXml(
      simpleXml('<value name="a" offset="0" length="2" signed="false"/>', 'signed="true"')
    )
    expect(signals[0]?.signed).toBe(false)
  })
})

describe('rangeMin / rangeMax', () => {
  it('uses rangeMin/rangeMax when present', () => {
    const { signals } = parseCanXml(
      simpleXml(
        '<value name="s" offset="0" length="2" conversion="V*0.1" rangeMin="0" rangeMax="500"/>'
      )
    )
    expect(signals[0]?.min).toBe(0)
    expect(signals[0]?.max).toBe(500)
  })

  it('falls back to computed range when absent', () => {
    const { signals } = parseCanXml(
      simpleXml('<value name="s" offset="0" length="2" conversion="V*0.1"/>')
    )
    expect(signals[0]?.max).toBeCloseTo(6553.5)
  })
})

describe('signed attribute', () => {
  it('signed="true" on value → signed=true', () => {
    const { signals } = parseCanXml(
      simpleXml('<value name="s" offset="4" length="2" signed="true" conversion="V*0.1"/>')
    )
    expect(signals[0]?.signed).toBe(true)
  })

  it('absent signed → signed=false', () => {
    const { signals } = parseCanXml(simpleXml('<value name="s" offset="0" length="2"/>'))
    expect(signals[0]?.signed).toBe(false)
  })
})

describe('min/max computation', () => {
  it('2-byte unsigned V*0.1 → max≈6553.5', () => {
    const { signals } = parseCanXml(
      simpleXml('<value name="s" offset="0" length="2" conversion="V*0.1"/>')
    )
    expect(signals[0]?.min).toBe(0)
    expect(signals[0]?.max).toBeCloseTo(6553.5)
  })

  it('1-byte signed → range -128..127', () => {
    const { signals } = parseCanXml(
      simpleXml('<value name="s" offset="0" length="1" signed="true"/>')
    )
    expect(signals[0]?.min).toBe(-128)
    expect(signals[0]?.max).toBe(127)
  })

  it('2-byte unsigned V*0.1-40 → min=-40', () => {
    const { signals } = parseCanXml(
      simpleXml('<value name="s" offset="0" length="2" conversion="V*0.1-40"/>')
    )
    expect(signals[0]?.min).toBe(-40)
  })
})

describe('timeout', () => {
  it('picks up timeout from frame attr', () => {
    const { signals } = parseCanXml(
      `<RealDashCAN version="2"><frames><frame id="0x520" timeout="5000"><value name="s" offset="0" length="2"/></frame></frames></RealDashCAN>`
    )
    expect(signals[0]?.timeoutMs).toBe(5000)
  })

  it('defaults to 2000 when absent', () => {
    const { signals } = parseCanXml(
      `<RealDashCAN version="2"><frames><frame id="0x520"><value name="s" offset="0" length="2"/></frame></frames></RealDashCAN>`
    )
    expect(signals[0]?.timeoutMs).toBe(2000)
  })
})

describe('schema validation', () => {
  it('length=3 is rejected and emits a warning (no silent coercion)', () => {
    const { signals, warnings } = parseCanXml(
      simpleXml('<value name="bad" offset="0" length="3"/>')
    )
    expect(signals).toHaveLength(0)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/Rejected signal "bad"/)
    expect(warnings[0]).toMatch(/frame 0x520/)
    expect(warnings[0]).toMatch(/byteLength/)
  })

  it('length=4 passes through unchanged', () => {
    const { signals, warnings } = parseCanXml(simpleXml('<value name="s" offset="0" length="4"/>'))
    expect(signals).toHaveLength(1)
    expect(signals[0]?.byteLength).toBe(4)
    expect(warnings).toHaveLength(0)
  })

  it('length=1 and length=2 pass through unchanged', () => {
    const { signals, warnings } = parseCanXml(
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
    const { signals, warnings } = parseCanXml(
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
    const { signals, warnings } = parseCanXml(
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
    const { warnings } = parseCanXml(simpleXml('<value name="bad" offset="0" length="8"/>'))
    expect(warnings[0]).toMatch(/byteLength:/)
  })

  it('result still satisfies ParseRealDashXMLResult (string[] warnings)', () => {
    const result = parseCanXml(simpleXml('<value name="bad" offset="0" length="3"/>'))
    expect(Array.isArray(result.signals)).toBe(true)
    expect(Array.isArray(result.warnings)).toBe(true)
    expect(result.warnings.every((w) => typeof w === 'string')).toBe(true)
  })
})

describe('multiple frames', () => {
  it('collects signals from all frames', () => {
    const { signals } = parseCanXml(
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

describe('MaxxECU fixture', () => {
  const fixturePath = path.resolve(
    __dirname,
    '../../../../RealDash-extras/RealDash-CAN/XML-files/MaxxECU/maxxecu_default_can.xml'
  )
  const maybeIt = fs.existsSync(fixturePath) ? it : it.skip

  maybeIt('parses at least 30 signals with no root-level warning', () => {
    const content = fs.readFileSync(fixturePath, 'utf-8')
    const { signals, warnings } = parseCanXml(content)
    expect(signals.length).toBeGreaterThan(30)
    expect(warnings.every((w) => !w.startsWith('Not a'))).toBe(true)
    for (const s of signals) {
      expect(s.canFrameId).toMatch(/^0x[0-9a-f]+$/)
    }
  })

  maybeIt('extracts bit-shift signals from frame 0x526', () => {
    const content = fs.readFileSync(fixturePath, 'utf-8')
    const { signals } = parseCanXml(content)
    const frame526 = signals.filter((s) => s.canFrameId === '0x526')
    expect(frame526.length).toBeGreaterThan(4)
    expect(frame526[0]?.bitMask).toBe('0x01')
    expect(frame526.find((s) => s.bitMask === '0x08')).toBeDefined()
  })

  maybeIt('defaults to little-endian (MaxxECU uses no endian attr)', () => {
    const content = fs.readFileSync(fixturePath, 'utf-8')
    const { signals } = parseCanXml(content)
    expect(signals.every((s) => !s.bigEndian)).toBe(true)
  })
})
