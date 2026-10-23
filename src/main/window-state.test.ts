import { describe, expect, it } from 'vitest';
import type { WindowStateSettings } from '@shared/settings';
import {
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  resolveWindowBounds,
} from './window-state';

const primary = {
  workArea: { x: 0, y: 0, width: 1920, height: 1040 },
};
const secondary = {
  workArea: { x: 1920, y: 0, width: 1600, height: 900 },
};
const displays = [primary, secondary];

function state(
  overrides: Partial<WindowStateSettings> = {},
): WindowStateSettings {
  return {
    x: null,
    y: null,
    width: 1180,
    height: 760,
    maximized: false,
    ...overrides,
  };
}

describe('window bounds resolution', () => {
  it('centers the default window on the primary display', () => {
    expect(resolveWindowBounds(state(), displays, primary)).toEqual({
      x: 370,
      y: 140,
      width: 1180,
      height: 760,
    });
  });

  it('restores a window on a connected secondary display', () => {
    expect(
      resolveWindowBounds(
        state({ x: 2100, y: 80, width: 1200, height: 800 }),
        displays,
        primary,
      ),
    ).toEqual({
      x: 2100,
      y: 80,
      width: 1200,
      height: 800,
    });
  });

  it('moves an off-screen saved position back to the primary display', () => {
    expect(
      resolveWindowBounds(state({ x: 5000, y: 5000 }), displays, primary),
    ).toEqual({
      x: 370,
      y: 140,
      width: 1180,
      height: 760,
    });
  });

  it('clamps a saved size to the display work area', () => {
    expect(
      resolveWindowBounds(
        state({ x: 0, y: 0, width: 3000, height: 2000 }),
        displays,
        primary,
      ),
    ).toEqual({
      x: 0,
      y: 0,
      width: 1920,
      height: 1040,
    });
  });

  it('keeps a partially visible window on screen', () => {
    expect(
      resolveWindowBounds(state({ x: -1000, y: -300 }), displays, primary),
    ).toEqual({
      x: 0,
      y: 0,
      width: 1180,
      height: 760,
    });
  });

  it('enforces the minimum size on a small display', () => {
    const small = {
      workArea: { x: 0, y: 0, width: 800, height: 600 },
    };

    expect(
      resolveWindowBounds(state({ width: 400, height: 300 }), [small], small),
    ).toEqual({
      x: 0,
      y: 0,
      width: MIN_WINDOW_WIDTH,
      height: MIN_WINDOW_HEIGHT,
    });
  });

  it('does not depend on a display array being present', () => {
    expect(resolveWindowBounds(state(), [], primary)).toEqual({
      x: 370,
      y: 140,
      width: 1180,
      height: 760,
    });
  });
});
