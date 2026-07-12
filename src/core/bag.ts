// 7-bag 랜덤라이저 (PRD 4.2): 7종을 한 가방에 넣고 섞어 지급, 비면 새로 섞음

import { PIECE_TYPES, type PieceType } from './piece';

export class SevenBag {
  private queue: PieceType[] = [];

  // rng 주입으로 테스트에서 결정적 시퀀스 재현 가능
  constructor(private readonly rng: () => number = Math.random) {}

  private refill(): void {
    const bag = [...PIECE_TYPES];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [bag[i], bag[j]] = [bag[j]!, bag[i]!];
    }
    this.queue.push(...bag);
  }

  private ensure(count: number): void {
    while (this.queue.length < count) this.refill();
  }

  next(): PieceType {
    this.ensure(1);
    return this.queue.shift()!;
  }

  /** 앞으로 나올 블록 미리보기 (소비하지 않음) */
  preview(count = 5): PieceType[] {
    this.ensure(count);
    return this.queue.slice(0, count);
  }
}
