/**
 * 🔄 Diff 工具函数
 * 用于比较文件新旧内容，生成类似 GitHub 风格的 diff 数据
 * 支持行级别的新增（绿色）和删除（红色）标注
 */

export interface DiffLine {
  /** 行类型: 'add' 新增, 'del' 删除, 'normal'  unchanged */
  type: 'add' | 'del' | 'normal';
  /** 行内容 */
  content: string;
  /** 原文件行号（删除行/unchanged 行） */
  oldLineNum?: number;
  /** 新文件行号（新增行/unchanged 行） */
  newLineNum?: number;
}

export interface DiffResult {
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
  /** 用于展示的纯文本格式 */
  text: string;
}

/**
 * 比较两段文本内容，生成行级别的 diff
 * 基于 LCS（最长公共子序列）算法实现
 */
function computeDiffLines(oldLines: string[], newLines: string[]): DiffLine[] {
  const result: DiffLine[] = [];
  const oldLen = oldLines.length;
  const newLen = newLines.length;

  // 构建 LCS DP 表
  const dp: number[][] = Array.from({ length: oldLen + 1 }, () =>
    Array(newLen + 1).fill(0)
  );

  for (let i = 1; i <= oldLen; i++) {
    for (let j = 1; j <= newLen; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 回溯 LCS，生成 diff 行
  let i = oldLen;
  let j = newLen;

  // 用栈存储，因为回溯是反向的
  const stack: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      // unchanged
      stack.push({
        type: 'normal',
        content: oldLines[i - 1],
        oldLineNum: i,
        newLineNum: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      // 新增行
      stack.push({
        type: 'add',
        content: newLines[j - 1],
        newLineNum: j,
      });
      j--;
    } else if (i > 0) {
      // 删除行
      stack.push({
        type: 'del',
        content: oldLines[i - 1],
        oldLineNum: i,
      });
      i--;
    }
  }

  // 从栈中取出，恢复正序
  while (stack.length > 0) {
    result.push(stack.pop()!);
  }

  return result;
}

/**
 * 生成文件 diff 数据
 * @param filePath 文件路径
 * @param action 操作类型
 * @param oldContent 旧文件内容
 * @param newContent 新文件内容
 * @param isNewFile 是否是新文件（无旧内容）
 */
export function generateDiff(
  filePath: string,
  action: 'write' | 'insertLine' | 'delete',
  oldContent: string,
  newContent: string,
  isNewFile: boolean = false
): DiffResult {
  const oldLines = oldContent ? oldContent.split('\n') : [];
  const newLines = newContent ? newContent.split('\n') : [];

  let lines: DiffLine[];

  if (isNewFile || oldLines.length === 0) {
    // 新文件：所有行都是新增
    lines = newLines.map((line, idx) => ({
      type: 'add' as const,
      content: line,
      newLineNum: idx + 1,
    }));
  } else if (newLines.length === 0) {
    // 文件被清空或删除：所有行都是删除
    lines = oldLines.map((line, idx) => ({
      type: 'del' as const,
      content: line,
      oldLineNum: idx + 1,
    }));
  } else {
    // 正常对比
    lines = computeDiffLines(oldLines, newLines);
  }

  const additions = lines.filter((l) => l.type === 'add').length;
  const deletions = lines.filter((l) => l.type === 'del').length;

  // 生成可读的文本格式
  const header = `📄 ${filePath} (${action}${isNewFile ? ', 新文件' : ''})`;
  const stats = `  ${additions} 处新增 ⬆️  ${deletions} 处删除 ⬇️`;
  const body = lines
    .map((line) => {
      const prefix = line.type === 'add' ? '+ ' : line.type === 'del' ? '- ' : '  ';
      return `${prefix}${line.content}`;
    })
    .join('\n');

  const text = `${header}\n${stats}\n\`\`\`diff\n${body}\n\`\`\``;

  return {
    filePath,
    action,
    additions,
    deletions,
    lines,
    text,
  };
}

/**
 * 将 DiffResult 格式化为 SSE 事件数据
 */
export function formatDiffForSSE(diff: DiffResult): Record<string, unknown> {
  return {
    type: 'file_diff',
    filePath: diff.filePath,
    action: diff.action,
    additions: diff.additions,
    deletions: diff.deletions,
    lines: diff.lines,
    text: diff.text,
    timestamp: new Date().toISOString(),
  };
}
