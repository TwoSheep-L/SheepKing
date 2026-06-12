/**
 * 🐑 欢迎弹窗组件
 *
 * 页面首次打开时显示，提供两种模式：
 * - 正常使用：关闭弹窗，直接对话
 * - 写代码：填写项目信息，AI 自动检查项目
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Bot, Code, Plus, X, ChevronLeft, Check } from 'lucide-react';
import styles from './index.module.less';

interface ProjectRow {
  id: number;
  name: string;
  path: string;
}

interface WelcomeModalProps {
  /** 发送消息的回调 */
  onSendMessage: (message: string) => void;
}

export default function WelcomeModal({ onSendMessage }: WelcomeModalProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [screen, setScreen] = useState<'mode' | 'form'>('mode');
  const [projects, setProjects] = useState<ProjectRow[]>([
    { id: Date.now(), name: '', path: '' },
  ]);
  const nextId = useRef(Date.now() + 1);

  /** 选择模式 */
  const handleSelectMode = useCallback((mode: 'normal' | 'code') => {
    if (mode === 'normal') {
      setIsOpen(false);
    } else {
      setScreen('form');
    }
  }, []);

  /** 新增项目行 */
  const handleAddRow = useCallback(() => {
    setProjects((prev) => [...prev, { id: nextId.current++, name: '', path: '' }]);
  }, []);

  /** 删除项目行 */
  const handleRemoveRow = useCallback((id: number) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  /** 更新项目名 */
  const handleNameChange = useCallback((id: number, value: string) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name: value } : p)));
  }, []);

  /** 更新项目地址 */
  const handlePathChange = useCallback((id: number, value: string) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, path: value } : p)));
  }, []);

  /** 返回模式选择 */
  const handleBack = useCallback(() => {
    setScreen('mode');
  }, []);

  /** 提交项目信息 */
  const handleSubmit = useCallback(() => {
    // 过滤出已填写的项目
    const validProjects = projects.filter((p) => p.name.trim() && p.path.trim());

    if (validProjects.length === 0) {
      return; // 至少填写一个
    }

    // 按格式构建消息
    const projectLines = validProjects.map((p) => `${p.name.trim()}: ${p.path.trim()}`);
    const message = `现在我要写代码,检查这几个项目\n${projectLines.join('\n')}`;

    setIsOpen(false);
    onSendMessage(message);
  }, [projects, onSendMessage]);

  // 键盘事件：Enter 提交
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, id: number, field: 'name' | 'path') => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // 如果当前行最后一个字段，且已填写，则新增一行
        if (field === 'path') {
          const current = projects.find((p) => p.id === id);
          if (current?.name.trim() && current?.path.trim()) {
            // 检查是否是最后一行
            const isLast = id === projects[projects.length - 1]?.id;
            if (isLast) {
              handleAddRow();
            }
          }
        }
      }
    },
    [projects, handleAddRow],
  );

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.box}>
        {screen === 'mode' ? (
          // ====== 第一屏：模式选择 ======
          <>
            <div className={styles.title}>🐑 欢迎使用 SheepKing AI Chat</div>
            <p className={styles.subtitle}>请选择你的使用模式</p>
            <div className={styles.modeButtons}>
              <button className={styles.modeBtn} onClick={() => handleSelectMode('normal')}>
                <span className={styles.modeIcon}>
                  <Bot size={36} />
                </span>
                <span className={styles.modeLabel}>正常使用</span>
                <span className={styles.modeDesc}>直接开始对话，不写代码</span>
              </button>
              <button className={styles.modeBtn} onClick={() => handleSelectMode('code')}>
                <span className={styles.modeIcon}>
                  <Code size={36} />
                </span>
                <span className={styles.modeLabel}>写代码</span>
                <span className={styles.modeDesc}>指定项目路径，让 AI 帮你编程</span>
              </button>
            </div>
          </>
        ) : (
          // ====== 第二屏：项目表单 ======
          <>
            <div className={styles.title} style={{ fontSize: 18 }}>
              💻 写代码模式
            </div>
            <p className={styles.subtitle} style={{ marginBottom: 20 }}>
              添加你要检查的项目
            </p>

            <div className={styles.projectList}>
              {projects.map((project, index) => (
                <div key={project.id} className={styles.projectRow}>
                  <span className={styles.rowLabel}>项目名称:</span>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="例如: my-app"
                    value={project.name}
                    onChange={(e) => handleNameChange(project.id, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, project.id, 'name')}
                  />
                  <span className={styles.rowLabel} style={{ minWidth: 50 }}>
                    地址:
                  </span>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="例如: D:/MyProject"
                    value={project.path}
                    onChange={(e) => handlePathChange(project.id, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, project.id, 'path')}
                  />
                  {projects.length > 1 && (
                    <button className={styles.delBtn} onClick={() => handleRemoveRow(project.id)}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button className={styles.addBtn} onClick={handleAddRow}>
              <Plus size={16} />
              新增一个项目
            </button>

            <div className={styles.formActions}>
              <button className={styles.btnBack} onClick={handleBack}>
                <ChevronLeft size={16} style={{ marginRight: 4 }} />
                返回
              </button>
              <button
                className={styles.btnGo}
                onClick={handleSubmit}
                disabled={!projects.some((p) => p.name.trim() && p.path.trim())}
              >
                <Check size={16} style={{ marginRight: 4 }} />
                确定
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
