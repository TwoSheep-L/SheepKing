/**
 * 🐑 SheepKing Web Chat - 类型定义
 */

/** 消息角色 */
export type MessageRole = 'user' | 'ai';

/** 消息类型 */
export type MessageType = 'text' | 'file_diff';

/** Diff 中的单行数据 */
export interface DiffLine {
  /** 行类型: 'add' 新增, 'del' 删除, 'normal' 未变动 */
  type: 'add' | 'del' | 'normal';
  /** 行内容 */
  content: string;
  /** 原文件行号（删除行/unchanged 行） */
  oldLineNum?: number;
  /** 新文件行号（新增行/unchanged 行） */
  newLineNum?: number;
}

/** 文件 diff 数据 */
export interface FileDiffData {
  /** 固定标识 */
  type: 'file_diff';
  /** 文件路径 */
  filePath: string;
  /** 操作类型 */
  action: 'write' | 'insertLine' | 'delete';
  /** 新增行数 */
  additions: number;
  /** 删除行数 */
  deletions: number;
  /** 对比行列表 */
  lines: DiffLine[];
  /** 纯文本展示格式 */
  text: string;
  /** 时间戳 */
  timestamp: string;
}

/** 单条消息 */
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  /** 消息类型，file_diff 为文件变更展示 */
  type?: MessageType;
  /** 文件 diff 数据（type 为 file_diff 时存在） */
  diffData?: FileDiffData;
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

/** SSE 推送的 file_diff 事件数据 */
export interface FileDiffEventData {
  type: 'file_diff';
  filePath: string;
  action: 'write' | 'insertLine' | 'delete';
  additions: number;
  deletions: number;
  lines: DiffLine[];
  text: string;
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
