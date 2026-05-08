// src/cli/parse.test.ts — Tokenizer cases for the CLI input parser.

import { describe, expect, it } from 'vitest'
import { parse, parseMany, ParseError } from './parse'

describe('parse', () => {
  it('returns null for an empty line', () => {
    expect(parse('')).toBeNull()
  })

  it('returns null for a whitespace-only line', () => {
    expect(parse('   \t  ')).toBeNull()
  })

  it('splits a simple command with positional args', () => {
    expect(parse('help status')).toEqual({ name: 'help', rawArgs: ['status'] })
  })

  it('preserves spaces inside double-quoted strings', () => {
    expect(parse('echo "hello world"')).toEqual({
      name: 'echo',
      rawArgs: ['hello world'],
    })
  })

  it('handles escaped double quotes within a quoted string', () => {
    expect(parse('echo "say \\"hi\\""')).toEqual({
      name: 'echo',
      rawArgs: ['say "hi"'],
    })
  })

  it('handles escaped backslashes', () => {
    expect(parse('echo "back\\\\slash"')).toEqual({
      name: 'echo',
      rawArgs: ['back\\slash'],
    })
  })

  it('throws ParseError on unterminated quoted strings', () => {
    expect(() => parse('echo "oops')).toThrow(ParseError)
  })

  it('collapses runs of whitespace between tokens', () => {
    expect(parse('a   b\t\tc')).toEqual({ name: 'a', rawArgs: ['b', 'c'] })
  })
})

describe('parseMany', () => {
  it('returns an empty array for empty input', () => {
    expect(parseMany('')).toEqual([])
  })

  it('returns one result per non-empty line', () => {
    const out = parseMany('help\n\nstatus arg1\n  \nclear')
    expect(out).toEqual([
      { name: 'help', rawArgs: [] },
      { name: 'status', rawArgs: ['arg1'] },
      { name: 'clear', rawArgs: [] },
    ])
  })
})
