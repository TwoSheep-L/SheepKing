/**
 * 🐑 DiffView 组件
 * 以 GitHub 风格展示文件代码变更：
 * - 🟢 绿色背景 = 新增行
 * - 🔴 红色背景 = 删除行
 * - 左侧显示行号
 */
import { useMemo } from 'react';
import type { FileDiffData, DiffLine } from '../../types';
import styles from './index.module.less';

interface DiffViewProps {
  /** 文件 diff 数据 */
  diffData: FileDiffData;
}

/**
 * 获取文件名的简短显示（从路径中提取）
 */
function getFileName(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || filePath;
}

/**
 * 将 diff 数据分组为连续的块，方便渲染
 */
function groupIntoBlocks(lines: DiffLine[]): { type: string; lines: DiffLine[] }[] {
  const blocks: { type: string; lines: DiffLine[] }[] = [];
  let currentBlock: { type: string; lines: DiffLine[] } | null = null;

  for (const line of lines) {
    const blockType = line.type;
    if (!currentBlock || currentBlock.type !== blockType) {
      currentBlock = { type: blockType, lines: [] };
      blocks.push(currentBlock);
    }
    currentBlock.lines.push(line);
  }

  return blocks;
}

export default function DiffView({ diffData }: DiffViewProps) {
  const { filePath, action, additions, deletions, lines } = diffData;

  /** 获取操作类型的中文描述 */
  const actionLabel = useMemo(() => {
    switch (action) {
      case 'write': return '写入';
      case 'insertLine': return '插入行';
      case 'delete': return '删除';
      default: return action;
    }
  }, [action]);

  /** 文件名 */
  const fileName = useMemo(() => getFileName(filePath), [filePath]);

  /** 分块后的数据 */
  const blocks = useMemo(() => groupIntoBlocks(lines), [lines]);

  return (
    <div className={styles.container}>
      {/* 文件头信息 */}
      <div className={styles.header}>
        <span className={styles.fileIcon}>📄</span>
        <span className={styles.filePath} title={filePath}>{fileName}</span>
        <span className={styles.action}>{actionLabel}</span>
        <span className={styles.stats}>
          <span className={styles.additions}>+{additions}</span>
          <span className={styles.deletions}>-{deletions}</span>
        </span>
      </div>

      {/* Diff 内容 */}
      <div className={styles.diffContent}>
        {blocks.map((block, blockIdx) => (
          <div key={blockIdx} className={`${styles.block} ${styles[block.type]}`}>
            {block.lines.map((line, lineIdx) => (
              <div key={lineIdx} className={`${styles.line} ${styles[line.type]}`}>
                {/* 行号区域 */}
                <span className={styles.lineNum}>
                  {line.type === 'del' ? (
                    <span className={styles.oldNum}>{line.oldLineNum || ''}</span>
                  ) : line.type === 'add' ? (
                    <span className={styles.newNum}>{line.newLineNum || ''}</span>
                  ) : (
                    <>
                      <span className={styles.oldNum}>{line.oldLineNum || ''}</span>
                      <span className={styles.newNum}>{line.newLineNum || ''}</span>
                    </>
                  )}
                </span>
                {/* 变更标记 */}
                <span className={styles.marker}>
                  {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                </span>
                {/* 代码内容 */}
                <span className={styles.content}>
                  {line.content || ' '}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
