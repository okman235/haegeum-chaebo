import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 는 저장소 이름 아래에 뜨므로 워크플로에서 BASE_PATH=/저장소명/ 을 준다
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    // 홈 화면 설치 + 오프라인. 설치는 HTTPS 에서만 되므로(localhost 제외) 배포 뒤에 실기기 확인
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '해금 채보', short_name: '채보', lang: 'ko', display: 'standalone', orientation: 'any',
        background_color: '#0f171c', theme_color: '#0f171c', start_url: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,   // VexFlow 폰트 번들이 1.4MB
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  // 개발 중 ?open=파일명 으로 ../samples 를 바로 열 때 쓰는 저장소 루트 (배포 빌드엔 안 쓰임)
  define: { __REPO_ROOT__: JSON.stringify(resolve(import.meta.dirname, '..')) },
  server: {
    // 개발 중 ../samples 의 녹음을 /@fs/ 경로로 불러와 테스트할 수 있게 (배포 빌드와 무관)
    fs: { allow: ['..'] },
  },
})
