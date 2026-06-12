/**
 * 🐑 SheepKing Web Chat - 主应用组件
 *
 * 功能：
 * 1. 欢迎弹窗：选择"正常使用"或"写代码"模式
 * 2. SSE 实时接收后端控制台日志
 * 3. Chat API 与 AI 对话
 * 4. User Input API 处理 AI 追问（文本输入）
 * 5. Confirm API 处理 AI 确认请求（确认/取消）
 * 6. 6 个浅色系主题切换
 * 7. 控制台日志实时面板
 */

import { useState, useCallback } from 'react';
import Header from './components/Header';
import ChatPanel from './components/ChatPanel';
import ConsolePanel from './components/ConsolePanel';
import AskModal from './components/AskModal';
import WelcomeModal from './components/WelcomeModal';
import { useTheme } from './hooks/useTheme';
import { useSSE } from './hooks/useSSE';
import { useChat } from './hooks/useChat';
import type { LogEntry } from './types';
import styles from './App.module.less';

export default function App() {
  // ---- 主题 ----
  const { theme, setTheme, themes } = useTheme();

  // ---- 聊天 ----
  const { messages, isLoading, sendMessage, replyToAsk } = useChat();

  // ---- 控制台日志 ----
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sseConnected, setSseConnected] = useState(false);

  /** 清空日志 */
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  /** 添加日志（限制最多 500 条防止内存溢出） */
  const addLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => {
      const next = [...prev, entry];
      return next.length > 500 ? next.slice(-500) : next;
    });
  }, []);

  // ---- SSE 连接 ----
  const [askQuestion, setAskQuestion] = useState('');      // 文本输入模式
  const [confirmQuestion, setConfirmQuestion] = useState(''); // 确认模式

  /** 处理 AI 追问（文本输入） */
  const handleAskUser = useCallback((data: { question: string }) => {
    setAskQuestion(data.question);
  }, []);

  /** 处理 AI 确认请求 */
  const handleAskConfirm = useCallback((data: { question: string }) => {
    setConfirmQuestion(data.question);
  }, []);

  const handleStatusChange = useCallback((connected: boolean) => {
    setSseConnected(connected);
  }, []);

  useSSE(
    {
      onConsoleLog: addLog,
      onAskUser: handleAskUser,
      onAskConfirm: handleAskConfirm,
      onStatusChange: handleStatusChange,
    },
    true,
  );

  /** 用户回复 AI 追问（文本输入提交） */
  const handleAskSubmit = useCallback(
    (input: string) => {
      setAskQuestion('');
      replyToAsk(input);
    },
    [replyToAsk],
  );

  /** 用户取消 AI 追问 */
  const handleAskCancel = useCallback(() => {
    setAskQuestion('');
    replyToAsk('用户取消了输入');
  }, [replyToAsk]);

  /** 用户确认（确认弹窗确认按钮） */
  const handleConfirmYes = useCallback(() => {
    setConfirmQuestion('');
    replyToAsk('yes');
  }, [replyToAsk]);

  /** 用户拒绝（确认弹窗取消按钮） */
  const handleConfirmNo = useCallback(() => {
    setConfirmQuestion('');
    replyToAsk('no');
  }, [replyToAsk]);

  return (
    <div className={styles.container}>
      {/* 欢迎弹窗（首次打开时显示） */}
      <WelcomeModal onSendMessage={sendMessage} />

      <Header
        connected={sseConnected}
        theme={theme}
        themes={themes}
        onThemeChange={setTheme}
      />
      <div className={styles.main}>
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onSend={sendMessage}
        />
        <ConsolePanel logs={logs} onClear={clearLogs} />
      </div>
      {/* AI 追问弹窗（文本输入模式） */}
      <AskModal
        question={askQuestion}
        onSubmit={handleAskSubmit}
        onCancel={handleAskCancel}
      />
      {/* AI 确认弹窗（确认/取消模式） */}
      <AskModal
        question={confirmQuestion}
        onSubmit={handleConfirmYes}
        onCancel={handleConfirmNo}
        mode="confirm"
      />
    </div>
  );
}
