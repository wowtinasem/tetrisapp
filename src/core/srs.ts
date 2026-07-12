// SRS(Super Rotation System) 회전 + 벽킥 테이블 (PRD 4.3)
// 표준 SRS 테이블은 y가 위로 갈수록 +지만, 이 프로젝트 보드 좌표는 y가 아래로
// 갈수록 +이므로 y 부호를 반전해 저장했다.

import { isValidPosition, type Board } from './board';
import { getShape, nextRotation, type PieceType, type Rotation } from './piece';

type KickOffset = readonly [number, number]; // [dx, dy]
type KickTable = Record<string, readonly KickOffset[]>;

// J, L, S, T, Z 공용 킥 테이블
const JLSTZ_KICKS: KickTable = {
  '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
};

// I 전용 킥 테이블
const I_KICKS: KickTable = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};

// O는 회전해도 형태가 같으므로 킥 불필요
const O_KICKS: readonly KickOffset[] = [[0, 0]];

export interface PiecePosition {
  type: PieceType;
  rotation: Rotation;
  x: number;
  y: number;
}

export interface RotationResult {
  x: number;
  y: number;
  rotation: Rotation;
  // 성공한 킥의 인덱스 (0 = 킥 없음). T-스핀 판정(Phase 4)에서 사용
  kickIndex: number;
}

export function getKickOffsets(
  type: PieceType,
  from: Rotation,
  to: Rotation,
): readonly KickOffset[] {
  if (type === 'O') return O_KICKS;
  const table = type === 'I' ? I_KICKS : JLSTZ_KICKS;
  return table[`${from}>${to}`]!;
}

/** SRS 규칙으로 회전을 시도한다. 모든 킥이 실패하면 null. */
export function tryRotate(
  board: Board,
  piece: PiecePosition,
  direction: 1 | -1,
): RotationResult | null {
  const to = nextRotation(piece.rotation, direction);
  const shape = getShape(piece.type, to);
  const kicks = getKickOffsets(piece.type, piece.rotation, to);
  for (let i = 0; i < kicks.length; i++) {
    const [dx, dy] = kicks[i]!;
    const x = piece.x + dx;
    const y = piece.y + dy;
    if (isValidPosition(board, shape, x, y)) {
      return { x, y, rotation: to, kickIndex: i };
    }
  }
  return null;
}
