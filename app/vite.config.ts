import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 개발 중 ?open=파일명 으로 ../samples 를 바로 열 때 쓰는 저장소 루트 (배포 빌드엔 안 쓰임)
  define: { __REPO_ROOT__: JSON.stringify(resolve(import.meta.dirname, '..')) },
  server: {
    // 개발 중 ../samples 의 녹음을 /@fs/ 경로로 불러와 테스트할 수 있게 (배포 빌드와 무관)
    fs: { allow: ['..'] },
  },
})
