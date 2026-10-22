import { describe, expect, it } from 'vitest';
import { findActiveSubtitle, parseSubtitle } from './subtitles';

describe('subtitle parsing', () => {
  it('parses SRT cues and returns the active text', () => {
    const cues = parseSubtitle(
      `1
00:00:01,000 --> 00:00:03,500
第一句

2
00:00:04,000 --> 00:00:06,000
第二句
`,
      'srt',
    );

    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({
      start: 1,
      end: 3.5,
      text: '第一句',
    });
    expect(findActiveSubtitle(cues, 4.2)).toBe('第二句');
    expect(findActiveSubtitle(cues, 7)).toBe('');
  });

  it('parses basic ASS dialogue events', () => {
    const cues = parseSubtitle(
      `[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.50,0:00:03.00,Default,,0,0,0,,{\\an8}你好\\N世界
`,
      'ass',
    );

    expect(cues).toEqual([
      {
        start: 1.5,
        end: 3,
        text: '你好\n世界',
      },
    ]);
  });
});
