import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { helloRequest, helloResponse } from '../helpers/hello.fixtures.js';

describe('POST /api/hello', () => {
  it('returns a greeting and echoes the client message', async () => {
    const response = await request(app).post('/api/hello').send(helloRequest);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(helloResponse);
  });

  it('rejects an empty client message', async () => {
    const response = await request(app)
      .post('/api/hello')
      .send({ message: ' ' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('A non-empty message is required.');
  });
});
