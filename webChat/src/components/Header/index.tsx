/**
 * 🐑 顶部栏组件
 * 展示标题、连接状态、Agent 标识和主题选择器
 */

import { Bot, Wifi, WifiOff } from 'lucide-react';
import ThemeSelector from '../ThemeSelector';
import type { ThemeName } from '../../types';
import styles from './index.module.less';

interface HeaderProps {
  connected: boolean;
  theme: ThemeName;
  themes: { name: ThemeName; label: string; color: string }[];
  onThemeChange: (name: ThemeName) => void;
}

export default function Header({ connected, theme, themes, onThemeChange }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <Bot size={24} style={{ color: 'var(--accent-blue)' }} />
        <h1 className={styles.title}>SheepKing AI Chat</h1>
      </div>
      <div className={styles.right}>
        <div className={styles.status}>
          {connected ? (
            <Wifi size={14} style={{ color: 'var(--status-dot)' }} />
          ) : (
            <WifiOff size={14} style={{ color: 'var(--log-level-error)' }} />
          )}
          <span>{connected ? '已连接' : '连接中...'}</span>
          <span className={styles.badge}>OrchestratorCodeAgent</span>
        </div>
        <ThemeSelector
          currentTheme={theme}
          themes={themes}
          onSelect={onThemeChange}
        />
      </div>
    </header>
  );
}
