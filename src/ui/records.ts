// 기록 열람 화면: 하이스코어 TOP 10, 최근 기록, 파일 연결/내보내기/불러오기 (Phase 5)

import { downloadTxt, pickTxtFile, type ScoreFileSync } from '../score/fileSync';
import type { GameRecord, ScoreStore } from '../score/scoreStore';
import { formatDuration, formatTimestamp, parseLog, serializeLog } from '../score/txtFormat';

const STATUS_TEXT: Record<string, string> = {
  unsupported: '이 브라우저는 파일 자동 기록을 지원하지 않습니다 — 내보내기/불러오기를 사용하세요.',
  unlinked: '연결된 파일 없음 — "scores.txt 파일 연결"을 누르면 게임 오버마다 자동 기록됩니다.',
  'need-permission': 'scores.txt 연결됨 — 권한 재승인이 필요합니다 ("파일 연결" 버튼을 다시 누르세요).',
  ready: 'scores.txt 연결됨 — 게임 오버 시 자동으로 기록됩니다.',
};

function describeRecord(record: GameRecord): string {
  const when = formatTimestamp(record.timestamp);
  if (record.kind === 'solo') {
    return `[${when}] ${record.player} · ${record.score.toLocaleString()}점 · ${record.lines}줄 · Lv${record.level} · ${formatDuration(record.durationMs)}`;
  }
  return `[${when}] 대전 · 승자 ${record.winner} (${record.rounds}) · ${formatDuration(record.durationMs)}`;
}

export class RecordsPanel {
  visible = false;

  private readonly el: HTMLDivElement;
  private readonly topEl: HTMLOListElement;
  private readonly recentEl: HTMLUListElement;
  private readonly statusEl: HTMLElement;
  private readonly messageEl: HTMLElement;

  constructor(
    parent: HTMLElement,
    private readonly store: ScoreStore,
    private readonly sync: ScoreFileSync,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'records-panel hidden';
    this.el.innerHTML = `
      <div class="records-inner">
        <h2>기록</h2>
        <div class="records-columns">
          <section>
            <h3>하이스코어 TOP 10</h3>
            <ol data-role="top"></ol>
          </section>
          <section>
            <h3>최근 기록</h3>
            <ul data-role="recent"></ul>
          </section>
        </div>
        <div class="records-actions">
          <button type="button" data-role="link">scores.txt 파일 연결</button>
          <button type="button" data-role="export">TXT로 내보내기</button>
          <button type="button" data-role="import">TXT 불러오기</button>
        </div>
        <div class="records-status" data-role="status"></div>
        <div class="records-message" data-role="message"></div>
        <div class="records-footer">
          <button type="button" class="records-return" data-role="close">게임으로 돌아가기</button>
          <div class="records-close">Tab/Esc 키로도 닫기</div>
        </div>
      </div>`;
    parent.appendChild(this.el);

    this.topEl = this.el.querySelector<HTMLOListElement>('[data-role="top"]')!;
    this.recentEl = this.el.querySelector<HTMLUListElement>('[data-role="recent"]')!;
    this.statusEl = this.el.querySelector<HTMLElement>('[data-role="status"]')!;
    this.messageEl = this.el.querySelector<HTMLElement>('[data-role="message"]')!;

    this.el.querySelector('[data-role="link"]')!.addEventListener('click', () => {
      void this.onLink();
    });
    this.el.querySelector('[data-role="export"]')!.addEventListener('click', () => {
      downloadTxt(serializeLog(this.store.chronological()));
      this.message('scores.txt 다운로드를 시작했습니다.');
    });
    this.el.querySelector('[data-role="import"]')!.addEventListener('click', () => {
      void this.onImport();
    });
    this.el.querySelector('[data-role="close"]')!.addEventListener('click', () => {
      this.close();
    });
  }

  toggle(): void {
    if (this.visible) {
      this.close();
      return;
    }
    this.visible = true;
    this.el.classList.remove('hidden');
    this.message('');
    void this.refresh();
  }

  close(): void {
    this.visible = false;
    this.el.classList.add('hidden');
  }

  async refresh(): Promise<void> {
    const top = this.store.topSolo(10);
    this.topEl.innerHTML =
      top.length === 0
        ? '<li class="records-empty">기록 없음</li>'
        : top
            .map(
              (r) =>
                `<li>${r.score.toLocaleString()}점 · ${r.lines}줄 · Lv${r.level} <span class="records-date">${formatTimestamp(r.timestamp)}</span></li>`,
            )
            .join('');

    const recent = this.store.all().slice(0, 10);
    this.recentEl.innerHTML =
      recent.length === 0
        ? '<li class="records-empty">기록 없음</li>'
        : recent.map((r) => `<li>${describeRecord(r)}</li>`).join('');

    this.statusEl.textContent = STATUS_TEXT[await this.sync.status()] ?? '';
  }

  private async onLink(): Promise<void> {
    const status = await this.sync.status();
    if (status === 'unsupported') {
      this.message('이 브라우저에서는 파일 연결을 지원하지 않습니다.');
      return;
    }
    const ok =
      status === 'need-permission' ? await this.sync.ensurePermission() : await this.sync.link();
    this.message(ok ? 'scores.txt가 연결되었습니다.' : '파일 연결이 취소되었거나 실패했습니다.');
    await this.refresh();
  }

  private async onImport(): Promise<void> {
    const text = await pickTxtFile();
    if (text === null) return;
    const { records, skipped } = parseLog(text);
    const added = this.store.merge(records);
    const skippedNote = skipped > 0 ? `, ${skipped}줄은 형식 오류로 건너뜀` : '';
    this.message(`기록 ${added}개를 불러왔습니다 (중복 ${records.length - added}개 제외${skippedNote}).`);
    await this.refresh();
  }

  private message(text: string): void {
    this.messageEl.textContent = text;
  }
}
