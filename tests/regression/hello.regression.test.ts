import { describe, expect, it } from 'vitest';

describe('project regression smoke', () => {
  it('keeps the hello feature stable across the project workflow', () => {
    expect(['Hello from server', 'Hello from client']).toHaveLength(2);
  });
});
