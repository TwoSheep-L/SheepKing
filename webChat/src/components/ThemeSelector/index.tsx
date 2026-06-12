/**
 * 🐑 主题选择器组件
 * 展示 6 个颜色圆点，点击切换主题
 */

import { Palette } from 'lucide-react';
import type { ThemeName } from '../../types';
import styles from './index.module.less';

interface ThemeSelectorProps {
  currentTheme: ThemeName;
  themes: { name: ThemeName; label: string; color: string }[];
  onSelect: (name: ThemeName) => void;
}

export default function ThemeSelector({ currentTheme, themes, onSelect }: ThemeSelectorProps) {
  return (
    <div className={styles.selector}>
      <Palette size={14} style={{ color: 'var(--text-tertiary)' }} />
      <span className={styles.label}>主题</span>
      {themes.map((t) => (
        <span
          key={t.name}
          className={`${styles.dot} ${currentTheme === t.name ? styles.active : ''}`}
          style={{ background: t.color }}
          onClick={() => onSelect(t.name)}
        >
          <span className={styles.tooltip}>{t.label}</span>
        </span>
      ))}
    </div>
  );
}
