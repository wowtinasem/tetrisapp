// 기록 <-> scores.txt 직렬화/파싱 (implementation_plan 0장 포맷)
// 한 줄 = 한 게임, `[timestamp]` + `KEY=VALUE` 공백 구분. 파싱 실패 줄은 건너뛴다.

import type { GameRecord } from './scoreStore';

export const TXT_HEADER = '=== TETRIS SCORE LOG ===';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** mm:ss (한 시간이 넘으면 분이 60을 넘어간다: 75:03) */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  return `${pad2(Math.floor(totalSec / 60))}:${pad2(totalSec % 60)}`;
}

export function parseDuration(text: string): number | null {
  const m = /^(\d+):(\d{2})$/.exec(text);
  if (!m) return null;
  return (Number(m[1]!) * 60 + Number(m[2]!)) * 1000;
}

export function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  );
}

export function serializeRecord(record: GameRecord): string {
  const ts = `[${formatTimestamp(record.timestamp)}]`;
  if (record.kind === 'solo') {
    return (
      `${ts} MODE=SOLO  PLAYER=${record.player}  SCORE=${record.score}` +
      `  LINES=${record.lines}  LEVEL=${record.level}  DURATION=${formatDuration(record.durationMs)}`
    );
  }
  return (
    `${ts} MODE=VERSUS  WINNER=${record.winner}` +
    `  ROUNDS=${record.rounds}  DURATION=${formatDuration(record.durationMs)}`
  );
}

export function serializeLog(records: GameRecord[]): string {
  return [TXT_HEADER, ...records.map(serializeRecord)].join('\n') + '\n';
}

const LINE_RE = /^\[(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\]\s+(.+)$/;

export function parseRecordLine(line: string): GameRecord | null {
  const m = LINE_RE.exec(line.trim());
  if (!m) return null;
  const timestamp = new Date(
    Number(m[1]!),
    Number(m[2]!) - 1,
    Number(m[3]!),
    Number(m[4]!),
    Number(m[5]!),
    Number(m[6]!),
  ).getTime();
  if (Number.isNaN(timestamp)) return null;

  const fields = new Map<string, string>();
  for (const token of m[7]!.split(/\s+/)) {
    const eq = token.indexOf('=');
    if (eq <= 0) return null;
    fields.set(token.slice(0, eq), token.slice(eq + 1));
  }

  const durationMs = parseDuration(fields.get('DURATION') ?? '');
  if (durationMs === null) return null;

  const mode = fields.get('MODE');
  if (mode === 'SOLO') {
    const player = fields.get('PLAYER');
    const score = Number(fields.get('SCORE'));
    const lines = Number(fields.get('LINES'));
    const level = Number(fields.get('LEVEL'));
    if (!player || !Number.isFinite(score) || !Number.isFinite(lines) || !Number.isFinite(level)) {
      return null;
    }
    return { kind: 'solo', timestamp, player, score, lines, level, durationMs };
  }
  if (mode === 'VERSUS') {
    const winner = fields.get('WINNER');
    const rounds = fields.get('ROUNDS');
    if (!winner || !rounds) return null;
    return { kind: 'versus', timestamp, winner, rounds, durationMs };
  }
  return null;
}

export interface ParseResult {
  records: GameRecord[];
  skipped: number; // 파싱에 실패해 건너뛴 줄 수
}

/** 헤더와 빈 줄은 무시하고, 실패한 줄은 건너뛰며 개수만 센다 */
export function parseLog(text: string): ParseResult {
  const records: GameRecord[] = [];
  let skipped = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line === TXT_HEADER) continue;
    const record = parseRecordLine(line);
    if (record) records.push(record);
    else skipped++;
  }
  return { records, skipped };
}
