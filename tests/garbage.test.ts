import { describe, expect, it } from 'vitest';
import { addGarbageLines, BOARD_HEIGHT, BOARD_WIDTH, createBoard } from '../src/core/board';
import { Game } from '../src/core/game';
import { attackLines, comboBonus, GarbageQueue } from '../src/core/garbage';

const rng0 = () => 0; // bag 순서: O, T, S, Z, J, L, I

describe('attackLines (PRD 3.2 공격 테이블)', () => {
  const base = { tspin: false, backToBack: false, combo: 0 };

  it('일반 클리어: 싱글 0, 더블 1, 트리플 2, 테트리스 4', () => {
    expect(attackLines({ ...base, lines: 1 })).toBe(0);
    expect(attackLines({ ...base, lines: 2 })).toBe(1);
    expect(attackLines({ ...base, lines: 3 })).toBe(2);
    expect(attackLines({ ...base, lines: 4 })).toBe(4);
  });

  it('T-스핀: 싱글 2, 더블 4, 트리플 6', () => {
    expect(attackLines({ ...base, lines: 1, tspin: true })).toBe(2);
    expect(attackLines({ ...base, lines: 2, tspin: true })).toBe(4);
    expect(attackLines({ ...base, lines: 3, tspin: true })).toBe(6);
  });

  it('백투백 보너스 +1', () => {
    expect(attackLines({ ...base, lines: 4, backToBack: true })).toBe(5);
    expect(attackLines({ ...base, lines: 2, tspin: true, backToBack: true })).toBe(5);
  });

  it('콤보 보너스 +1 ~ +4', () => {
    expect(comboBonus(0)).toBe(0);
    expect(comboBonus(1)).toBe(1);
    expect(comboBonus(3)).toBe(2);
    expect(comboBonus(5)).toBe(3);
    expect(comboBonus(7)).toBe(4);
    expect(comboBonus(20)).toBe(4);
    // 싱글도 콤보 중에는 공격이 생긴다
    expect(attackLines({ ...base, lines: 1, combo: 1 })).toBe(1);
  });

  it('클리어가 없으면 공격도 없다', () => {
    expect(attackLines({ ...base, lines: 0, combo: 5 })).toBe(0);
  });
});

describe('GarbageQueue — 상쇄', () => {
  it('공격 단위로 쌓이고 총량을 집계한다', () => {
    const q = new GarbageQueue();
    q.enqueue(2);
    q.enqueue(4);
    q.enqueue(0); // 무시
    expect(q.total).toBe(6);
  });

  it('부분 상쇄: 대기량이 더 많으면 잔여 공격 0', () => {
    const q = new GarbageQueue();
    q.enqueue(3);
    expect(q.offset(1)).toBe(0);
    expect(q.total).toBe(2);
  });

  it('초과 상쇄: 대기량을 넘는 공격은 잔여분을 반환한다', () => {
    const q = new GarbageQueue();
    q.enqueue(2);
    expect(q.offset(5)).toBe(3);
    expect(q.total).toBe(0);
  });

  it('여러 공격 단위를 순서대로 깎는다', () => {
    const q = new GarbageQueue();
    q.enqueue(2);
    q.enqueue(3);
    expect(q.offset(4)).toBe(0);
    expect(q.total).toBe(1);
  });

  it('flush는 전량을 꺼내고 비운다', () => {
    const q = new GarbageQueue();
    q.enqueue(2);
    q.enqueue(1);
    expect(q.flush()).toBe(3);
    expect(q.total).toBe(0);
  });
});

describe('addGarbageLines', () => {
  it('하단에 구멍 있는 회색 줄이 올라오고 기존 줄은 위로 밀린다', () => {
    const board = createBoard();
    board[BOARD_HEIGHT - 1]![0] = 'T'; // 기존 스택 표식
    const result = addGarbageLines(board, [4, 7]);

    expect(result).toHaveLength(BOARD_HEIGHT);
    expect(result[BOARD_HEIGHT - 3]![0]).toBe('T'); // 두 칸 위로 밀림
    // 첫 가비지 줄: 구멍 4
    expect(result[BOARD_HEIGHT - 2]![4]).toBeNull();
    expect(result[BOARD_HEIGHT - 2]!.filter((c) => c === 'G')).toHaveLength(BOARD_WIDTH - 1);
    // 둘째 가비지 줄: 구멍 7
    expect(result[BOARD_HEIGHT - 1]![7]).toBeNull();
    expect(board[BOARD_HEIGHT - 1]![0]).toBe('T'); // 원본 불변
  });
});

describe('가비지 적용 타이밍 (Game 통합)', () => {
  it('대기 가비지는 다음 "클리어 없는 고정" 직후에 올라온다', () => {
    const g = new Game({ rng: rng0, garbageRng: rng0 });
    g.garbage.enqueue(2);
    expect(g.board[BOARD_HEIGHT - 1]!.every((c) => c === null)).toBe(true);

    g.hardDrop(); // O 고정 (클리어 없음) → 가비지 2줄 적용
    // 바닥 2줄이 가비지 (구멍은 garbageRng=0 → 열 0)
    for (const y of [BOARD_HEIGHT - 1, BOARD_HEIGHT - 2]) {
      expect(g.board[y]![0]).toBeNull();
      expect(g.board[y]!.filter((c) => c === 'G')).toHaveLength(BOARD_WIDTH - 1);
    }
    // O는 두 칸 위로 밀렸다
    expect(g.board[BOARD_HEIGHT - 3]![4]).toBe('O');
    expect(g.board[BOARD_HEIGHT - 4]![4]).toBe('O');
    expect(g.garbage.total).toBe(0);
  });

  it('라인을 클리어하면 공격량만큼 상쇄되고 가비지는 올라오지 않는다', () => {
    const g = new Game({ rng: rng0, garbageRng: rng0 });
    g.garbage.enqueue(3);
    // O가 두 줄을 클리어하도록 세팅 → 더블 = 공격 1 → 상쇄 후 대기 2
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (x !== 4 && x !== 5) {
        g.board[BOARD_HEIGHT - 1]![x] = 'G';
        g.board[BOARD_HEIGHT - 2]![x] = 'G';
      }
    }
    g.hardDrop();
    expect(g.lastLock).toMatchObject({ linesCleared: 2, attack: 0 }); // 전부 상쇄에 사용
    expect(g.garbage.total).toBe(2); // 클리어한 lock에서는 가비지가 올라오지 않음
    expect(g.board[BOARD_HEIGHT - 1]!.every((c) => c === null)).toBe(true);
  });

  it('상쇄하고 남은 공격량이 lastLock.attack으로 나간다', () => {
    const g = new Game({ rng: rng0, garbageRng: rng0 });
    g.garbage.enqueue(1);
    // 테트리스 세팅: I가 열 4에 수직으로 들어가 4줄 클리어
    for (let y = BOARD_HEIGHT - 4; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        if (x !== 4) g.board[y]![x] = 'G';
      }
    }
    g.active = { type: 'I', rotation: 1, x: 2, y: 0 }; // R 상태 I는 x+2 열 차지
    g.hardDrop();
    expect(g.lastLock).toMatchObject({ linesCleared: 4, attack: 3 }); // 4 - 대기 1 = 3
  });
});
