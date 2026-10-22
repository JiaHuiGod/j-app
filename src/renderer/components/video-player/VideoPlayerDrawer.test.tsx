import { cleanup, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoPlayerDrawer } from './VideoPlayerDrawer';

type DrawerProps = ComponentProps<typeof VideoPlayerDrawer>;

const playlist = Array.from({ length: 20 }, (_, index) => ({
  id: `video-${index}`,
  title: `Video ${index}`,
}));

function createProps(overrides: Partial<DrawerProps> = {}): DrawerProps {
  return {
    open: false,
    playlist,
    activeId: 'video-15',
    onSelectPlaylist: vi.fn<DrawerProps['onSelectPlaylist']>(),
    ...overrides,
  };
}

function rect(top: number, bottom: number): DOMRect {
  return {
    bottom,
    height: bottom - top,
    left: 0,
    right: 0,
    top,
    width: 0,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'scrollIntoView',
);
let scrollIntoView: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  scrollIntoView = vi.fn<() => void>();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
    writable: true,
  });
});

afterEach(() => {
  cleanup();

  if (scrollIntoViewDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      'scrollIntoView',
      scrollIntoViewDescriptor,
    );
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  }
});

describe('VideoPlayerDrawer', () => {
  it('opens without scrolling the dialog horizontally', () => {
    const props = createProps();
    const { rerender } = render(<VideoPlayerDrawer {...props} />);
    const activeItem = screen.getByTitle('Video 15');
    const container = activeItem.parentElement;

    if (!container) {
      throw new Error('playlist scroll container was not rendered');
    }

    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(rect(0, 100));
    vi.spyOn(activeItem, 'getBoundingClientRect').mockReturnValue(
      rect(120, 140),
    );
    container.scrollTop = 0;
    container.scrollLeft = 0;

    rerender(<VideoPlayerDrawer {...props} open />);

    expect(container.scrollTop).toBe(40);
    expect(container.scrollLeft).toBe(0);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
