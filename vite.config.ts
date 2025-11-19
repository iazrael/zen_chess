import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    // 设置 base 为 './' 使得部署在 GitHub Pages 子路径时能正确引用资源
    base: './',
    define: {
      // 允许在构建时注入环境变量
      'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
      'process.env.OPENAI_API_KEY': JSON.stringify(process.env.OPENAI_API_KEY),
      'process.env.OPENAI_BASE_URL': JSON.stringify(process.env.OPENAI_BASE_URL),
      'process.env.OPENAI_MODEL': JSON.stringify(process.env.OPENAI_MODEL)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});