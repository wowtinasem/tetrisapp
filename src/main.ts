// 진입점 — 씬 전환과 게임 루프는 Phase 3에서 구현한다.
const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.innerHTML = '<p style="padding: 2rem">Tetris — Phase 1 (코어 로직 개발 중, 화면은 Phase 3에서 구현)</p>';
}

export {};
