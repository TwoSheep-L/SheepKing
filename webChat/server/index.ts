/**
 * 🐑 SheepKing Web Chat Server（独立完整服务）
 *
 * 一个独立的 HTTP 服务，集成了 AI 对话后端 + 前端静态文件服务。
 * 可直接独立运行（端口 5200），也可与 Vite 开发服务器协作。
 *
 * ===== 运行方式 =====
 * 开发模式（配合 Vite 前端）：
 *   cd webChat && npm run dev
 *   → Vite (localhost:5173) 通过 proxy 将 /api 转发到本服务 (5200)
 *
 * 独立运行模式（生产/测试）：
 *   cd webChat && npx tsx server/index.ts
 *   → 直接访问 http://localhost:5200 即可使用
 *
 * ===== 功能 =====
 * 1. SSE 实时推送控制台日志到前端
 * 2. Chat API 与 OrchestratorCodeAgent 对话
 * 3. UserInput API 处理 AI 追问（Web 弹窗版）
 * 4. 静态文件服务（托管 webChat/dist）
 * 5. SPA 路由回退（所有非 API 请求返回 index.html）
 * 6. 友好的未构建提示页面
 */

// ============================================================
// 1️⃣ 加载项目依赖
// ============================================================
import '../../src/tools/index.js'; // 注册所有工具
import { agentRegistery } from '../../src/skills/index.js'; // 注册所有 Skill Agent
import { OrchestratorCodeAgent } from '../../src/core/OrchestratorAgent-Code.js';
import { AgentTool } from '../../src/core/BaseAgentTool.js'; // 工具基类
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
import { log as clackLog } from '@clack/prompts';

// ============================================================
// 2️⃣ 路径常量
// ============================================================

/** 当前文件所在目录 (webChat/server) */
const __dirname = path.dirname(new URL(import.meta.url).pathname);

/** webChat 项目根目录（server 的上级目录） */
const WEBCHAT_ROOT = path.resolve(__dirname, '..');

/** webChat 打包后的静态文件目录 */
const DIST_DIR = path.resolve(WEBCHAT_ROOT, 'dist');

/** 服务端口 */
const PORT = 5200;

// ============================================================
// 3️⃣ SSE 控制台日志广播
// ============================================================

/** SSE 客户端连接集合 */
const sseClients = new Set<http.ServerResponse>();

/** 向所有 SSE 客户端广播消息 */
function broadcastSSE(event: string, data: Record<string, unknown>) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  }
}

/**
 * 全局文件 diff 广播函数
 * 供 FsTool 等工具调用，实时向前端推送文件变更 diff
 * 格式：{ type, filePath, action, additions, deletions, lines, text, timestamp }
 */
(global as any).__broadcastDiff = (diffData: Record<string, unknown>) => {
  broadcastSSE('file_diff', diffData);
  _log(`📊 [FileDiff] ${diffData.filePath} (+${diffData.additions}/-${diffData.deletions})`);
};



/** 保存原始控制台方法引用 */
const _log = console.log.bind(console);
const _error = console.error.bind(console);
const _warn = console.warn.bind(console);

/** 判断参数是否为 @clack/prompts 的 symbol 对象 */
function isClackSymbolArg(arg: unknown): boolean {
  return typeof arg === 'object' && arg !== null && 'symbol' in arg && Object.keys(arg).length === 1;
}

/** 过滤掉 @clack/prompts 的 symbol 参数 */
function filterClackArgs(args: unknown[]): unknown[] {
  return args.filter((a) => !isClackSymbolArg(a));
}

/** 重写 console.log */
console.log = function (...args: unknown[]) {
  const filteredArgs = filterClackArgs(args);
  const message = filteredArgs
    .map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)))
    .join(' ');
  _log(...args);
  if (filteredArgs.length > 0) {
    broadcastSSE('console', { level: 'log', message, timestamp: new Date().toISOString() });
  }
};

/** 重写 console.error */
console.error = function (...args: unknown[]) {
  const filteredArgs = filterClackArgs(args);
  const message = filteredArgs
    .map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)))
    .join(' ');
  _error(...args);
  if (filteredArgs.length > 0) {
    broadcastSSE('console', { level: 'error', message, timestamp: new Date().toISOString() });
  }
};

/** 重写 console.warn */
console.warn = function (...args: unknown[]) {
  const filteredArgs = filterClackArgs(args);
  const message = filteredArgs
    .map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)))
    .join(' ');
  _warn(...args);
  if (filteredArgs.length > 0) {
    broadcastSSE('console', { level: 'warn', message, timestamp: new Date().toISOString() });
  }
};

// ============================================================
// 3.5️⃣ 拦截 @clack/prompts 的 log 方法
//      让所有工具使用的 log.info/warn/error/success/step/message
//      也通过 console.log 广播到前端 SSE
// ============================================================

/** 去除 ANSI 转义码 */
function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

/** 日志级别映射表 */
const clackLogLevelMap: Record<string, 'log' | 'warn' | 'error'> = {
  info: 'log',
  warn: 'warn',
  warning: 'warn',
  error: 'error',
  success: 'log',
  step: 'log',
  message: 'log',
};

for (const [method, level] of Object.entries(clackLogLevelMap)) {
  const original = (clackLog as any)[method];
  if (typeof original === 'function') {
    (clackLog as any)[method] = function (...args: unknown[]) {
      original.apply(clackLog, args);
      const textArgs = filterClackArgs(args);
      if (textArgs.length > 0) {
        const message = textArgs
          .map((a) => stripAnsi(typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)))
          .join(' ');
        console[level](`[Tool] ${message}`);
      }
    };
  }
}

_log('🔧 已拦截 @clack/prompts 的 log 方法，工具提示将同步展示在前端控制台面板');

// ============================================================
// 3.6️⃣ 拦截 @clack/prompts 的 confirm 方法
//      让所有工具使用的 confirm（如 FsTool 删除确认等）
//      通过 SSE 的 ask_confirm 事件推送到前端弹窗
//      用户点击确认→返回true，点击取消→返回取消Symbol
// ============================================================

/**
 * 拦截 @clack/prompts 的 confirm 函数
 * 通过动态 import 获取模块引用，利用 ESM live binding 机制
 * 使所有已导入 confirm 的工具都能使用 Web 版确认弹窗
 */
let _confirmIntercepted = false;
import('@clack/prompts').then((clackPromptsModule) => {
  if (_confirmIntercepted) return;
  _confirmIntercepted = true;
  
  const origConfirm = (clackPromptsModule as any).confirm;
  (clackPromptsModule as any).confirm = async (opts: { message: string }) => {
    _log(`[WebConfirm] AI 请求确认: ${opts.message}`);
    
    // 通过 SSE 广播 ask_confirm 事件（区别于 ask_user 文本输入）
    broadcastSSE('ask_confirm', {
      question: opts.message,
      timestamp: new Date().toISOString(),
    });
    
    // 等待用户通过 /api/user-input 提交结果（带 60 秒超时）
    return new Promise<boolean | symbol>((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        _log('[WebConfirm] ⏱ 用户确认超时，自动取消');
        resolve(Symbol('cancel'));
      }, 60_000);

      const handler = (input: string) => {
        cleanup();
        const lower = input.trim().toLowerCase();
        // 用户输入 yes/y/确认/是 → 确认，其他→取消
        if (lower === 'yes' || lower === 'y' || lower === '确认' || lower === '是') {
          _log('[WebConfirm] ✅ 用户确认');
          resolve(true);
        } else {
          _log('[WebConfirm] ❌ 用户取消');
          resolve(Symbol('cancel'));
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        pendingUserInputResolve = null;
      };

      pendingUserInputResolve = handler;
    });
  };
  
  _log('🔧 已拦截 @clack/prompts 的 confirm 方法，删除确认等操作将通过前端弹窗处理');
}).catch((err) => {
  _error('⚠️ 拦截 confirm 失败:', err);
});
_log('🔧 已拦截 @clack/prompts 的 log 方法，工具提示将同步展示在前端控制台面板');

// ============================================================
// 4️⃣ Web 兼容版 UserInputTool
// ============================================================

/**
 * WebUserInputTool
 * 当 AI 需要向用户提问时，通过 SSE 推送问题，前端弹窗收集输入后通过 POST /api/user-input 返回结果。
 */
class WebUserInputTool extends AgentTool {
  constructor() {
    super({
      name: 'user_input',
      description: '请求用户输入',
      parameters: [
        { name: 'question', type: 'string', description: '请求用户输入的提示', required: true },
      ],
    });
  }

  async execute({ question }: { question: string }): Promise<string> {
    _log(`[WebUserInput] AI 请求用户输入: ${question}`);

    // 通过 SSE 通知前端弹出输入框
    broadcastSSE('ask_user', { question, timestamp: new Date().toISOString() });

    // 等待前端通过 /api/user-input 提交结果（带 60 秒超时）
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve('用户未在60秒内回复（超时）');
      }, 60_000);

      const handler = (input: string) => {
        cleanup();
        _log(`[WebUserInput] 用户回复: ${input}`);
        resolve(`用户输入: ${input}`);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        pendingUserInputResolve = null;
      };

      pendingUserInputResolve = handler;
    });
  }
}

/** 全局 pending 回调，由 /api/user-input 触发 */
let pendingUserInputResolve: ((input: string) => void) | null = null;

// ============================================================
// 5️⃣ 初始化 AI Agent（单例模式，保持多轮对话上下文）
// ============================================================

_log('🚀 正在初始化 SheepKing AI...');
_log(`📦 已加载 ${agentRegistery.getAgents().length} 个 Skill`);

const agent = new OrchestratorCodeAgent();

// ---- 替换 UserInputTool 为 Web 兼容版 ----
const webUserInput = new WebUserInputTool();
const userInputIdx = agent.tools.findIndex((t) => t.name === 'user_input');
if (userInputIdx !== -1) {
  agent.tools[userInputIdx] = webUserInput;
  _log('🔧 已替换 UserInputTool → WebUserInputTool（Web 兼容版）');
} else {
  _warn('⚠️ 未找到 UserInputTool，跳过替换');
}

_log(`✅ AI 初始化完成，Agent: ${agent.name}`);
_log(`🔧 可用工具: ${agent.tools.map((t) => t.name).join(', ')}`);

// ============================================================
// 6️⃣ MIME 类型与静态文件服务
// ============================================================

/** MIME 类型映射表 */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

/**
 * 提供静态文件服务
 * @param filePath 文件绝对路径
 * @param res HTTP 响应对象
 */
function serveStaticFile(filePath: string, res: http.ServerResponse): void {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
}

/**
 * 检查 dist 目录是否存在（判断是否已构建前端）
 */
function checkDistExists(): boolean {
  try {
    return fs.statSync(path.join(DIST_DIR, 'index.html')).isFile();
  } catch {
    return false;
  }
}

// ============================================================
// 7️⃣ HTTP 服务
// ============================================================

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // ---- CORS ----
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // ====== SSE 端点：实时推送控制台日志 ======
    if (pathname === '/api/stream' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      res.write(`event: connected\ndata: ${JSON.stringify({ message: 'SSE 连接已建立' })}\n\n`);
      sseClients.add(res);

      req.on('close', () => {
        sseClients.delete(res);
        _log('🔌 SSE 客户端断开连接');
      });
      return;
    }

    // ====== Chat API：发送消息给 AI ======
    if (pathname === '/api/chat' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const { message } = JSON.parse(body);
          if (!message) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '消息不能为空' }));
            return;
          }

          _log(`\n🧑 用户: ${message}`);
          const result = await agent.run(message);
          const output = result.output || '（无返回结果）';
          _log(`🤖 AI: ${output}`);
          _log(`⏱ 迭代次数: ${result.iterations}`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ output, iterations: result.iterations }));
        } catch (err: any) {
          const errMsg = err instanceof Error ? `${err.message}\n${err.stack || ''}` : String(err);
          _error('❌ Chat API 错误:', errMsg);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message || String(err) }));
        }
      });
      return;
    }

    // ====== User Input API：用户回复 AI 的追问 ======
    if (pathname === '/api/user-input' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const { input } = JSON.parse(body);
          if (pendingUserInputResolve) {
            pendingUserInputResolve(input);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '没有待处理的用户输入请求' }));
          }
        } catch (err: any) {
          _error('❌ User Input API 错误:', err instanceof Error ? err.message : String(err));
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message || String(err) }));
        }
      });
      return;
    }

    // ====== Reset API：重置对话上下文（清空历史，保留 systemPrompt）======
    if (pathname === '/api/reset' && req.method === 'POST') {
      try {
        // 重置 Agent 的对话历史，仅保留 systemPrompt
        agent.message.reset();
        _log('🔄 [Reset] 对话上下文已重置，已清空所有历史消息，systemPrompt 已保留');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: '上下文已重置' }));
      } catch (err: any) {
        const errMsg = err instanceof Error ? err.message : String(err);
        _error('❌ Reset API 错误:', errMsg);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: errMsg }));
      }
      return;
    }



    // ====== 健康检查 ======
    if (pathname === '/api/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        agent: agent.name,
        tools: agent.tools.map((t) => t.name),
        distBuilt: checkDistExists(),
      }));
      return;
    }

    // ====== 静态文件服务（托管 dist 目录） ======
    // 只有 dist/index.html 存在时才服务静态文件
    if (checkDistExists()) {
      // 如果请求根路径，直接返回 index.html
      const safePath = pathname === '/' ? 'index.html' : path.normalize(pathname).replace(/^[/\\]+/, '');
      let filePath = path.join(DIST_DIR, safePath);

      // 安全检查：防止目录遍历攻击
      if (!filePath.startsWith(DIST_DIR)) {
        filePath = path.join(DIST_DIR, 'index.html');
      }

      // 如果路径是目录，尝试 index.html
      try {
        if (fs.statSync(filePath).isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        }
      } catch {
        // 文件不存在，走 SPA fallback
        filePath = path.join(DIST_DIR, 'index.html');
      }

      // 检查文件是否存在
      try {
        if (fs.statSync(filePath).isFile()) {
          return serveStaticFile(filePath, res);
        }
      } catch {
        // 文件不存在，走 SPA fallback
      }

      // ---- SPA 路由回退：所有未匹配的路径返回 index.html ----
      const fallbackPath = path.join(DIST_DIR, 'index.html');
      try {
        if (fs.statSync(fallbackPath).isFile()) {
          return serveStaticFile(fallbackPath, res);
        }
      } catch {
        // index.html 不存在，走兜底页面
      }
    }

    // ====== 兜底：dist 未构建时的独立运行页面 ======
    // 当 dist 不存在时，返回一个功能完整的独立页面（从原 chat-server.ts 移植）
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getStandalonePage());
  } catch (err: any) {
    const errMsg = err instanceof Error ? `${err.message}\n${err.stack || ''}` : String(err);
    _error('❌ 服务器错误:', errMsg);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || String(err) }));
  }
});

// ============================================================
// 8️⃣ 启动服务器
// ============================================================

server.listen(PORT, () => {
  const distExists = checkDistExists();

  _log('\n' + '='.repeat(50));
  _log('  🐑 SheepKing Web Chat - 独立完整服务');
  _log(`  🌐 访问地址: http://localhost:${PORT}`);
  _log(`  📦 前端构建: ${distExists ? '✅ 已构建（React 版）' : '⚠️ 未构建（使用内置独立页面）'}`);
  _log(`  🔗 AI Agent: ${agent.name}`);
  _log(`  🔧 可用工具: ${agent.tools.map((t) => t.name).join(', ')}`);
  _log('='.repeat(50) + '\n');

  if (!distExists) {
    _log('  💡 提示: 运行 npm run build 构建 React 前端后可获得更完整体验');
    _log('  💡 开发模式: 运行 npm run dev 启动 Vite + 后端协作开发\n');
  }
});

// ============================================================
// 9️⃣ 独立运行页面（dist 不存在时的 fallback）
//     从原 chat-server.ts 移植并适配，提供完整的对话体验
// ============================================================

function getStandalonePage(): string {
  const h: string[] = [];
  h.push('<!DOCTYPE html>');
  h.push('<html lang="zh-CN">');
  h.push('<head>');
  h.push('<meta charset="UTF-8" />');
  h.push('<meta name="viewport" content="width=device-width, initial-scale=1.0" />');
  h.push('<title>🐑 SheepKing AI Chat</title>');
  h.push('<style>');

  // ====== CSS 变量定义 ======
  h.push('/* Light (浅色默认) */');
  h.push('[data-theme="light"]{');
  h.push('--bg-primary:#f5f5f5;--bg-secondary:#ffffff;--bg-tertiary:#e8e8e8;');
  h.push('--text-primary:#1a1a2e;--text-secondary:#555555;--text-tertiary:#999999;');
  h.push('--border-color:#e0e0e0;--accent-blue:#4a90d9;--accent-green:#7ec8a3;');
  h.push('--msg-user-bg:linear-gradient(135deg,#4a90d9,#6ab0f7);');
  h.push('--msg-ai-bg:#ffffff;--msg-ai-border:#e0e0e0;');
  h.push('--header-bg:linear-gradient(135deg,#e8e8f0,#d5d5e8);');
  h.push('--input-bg:#ffffff;');
  h.push('--title-gradient:linear-gradient(90deg,#4a90d9,#7ec8a3);');
  h.push('--status-dot:#7ec8a3;--log-level-warn:#d29922;--log-level-error:#f85149;');
  h.push('--modal-overlay:rgba(0,0,0,0.4);--modal-shadow:0 20px 60px rgba(0,0,0,0.12);');
  h.push('--scrollbar-thumb:#d0d0d0;--scrollbar-thumb-hover:#b0b0b0;');
  h.push('--btn-hover-shadow:0 4px 12px rgba(74,144,217,0.4);');
  h.push('--theme-dot-color:#4a90d9;');
  h.push('}');

  // Light Green
  h.push('[data-theme="light-green"]{');
  h.push('--bg-primary:#f0f7f0;--bg-secondary:#ffffff;--bg-tertiary:#ddeedd;');
  h.push('--text-primary:#2d3e2d;--text-secondary:#5a7a5a;--text-tertiary:#8aaa8a;');
  h.push('--border-color:#c8e6c9;--accent-blue:#66bb6a;--accent-green:#81c784;');
  h.push('--msg-user-bg:linear-gradient(135deg,#66bb6a,#a5d6a7);');
  h.push('--msg-ai-bg:#ffffff;--msg-ai-border:#c8e6c9;');
  h.push('--header-bg:linear-gradient(135deg,#e8f5e9,#c8e6c9);');
  h.push('--input-bg:#ffffff;');
  h.push('--title-gradient:linear-gradient(90deg,#66bb6a,#81c784);');
  h.push('--status-dot:#81c784;--log-level-warn:#d29922;--log-level-error:#f85149;');
  h.push('--modal-overlay:rgba(0,0,0,0.3);--modal-shadow:0 20px 60px rgba(0,0,0,0.1);');
  h.push('--scrollbar-thumb:#c8e6c9;--scrollbar-thumb-hover:#a5d6a7;');
  h.push('--btn-hover-shadow:0 4px 12px rgba(102,187,106,0.4);');
  h.push('--theme-dot-color:#66bb6a;');
  h.push('}');

  // Light Pink
  h.push('[data-theme="light-pink"]{');
  h.push('--bg-primary:#fdf0f5;--bg-secondary:#ffffff;--bg-tertiary:#f5dde6;');
  h.push('--text-primary:#4a2d3e;--text-secondary:#8a5a7a;--text-tertiary:#ba8aaa;');
  h.push('--border-color:#f8bbd0;--accent-blue:#f06292;--accent-green:#f48fb1;');
  h.push('--msg-user-bg:linear-gradient(135deg,#f06292,#f48fb1);');
  h.push('--msg-ai-bg:#ffffff;--msg-ai-border:#f8bbd0;');
  h.push('--header-bg:linear-gradient(135deg,#fce4ec,#f8bbd0);');
  h.push('--input-bg:#ffffff;');
  h.push('--title-gradient:linear-gradient(90deg,#f06292,#f48fb1);');
  h.push('--status-dot:#f48fb1;--log-level-warn:#d29922;--log-level-error:#f85149;');
  h.push('--modal-overlay:rgba(0,0,0,0.3);--modal-shadow:0 20px 60px rgba(0,0,0,0.1);');
  h.push('--scrollbar-thumb:#f8bbd0;--scrollbar-thumb-hover:#f48fb1;');
  h.push('--btn-hover-shadow:0 4px 12px rgba(240,98,146,0.4);');
  h.push('--theme-dot-color:#f06292;');
  h.push('}');

  // Light Blue
  h.push('[data-theme="light-blue"]{');
  h.push('--bg-primary:#f0f5fd;--bg-secondary:#ffffff;--bg-tertiary:#dde6f5;');
  h.push('--text-primary:#2d3e4a;--text-secondary:#5a7a8a;--text-tertiary:#8aaaba;');
  h.push('--border-color:#bbdefb;--accent-blue:#42a5f5;--accent-green:#64b5f6;');
  h.push('--msg-user-bg:linear-gradient(135deg,#42a5f5,#90caf9);');
  h.push('--msg-ai-bg:#ffffff;--msg-ai-border:#bbdefb;');
  h.push('--header-bg:linear-gradient(135deg,#e3f2fd,#bbdefb);');
  h.push('--input-bg:#ffffff;');
  h.push('--title-gradient:linear-gradient(90deg,#42a5f5,#64b5f6);');
  h.push('--status-dot:#64b5f6;--log-level-warn:#d29922;--log-level-error:#f85149;');
  h.push('--modal-overlay:rgba(0,0,0,0.3);--modal-shadow:0 20px 60px rgba(0,0,0,0.1);');
  h.push('--scrollbar-thumb:#bbdefb;--scrollbar-thumb-hover:#90caf9;');
  h.push('--btn-hover-shadow:0 4px 12px rgba(66,165,245,0.4);');
  h.push('--theme-dot-color:#42a5f5;');
  h.push('}');

  // Light Purple
  h.push('[data-theme="light-purple"]{');
  h.push('--bg-primary:#f5f0fd;--bg-secondary:#ffffff;--bg-tertiary:#e5ddf5;');
  h.push('--text-primary:#3d2d4a;--text-secondary:#7a5a8a;--text-tertiary:#aa8aba;');
  h.push('--border-color:#d1c4e9;--accent-blue:#9575cd;--accent-green:#b39ddb;');
  h.push('--msg-user-bg:linear-gradient(135deg,#9575cd,#b39ddb);');
  h.push('--msg-ai-bg:#ffffff;--msg-ai-border:#d1c4e9;');
  h.push('--header-bg:linear-gradient(135deg,#ede7f6,#d1c4e9);');
  h.push('--input-bg:#ffffff;');
  h.push('--title-gradient:linear-gradient(90deg,#9575cd,#b39ddb);');
  h.push('--status-dot:#b39ddb;--log-level-warn:#d29922;--log-level-error:#f85149;');
  h.push('--modal-overlay:rgba(0,0,0,0.3);--modal-shadow:0 20px 60px rgba(0,0,0,0.1);');
  h.push('--scrollbar-thumb:#d1c4e9;--scrollbar-thumb-hover:#b39ddb;');
  h.push('--btn-hover-shadow:0 4px 12px rgba(149,117,205,0.4);');
  h.push('--theme-dot-color:#9575cd;');
  h.push('}');

  // Light Yellow
  h.push('[data-theme="light-yellow"]{');
  h.push('--bg-primary:#fef9e7;--bg-secondary:#ffffff;--bg-tertiary:#fdf2d6;');
  h.push('--text-primary:#5a4a2a;--text-secondary:#9a7a4a;--text-tertiary:#baaa7a;');
  h.push('--border-color:#f0e0b0;--accent-blue:#d4a843;--accent-green:#e6c76a;');
  h.push('--msg-user-bg:linear-gradient(135deg,#d4a843,#f0d68a);');
  h.push('--msg-ai-bg:#ffffff;--msg-ai-border:#f0e0b0;');
  h.push('--header-bg:linear-gradient(135deg,#fef5e7,#fdebd0);');
  h.push('--input-bg:#ffffff;');
  h.push('--title-gradient:linear-gradient(90deg,#d4a843,#e6c76a);');
  h.push('--status-dot:#e6c76a;--log-level-warn:#d29922;--log-level-error:#f85149;');
  h.push('--modal-overlay:rgba(0,0,0,0.3);--modal-shadow:0 20px 60px rgba(0,0,0,0.1);');
  h.push('--scrollbar-thumb:#f0e0b0;--scrollbar-thumb-hover:#e6c76a;');
  h.push('--btn-hover-shadow:0 4px 12px rgba(212,168,67,0.4);');
  h.push('--theme-dot-color:#d4a843;');
  h.push('}');

  // ====== 平滑过渡 ======
  h.push('html{transition:background-color 0.3s ease}');
  h.push('body{transition:background-color 0.3s ease,color 0.3s ease}');

  // ====== 基础样式 ======
  h.push('body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans SC",sans-serif;background:var(--bg-primary);color:var(--text-primary);height:100vh;display:flex;flex-direction:column;overflow:hidden;margin:0}');
  h.push('.header{background:var(--header-bg);padding:16px 24px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}');
  h.push('.header h1{font-size:20px;font-weight:600;background:var(--title-gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:0}');
  h.push('.header .status{display:flex;align-items:center;gap:12px;font-size:13px;color:var(--text-secondary)}');
  h.push('.header .status-dot{width:10px;height:10px;border-radius:50%;background:var(--status-dot);animation:pulse 2s infinite}');
  h.push('@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}');
  h.push('.header .badge{font-size:11px;background:var(--bg-tertiary);padding:2px 8px;border-radius:12px;color:var(--text-secondary);border:1px solid var(--border-color)}');

  // ====== 主题选择器 ======
  h.push('.theme-selector{display:flex;align-items:center;gap:6px;margin-left:12px}');
  h.push('.theme-selector .theme-label{font-size:11px;color:var(--text-secondary);margin-right:2px}');
  h.push('.theme-dot{width:18px;height:18px;border-radius:50%;border:2px solid var(--border-color);cursor:pointer;transition:all 0.25s ease;position:relative;display:inline-block}');
  h.push('.theme-dot:hover{transform:scale(1.2);border-color:var(--text-secondary)}');
  h.push('.theme-dot.active{border-color:var(--text-primary);transform:scale(1.15);box-shadow:0 0 0 2px var(--bg-secondary),0 0 0 4px var(--accent-blue)}');

  // 各主题圆点颜色
  const themeDots = [
    ['light', '#f5f5f5'],
    ['light-green', '#81c784'],
    ['light-pink', '#f48fb1'],
    ['light-blue', '#64b5f6'],
    ['light-yellow', '#e6c76a'],
    ['light-purple', '#b39ddb'],
  ];
  for (const [name, color] of themeDots) {
    h.push(`.theme-dot[data-theme="${name}"]{background:${color}}`);
  }

  h.push('.theme-dot .tooltip{visibility:hidden;opacity:0;position:absolute;top:calc(100% + 6px);left:50%;transform:translateX(-50%);background:var(--bg-secondary);color:var(--text-primary);font-size:10px;padding:3px 8px;border-radius:6px;border:1px solid var(--border-color);white-space:nowrap;transition:all 0.2s ease;z-index:100;pointer-events:none}');
  h.push('.theme-dot:hover .tooltip{visibility:visible;opacity:1}');

  // ====== 主布局 ======
  h.push('.main-container{display:flex;flex:1;overflow:hidden}');
  h.push('.chat-panel{flex:1;display:flex;flex-direction:column;min-width:0;border-right:1px solid var(--border-color)}');
  h.push('.chat-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px}');
  h.push('.chat-messages .empty-hint{text-align:center;color:var(--text-tertiary);margin-top:80px;font-size:15px;line-height:2}');
  h.push('.chat-messages .empty-hint .big{font-size:48px;display:block;margin-bottom:16px}');
  h.push('.message{max-width:85%;padding:12px 16px;border-radius:16px;line-height:1.6;font-size:14px;word-break:break-word;white-space:pre-wrap;animation:fadeIn 0.3s ease}');
  h.push('@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}');
  h.push('.message.user{align-self:flex-end;background:var(--msg-user-bg);color:#fff;border-bottom-right-radius:4px}');
  h.push('.message.ai{align-self:flex-start;background:var(--msg-ai-bg);color:var(--text-primary);border:1px solid var(--msg-ai-border);border-bottom-left-radius:4px}');
  h.push('.message .msg-label{font-size:11px;font-weight:600;margin-bottom:6px;opacity:0.7;text-transform:uppercase;letter-spacing:0.5px}');
  h.push('.message .msg-time{font-size:11px;opacity:0.5;margin-top:8px;text-align:right;color:var(--text-tertiary)}');
  h.push('.message.ai .msg-label{color:var(--accent-green)}');
  h.push('.message.user .msg-label{color:rgba(255,255,255,0.7)}');
  h.push('.chat-input-area{padding:16px 20px;border-top:1px solid var(--border-color);background:var(--bg-primary);display:flex;gap:12px;align-items:flex-end;flex-shrink:0}');
  h.push('.chat-input-area textarea{flex:1;background:var(--input-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px 16px;color:var(--text-primary);font-size:14px;font-family:inherit;resize:none;min-height:48px;max-height:120px;outline:none;transition:border-color 0.2s}');
  h.push('.chat-input-area textarea:focus{border-color:var(--accent-blue)}');
  h.push('.chat-input-area textarea::placeholder{color:var(--text-tertiary)}');
  h.push('.chat-input-area button{background:var(--msg-user-bg);color:#fff;border:none;border-radius:12px;padding:12px 24px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s;white-space:nowrap;height:48px}');
  h.push('.chat-input-area button:hover:not(:disabled){transform:translateY(-1px);box-shadow:var(--btn-hover-shadow)}');
  h.push('.chat-input-area button:disabled{opacity:0.5;cursor:not-allowed}');
  h.push('.chat-input-area button.loading{background:var(--bg-tertiary);pointer-events:none;color:var(--text-secondary)}');

  // ====== 控制台面板 ======
  h.push('.console-panel{width:420px;display:flex;flex-direction:column;background:var(--bg-primary);flex-shrink:0}');
  h.push('.console-header{padding:12px 16px;border-bottom:1px solid var(--border-color);font-size:13px;font-weight:600;color:var(--text-secondary);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}');
  h.push('.console-header .console-actions{display:flex;gap:8px}');
  h.push('.console-header .console-actions button{background:var(--bg-tertiary);border:1px solid var(--border-color);color:var(--text-secondary);padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer;transition:all 0.2s}');
  h.push('.console-header .console-actions button:hover{background:var(--border-color);color:var(--text-primary)}');
  h.push('.console-logs{flex:1;overflow-y:auto;padding:8px 0;font-family:"JetBrains Mono","Fira Code","Cascadia Code","Consolas",monospace;font-size:12px;line-height:1.6}');
  h.push('.console-logs .log-entry{padding:4px 16px;border-bottom:1px solid var(--border-color);animation:logFade 0.2s ease}');
  h.push('@keyframes logFade{from{opacity:0;background:rgba(0,0,0,0.03)}to{opacity:1;background:transparent}}');
  h.push('.console-logs .log-entry .log-time{color:var(--text-tertiary);margin-right:8px;font-size:11px}');
  h.push('.console-logs .log-entry .log-level{display:inline-block;width:44px;font-weight:600;font-size:11px;text-transform:uppercase}');
  h.push('.console-logs .log-entry.log-level-log .log-level{color:var(--text-secondary)}');
  h.push('.console-logs .log-entry.log-level-warn .log-level{color:var(--log-level-warn)}');
  h.push('.console-logs .log-entry.log-level-error .log-level{color:var(--log-level-error)}');
  h.push('.console-logs .log-entry .log-msg{color:var(--text-primary)}');
  h.push('.console-logs .log-entry.log-level-error{background:color-mix(in srgb,var(--log-level-error) 8%,transparent)}');
  h.push('.console-logs .log-entry.log-level-warn{background:color-mix(in srgb,var(--log-level-warn) 8%,transparent)}');
  h.push('.console-footer{padding:8px 16px;border-top:1px solid var(--border-color);font-size:11px;color:var(--text-tertiary);text-align:right;flex-shrink:0}');

  // ====== 模态框 ======
  h.push('.modal-overlay{display:none;position:fixed;inset:0;background:var(--modal-overlay);backdrop-filter:blur(4px);z-index:1000;align-items:center;justify-content:center}');
  h.push('.modal-overlay.active{display:flex}');
  h.push('.modal-box{background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:16px;padding:28px 32px 24px;max-width:480px;width:90%;box-shadow:var(--modal-shadow);animation:modalIn 0.25s ease}');
  h.push('@keyframes modalIn{from{transform:scale(0.9);opacity:0}to{transform:scale(1);opacity:1}}');
  h.push('.modal-box h3{font-size:15px;margin-bottom:8px;color:var(--text-primary);margin-top:0}');
  h.push('.modal-box p{font-size:14px;color:var(--text-secondary);margin-bottom:16px;line-height:1.5}');
  h.push('.modal-box input{width:100%;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:8px;padding:10px 14px;color:var(--text-primary);font-size:14px;outline:none;margin-bottom:12px;box-sizing:border-box}');
  h.push('.modal-box input:focus{border-color:var(--accent-blue)}');
  h.push('.modal-box .modal-actions{display:flex;gap:8px;justify-content:flex-end}');
  h.push('.modal-box .modal-actions button{padding:8px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:all 0.2s}');
  h.push('.modal-box .modal-actions .btn-cancel{background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-color)}');
  h.push('.modal-box .modal-actions .btn-cancel:hover{background:var(--border-color)}');
  h.push('.modal-box .modal-actions .btn-submit{background:var(--msg-user-bg);color:#fff}');
  h.push('.modal-box .modal-actions .btn-submit:hover{box-shadow:var(--btn-hover-shadow)}');

  // ====== 滚动条 ======
  h.push('::-webkit-scrollbar{width:6px;height:6px}');
  h.push('::-webkit-scrollbar-track{background:transparent}');
  h.push('::-webkit-scrollbar-thumb{background:var(--scrollbar-thumb);border-radius:3px}');
  h.push('::-webkit-scrollbar-thumb:hover{background:var(--scrollbar-thumb-hover)}');

  // ====== 响应式 ======
  h.push('@media(max-width:768px){.main-container{flex-direction:column}.console-panel{width:100%;height:40vh;border-top:1px solid var(--border-color)}.chat-panel{height:60vh}}');

  // ====== Markdown 样式 ======
  h.push('.message.ai .markdown-body hr{border:none;border-top:1px solid var(--border-color);margin:12px 0}');
  h.push('.message.ai .markdown-body img{max-width:100%;border-radius:8px;margin:8px 0}');
  h.push('.message.ai .markdown-body strong{font-weight:600}');
  h.push('.message.ai .markdown-body a{color:var(--accent-blue);text-decoration:none;cursor:pointer}');
  h.push('.message.ai .markdown-body a:hover{text-decoration:underline}');
  h.push('.message.ai .markdown-body table{border-collapse:collapse;margin:8px 0;width:100%;font-size:13px}');
  h.push('.message.ai .markdown-body th,.message.ai .markdown-body td{border:1px solid var(--border-color);padding:6px 10px;text-align:left}');
  h.push('.message.ai .markdown-body th{background:var(--bg-tertiary);font-weight:600}');
  h.push('.message.ai .markdown-body blockquote{border-left:3px solid var(--accent-blue);margin:8px 0;padding:4px 12px;color:var(--text-secondary);background:var(--bg-tertiary);border-radius:0 4px 4px 0}');
  h.push('.message.ai .markdown-body h1,.message.ai .markdown-body h2,.message.ai .markdown-body h3,.message.ai .markdown-body h4{margin:12px 0 6px;font-weight:600}');
  h.push('.message.ai .markdown-body h1{font-size:18px}.message.ai .markdown-body h2{font-size:16px}.message.ai .markdown-body h3{font-size:15px}');
  h.push('.message.ai .markdown-body ul,.message.ai .markdown-body ol{padding-left:20px;margin:6px 0}');
  h.push('.message.ai .markdown-body li{margin:4px 0}');
  h.push('.message.ai .markdown-body pre{background:#f6f8fa;border:1px solid var(--border-color);border-radius:8px;padding:12px 16px;overflow-x:auto;margin:8px 0;font-size:13px;line-height:1.5}');
  h.push('.message.ai .markdown-body code{background:#f0f0f0;padding:2px 6px;border-radius:4px;font-size:13px;font-family:\'JetBrains Mono\',\'Fira Code\',\'Consolas\',monospace;color:#d63384}');
  h.push('.message.ai .markdown-body pre code{background:transparent;padding:0;border-radius:0;color:var(--text-primary)}');
  h.push('.message.ai .markdown-body p{margin:0 0 8px 0}');
  h.push('.message.ai .markdown-body p:last-child{margin-bottom:0}');
  h.push('.message.ai .markdown-body{font-size:14px;line-height:1.7;color:var(--text-primary)}');

  // ====== 欢迎弹窗样式 ======
  h.push('.welcome-overlay{position:fixed;inset:0;background:var(--modal-overlay);backdrop-filter:blur(6px);z-index:2000;display:flex;align-items:center;justify-content:center}');
  h.push('.welcome-overlay.hidden{display:none}');
  h.push('.welcome-box{background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:20px;padding:36px 40px 32px;max-width:640px;width:92%;box-shadow:0 24px 80px rgba(0,0,0,0.15);animation:modalIn 0.35s ease}');
  h.push('.welcome-title{text-align:center;font-size:22px;font-weight:700;background:var(--title-gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:6px}');
  h.push('.welcome-sub{text-align:center;font-size:14px;color:var(--text-tertiary);margin-bottom:28px}');
  h.push('.welcome-buttons{display:flex;gap:16px;justify-content:center}');
  h.push('.mode-btn{flex:1;max-width:220px;padding:20px 24px;border-radius:14px;border:2px solid var(--border-color);background:var(--bg-primary);cursor:pointer;transition:all 0.25s ease;text-align:center}');
  h.push('.mode-btn:hover{border-color:var(--accent-blue);transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.08)}');
  h.push('.mode-btn .icon{font-size:36px;display:block;margin-bottom:8px}');
  h.push('.mode-btn .label{font-size:15px;font-weight:600;color:var(--text-primary)}');
  h.push('.mode-btn .desc{font-size:12px;color:var(--text-tertiary);margin-top:4px;line-height:1.4}');
  h.push('.welcome-form{display:none}');
  h.push('.welcome-form.active{display:block}');
  h.push('.project-row{display:flex;gap:12px;margin-bottom:12px;align-items:center}');
  h.push('.project-row input{flex:1;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:8px;padding:10px 14px;color:var(--text-primary);font-size:13px;outline:none;transition:border-color 0.2s;box-sizing:border-box}');
  h.push('.project-row input:focus{border-color:var(--accent-blue)}');
  h.push('.project-row .row-label{font-size:12px;font-weight:600;color:var(--text-secondary);white-space:nowrap;min-width:60px}');
  h.push('.project-row .del-btn{padding:6px 10px;border-radius:6px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-tertiary);cursor:pointer;font-size:14px;transition:all 0.2s}');
  h.push('.project-row .del-btn:hover{background:var(--log-level-error);color:#fff;border-color:var(--log-level-error)}');
  h.push('.add-project-btn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:10px;border:2px dashed var(--border-color);border-radius:10px;background:transparent;color:var(--text-tertiary);font-size:13px;cursor:pointer;transition:all 0.2s;margin-bottom:16px}');
  h.push('.add-project-btn:hover{border-color:var(--accent-blue);color:var(--accent-blue);background:color-mix(in srgb,var(--accent-blue) 5%,transparent)}');
  h.push('.welcome-form-actions{display:flex;gap:12px;justify-content:flex-end}');
  h.push('.welcome-form-actions button{padding:10px 28px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;border:none;transition:all 0.2s}');
  h.push('.welcome-form-actions .btn-back{background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-color)}');
  h.push('.welcome-form-actions .btn-back:hover{background:var(--border-color)}');
  h.push('.welcome-form-actions .btn-go{background:var(--msg-user-bg);color:#fff}');
  h.push('.welcome-form-actions .btn-go:hover{box-shadow:var(--btn-hover-shadow)}');
  h.push('.welcome-form-actions .btn-go:disabled{opacity:0.5;cursor:not-allowed;box-shadow:none}');
  h.push('</style>');
  h.push('<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script>');
  h.push('</head>');
  h.push('<body data-theme="light">');

  // ---- 顶部栏 ----
  h.push('<header class="header">');
  h.push('<h1>\u{1F411} SheepKing AI Chat</h1>');
  h.push('<div class="status">');
  h.push('<span class="status-dot"></span><span>\u5DF2\u8FDE\u63A5</span><span class="badge">OrchestratorCodeAgent</span>');
  h.push('<div class="theme-selector">');
  h.push('<span class="theme-label">\u4E3B\u9898</span>');

  const themeNames: [string, string][] = [
    ['light', '\u6D45\u8272\u9ED8\u8BA4'],
    ['light-green', '\u6D45\u7EFF\u8272'],
    ['light-pink', '\u6D45\u7C89\u8272'],
    ['light-blue', '\u6D45\u84DD\u8272'],
    ['light-yellow', '\u6D45\u9EC4\u8272'],
    ['light-purple', '\u6D45\u7D2B\u8272'],
  ];
  for (const [key, label] of themeNames) {
    const active = key === 'light' ? ' active' : '';
    h.push(`<span class="theme-dot${active}" data-theme="${key}" onclick="setTheme('${key}')"><span class="tooltip">${label}</span></span>`);
  }

  h.push('</div></div></header>');

  // ---- 主区域 ----
  h.push('<div class="main-container">');
  h.push('<div class="chat-panel">');
  h.push('<div class="chat-messages" id="chatMessages">');
  h.push('<div class="empty-hint"><span class="big">\u{1F411}</span>\u5F00\u59CB\u548C AI \u5BF9\u8BDD\u5427!<br/>\u5728\u4E0B\u65B9\u8F93\u5165\u4F60\u7684\u95EE\u9898\uFF0CAI \u4F1A\u81EA\u52A8\u8C03\u5EA6\u5408\u9002\u7684\u6280\u80FD\u6765\u5904\u7406\u3002</div>');
  h.push('</div>');
  h.push('<div class="chat-input-area">');
  h.push('<textarea id="chatInput" placeholder="\u8F93\u5165\u4F60\u7684\u95EE\u9898..." rows="1" oninput="autoResize(this)" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();sendMessage()}"></textarea>');
  h.push('<button id="sendBtn" onclick="sendMessage()">\u53D1\u9001</button>');
  h.push('</div></div>');

  // ---- 控制台日志 ----
  h.push('<div class="console-panel">');
  h.push('<div class="console-header"><span>\u{1F4CB} \u63A7\u5236\u53F0\u65E5\u5FD7</span>');
  h.push('<div class="console-actions"><button onclick="clearLogs()">\u6E05\u7A7A</button><button onclick="toggleAutoScroll()" id="autoScrollBtn">\u81EA\u52A8\u6EDA\u52A8 \u2713</button></div>');
  h.push('</div>');
  h.push('<div class="console-logs" id="consoleLogs"></div>');
  h.push('<div class="console-footer" id="logCount">\u5171 0 \u6761\u65E5\u5FD7</div>');
  // ---- 欢迎弹窗 ----
  h.push('<div class="welcome-overlay" id="welcomeOverlay">');
  h.push('<div class="welcome-box">');
  // 第一屏：模式选择
  h.push('<div id="welcomeScreen1">');
  h.push('<div class="welcome-title">\u{1F411} \u6B22\u8FCE\u4F7F\u7528 SheepKing AI Chat</div>');
  h.push('<div class="welcome-sub">\u8BF7\u9009\u62E9\u4F60\u7684\u4F7F\u7528\u6A21\u5F0F</div>');
  h.push('<div class="welcome-buttons">');
  h.push('<button class="mode-btn" onclick="selectMode(\'normal\')"><span class="icon">\u{1F916}</span><span class="label">\u6B63\u5E38\u4F7F\u7528</span><span class="desc">\u76F4\u63A5\u5F00\u59CB\u5BF9\u8BDD\uFF0C\u4E0D\u5199\u4EE3\u7801</span></button>');
  h.push('<button class="mode-btn" onclick="selectMode(\'code\')"><span class="icon">\u{1F4BB}</span><span class="label">\u5199\u4EE3\u7801</span><span class="desc">\u6307\u5B9A\u9879\u76EE\u8DEF\u5F84\uFF0C\u8BA9 AI \u5E2E\u4F60\u7F16\u7A0B</span></button>');
  h.push('</div></div>');
  // 第二屏：项目表单
  h.push('<div class="welcome-form" id="welcomeScreen2">');
  h.push('<div class="welcome-title" style="font-size:18px">\u{1F4BB} \u5199\u4EE3\u7801\u6A21\u5F0F</div>');
  h.push('<div class="welcome-sub" style="margin-bottom:20px">\u6DFB\u52A0\u4F60\u8981\u68C0\u67E5\u7684\u9879\u76EE</div>');
  h.push('<div id="projectList">');
  h.push('<div class="project-row" data-index="0">');
  h.push('<span class="row-label">\u9879\u76EE\u540D\u79F0:</span>');
  h.push('<input type="text" class="project-name" placeholder="\u4F8B\u5982: my-app" />');
  h.push('<span class="row-label" style="min-width:50px">\u5730\u5740:</span>');
  h.push('<input type="text" class="project-path" placeholder="\u4F8B\u5982: D:/MyProject" />');
  h.push('</div></div>');
  h.push('<button class="add-project-btn" onclick="addProjectRow()">+ \u65B0\u589E\u4E00\u4E2A\u9879\u76EE</button>');
  h.push('<div class="welcome-form-actions">');
  h.push('<button class="btn-back" onclick="backToScreen1()">\u8FD4\u56DE</button>');
  h.push('<button class="btn-go" id="btnGoCode" onclick="submitProjects()">\u786E\u5B9A</button>');
  h.push('</div></div></div></div>');
  h.push('</div></div>');

  // ---- 追问模态框 ----
  h.push('<div class="modal-overlay" id="askModal">');
  h.push('<div class="modal-box">');
  h.push('<h3>\u{1F916} AI \u60F3\u95EE\u60A8\u4E00\u4E2A\u95EE\u9898</h3>');
  h.push('<p id="askQuestion">\u8BF7\u7A0D\u5019...</p>');
  h.push('<input type="text" id="askInput" placeholder="\u8BF7\u8F93\u5165\u4F60\u7684\u56DE\u7B54..." />');
  h.push('<div class="modal-actions">');
  h.push('<button class="btn-cancel" onclick="cancelAsk()">\u8DF3\u8FC7</button>');
  h.push('<button class="btn-submit" onclick="submitAsk()">\u63D0\u4EA4</button>');
  h.push('</div></div></div>');

  // ---- JavaScript ----
  h.push('<script>');
  h.push('function setTheme(t){');
  h.push('document.documentElement.setAttribute("data-theme",t);');
  h.push('document.body.setAttribute("data-theme",t);');
  h.push('var dots=document.querySelectorAll(".theme-dot");');
  h.push('for(var i=0;i<dots.length;i++){dots[i].classList.remove("active");if(dots[i].getAttribute("data-theme")===t){dots[i].classList.add("active")}}');
  h.push('try{localStorage.setItem("chat-theme",t)}catch(e){}');
  h.push('}');
  h.push('try{var st=localStorage.getItem("chat-theme");if(st){setTheme(st)}}catch(e){}');

  h.push('function autoResize(el){el.style.height="auto";el.style.height=Math.min(el.scrollHeight,120)+"px"}');

  // DOM 引用
  h.push('var cm=document.getElementById("chatMessages");');
  h.push('var ci=document.getElementById("chatInput");');
  h.push('var sb=document.getElementById("sendBtn");');
  h.push('var cl=document.getElementById("consoleLogs");');
  h.push('var lc=document.getElementById("logCount");');
  h.push('var am=document.getElementById("askModal");');
  h.push('var aq=document.getElementById("askQuestion");');
  h.push('var ai=document.getElementById("askInput");');
  h.push('var sending=false,autoScr=true,logCnt=0;');

  // SSE 连接
  h.push('function connectSSE(){');
  h.push('var es=new EventSource("/api/stream");');
  h.push('es.addEventListener("connected",function(){console.log("SSE OK")});');
  h.push('es.addEventListener("console",function(e){try{addLog(JSON.parse(e.data))}catch(_){}});');
  h.push('es.addEventListener("ask_user",function(e){try{var d=JSON.parse(e.data);showModal(d.question)}catch(_){}});');
  h.push('es.addEventListener("ask_confirm",function(e){try{var d=JSON.parse(e.data);showConfirm(d.question)}catch(_){}});');
  h.push('es.onerror=function(){setTimeout(connectSSE,3000)}');
  h.push('}');

  // 日志
  h.push('function addLog(d){');
  h.push('var t=d.timestamp?new Date(d.timestamp).toLocaleTimeString():"";logCnt++;');
  h.push('var el=document.createElement("div");');
  h.push('el.className="log-entry log-level-"+d.level;');
  h.push('el.innerHTML="<span class=\\"log-time\\">"+t+"</span><span class=\\"log-level\\">["+d.level+"]</span><span class=\\"log-msg\\">"+esc(d.message)+"</span>";');
  h.push('cl.appendChild(el);');
  h.push('lc.textContent="\u5171 "+logCnt+" \u6761\u65E5\u5FD7";');
  h.push('if(autoScr)cl.scrollTop=cl.scrollHeight');
  h.push('}');

  h.push('function clearLogs(){cl.innerHTML="";logCnt=0;lc.textContent="\u5171 0 \u6761\u65E5\u5FD7"}');
  h.push('function toggleAutoScroll(){autoScr=!autoScr;document.getElementById("autoScrollBtn").textContent=autoScr?"\u81EA\u52A8\u6EDA\u52A8 \u2713":"\u81EA\u52A8\u6EDA\u52A8 \u2717"}');
  h.push('function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML}');

  // 模态框
  h.push('function showModal(q){aq.textContent=q;ai.value="";am.classList.add("active");setTimeout(function(){ai.focus()},100)}');
  h.push('function cancelAsk(){am.classList.remove("active");fetch("/api/user-input",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input:"\u7528\u6237\u53D6\u6D88\u4E86\u8F93\u5165"})}).catch(function(){})}');
  h.push('function submitAsk(){var v=ai.value.trim()||"(\u7A7A)";am.classList.remove("active");addMsg("user","[\u56DE\u7B54AI\u8FFD\u95EE] "+v);fetch("/api/user-input",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input:v})}).catch(function(){})}');
  h.push('ai.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();submitAsk()}});');
  // 确认模式（用于 ask_confirm 事件）
  h.push('function showConfirm(q){document.querySelector("#askModal h3").textContent="⚠️ AI 需要您的确认";aq.textContent=q;document.getElementById("askInput").style.display="none";document.querySelector("#askModal .btn-cancel").textContent="取消";document.querySelector("#askModal .btn-submit").textContent="确认";document.querySelector("#askModal .btn-submit").onclick=acceptConfirm;document.querySelector("#askModal .btn-cancel").onclick=rejectConfirm;am.classList.add("active")}');
  h.push('function acceptConfirm(){am.classList.remove("active");restoreModal();fetch("/api/user-input",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input:"yes"})}).catch(function(){})}');
  h.push('function rejectConfirm(){am.classList.remove("active");restoreModal();fetch("/api/user-input",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input:"no"})}).catch(function(){})}');
  h.push('function restoreModal(){document.querySelector("#askModal h3").textContent="\u{1F916} AI \u60F3\u95EE\u60A8\u4E00\u4E2A\u95EE\u9898";document.getElementById("askInput").style.display="";document.querySelector("#askModal .btn-cancel").textContent="\u8DF3\u8FC7";document.querySelector("#askModal .btn-submit").textContent="\u63D0\u4EA4";document.querySelector("#askModal .btn-submit").onclick=submitAsk;document.querySelector("#askModal .btn-cancel").onclick=cancelAsk;ai.value=""}');

  // 消息渲染（支持 Markdown）
  h.push('function addMsg(role,content){');
  h.push('var hint=cm.querySelector(".empty-hint");if(hint)hint.remove();');
  h.push('var now=new Date().toLocaleTimeString();');
  h.push('var div=document.createElement("div");');
  h.push('div.className="message "+role;');
  h.push('div.innerHTML="<div class=\\"msg-label\\">"+(role==="user"?"\u{1F9D1} \u4F60":"\u{1F411} AI")+"</div>"+(role==="ai"?"<div class=\\"markdown-body\\">"+marked.parse(content)+"</div>":esc(content))+"<div class=\\"msg-time\\">"+now+"</div>";');
  h.push('cm.appendChild(div);cm.scrollTop=cm.scrollHeight');
  h.push('}');

  // 发送消息
  h.push('async function sendMessage(){');
  h.push('var msg=ci.value.trim();if(!msg||sending)return;');
  h.push('addMsg("user",msg);ci.value="";ci.style.height="auto";');
  h.push('sending=true;sb.disabled=true;sb.textContent="AI \u601D\u8003\u4E2D...";sb.classList.add("loading");');
  h.push('try{');
  h.push('var res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:msg})});');
  h.push('if(!res.ok)throw new Error((await res.json()).error||"\u8BF7\u6C42\u5931\u8D25");');
  h.push('var data=await res.json();addMsg("ai",data.output||"(\u65E0\u8FD4\u56DE\u7ED3\u679C)")');
  h.push('}catch(e){addMsg("ai","\u274C "+e.message)}');
  h.push('finally{sending=false;sb.disabled=false;sb.textContent="\u53D1\u9001";sb.classList.remove("loading");ci.focus()}');
  h.push('}');

  // ====== 欢迎弹窗逻辑 ======
  h.push('function selectMode(mode){');
  h.push('if(mode==="normal"){document.getElementById("welcomeOverlay").classList.add("hidden")}');
  h.push('else{document.getElementById("welcomeScreen1").style.display="none";document.getElementById("welcomeScreen2").classList.add("active")}');
  h.push('}');
  h.push('function addProjectRow(){');
  h.push('var list=document.getElementById("projectList");');
  h.push('var idx=list.children.length;');
  h.push('var row=document.createElement("div");row.className="project-row";row.dataset.index=idx;');
  h.push('row.innerHTML=\'<span class="row-label">\u9879\u76EE\u540D\u79F0:</span><input type="text" class="project-name" placeholder="\u4F8B\u5982: my-app" /><span class="row-label" style="min-width:50px">\u5730\u5740:</span><input type="text" class="project-path" placeholder="\u4F8B\u5982: D:/MyProject" /><button class="del-btn" onclick="this.parentElement.remove()">\u2716</button>\';');
  h.push('list.appendChild(row)}');
  h.push('function backToScreen1(){document.getElementById("welcomeScreen1").style.display="";document.getElementById("welcomeScreen2").classList.remove("active")}');
  h.push('function submitProjects(){');
  h.push('var rows=document.querySelectorAll(".project-row");');
  h.push('var projects=[];');
  h.push('for(var i=0;i<rows.length;i++){');
  h.push('var name=rows[i].querySelector(".project-name").value.trim();');
  h.push('var path=rows[i].querySelector(".project-path").value.trim();');
  h.push('if(name&&path){projects.push(name+": "+path)}');
  h.push('}');
  h.push('if(projects.length===0){document.querySelector("#welcomeScreen2 .welcome-sub").textContent="\u8BF7\u81F3\u5C11\u586B\u5199\u4E00\u4E2A\u9879\u76EE\u4FE1\u606F";return}');
  h.push('var msg="\u73B0\u5728\u6211\u8981\u5199\u4EE3\u7801,\u68C0\u67E5\u8FD9\u51E0\u4E2A\u9879\u76EE\\n"+projects.join("\\n");');
  h.push('document.getElementById("welcomeOverlay").classList.add("hidden");');
  // 恢复第一屏状态以便下次打开
  h.push('document.getElementById("welcomeScreen1").style.display="";document.getElementById("welcomeScreen2").classList.remove("active");');
  // 直接发送消息
  h.push('ci.value=msg;sendMessage()');
  h.push('}');
  h.push('connectSSE();ci.focus();');
  h.push('<\/script>');
  h.push('</body></html>');

  return h.join('\n');
}
