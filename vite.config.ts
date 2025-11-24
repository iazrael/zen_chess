import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import comlink from 'vite-plugin-comlink';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
        server: {
            port: 3000,
            host: '0.0.0.0',
        },
        plugins: [
            comlink(),            // 一定要放在最前面
            react(),
        ],
        worker: {
            plugins: () => [comlink()] // 让插件同时处理 Worker  chunk
        },
        // 设置 base 为 './' 使得部署在 GitHub Pages 子路径时能正确引用资源
        base: './',
        define: {
            // 允许在构建时注入环境变量
            'process.env.API_BASE_URL': JSON.stringify(env.API_BASE_URL || process.env.API_BASE_URL),
            'process.env.GITHUB_PAGES': JSON.stringify(env.GITHUB_PAGES || process.env.GITHUB_PAGES),
            'process.env.VERCEL': JSON.stringify(env.VERCEL || process.env.VERCEL),
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, '.'),
            }
        },
        build: { sourcemap: true }
    };
});