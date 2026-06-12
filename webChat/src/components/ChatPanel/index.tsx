/**
 * 🐑 对话面板组件
 * 消息列表展示 + 输入框 + 发送按钮
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
import type { Message } from '../../types';
import MessageItem from '../MessageItem';
import styles from './index.module.less';

interface ChatPanelProps {
  messages: Message[];
  isLoading: boolean;
  onSend: (content: string) => void;
}

export default function ChatPanel({ messages, isLoading, onSend }: ChatPanelProps) {
  const [input, setInput] = useState('');
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

  return (
    <div className={styles.panel}>
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
    </div>
  );
}
