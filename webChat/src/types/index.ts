/**
 * 🐑 SheepKing Web Chat - 类型定义
 */

/** 消息角色 */
export type MessageRole = 'user' | 'ai';

/** 单条消息 */
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

/** 控制台日志条目 */
export interface LogEntry {
  level: 'log' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

/** SSE 推送的 ask_user 事件数据（文本输入） */
export interface AskUserData {
  question: string;
  timestamp: string;
}

/** SSE 推送的 ask_confirm 事件数据（确认/取消） */
export interface AskConfirmData {
  question: string;
  timestamp: string;
}

/** Chat API 请求体 */
export interface ChatRequest {
  message: string;
}

/** Chat API 响应体 */
export interface ChatResponse {
  output: string;
  iterations: number;
}

/** User Input API 请求体 */
export interface UserInputRequest {
  input: string;
}

/** 主题名称 */
export type ThemeName =
  | 'light'
  | 'light-green'
  | 'light-pink'
  | 'light-blue'
  | 'light-yellow'
  | 'light-purple';
