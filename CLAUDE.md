# 해금 채보앱

해금 녹음/영상을 넣으면 음높이 곡선과 오선보를 브라우저에서 뽑아 교재용으로 내보내는 웹앱. **서버 없음.**

기획 전체는 `docs/기획서.md`, 하루치 상세는 `docs/YYYY-MM-DD-*.md`. 여기엔 **결정과 규칙만** 둔다.

## 지금 위치 (2026-09-13)

v0.0 스파이크 ①②③ 닫힘. v0.1(f0 곡선·구간 재생), v0.2(음 분할·조율·오선보), v0.3(장단 격자·마디·편집), v0.5(IndexedDB 저장·내보내기 4종·PWA) 동작. **배포됨: https://okman235.github.io/haegeum-chaebo/** (main 푸시 → Actions 자동 배포, 약 1분). **다음은 아이패드 설치 확인 → v1.0 아들 도그푸딩.** v0.4 시김새는 아들 부호 사진이 있어야 한다.

**사용자(아버지)는 해금을 모른다.** 귀로 판단할 것(분할 감도, 프리셋 값, 박자표, 시김새 부호)은 묻지 말고 아들 방문 때 확인할 목록으로 모은다 — 기획서 11장.

## 대상

아이패드·아이폰 **사파리** + 맥/PC 크롬. 셋 다 쓰므로 **기준은 더 빡빡한 사파리**로 잡는다.

## 뒤집지 말 것

- **음높이 엔진은 자체 pYIN 이식** (`app/src/audio/pyin.ts`). essentia.js pYIN 과 pitchfinder YIN 은 실제 해금 녹음에서 탈락했다 — 되돌리지 말 것.
- **입력 파일 변환을 사용자에게 시키지 않는다.** 사파리는 `.mov`(ftyp qt)와 Opus 를 `decodeAudioData` 로 거부한다. 실패하면 `app/src/audio/movDecode.ts`(mp4box + WebCodecs)가 직접 푼다.
- 리듬은 v1 에서 자동 박 추적을 신뢰하지 않는다. 장단 프리셋 + 수동 BPM + 첫 박 클릭.
- 조율 값은 하드코딩하지 않는다. 사용자 기준을 받고, 녹음마다 히스토그램으로 보정한다.
- 쓰는 사람은 **아들**(과 나). 수강생 배포는 없다.

## 확인하는 법

- **브라우저 패널은 Chromium 이다.** 사파리 전용 문제(.mov·Opus·속도)를 못 잡는다. 사파리는 따로 본다:
  ```
  open -g -a Safari "http://localhost:5173/dev/bench.html?run=11,3"
  ```
  결과는 `python3 app/dev/collector.py` 를 띄워 두면 8899 로 받아 적힌다. `-g` 라 포커스를 안 뺏는다.
- 실기기(아이패드)는 **정말 기기 성능이 궁금할 때만**. 코덱·동작 문제는 맥 사파리로 재현된다.
- 비싼 행동(빌드·실기기·사용자 수동작업) 전에 싼 검증부터. 사용자 시간이 가장 비싸다.

## 명령

```bash
pnpm --dir app dev --host        # 개발 서버 (LAN 공개, 실기기 확인용)
pnpm --dir app build             # tsc -b && vite build
git push                         # → GitHub Pages 자동 배포 (gh run watch 로 확인)
```

- 원격은 SSH(`git@github.com:okman235/haegeum-chaebo.git`). gh 의 OAuth 토큰엔 `workflow` 스코프가 없어 https 푸시는 워크플로 파일에서 거부된다.

- 측정 페이지 `/dev/bench.html`, pYIN 정확도 회귀 `/dev/pyin-test.html`, mov 우회로 `/dev/remux-test.html`
- 앱을 파일 선택 없이 열기: `/?open=hg_180_240.wav` (개발 서버에서만, `samples/` 기준). 콘솔에서 `__notes`, `__segment({onsetDb, minMs, ...})` 로 분할 실험
- `samples/` 는 개인 녹음이라 저장소에 안 들어간다 (`.gitignore`). `research/*.npy` 도 마찬가지.
