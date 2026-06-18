import { describe, expect, it } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { evalExpr } from '../can-xml/eval-expr.js'

const here = dirname(fileURLToPath(import.meta.url))

interface Fixture {
  expr: string
  v: number
  bytes: number[]
  expected: number
}

const fixtures = JSON.parse(
  readFileSync(join(here, '__fixtures__/expr-parity.json'), 'utf8')
) as Fixture[]

describe('eval-expr parity fixtures (TS side)', () => {
  for (const fx of fixtures) {
    it(`${fx.expr} @ V=${String(fx.v)} bytes=${JSON.stringify(fx.bytes)} → ${String(fx.expected)}`, () => {
      const actual = evalExpr(fx.expr, { v: fx.v, bytes: fx.bytes })
      expect(actual).toBeCloseTo(fx.expected, 4)
    })
  }
})
