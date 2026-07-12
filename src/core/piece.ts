// 7종 테트로미노 정의: 형태(회전 4상태), 색상, 스폰 위치 (PRD 4.1, 4.3)

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export type Rotation = 0 | 1 | 2 | 3;
export type ShapeMatrix = readonly (readonly number[])[];

export const PIECE_TYPES: readonly PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

export const PIECE_COLORS: Record<PieceType, string> = {
  I: '#00e5ff', // 하늘색
  O: '#ffd500', // 노랑
  T: '#9c27b0', // 보라
  S: '#4caf50', // 초록
  Z: '#f44336', // 빨강
  J: '#2196f3', // 파랑
  L: '#ff9800', // 주황
};

// 회전 상태 0(스폰 방향)의 기준 형태. I는 4x4, O는 2x2, 나머지는 3x3.
const BASE_SHAPES: Record<PieceType, ShapeMatrix> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

function rotateCW(shape: ShapeMatrix): ShapeMatrix {
  const n = shape.length;
  return Array.from({ length: n }, (_, y) =>
    Array.from({ length: n }, (_, x) => shape[n - 1 - x]![y]!),
  );
}

function buildRotations(base: ShapeMatrix): readonly ShapeMatrix[] {
  const states: ShapeMatrix[] = [base];
  for (let i = 1; i < 4; i++) {
    states.push(rotateCW(states[i - 1]!));
  }
  return states;
}

// 타입별 회전 상태 [0, R, 2, L] 사전 계산
const ROTATION_SHAPES: Record<PieceType, readonly ShapeMatrix[]> = {
  I: buildRotations(BASE_SHAPES.I),
  O: buildRotations(BASE_SHAPES.O),
  T: buildRotations(BASE_SHAPES.T),
  S: buildRotations(BASE_SHAPES.S),
  Z: buildRotations(BASE_SHAPES.Z),
  J: buildRotations(BASE_SHAPES.J),
  L: buildRotations(BASE_SHAPES.L),
};

export function getShape(type: PieceType, rotation: Rotation): ShapeMatrix {
  return ROTATION_SHAPES[type][rotation]!;
}

// 스폰 위치: 보드 좌상단 기준 셀 좌표. y=0이면 버퍼 2줄(보이지 않는 영역)에서 스폰된다.
export function getSpawnPosition(type: PieceType): { x: number; y: number } {
  return type === 'O' ? { x: 4, y: 0 } : { x: 3, y: 0 };
}

export function nextRotation(rotation: Rotation, direction: 1 | -1): Rotation {
  return (((rotation + direction) % 4) + 4) % 4 as Rotation;
}
