import { describe, expect, it } from 'vitest';

import { withTimeout } from '../../src/features/chat/conversation.service.js';

describe('Sprint 4 API resilience', () => {
  it('bounds repeated slow answer work at the configured timeout', async () => {
    const timeoutMs = 15;
    const elapsedSamples: number[] = [];

    for (let sample = 0; sample < 5; sample += 1) {
      const startedAt = performance.now();

      await expect(
        withTimeout(new Promise(() => undefined), timeoutMs)
      ).rejects.toMatchObject({ status: 504, code: 'timeout' });

      elapsedSamples.push(performance.now() - startedAt);
    }

    const averageMs =
      elapsedSamples.reduce((total, elapsed) => total + elapsed, 0) /
      elapsedSamples.length;

    expect(averageMs).toBeGreaterThanOrEqual(timeoutMs * 0.5);
    expect(averageMs).toBeLessThan(timeoutMs * 8);
  });

  it('returns fast successful work before the timeout', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 100)).resolves.toBe('ok');
  });
});
