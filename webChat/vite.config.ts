import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 打包到 webChat/dist（默认就是 dist，显式指定确保路径清晰）
  base: '/',
  build: {
    outDir: 'dist',
    // 清理旧文件
    emptyOutDir: true,
  },
  css: {
    // 启用 CSS 模块化
    modules: {
      localsConvention: 'camelCaseOnly',
    },
    // 支持 Less
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
  server: {
    port: 5173,
    // 代理 /api 请求到后端服务（端口 5200）
    proxy: {
      '/api': {
        target: 'http://localhost:5200',
        changeOrigin: true,
      },
    },
  },
});
