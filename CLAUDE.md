# Tetris Project

- 요구사항: ./tetris-prd.md
- 구현 계획: ./implementation_plan.md
- 규칙: 코어 로직 수정 시 반드시 관련 테스트 갱신, `npm test` 통과 후 커밋
- 커밋 단위: Phase당 1개 이상, 커밋 메시지에 Phase 번호 포함 (예: `feat(phase-1): core data model`)
- Phase 4 이후에는 매 Phase 종료 시 전체 테스트 회귀 실행
- 아키텍처: 코어 로직(src/core)은 렌더링/입력과 분리된 순수 함수 — DOM/Canvas 의존 금지
- 튜닝값(DAS/ARR/락 딜레이 등)은 config 상수로 관리
- 현재 진행: Phase 6 완료 (다음: Phase 7 — 메뉴/폴리싱)
