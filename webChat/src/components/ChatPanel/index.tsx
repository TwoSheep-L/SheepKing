/**
 * 🐑 对话面板组件
 * 消息列表展示 + 输入框 + 发送按钮 + 重置按钮
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, RotateCcw } from 'lucide-react';
import type { Message } from '../../types';
import MessageItem from '../MessageItem';
import styles from './index.module.less';

interface ChatPanelProps {
  messages: Message[];
  isLoading: boolean;
  onSend: (content: string) => void;
  /** 🔄 重置对话上下文（清空历史，保留 systemPrompt） */
  onReset?: () => void;
}

export default function ChatPanel({ messages, isLoading, onSend, onReset }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** 自动滚动到底部 */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /** 自动调整输入框高度 */
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
  }, []);

  /** 发送消息 */
  const handleSend = useCallback(() => {
    const content = input.trim();
    if (!content || isLoading) return;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSend(content);
  }, [input, isLoading, onSend]);

  /** 键盘事件：Enter 发送（Shift+Enter 换行） */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  /** 点击重置按钮：如果有消息则弹出确认，否则直接重置 */
  const handleResetClick = useCallback(() => {
    if (messages.length > 0) {
      setShowResetConfirm(true);
    } else {
      onReset?.();
    }
  }, [messages.length, onReset]);

  /** 确认重置 */
  const handleConfirmReset = useCallback(() => {
    setShowResetConfirm(false);
    onReset?.();
  }, [onReset]);

  /** 取消重置 */
  const handleCancelReset = useCallback(() => {
    setShowResetConfirm(false);
  }, []);

  return (
    <div className={styles.panel}>
      {/* 重置确认浮层 */}
      {showResetConfirm && (
        <div className={styles.resetOverlay} onClick={handleCancelReset}>
          <div className={styles.resetDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.resetIcon}>🔄</div>
            <h3 className={styles.resetTitle}>确认重置对话？</h3>
            <p className={styles.resetDesc}>
              这将清空所有对话历史，AI 将忘记之前的所有上下文信息。
              <br />
              <strong>系统设定（systemPrompt）将被保留</strong>，恢复到首次打开时的状态。
            </p>
            <div className={styles.resetActions}>
              <button className={styles.resetCancelBtn} onClick={handleCancelReset}>
                取消
              </button>
              <button className={styles.resetConfirmBtn} onClick={handleConfirmReset}>
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.messages}>
        {messages.length === 0 ? (
          <div className={styles.emptyHint}>
            <span className={styles.emptyIcon}>🐑</span>
            开始和 AI 对话吧！
            <br />
            在下方输入你的问题，AI 会自动调度合适的技能来处理。
          </div>
        ) : (
          messages.map((msg) => <MessageItem key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputArea}>
        <div className={styles.inputRow}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            placeholder="输入你的问题..."
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autoResize();
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            className={`${styles.sendBtn} ${isLoading ? styles.loading : ''}`}
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="spin" />
                AI 思考中...
              </>
            ) : (
              <>
                <Send size={16} />
                发送
              </>
            )}
          </button>
        </div>
        <div className={styles.toolbar}>
          {/* 🔄 重置按钮 */}
          <button
            className={styles.resetBtn}
            onClick={handleResetClick}
            disabled={isLoading}
            title="重置对话（清空历史，保留系统设定）"
          >
            <RotateCcw size={14} />
            重置对话
          </button>
        </div>
      </div>
    </div>
  );
}
