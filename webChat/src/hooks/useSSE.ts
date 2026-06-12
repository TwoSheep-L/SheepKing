/**
 * 🐑 SSE (Server-Sent Events) Hook
 * 实时接收后端推送的控制台日志、AI 追问和确认事件
 */

import { useEffect, useRef, useCallback } from 'react';
import type { LogEntry, AskUserData, AskConfirmData } from '../types';

export interface SSEEventHandlers {
  /** 收到控制台日志 */
  onConsoleLog: (entry: LogEntry) => void;
  /** 收到 AI 追问（文本输入） */
  onAskUser: (data: AskUserData) => void;
  /** 收到 AI 确认请求（确认/取消） */
  onAskConfirm: (data: AskConfirmData) => void;
  /** SSE 连接状态变化 */
  onStatusChange?: (connected: boolean) => void;
}

/**
 * 建立 SSE 连接，自动重连
 * @param handlers 事件处理函数
 * @param enabled 是否启用 SSE
 */
export function useSSE(handlers: SSEEventHandlers, enabled: boolean = true) {
  const handlersRef = useRef(handlers);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 保持 handlers 引用最新
  handlersRef.current = handlers;

  const connect = useCallback(() => {
    if (!enabled) return;

    // 清理旧连接
    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource('/api/stream');
    esRef.current = es;

    es.addEventListener('connected', () => {
      handlersRef.current.onStatusChange?.(true);
    });

    es.addEventListener('console', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as LogEntry;
        handlersRef.current.onConsoleLog(data);
      } catch {
        // JSON 解析失败时忽略
      }
    });

    es.addEventListener('ask_user', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as AskUserData;
        handlersRef.current.onAskUser(data);
      } catch {
        // JSON 解析失败时忽略
      }
    });

    es.addEventListener('ask_confirm', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as AskConfirmData;
        handlersRef.current.onAskConfirm(data);
      } catch {
        // JSON 解析失败时忽略
      }
    });

    es.onerror = () => {
      handlersRef.current.onStatusChange?.(false);
      es.close();
      // 3 秒后自动重连
      reconnectTimerRef.current = setTimeout(connect, 3000);
    };
  }, [enabled]);

  /** 断开 SSE 连接 */
  const disconnect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return { disconnect, reconnect: connect };
}
