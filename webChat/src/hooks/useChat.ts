/**
 * 🐑 聊天 Hook
 * 管理对话消息列表、发送消息、AI 追问回复等核心逻辑
 */

import { useState, useCallback, useRef } from 'react';
import type { Message, ChatResponse, UserInputRequest } from '../types';

/** 生成唯一 ID */
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export interface UseChatReturn {
  /** 消息列表 */
  messages: Message[];
  /** 是否正在等待 AI 回复 */
  isLoading: boolean;
  /** 发送消息给 AI */
  sendMessage: (content: string) => Promise<void>;
  /** 回复 AI 的追问 */
  replyToAsk: (input: string) => Promise<void>;
  /** 清空消息 */
  clearMessages: () => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  /** 发送消息给 AI */
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // 添加用户消息
    const userMsg: Message = {
      id: genId(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: '请求失败' }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data: ChatResponse = await res.json();

      // 添加 AI 回复
      const aiMsg: Message = {
        id: genId(),
        role: 'ai',
        content: data.output || '（无返回结果）',
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const errAiMsg: Message = {
        id: genId(),
        role: 'ai',
        content: `❌ ${errMsg}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errAiMsg]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** 回复 AI 的追问（调用 /api/user-input） */
  const replyToAsk = useCallback(async (input: string) => {
    try {
      await fetch('/api/user-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input } as UserInputRequest),
      });
    } catch {
      // 即使请求失败也不影响前端体验
    }
  }, []);

  /** 清空消息 */
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isLoading, sendMessage, replyToAsk, clearMessages };
}
