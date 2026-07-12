import { describe, expect, it } from 'vitest';
import { BOARD_HEIGHT, BOARD_WIDTH } from '../src/core/board';
import { Game } from '../src/core/game';
import { LOCK_DELAY_MS, MAX_LOCK_RESETS } from '../src/core/gravity';

// rng가 항상 0을 반환하면 7-bag 순서가 [O, T, S, Z, J, L, I]로 고정된다
const rng0 = () => 0;

function newGame(level = 1): Game {
  return new Game({ rng: rng0, level });
}

describe('스폰', () => {
  it('생성 직후 활성 블록이 스폰 위치에 있다', () => {
    const g = newGame();
    expect(g.phase).toBe('falling');
    expect(g.active).toEqual({ type: 'O', rotation: 0, x: 4, y: 0 });
  });

  it('preview가 다음 블록 순서를 보여준다', () => {
    const g = newGame();
    expect(g.preview(5)).toEqual(['T', 'S', 'Z', 'J', 'L']);
  });
});

describe('중력', () => {
  it('레벨 1에서는 1000ms마다 한 칸 낙하한다', () => {
    const g = newGame();
    g.tick(999);
    expect(g.active!.y).toBe(0);
    g.tick(1);
    expect(g.active!.y).toBe(1);
  });

  it('소프트 드롭은 기본 중력의 20배 속도다', () => {
    const g = newGame();
    g.setSoftDrop(true);
    g.tick(50); // 1000ms / 20 = 50ms
    expect(g.active!.y).toBe(1);
  });

  it('큰 deltaMs가 와도 바닥을 뚫지 않고 접지 상태가 된다', () => {
    const g = newGame();
    g.tick(60_000);
    expect(g.phase).toBe('locking');
    // O의 아래쪽 셀(y+1)이 마지막 줄에 닿아 있음
    expect(g.active!.y).toBe(BOARD_HEIGHT - 2);
  });
});

describe('락 딜레이', () => {
  function groundedGame(): Game {
    const g = newGame();
    g.tick(60_000); // 바닥까지 낙하 → locking
    return g;
  }

  it('접지 후 500ms가 지나면 고정된다', () => {
    const g = groundedGame();
    g.tick(LOCK_DELAY_MS - 1);
    expect(g.board.flat().every((cell) => cell === null)).toBe(true);
    g.tick(1);
    expect(g.board[BOARD_HEIGHT - 1]![4]).toBe('O');
    expect(g.active!.type).toBe('T'); // 다음 블록 스폰
  });

  it('접지 중 이동에 성공하면 타이머가 리셋된다', () => {
    const g = groundedGame();
    g.tick(LOCK_DELAY_MS - 1);
    expect(g.moveActive(-1)).toBe(true);
    g.tick(LOCK_DELAY_MS - 1);
    expect(g.board.flat().every((cell) => cell === null)).toBe(true); // 아직 고정 안 됨
    g.tick(1);
    expect(g.board[BOARD_HEIGHT - 1]![3]).toBe('O'); // 이동한 위치에 고정
  });

  it('리셋 15회 소진 후의 조작은 즉시 강제 고정된다', () => {
    const g = groundedGame();
    for (let i = 0; i < MAX_LOCK_RESETS; i++) {
      expect(g.moveActive(i % 2 === 0 ? -1 : 1)).toBe(true);
    }
    expect(g.board.flat().every((cell) => cell === null)).toBe(true); // 15회까지는 유예
    g.moveActive(1); // 16번째 조작
    expect(g.board[BOARD_HEIGHT - 1]!.some((cell) => cell === 'O')).toBe(true);
  });
});

describe('하드 드롭과 라인 클리어', () => {
  it('hardDrop은 즉시 바닥에 고정하고 다음 블록을 스폰한다', () => {
    const g = newGame();
    g.hardDrop();
    expect(g.board[BOARD_HEIGHT - 1]![4]).toBe('O');
    expect(g.board[BOARD_HEIGHT - 1]![5]).toBe('O');
    expect(g.active!.type).toBe('T');
    expect(g.phase).toBe('falling');
  });

  it('고정으로 줄이 차면 클리어되고 totalLines가 오른다', () => {
    const g = newGame();
    // 바닥 줄을 O가 떨어질 칸(4,5)만 남기고 채움
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (x !== 4 && x !== 5) g.board[BOARD_HEIGHT - 1]![x] = 'G';
    }
    g.hardDrop();
    expect(g.totalLines).toBe(1);
    expect(g.lastLock).toMatchObject({ linesCleared: 1, clearedRows: [BOARD_HEIGHT - 1] });
    // O의 윗줄 절반이 한 칸 내려와 바닥 줄에 남음
    expect(g.board[BOARD_HEIGHT - 1]![4]).toBe('O');
    expect(g.board[BOARD_HEIGHT - 1]![0]).toBeNull();
  });
});

describe('회전 (SRS 연동)', () => {
  it('rotateActive가 SRS 결과를 활성 블록에 적용한다', () => {
    const g = newGame();
    g.hardDrop(); // O 고정 → T 스폰
    expect(g.rotateActive(1)).toBe(true);
    expect(g.active!.rotation).toBe(1);
  });
});

describe('홀드', () => {
  it('홀드는 블록당 1회만 가능하고 고정 후 다시 사용할 수 있다', () => {
    const g = newGame();
    expect(g.holdActive()).toBe(true); // O 보관 → T 스폰
    expect(g.heldPiece).toBe('O');
    expect(g.active!.type).toBe('T');
    expect(g.holdActive()).toBe(false); // 같은 블록에서 재사용 불가

    g.hardDrop(); // T 고정 → S 스폰, 홀드 사용권 회복
    expect(g.holdActive()).toBe(true); // S ↔ O 교체
    expect(g.active!.type).toBe('O');
    expect(g.heldPiece).toBe('S');
  });
});

describe('점수와 T-스핀', () => {
  /**
   * T-스핀 더블 슬롯 — T의 가로 행이 row 20을, 아래 돌기가 row 21을 완성한다:
   *   row 19:  . . . G . . . . . .   (col 3 오버행)
   *   row 20:  G G G . . . G G G G   (cols 3~5 비움)
   *   row 21:  G G G G . G G G G G   (col 4만 비움)
   */
  function tspinSlotGame(): Game {
    const g = newGame();
    const bottom = BOARD_HEIGHT - 1; // 21
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (x !== 4) g.board[bottom]![x] = 'G';
      if (x < 3 || x > 5) g.board[bottom - 1]![x] = 'G';
    }
    g.board[bottom - 2]![3] = 'G';
    return g;
  }

  it('회전으로 슬롯에 들어간 T는 T-스핀 더블로 판정된다', () => {
    const g = tspinSlotGame();
    g.active = { type: 'T', rotation: 0, x: 3, y: BOARD_HEIGHT - 3 };
    expect(g.rotateActive(1)).toBe(true); // 0 → R
    expect(g.rotateActive(1)).toBe(true); // R → 2 (아래를 향한 T)
    g.hardDrop(); // 접지 상태라 이동 0칸 — 마지막 동작은 회전 유지
    expect(g.lastLock).toMatchObject({ tspin: true, linesCleared: 2 });
    expect(g.lastLock!.points).toBe(1200); // T-스핀 더블 1200 × 레벨 1
    expect(g.score).toBe(1200);
  });

  it('회전 없이 고정되면 같은 슬롯이라도 T-스핀이 아니다', () => {
    const g = tspinSlotGame();
    g.active = { type: 'T', rotation: 2, x: 3, y: BOARD_HEIGHT - 3 };
    g.hardDrop();
    expect(g.lastLock).toMatchObject({ tspin: false, linesCleared: 2 });
    expect(g.lastLock!.points).toBe(300); // 일반 더블
  });

  it('하드 드롭은 2점/칸, 소프트 드롭은 1점/칸', () => {
    const g = newGame();
    g.hardDrop(); // O가 y0 → y20으로 20칸 낙하
    expect(g.score).toBe(40);

    const g2 = newGame();
    g2.setSoftDrop(true);
    g2.tick(50); // 1칸 하강
    expect(g2.score).toBe(1);
  });

  it('10라인을 채우면 레벨이 오른다', () => {
    const g = newGame();
    g.totalLines = 8;
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (x !== 4 && x !== 5) {
        g.board[BOARD_HEIGHT - 1]![x] = 'G';
        g.board[BOARD_HEIGHT - 2]![x] = 'G';
      }
    }
    g.hardDrop(); // O가 두 줄을 동시에 클리어
    expect(g.totalLines).toBe(10);
    expect(g.level).toBe(2);
    expect(g.lastLock).toMatchObject({ linesCleared: 2, points: 300 });
  });

  it('autoLevelUp: false면 레벨이 고정된다 (2인용)', () => {
    const g = new Game({ rng: rng0, level: 5, autoLevelUp: false });
    g.totalLines = 30;
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (x !== 4 && x !== 5) g.board[BOARD_HEIGHT - 1]![x] = 'G';
    }
    g.hardDrop();
    expect(g.level).toBe(5);
  });
});

describe('게임 오버', () => {
  it('중앙에 계속 쌓으면 스폰 불가로 게임 오버가 된다', () => {
    const g = newGame();
    for (let i = 0; i < 200 && g.phase !== 'gameover'; i++) {
      g.hardDrop();
    }
    expect(g.phase).toBe('gameover');
    expect(g.active).toBeNull();
  });

  it('게임 오버 후에는 조작이 무시된다', () => {
    const g = newGame();
    for (let i = 0; i < 200 && g.phase !== 'gameover'; i++) g.hardDrop();
    const boardSnapshot = g.board.map((row) => [...row]);
    expect(g.moveActive(-1)).toBe(false);
    expect(g.rotateActive(1)).toBe(false);
    expect(g.holdActive()).toBe(false);
    g.hardDrop();
    g.tick(1000);
    expect(g.board).toEqual(boardSnapshot);
  });
});
