import { describe, expect, it } from 'vitest';
import { createDefaultAppSettings } from './defaults';

describe('default app settings', () => {
  it('starts new installs in light mode', () => {
    expect(createDefaultAppSettings().appearance.theme).toBe('light');
  });
});
