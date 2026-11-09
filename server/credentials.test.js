import { describe, expect, it } from 'vitest';
import { validatePassword, validateUsername } from './auth.js';

describe('credential validation', () => {
  it('accepts lowercase usernames with spaces', () => {
    expect(validateUsername('super admin')).toBe(true);
    expect(validateUsername('Super Admin')).toBe(false);
  });

  it('requires passwords to contain at least six characters', () => {
    expect(validatePassword('123456')).toBe(true);
    expect(validatePassword('12345')).toBe(false);
  });
});
