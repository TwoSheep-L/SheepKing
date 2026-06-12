/**
 * 🐑 聊天 Hook
 * 管理对话消息列表、发送消息、AI 追问回复等核心逻辑
 * 支持文件 diff 消息实时展示
 * 支持重置对话上下文（清空历史，保留 systemPrompt）
 */

import { useState, useCallback, useRef } from 'react';
import type { Message, ChatResponse, UserInputRequest, FileDiffEventData } from '../types';

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
  /** 添加文件 diff 消息（由 SSE file_diff 事件触发） */
  addDiffMessage: (diffData: FileDiffEventData) => void;
  /** 清空消息 */
  clearMessages: () => void;
  /** 🔄 重置对话：调用后端重置 API + 清空前端消息列表 */
  resetChat: () => Promise<void>;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  /** 防止重复重置 */
  const resettingRef = useRef(false);

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

  /**
   * 添加文件 diff 消息
   * 由 SSE 的 file_diff 事件触发，实时在聊天中展示代码变更
   */
  const addDiffMessage = useCallback((diffData: FileDiffEventData) => {
    const diffMsg: Message = {
      id: genId(),
      role: 'ai',
      content: `📄 文件变更: ${diffData.filePath} (+${diffData.additions}/-${diffData.deletions})`,
      timestamp: Date.now(),
      type: 'file_diff',
      diffData,
    };
    setMessages((prev) => [...prev, diffMsg]);
  }, []);

  /** 清空消息 */
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  /**
   * 🔄 重置对话上下文
   * 1. 调用后端 POST /api/reset 清空 Agent 对话历史（保留 systemPrompt）
   * 2. 清空前端消息列表
   * 恢复到首次打开页面时的初始状态
   */
  const resetChat = useCallback(async () => {
    if (resettingRef.current) return; // 防止重复调用
    resettingRef.current = true;

    try {
      const res = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: '重置失败' }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      // 重置成功后清空前端消息列表
      setMessages([]);
      console.log('🔄 [Reset] 对话已重置，已恢复到初始状态');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('❌ [Reset] 重置失败:', errMsg);
      // 即使后端请求失败，也清空前端消息（至少前端恢复初始状态）
      setMessages([]);
    } finally {
      resettingRef.current = false;
    }
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    replyToAsk,
    addDiffMessage,
    clearMessages,
    resetChat,
  };
}
