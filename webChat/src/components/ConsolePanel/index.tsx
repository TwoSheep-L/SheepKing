/**
 * 🐑 控制台日志面板组件
 * 实时展示后端推送的控制台日志，支持自动滚动和清空
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { Terminal, Trash2, ScrollText } from 'lucide-react';
import type { LogEntry } from '../../types';
import styles from './index.module.less';

interface ConsolePanelProps {
  logs: LogEntry[];
  onClear: () => void;
}

/** 日志级别到 CSS 类名的映射 */
function getLevelClass(level: string): string {
  switch (level) {
    case 'error':
      return styles.levelError;
    case 'warn':
      return styles.levelWarn;
    default:
      return styles.levelLog;
  }
}

export default function ConsolePanel({ logs, onClear }: ConsolePanelProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  /** 自动滚动到底部 */
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  /** 切换自动滚动 */
  const toggleAutoScroll = useCallback(() => {
    setAutoScroll((prev) => !prev);
  }, []);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Terminal size={14} />
          控制台日志
        </span>
        <div className={styles.actions}>
          <button onClick={onClear}>
            <Trash2 size={12} />
            清空
          </button>
          <button onClick={toggleAutoScroll}>
            <ScrollText size={12} />
            自动滚动 {autoScroll ? '✓' : '✗'}
          </button>
        </div>
      </div>
      <div className={styles.logs}>
        {logs.map((entry, index) => (
          <div
            key={index}
            className={`${styles.entry} ${getLevelClass(entry.level)}`}
          >
            <span className={styles.time}>
              {entry.timestamp
                ? new Date(entry.timestamp).toLocaleTimeString()
                : ''}
            </span>
            <span className={styles.level}>[{entry.level}]</span>
            <span className={styles.msg}>{entry.message}</span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
      <div className={styles.footer}>共 {logs.length} 条日志</div>
    </div>
  );
}
