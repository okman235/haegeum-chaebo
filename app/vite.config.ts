import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 개발 중 ../samples 의 녹음을 /@fs/ 경로로 불러와 테스트할 수 있게 (배포 빌드와 무관)
    fs: { allow: ['..'] },
  },
})
