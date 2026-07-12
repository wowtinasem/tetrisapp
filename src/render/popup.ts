// 라인 클리어/T-스핀/백투백 텍스트 팝업 (PRD 6.2)

import type { LockResult } from '../core/game';

const LINE_LABELS = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS!'] as const;
const TSPIN_LABELS = ['T-SPIN', 'T-SPIN SINGLE!', 'T-SPIN DOUBLE!', 'T-SPIN TRIPLE!'] as const;

export function clearLabel(lock: LockResult): string | null {
  if (lock.tspin) return TSPIN_LABELS[lock.linesCleared] ?? null;
  if (lock.linesCleared === 0) return null;
  return LINE_LABELS[lock.linesCleared] ?? null;
}

/** 보드 위에 떠오르며 사라지는 클리어 텍스트를 표시한다 */
export function spawnClearPopup(container: HTMLElement, lock: LockResult): void {
  const label = clearLabel(lock);
  if (!label) return;

  const subs: string[] = [];
  if (lock.backToBack) subs.push('BACK-TO-BACK');
  if (lock.combo >= 1) subs.push(`COMBO ×${lock.combo}`);
  if (lock.points > 0) subs.push(`+${lock.points}`);

  const el = document.createElement('div');
  el.className = 'clear-popup';
  el.innerHTML =
    `<div class="clear-popup-main">${label}</div>` +
    subs.map((s) => `<div class="clear-popup-sub">${s}</div>`).join('');
  container.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
