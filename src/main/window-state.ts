import type { WindowStateSettings } from '@shared/settings';

export const MIN_WINDOW_WIDTH = 900;
export const MIN_WINDOW_HEIGHT = 620;

const MAX_WINDOW_WIDTH = 10_000;
const MAX_WINDOW_HEIGHT = 10_000;
const MIN_VISIBLE_WIDTH = 160;
const MIN_VISIBLE_HEIGHT = 80;

export interface WindowWorkArea {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface WindowDisplay {
  readonly workArea: WindowWorkArea;
}

export interface WindowBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function intersectionSize(
  left: WindowWorkArea,
  right: WindowWorkArea,
): { width: number; height: number } {
  return {
    width: Math.max(
      0,
      Math.min(left.x + left.width, right.x + right.width) -
        Math.max(left.x, right.x),
    ),
    height: Math.max(
      0,
      Math.min(left.y + left.height, right.y + right.height) -
        Math.max(left.y, right.y),
    ),
  };
}

function centerOn(area: WindowWorkArea, width: number, height: number) {
  return {
    x: area.x + Math.max(0, Math.floor((area.width - width) / 2)),
    y: area.y + Math.max(0, Math.floor((area.height - height) / 2)),
  };
}

export function resolveWindowBounds(
  state: WindowStateSettings,
  displays: readonly WindowDisplay[],
  primaryDisplay: WindowDisplay,
): WindowBounds {
  const areas =
    displays.length > 0
      ? displays.map((display) => display.workArea)
      : [primaryDisplay.workArea];
  let width = clamp(
    Math.round(state.width),
    MIN_WINDOW_WIDTH,
    MAX_WINDOW_WIDTH,
  );
  let height = clamp(
    Math.round(state.height),
    MIN_WINDOW_HEIGHT,
    MAX_WINDOW_HEIGHT,
  );

  if (state.x !== null && state.y !== null) {
    const candidate: WindowWorkArea = {
      x: Math.round(state.x),
      y: Math.round(state.y),
      width,
      height,
    };
    let target: WindowWorkArea | null = null;
    let bestArea = 0;

    for (const area of areas) {
      const overlap = intersectionSize(candidate, area);
      const areaSize = overlap.width * overlap.height;

      if (areaSize > bestArea) {
        bestArea = areaSize;
        target = area;
      }
    }

    if (target) {
      const overlap = intersectionSize(candidate, target);

      if (
        overlap.width >= MIN_VISIBLE_WIDTH &&
        overlap.height >= MIN_VISIBLE_HEIGHT
      ) {
        width = clamp(
          width,
          MIN_WINDOW_WIDTH,
          Math.max(target.width, MIN_WINDOW_WIDTH),
        );
        height = clamp(
          height,
          MIN_WINDOW_HEIGHT,
          Math.max(target.height, MIN_WINDOW_HEIGHT),
        );

        return {
          width,
          height,
          x: clamp(
            Math.round(state.x),
            target.x,
            target.x + Math.max(0, target.width - width),
          ),
          y: clamp(
            Math.round(state.y),
            target.y,
            target.y + Math.max(0, target.height - height),
          ),
        };
      }
    }
  }

  const fallbackArea = primaryDisplay.workArea;

  width = clamp(
    width,
    MIN_WINDOW_WIDTH,
    Math.max(fallbackArea.width, MIN_WINDOW_WIDTH),
  );
  height = clamp(
    height,
    MIN_WINDOW_HEIGHT,
    Math.max(fallbackArea.height, MIN_WINDOW_HEIGHT),
  );

  return {
    width,
    height,
    ...centerOn(fallbackArea, width, height),
  };
}
