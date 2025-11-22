// utils/env.ts

/**
 * 运行环境枚举
 */
export enum RuntimeEnvironment {
  VERCEL = 'vercel',
  GITHUB_PAGES = 'github-pages',
  LOCAL = 'local'
}

/**
 * 判断当前运行环境
 * @returns RuntimeEnvironment 运行环境类型
 */
export const getRuntimeEnvironment = (): RuntimeEnvironment => {
  // Vercel 环境检测
  if (!!process.env.VERCEL || process.env.NOW_BUILDER) {
    return RuntimeEnvironment.VERCEL;
  }
  
  // GitHub Pages 环境检测
  if (!!process.env.GITHUB_PAGES) {
    return RuntimeEnvironment.GITHUB_PAGES;
  }
  
  // 本地开发环境
  return RuntimeEnvironment.LOCAL;
};

/**
 * 获取API基础URL
 * 在Vercel上使用相对路径，在本地开发时使用完整的服务器地址
 */
export const getApiBaseUrl = (): string => {
  // 尝试从环境变量读取API基础URL
  if (typeof process !== 'undefined' && process.env.API_BASE_URL) {
    return process.env.API_BASE_URL;
  }
  return '';
};

/**
 * 构建完整的API URL
 * @param path API路径，例如 '/api/openai'
 */
export const buildApiUrl = (path: string): string => {
  // 确保路径以 '/' 开头
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
};