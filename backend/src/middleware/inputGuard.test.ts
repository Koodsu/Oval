import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { INPUT_GUARD_LIMITS, inputGuard } from './inputGuard';

function run(body: unknown, query: unknown = {}) {
  const req = { body, query } as unknown as Request;
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  inputGuard(req, res, next);
  return { next, status, json };
}

describe('inputGuard', () => {
  it('passes normal bodies through', () => {
    const { next, status } = run({ content: 'hello', replyToId: 'abc' });
    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it('passes empty/absent bodies', () => {
    expect(run(undefined).next).toHaveBeenCalled();
    expect(run(null).next).toHaveBeenCalled();
  });

  it('rejects deeply nested bodies', () => {
    let nested: Record<string, unknown> = { v: 1 };
    for (let i = 0; i < INPUT_GUARD_LIMITS.MAX_DEPTH + 2; i++) nested = { nested };
    const { next, status } = run(nested);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
  });

  it('rejects oversized arrays', () => {
    const { status } = run({ ids: new Array(INPUT_GUARD_LIMITS.MAX_ARRAY_LENGTH + 1).fill('x') });
    expect(status).toHaveBeenCalledWith(400);
  });

  it('rejects oversized strings', () => {
    const { status } = run({ bio: 'a'.repeat(INPUT_GUARD_LIMITS.MAX_STRING_LENGTH + 1) });
    expect(status).toHaveBeenCalledWith(400);
  });

  it('rejects prototype-pollution keys', () => {
    const body = JSON.parse('{"a": 1, "__proto__": {"admin": true}}');
    const { status } = run(body);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('rejects excessive total key counts', () => {
    const body: Record<string, number> = {};
    for (let i = 0; i <= INPUT_GUARD_LIMITS.MAX_TOTAL_KEYS; i++) body[`k${i}`] = i;
    const { status } = run(body);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('allows flat string query params', () => {
    const { next } = run({}, { limit: '20', cursor: 'abc', tags: ['a', 'b'] });
    expect(next).toHaveBeenCalled();
  });

  it('rejects nested-object query params', () => {
    const { status } = run({}, { limit: { $gt: '1' } });
    expect(status).toHaveBeenCalledWith(400);
  });

  it('rejects oversized query values', () => {
    const { status } = run({}, { q: 'a'.repeat(INPUT_GUARD_LIMITS.MAX_QUERY_VALUE_LENGTH + 1) });
    expect(status).toHaveBeenCalledWith(400);
  });
});
