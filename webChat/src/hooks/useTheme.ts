/**
 * 🐑 主题切换 Hook
 * 管理 6 个浅色系主题的切换与持久化
 */

import { useState, useCallback, useEffect } from 'react';
import type { ThemeName } from '../types';

const STORAGE_KEY = 'chat-theme';

/** 获取初始主题（优先从 localStorage 读取） */
function getInitialTheme(): ThemeName {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && isValidTheme(saved)) {
      return saved as ThemeName;
    }
  } catch {
    // localStorage 不可用时忽略
  }
  return 'light';
}

/** 校验主题名称是否合法 */
function isValidTheme(name: string): name is ThemeName {
  return ['light', 'light-green', 'light-pink', 'light-blue', 'light-yellow', 'light-purple'].includes(name);
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeName>(getInitialTheme);

  /** 设置主题 */
  const setTheme = useCallback((name: ThemeName) => {
    setThemeState(name);
    // 更新 DOM 属性
    document.documentElement.setAttribute('data-theme', name);
    document.body.setAttribute('data-theme', name);
    // 持久化
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch {
      // 忽略
    }
  }, []);

  /** 初始化时加载主题 */
  useEffect(() => {
    const initial = getInitialTheme();
    document.documentElement.setAttribute('data-theme', initial);
    document.body.setAttribute('data-theme', initial);
  }, []);

  /** 主题列表（用于 UI 展示） */
  const themes: { name: ThemeName; label: string; color: string }[] = [
    { name: 'light', label: '浅色默认', color: '#f5f5f5' },
    { name: 'light-green', label: '浅绿色', color: '#81c784' },
    { name: 'light-pink', label: '浅粉色', color: '#f48fb1' },
    { name: 'light-blue', label: '浅蓝色', color: '#64b5f6' },
    { name: 'light-yellow', label: '淡黄色', color: '#e6c76a' },
    { name: 'light-purple', label: '浅紫色', color: '#b39ddb' },
  ];

  return { theme, setTheme, themes };
}
