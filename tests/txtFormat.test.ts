import { describe, expect, it } from 'vitest';
import type { GameRecord, SoloRecord, VersusRecord } from '../src/score/scoreStore';
import {
  formatDuration,
  parseDuration,
  parseLog,
  parseRecordLine,
  serializeLog,
  serializeRecord,
  TXT_HEADER,
} from '../src/score/txtFormat';

const soloTs = new Date(2026, 6, 12, 21, 35, 2).getTime(); // 2026-07-12 21:35:02
const versusTs = new Date(2026, 6, 12, 21, 50, 17).getTime();

const solo: SoloRecord = {
  kind: 'solo',
  timestamp: soloTs,
  player: 'P1',
  score: 48200,
  lines: 62,
  level: 7,
  durationMs: 521_000, // 08:41
};

const versus: VersusRecord = {
  kind: 'versus',
  timestamp: versusTs,
  winner: 'P2',
  rounds: '2-1',
  durationMs: 723_000, // 12:03
};

describe('formatDuration / parseDuration', () => {
  it('mm:ss 형식으로 왕복된다', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(521_000)).toBe('08:41');
    expect(parseDuration('08:41')).toBe(521_000);
  });

  it('한 시간이 넘으면 분이 60을 넘는다', () => {
    expect(formatDuration(4_503_000)).toBe('75:03');
    expect(parseDuration('75:03')).toBe(4_503_000);
  });

  it('형식이 다르면 null', () => {
    expect(parseDuration('8:4')).toBeNull();
    expect(parseDuration('abc')).toBeNull();
  });
});

describe('serializeRecord', () => {
  it('SOLO 기록이 계획서 0장의 포맷을 따른다', () => {
    const line = serializeRecord(solo);
    expect(line).toBe(
      '[2026-07-12 21:35:02] MODE=SOLO  PLAYER=P1  SCORE=48200  LINES=62  LEVEL=7  DURATION=08:41',
    );
  });

  it('VERSUS 기록이 포맷을 따른다', () => {
    const line = serializeRecord(versus);
    expect(line).toBe('[2026-07-12 21:50:17] MODE=VERSUS  WINNER=P2  ROUNDS=2-1  DURATION=12:03');
  });
});

describe('직렬화 ↔ 파싱 왕복', () => {
  it('serializeLog → parseLog가 기록을 그대로 복원한다', () => {
    const records: GameRecord[] = [solo, versus];
    const text = serializeLog(records);
    expect(text.startsWith(TXT_HEADER)).toBe(true);

    const parsed = parseLog(text);
    expect(parsed.skipped).toBe(0);
    expect(parsed.records).toEqual(records);
  });

  it('두 번 직렬화해도 결과가 같다 (안정성)', () => {
    const once = serializeLog([solo, versus]);
    const twice = serializeLog(parseLog(once).records);
    expect(twice).toBe(once);
  });
});

describe('파싱 실패 줄 처리 (리스크 대응: 수동 편집 내성)', () => {
  it('깨진 줄은 건너뛰고 개수만 센다', () => {
    const text = [
      TXT_HEADER,
      serializeRecord(solo),
      '이것은 잘못된 줄',
      '[2026-07-12 22:00:00] MODE=SOLO PLAYER=P1', // DURATION 없음
      '[2026-13-99 99:99:99] MODE=SOLO', // 잘못된 날짜
      '',
      serializeRecord(versus),
    ].join('\n');

    const parsed = parseLog(text);
    expect(parsed.records).toHaveLength(2);
    expect(parsed.skipped).toBe(3);
  });

  it('CRLF 줄바꿈도 처리한다', () => {
    const text = serializeLog([solo]).replace(/\n/g, '\r\n');
    const parsed = parseLog(text);
    expect(parsed.records).toEqual([solo]);
  });

  it('알 수 없는 MODE는 건너뛴다', () => {
    expect(parseRecordLine('[2026-07-12 21:00:00] MODE=COOP  DURATION=01:00')).toBeNull();
  });
});
