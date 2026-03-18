import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/work-timer/', // 例如：'/work-timer/'
  build: {
    outDir: 'dist',
    assetsDir: 'static'
  }
})