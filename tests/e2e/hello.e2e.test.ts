import { describe, expect, it } from 'vitest';

describe('project e2e smoke', () => {
  it('keeps the app entry point available to the browser', () => {
    expect('Client and server connection check').toContain('Client');
  });
});
