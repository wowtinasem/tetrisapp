import { describe, expect, it } from 'vitest';
import { DasRepeater } from '../src/input/das';

// 기본값 DAS 167ms / ARR 33ms 대신 계산이 쉬운 값으로 검증
const DAS = 100;
const ARR = 25;

describe('DasRepeater', () => {
  it('처음 누르면 즉시 1회 이동한다', () => {
    const das = new DasRepeater(DAS, ARR);
    expect(das.update(true, false, 16)).toBe(-1);
  });

  it('DAS 지연이 지나기 전에는 추가 이동이 없다', () => {
    const das = new DasRepeater(DAS, ARR);
    das.update(true, false, 16); // 최초 이동
    expect(das.update(true, false, DAS - 1)).toBe(0);
  });

  it('DAS 경과 후 ARR 간격으로 반복 이동한다', () => {
    const das = new DasRepeater(DAS, ARR);
    das.update(false, true, 16); // 최초 +1
    expect(das.update(false, true, DAS)).toBe(1); // DAS 만료 시점에 1회
    expect(das.update(false, true, ARR)).toBe(1);
    expect(das.update(false, true, ARR * 3)).toBe(3); // 큰 델타는 한 번에 몰아서
  });

  it('키를 떼면 상태가 초기화되어 다시 즉시 이동한다', () => {
    const das = new DasRepeater(DAS, ARR);
    das.update(true, false, 16);
    das.update(true, false, DAS + ARR); // 반복 중
    expect(das.update(false, false, 16)).toBe(0);
    expect(das.update(true, false, 16)).toBe(-1); // 재입력 즉시 이동
  });

  it('방향 전환은 즉시 1회 이동하고 DAS를 다시 센다', () => {
    const das = new DasRepeater(DAS, ARR);
    das.update(true, false, 16);
    expect(das.update(false, true, 16)).toBe(1); // 전환 즉시
    expect(das.update(false, true, DAS - 1)).toBe(0); // DAS 재충전 중
  });

  it('좌우 동시 입력은 나중에 누른 쪽이 우선한다', () => {
    const das = new DasRepeater(DAS, ARR);
    expect(das.update(true, false, 16)).toBe(-1); // 왼쪽 먼저
    expect(das.update(true, true, 16)).toBe(1); // 오른쪽 추가 → 오른쪽 우선
    expect(das.update(true, true, 16)).toBe(0); // 유지 (DAS 충전 중)
    expect(das.update(true, false, 16)).toBe(-1); // 오른쪽 뗌 → 왼쪽으로 전환
  });
});
