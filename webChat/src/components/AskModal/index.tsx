/**
 * 🐑 AI 询问弹窗组件
 *
 * 支持两种模式：
 * - input（默认）：文本输入模式，显示输入框 + 提交/跳过按钮
 * - confirm：确认模式，显示确认/取消按钮（用于删除文件等操作的确认）
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, X, Send, AlertTriangle, Check, Ban } from 'lucide-react';
import styles from './index.module.less';

interface AskModalProps {
  /** 当前显示的问题（为空时隐藏弹窗） */
  question: string;
  /** 用户提交/确认的回调 */
  onSubmit: (input: string) => void;
  /** 用户取消/拒绝的回调 */
  onCancel: () => void;
  /** 弹窗模式：input（文本输入）| confirm（确认/取消） */
  mode?: 'input' | 'confirm';
}

export default function AskModal({ question, onSubmit, onCancel, mode = 'input' }: AskModalProps) {
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /** 当问题变化时打开弹窗 */
  useEffect(() => {
    if (question) {
      setIsOpen(true);
      if (mode === 'input') {
        setInput('');
        // 自动聚焦输入框
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }, [question, mode]);

  /** 提交输入 */
  const handleSubmit = useCallback(() => {
    if (mode === 'input') {
      const value = input.trim() || '(空)';
      setIsOpen(false);
      onSubmit(value);
    }
  }, [input, onSubmit, mode]);

  /** 确认（confirm 模式） */
  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    onSubmit('yes');
  }, [onSubmit]);

  /** 取消/拒绝 */
  const handleCancel = useCallback(() => {
    setIsOpen(false);
    onCancel();
  }, [onCancel]);

  /** 键盘事件：Enter 提交 */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (mode === 'input' && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, mode],
  );

  if (!isOpen) return null;

  return (
    <div className={`${styles.overlay} ${isOpen ? styles.active : ''}`}>
      <div className={styles.box}>
        {mode === 'confirm' ? (
          // ====== 确认模式（确认/取消） ======
          <>
            <div className={styles.title}>
              <AlertTriangle size={20} style={{ color: 'var(--log-level-warn)' }} />
              AI 需要您的确认
            </div>
            <p className={styles.desc}>{question}</p>
            <div className={styles.actions}>
              <button className={styles.btnCancel} onClick={handleCancel}>
                <Ban size={14} style={{ marginRight: 4 }} />
                取消
              </button>
              <button className={styles.btnSubmit} onClick={handleConfirm}>
                <Check size={14} style={{ marginRight: 4 }} />
                确认
              </button>
            </div>
          </>
        ) : (
          // ====== 输入模式（文本输入） ======
          <>
            <div className={styles.title}>
              <Bot size={20} style={{ color: 'var(--accent-blue)' }} />
              AI 想问您一个问题
            </div>
            <p className={styles.desc}>{question}</p>
            <input
              ref={inputRef}
              className={styles.input}
              type="text"
              placeholder="请输入你的回答..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className={styles.actions}>
              <button className={styles.btnCancel} onClick={handleCancel}>
                <X size={14} style={{ marginRight: 4 }} />
                跳过
              </button>
              <button className={styles.btnSubmit} onClick={handleSubmit}>
                <Send size={14} style={{ marginRight: 4 }} />
                提交
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
