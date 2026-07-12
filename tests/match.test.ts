import { describe, expect, it } from 'vitest';
import { VERSUS_BASE_LEVEL, VERSUS_LEVEL_UP_MS } from '../src/config';
import { BOARD_HEIGHT, BOARD_WIDTH } from '../src/core/board';
import { Match, versusLevel } from '../src/versus/match';

function forceGameOver(m: Match, player: 0 | 1): void {
  const g = m.games[player];
  for (let i = 0; i < 200 && !g.isGameOver; i++) g.hardDrop();
  m.tick(0); // 라우팅 + 라운드 판정
}

describe('versusLevel (5분마다 +1)', () => {
  it('기본 레벨 5에서 시작해 5분마다 오른다', () => {
    expect(versusLevel(VERSUS_BASE_LEVEL, 0)).toBe(5);
    expect(versusLevel(VERSUS_BASE_LEVEL, VERSUS_LEVEL_UP_MS - 1)).toBe(5);
    expect(versusLevel(VERSUS_BASE_LEVEL, VERSUS_LEVEL_UP_MS)).toBe(6);
    expect(versusLevel(VERSUS_BASE_LEVEL, VERSUS_LEVEL_UP_MS * 100)).toBe(20); // 상한
  });
});

describe('Match — 공정성', () => {
  it('두 플레이어가 같은 블록 순서를 받는다', () => {
    const m = new Match({ seed: 42 });
    expect(m.games[0].active!.type).toBe(m.games[1].active!.type);
    expect(m.games[0].preview(7)).toEqual(m.games[1].preview(7));
  });
});

describe('Match — 가비지 라우팅', () => {
  it('P1이 테트리스를 하면 P2 대기열에 4줄이 쌓이고, 다음 고정 시 보드에 올라온다', () => {
    const m = new Match({ seed: 7 });
    const [g1, g2] = m.games;

    // P1 테트리스 세팅
    for (let y = BOARD_HEIGHT - 4; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        if (x !== 4) g1.board[y]![x] = 'G';
      }
    }
    g1.active = { type: 'I', rotation: 1, x: 2, y: 0 };
    g1.hardDrop();
    m.tick(0);

    expect(g2.garbage.total).toBe(4); // 대기열에만 쌓임 (즉시 적용 아님)
    expect(g2.board.flat().filter((c) => c === 'G')).toHaveLength(0);

    g2.hardDrop(); // P2의 다음 고정(클리어 없음) → 가비지 4줄 적용
    m.tick(0);
    const garbageCells = g2.board
      .slice(BOARD_HEIGHT - 4)
      .flat()
      .filter((c) => c === 'G');
    expect(garbageCells).toHaveLength((BOARD_WIDTH - 1) * 4);
    expect(g2.garbage.total).toBe(0);
  });
});

describe('Match — 라운드/시리즈 (3판 2선승)', () => {
  it('탑아웃 → 라운드 승패 → 시리즈 → 재대결 플로우', () => {
    const m = new Match({ seed: 1 });

    // 1라운드: P2 탑아웃 → P1 승
    forceGameOver(m, 1);
    expect(m.phase).toBe('roundover');
    expect(m.roundWinner).toBe(0);
    expect(m.wins).toEqual([1, 0]);

    m.nextRound();
    expect(m.phase).toBe('playing');
    expect(m.round).toBe(2);
    expect(m.games[1].isGameOver).toBe(false); // 새 보드

    // 2라운드: P1 탑아웃 → P2 승 (1:1)
    forceGameOver(m, 0);
    expect(m.phase).toBe('roundover');
    expect(m.wins).toEqual([1, 1]);

    // 3라운드: P2 탑아웃 → P1이 2선승으로 시리즈 승리
    m.nextRound();
    forceGameOver(m, 1);
    expect(m.phase).toBe('matchover');
    expect(m.matchWinner).toBe(0);
    expect(m.wins).toEqual([2, 1]);

    // 시리즈가 끝나면 다음 라운드는 시작되지 않는다
    m.nextRound();
    expect(m.phase).toBe('matchover');

    // 재대결
    m.rematch();
    expect(m.phase).toBe('playing');
    expect(m.wins).toEqual([0, 0]);
    expect(m.round).toBe(1);
    expect(m.matchWinner).toBeNull();
  });

  it('라운드가 끝나면 입력/틱이 무시된다', () => {
    const m = new Match({ seed: 2 });
    forceGameOver(m, 1);
    const winsSnapshot = [...m.wins];
    m.tick(1000);
    expect(m.wins).toEqual(winsSnapshot);
    expect(m.phase).toBe('roundover');
  });
});
