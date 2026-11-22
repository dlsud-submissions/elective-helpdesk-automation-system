import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const seed = readFileSync(
  new URL('../../../supabase/seed.sql', import.meta.url),
  'utf8'
);

describe('fictional demo seed contract', () => {
  it('documents local-only demo credentials and rejects production use', () => {
    expect(seed).toContain('development project, never production');
    expect(seed).toContain('Password123!');
    expect(seed).toContain('@example.test');
  });

  it('seeds each expected role and supports repeatable reset', () => {
    expect(seed).toContain("'dana.cruz@example.test'");
    expect(seed).toContain("'lee.agent@example.test'");
    expect(seed).toContain("'ari.admin@example.test'");
    expect(seed).toContain("set role = 'agent'");
    expect(seed).toContain("set role = 'admin'");
    expect(seed).toContain('on conflict (id) do nothing');
    expect(seed).toContain('on conflict (id) do update');
  });

  it('includes the knowledge and ticket fixtures referenced by the walkthrough', () => {
    expect(seed).toContain('MFA reset procedures');
    expect(seed).toContain('Laptop onboarding checklist');
    expect(seed).toContain('Reason: user requested agent.');
    expect(seed).toContain('VPN drops on home network');
  });
});
