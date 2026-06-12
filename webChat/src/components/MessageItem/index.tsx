/**
 * 🐑 单条消息组件
 * 支持用户消息和 AI 消息两种样式
 * - 普通 AI 消息使用 Markdown 渲染
 * - file_diff 类型消息使用 DiffView 渲染（GitHub 风格代码变更展示）
 */

import { useMemo } from 'react';
import type { Message } from '../../types';
import DiffView from '../DiffView';
import styles from './index.module.less';

interface MessageItemProps {
  message: Message;
}

/** 简单 Markdown 渲染（内联方式，无需额外依赖） */
function renderMarkdown(content: string): string {
  // 基本转义
  let html = content
    // 代码块（先处理，避免内部被其他规则影响）
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const langClass = lang ? ` class="language-${lang}"` : '';
      return `<pre><code${langClass}>${escapeHtml(code.trim())}</code></pre>`;
    })
    // 行内代码
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // 标题
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // 加粗
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 斜体
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 链接
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // 图片
    .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" />')
    // 分割线
    .replace(/^---$/gm, '<hr />')
    // 引用
    .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
    // 无序列表
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // 有序列表
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // 段落（双换行）
    .replace(/\n\n/g, '</p><p>')
    // 换行
    .replace(/\n/g, '<br />');

  // 包裹段落（如果还没有被包裹）
  if (!html.startsWith('<')) {
    html = `<p>${html}</p>`;
  }

  // 修复嵌套问题：移除 p 内的 block div
  html = html.replace(/<p><\/p>/g, '');

  return html;
}

/** HTML 转义 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export default function MessageItem({ message }: MessageItemProps) {
  const formattedTime = useMemo(() => {
    return new Date(message.timestamp).toLocaleTimeString();
  }, [message.timestamp]);

  const renderedContent = useMemo(() => {
    if (message.role === 'ai') {
      // AI 消息渲染 Markdown
      return renderMarkdown(message.content);
    }
    // 用户消息直接显示文本（转义 HTML）
    return escapeHtml(message.content);
  }, [message.role, message.content]);

  // 判断是否为文件 diff 消息
  const isFileDiff = message.type === 'file_diff' && message.diffData;

  return (
    <div className={`${styles.message} ${styles[message.role]} ${isFileDiff ? styles.fileDiff : ''}`}>
      <div className={styles.label}>
        {message.role === 'user' ? '🧑 你' : isFileDiff ? '📝 文件变更' : '🐑 AI'}
      </div>

      {/* 文件 diff 消息使用 DiffView 组件渲染 */}
      {isFileDiff && message.diffData ? (
        <div className={styles.diffWrapper}>
          <DiffView diffData={message.diffData} />
        </div>
      ) : message.role === 'ai' ? (
        /* 普通 AI 消息使用 Markdown 渲染 */
        <div
          className={`${styles.content} markdown-body`}
          dangerouslySetInnerHTML={{ __html: renderedContent }}
        />
      ) : (
        /* 用户消息纯文本展示 */
        <div className={styles.content}>{renderedContent}</div>
      )}

      <div className={styles.time}>{formattedTime}</div>
    </div>
  );
}
