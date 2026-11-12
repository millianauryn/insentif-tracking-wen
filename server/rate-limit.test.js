import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { authLimiter } from './rate-limit.js';

describe('Batas percobaan login', () => {
  it('menerima 10 percobaan lalu menolak ke-11 dalam jendela 1 menit', async () => {
    const app = express();
    app.post('/login', authLimiter, (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 10; i++) {
      await request(app).post('/login').expect(200);
    }
    const blocked = await request(app).post('/login').expect(429);
    expect(blocked.body.error.code).toBe('AUTH_RATE_LIMITED');

    // Jendela reset paling lama 60 detik.
    const reset = Number(blocked.headers['ratelimit-reset']);
    expect(reset).toBeGreaterThan(0);
    expect(reset).toBeLessThanOrEqual(60);
  });
});
