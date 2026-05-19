/**
 * 🐑 SheepKing Web Chat Server
 *
 * 一个独立的HTTP服务，提供Web页面与 OrchestratorCodeAgent 对话，
 * 并实时展示控制台日志信息。所有代码完全独立，不修改任何现有源文件。
 *
 * 启动方式: npx tsx chat-server.ts
 * 访问地址: http://localhost:3000
 *
 * ===== 设计说明 =====
 * 1. 拦截 console.log/error/warn → 通过SSE实时推送至浏览器
 * 2. 替换 UserInputTool → Web兼容版（弹窗收集用户输入）
 * 3. 保持Agent单例 → 支持多轮对话上下文
 * 4. 内嵌HTML → 单文件自包含，无需额外静态资源
 */

// ============================================================
// 1️⃣ 加载项目依赖（路径别名 @/ 由 tsx 自动解析 tsconfig.json）
// ============================================================
import "./src/tools/index.js"; // 注册所有工具
import { agentRegistery } from "./src/skills/index.js"; // 注册所有Skill Agent
import { OrchestratorCodeAgent } from "./src/core/OrchestratorAgent-Code.js";
import { AgentTool } from "./src/core/BaseAgentTool.js"; // 工具基类（用于创建Web版UserInputTool）
import http from "node:http";
import { log as clackLog } from "@clack/prompts"; // 用于拦截工具日志输出，广播到前端SSE
import { URL } from "node:url";

// ============================================================
// 2️⃣ SSE 控制台日志广播
// ============================================================

/** SSE 客户端连接集合 */
const sseClients = new Set<http.ServerResponse>();

/** 向所有SSE客户端广播消息 */
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

/** 保存原始控制台方法引用 */
const _log = console.log.bind(console);
const _error = console.error.bind(console);
const _warn = console.warn.bind(console);


/** 判断参数是否为 @clack/prompts 的 symbol 对象（包含 ANSI 颜色码的符号） */
function isClackSymbolArg(arg: unknown): boolean {
    return (
        typeof arg === "object" &&
        arg !== null &&
        "symbol" in arg &&
        Object.keys(arg).length === 1
    );
}

/** 过滤掉 @clack/prompts 的 symbol 参数，只保留有效文本参数（用于SSE广播） */
function filterClackArgs(args: unknown[]): unknown[] {
    return args.filter((a) => !isClackSymbolArg(a));
}


/** 重写 console.log：终端输出 + SSE 广播（过滤 @clack/prompts 的 symbol 对象） */
console.log = function (...args: unknown[]) {
    const filteredArgs = filterClackArgs(args);
    const message = filteredArgs
        .map((a) =>
            typeof a === "object" ? JSON.stringify(a, null, 2) : String(a),
        )
        .join(" ");
    _log(...args); // 终端保持原样输出（含颜色）
    if (filteredArgs.length > 0) {
        broadcastSSE("console", {
            level: "log",
            message,
            timestamp: new Date().toISOString(),
        });
    }
};

/** 重写 console.error */
console.error = function (...args: unknown[]) {
    const filteredArgs = filterClackArgs(args);
    const message = filteredArgs
        .map((a) =>
            typeof a === "object" ? JSON.stringify(a, null, 2) : String(a),
        )
        .join(" ");
    _error(...args);
    if (filteredArgs.length > 0) {
        broadcastSSE("console", {
            level: "error",
            message,
            timestamp: new Date().toISOString(),
        });
    }
};

/** 重写 console.warn */
console.warn = function (...args: unknown[]) {
    const filteredArgs = filterClackArgs(args);
    const message = filteredArgs
        .map((a) =>
            typeof a === "object" ? JSON.stringify(a, null, 2) : String(a),
        )
        .join(" ");
    _warn(...args);
    if (filteredArgs.length > 0) {
        broadcastSSE("console", {
            level: "warn",
            message,
            timestamp: new Date().toISOString(),
        });
    }
};


// ============================================================
// 2.5️⃣ 拦截 @clack/prompts 的 log 方法
//     让所有工具使用的 log.info/warn/error/success/step/message
//     也通过 console.log 广播到前端 SSE，在 Web 页面展示工具操作提示
// ============================================================

/** 去除 ANSI 转义码（@clack/prompts 的 log 输出带颜色代码） */
function stripAnsi(str: string): string {
    return str.replace(/\x1B\[[0-9;]*m/g, "");
}

/** 日志级别映射表：@clack/prompts 方法名 → console 方法名 */
const clackLogLevelMap: Record<string, "log" | "warn" | "error"> = {
    info: "log",
    warn: "warn",
    warning: "warn",
    error: "error",
    success: "log",
    step: "log",
    message: "log",
};

// 遍历代理 @clack/prompts 的 log 对象的所有方法
for (const [method, level] of Object.entries(clackLogLevelMap)) {
    const original = (clackLog as any)[method];
    if (typeof original === "function") {
        (clackLog as any)[method] = function (...args: unknown[]) {
            // ① 先调原始方法（终端正常输出，带颜色高亮）
            original.apply(clackLog, args);
            // ② 提取有效文本参数（过滤掉 symbol 对象），通过 console 广播到前端
            const textArgs = filterClackArgs(args);
            if (textArgs.length > 0) {
                const message = textArgs
                    .map((a) =>
                        stripAnsi(
                            typeof a === "object"
                                ? JSON.stringify(a, null, 2)
                                : String(a),
                        ),
                    )
                    .join(" ");
                console[level](`[Tool] ${message}`);
            }
        };
    }
}

console.log("🔧 已拦截 @clack/prompts 的 log 方法，工具提示将同步展示在前端控制台面板");

// ============================================================
// 3️⃣ Web兼容版 UserInputTool
//    （替代原版终端交互工具，避免Web场景下挂起）
// ============================================================

/**
 * WebUserInputTool
 * 当AI需要向用户提问时，通过SSE推送问题，并通过等待全局变量获取回答。
 * 前端页面监听到 'ask_user' 事件后会弹出输入框，提交后通过
 * POST /api/user-input 接口返回结果。
 */
class WebUserInputTool extends AgentTool {
    constructor() {
        super({
            name: "user_input",
            description: "请求用户输入",
            parameters: [
                {
                    name: "question",
                    type: "string",
                    description: "请求用户输入的提示",
                    required: true,
                },
            ],
        });
    }

    async execute({ question }: { question: string }): Promise<string> {
        _log(`[WebUserInput] AI 请求用户输入: ${question}`);

        // 通过SSE通知前端弹出输入框
        broadcastSSE("ask_user", {
            question,
            timestamp: new Date().toISOString(),
        });

        // 等待前端通过 /api/user-input 提交结果（带60秒超时）
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                cleanup();
                resolve("用户未在60秒内回复（超时）");
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
// 4️⃣ 初始化 AI Agent（单例模式，保持多轮对话上下文）
// ============================================================

console.log("🚀 正在初始化 SheepKing AI...");
console.log(`📦 已加载 ${agentRegistery.getAgents().length} 个 Skill`);

const agent = new OrchestratorCodeAgent();

// ---- 替换 UserInputTool 为 Web 兼容版 ----
const webUserInput = new WebUserInputTool();
const userInputIdx = agent.tools.findIndex((t) => t.name === "user_input");
if (userInputIdx !== -1) {
    agent.tools[userInputIdx] = webUserInput;
    console.log("🔧 已替换 UserInputTool → WebUserInputTool（Web兼容版）");
} else {
    console.warn("⚠️ 未找到 UserInputTool，跳过替换");
}

console.log(`✅ AI 初始化完成，Agent: ${agent.name}`);
console.log(`🔧 可用工具: ${agent.tools.map((t) => t.name).join(", ")}`);

// ============================================================
// 5️⃣ HTTP 服务
// ============================================================

const PORT = 3000;

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const pathname = url.pathname;

    // ---- CORS ----
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    try {
        // ====== SSE 端点：实时推送控制台日志 ======
        if (pathname === "/api/stream" && req.method === "GET") {
            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            });

            res.write(
                `event: connected\ndata: ${JSON.stringify({ message: "SSE 连接已建立" })}\n\n`,
            );
            sseClients.add(res);

            req.on("close", () => {
                sseClients.delete(res);
                _log("🔌 SSE 客户端断开连接");
            });
            return;
        }

        // ====== Chat API：发送消息给AI ======
        if (pathname === "/api/chat" && req.method === "POST") {
            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", async () => {
                try {
                    const { message } = JSON.parse(body);
                    if (!message) {
                        res.writeHead(400, {
                            "Content-Type": "application/json",
                        });
                        res.end(JSON.stringify({ error: "消息不能为空" }));
                        return;
                    }

                    console.log(`\n🧑 用户: ${message}`);
                    const result = await agent.run(message);
                    const output = result.output || "（无返回结果）";
                    console.log(`🤖 AI: ${output}`);
                    console.log(`⏱  迭代次数: ${result.iterations}`);

                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(
                        JSON.stringify({
                            output,
                            iterations: result.iterations,
                        }),
                    );
                } catch (err: any) {
                    const errMsg = err instanceof Error ? `${err.message}\n${err.stack || ''}` : String(err);
                    console.error("❌ Chat API 错误:", errMsg);
                    res.writeHead(500, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
            return;
        }

        // ====== User Input API：用户回复AI的追问 ======
        if (pathname === "/api/user-input" && req.method === "POST") {
            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", () => {
                try {
                    const { input } = JSON.parse(body);
                    if (pendingUserInputResolve) {
                        pendingUserInputResolve(input);
                        res.writeHead(200, {
                            "Content-Type": "application/json",
                        });
                        res.end(JSON.stringify({ success: true }));
                    } else {
                        res.writeHead(400, {
                            "Content-Type": "application/json",
                        });
                        res.end(
                            JSON.stringify({
                                error: "没有待处理的用户输入请求",
                            }),
                        );
                    }
                } catch (err: any) {
                    console.error("❌ User Input API 错误:", err instanceof Error ? err.message : String(err));
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
            return;
        }

        // ====== 前端页面 ======
        if (pathname === "/" || pathname === "/index.html") {
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(getHTMLPage());
            return;
        }

        // ====== 404 ======
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not Found" }));
    } catch (err: any) {
        const errMsg = err instanceof Error ? `${err.message}\n${err.stack || ''}` : String(err);
        console.error("❌ 服务器错误:", errMsg);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
    }
});

server.listen(PORT, () => {
    _log("\n" + "=".repeat(50));
    _log("  🐑 SheepKing Web Chat Server");
    _log(`  🌐 访问地址: http://localhost:${PORT}`);
    _log("  💬 在浏览器中和 AI 对话吧！");
    _log("  📋 控制台日志将实时展示在页面上");
    _log("=".repeat(50) + "\n");
});

// ============================================================
// 6️⃣ 前端 HTML 页面（内嵌在服务中，单文件自包含）
// ============================================================

function getHTMLPage(): string {
    // 注意：此处使用普通字符串拼接，避免与外层模板字符串的反引号冲突
    var h = "";
    h += "<!DOCTYPE html>";
    h += '<html lang="zh-CN">';
    h += "<head>";
    h += '<meta charset="UTF-8" />';
    h +=
        '<meta name="viewport" content="width=device-width, initial-scale=1.0" />';
    h += "<title>🐑 SheepKing AI Chat</title>";
    h += "<style>";
    h += "*{margin:0;padding:0;box-sizing:border-box}";

    // ====== CSS 变量定义：6个浅色系主题 ======
    h += "/* Light (浅色默认) */";
    h += '[data-theme="light"]{';
    h += "--bg-primary:#f5f5f5;";
    h += "--bg-secondary:#ffffff;";
    h += "--bg-tertiary:#e8e8e8;";
    h += "--text-primary:#1a1a2e;";
    h += "--text-secondary:#555555;";
    h += "--text-tertiary:#999999;";
    h += "--border-color:#e0e0e0;";
    h += "--accent-blue:#4a90d9;";
    h += "--accent-green:#7ec8a3;";
    h += "--msg-user-bg:linear-gradient(135deg,#4a90d9,#6ab0f7);";
    h += "--msg-ai-bg:#ffffff;";
    h += "--msg-ai-border:#e0e0e0;";
    h += "--header-bg:linear-gradient(135deg,#e8e8f0,#d5d5e8);";
    h += "--input-bg:#ffffff;";
    h += "--title-gradient:linear-gradient(90deg,#4a90d9,#7ec8a3);";
    h += "--status-dot:#7ec8a3;";
    h += "--log-level-warn:#d29922;";
    h += "--log-level-error:#f85149;";
    h += "--modal-overlay:rgba(0,0,0,0.4);";
    h += "--modal-shadow:0 20px 60px rgba(0,0,0,0.12);";
    h += "--scrollbar-thumb:#d0d0d0;";
    h += "--scrollbar-thumb-hover:#b0b0b0;";
    h += "--btn-hover-shadow:0 4px 12px rgba(74,144,217,0.4);";
    h += "--theme-dot-color:#4a90d9;";
    h += "}";

    h += "/* Light Green (浅绿色) */";
    h += '[data-theme="light-green"]{';
    h += "--bg-primary:#f0f7f0;";
    h += "--bg-secondary:#ffffff;";
    h += "--bg-tertiary:#ddeedd;";
    h += "--text-primary:#2d3e2d;";
    h += "--text-secondary:#5a7a5a;";
    h += "--text-tertiary:#8aaa8a;";
    h += "--border-color:#c8e6c9;";
    h += "--accent-blue:#66bb6a;";
    h += "--accent-green:#81c784;";
    h += "--msg-user-bg:linear-gradient(135deg,#66bb6a,#a5d6a7);";
    h += "--msg-ai-bg:#ffffff;";
    h += "--msg-ai-border:#c8e6c9;";
    h += "--header-bg:linear-gradient(135deg,#e8f5e9,#c8e6c9);";
    h += "--input-bg:#ffffff;";
    h += "--title-gradient:linear-gradient(90deg,#66bb6a,#81c784);";
    h += "--status-dot:#81c784;";
    h += "--log-level-warn:#d29922;";
    h += "--log-level-error:#f85149;";
    h += "--modal-overlay:rgba(0,0,0,0.3);";
    h += "--modal-shadow:0 20px 60px rgba(0,0,0,0.1);";
    h += "--scrollbar-thumb:#c8e6c9;";
    h += "--scrollbar-thumb-hover:#a5d6a7;";
    h += "--btn-hover-shadow:0 4px 12px rgba(102,187,106,0.4);";
    h += "--theme-dot-color:#66bb6a;";
    h += "}";

    h += "/* Light Pink (浅粉色) */";
    h += '[data-theme="light-pink"]{';
    h += "--bg-primary:#fdf0f5;";
    h += "--bg-secondary:#ffffff;";
    h += "--bg-tertiary:#f5dde6;";
    h += "--text-primary:#4a2d3e;";
    h += "--text-secondary:#8a5a7a;";
    h += "--text-tertiary:#ba8aaa;";
    h += "--border-color:#f8bbd0;";
    h += "--accent-blue:#f06292;";
    h += "--accent-green:#f48fb1;";
    h += "--msg-user-bg:linear-gradient(135deg,#f06292,#f48fb1);";
    h += "--msg-ai-bg:#ffffff;";
    h += "--msg-ai-border:#f8bbd0;";
    h += "--header-bg:linear-gradient(135deg,#fce4ec,#f8bbd0);";
    h += "--input-bg:#ffffff;";
    h += "--title-gradient:linear-gradient(90deg,#f06292,#f48fb1);";
    h += "--status-dot:#f48fb1;";
    h += "--log-level-warn:#d29922;";
    h += "--log-level-error:#f85149;";
    h += "--modal-overlay:rgba(0,0,0,0.3);";
    h += "--modal-shadow:0 20px 60px rgba(0,0,0,0.1);";
    h += "--scrollbar-thumb:#f8bbd0;";
    h += "--scrollbar-thumb-hover:#f48fb1;";
    h += "--btn-hover-shadow:0 4px 12px rgba(240,98,146,0.4);";
    h += "--theme-dot-color:#f06292;";
    h += "}";

    h += "/* Light Blue (浅蓝色) */";
    h += '[data-theme="light-blue"]{';
    h += "--bg-primary:#f0f5fd;";
    h += "--bg-secondary:#ffffff;";
    h += "--bg-tertiary:#dde6f5;";
    h += "--text-primary:#2d3e4a;";
    h += "--text-secondary:#5a7a8a;";
    h += "--text-tertiary:#8aaaba;";
    h += "--border-color:#bbdefb;";
    h += "--accent-blue:#42a5f5;";
    h += "--accent-green:#64b5f6;";
    h += "--msg-user-bg:linear-gradient(135deg,#42a5f5,#90caf9);";
    h += "--msg-ai-bg:#ffffff;";
    h += "--msg-ai-border:#bbdefb;";
    h += "--header-bg:linear-gradient(135deg,#e3f2fd,#bbdefb);";
    h += "--input-bg:#ffffff;";
    h += "--title-gradient:linear-gradient(90deg,#42a5f5,#64b5f6);";
    h += "--status-dot:#64b5f6;";
    h += "--log-level-warn:#d29922;";
    h += "--log-level-error:#f85149;";
    h += "--modal-overlay:rgba(0,0,0,0.3);";
    h += "--modal-shadow:0 20px 60px rgba(0,0,0,0.1);";
    h += "--scrollbar-thumb:#bbdefb;";
    h += "--scrollbar-thumb-hover:#90caf9;";
    h += "--btn-hover-shadow:0 4px 12px rgba(66,165,245,0.4);";
    h += "--theme-dot-color:#42a5f5;";
    h += "}";

    h += "/* Light Purple (浅紫色) */";
    h += '[data-theme="light-purple"]{';
    h += "--bg-primary:#f5f0fd;";
    h += "--bg-secondary:#ffffff;";
    h += "--bg-tertiary:#e5ddf5;";
    h += "--text-primary:#3d2d4a;";
    h += "--text-secondary:#7a5a8a;";
    h += "--text-tertiary:#aa8aba;";
    h += "--border-color:#d1c4e9;";
    h += "--accent-blue:#9575cd;";
    h += "--accent-green:#b39ddb;";
    h += "--msg-user-bg:linear-gradient(135deg,#9575cd,#b39ddb);";
    h += "--msg-ai-bg:#ffffff;";
    h += "--msg-ai-border:#d1c4e9;";
    h += "--header-bg:linear-gradient(135deg,#ede7f6,#d1c4e9);";
    h += "--input-bg:#ffffff;";
    h += "--title-gradient:linear-gradient(90deg,#9575cd,#b39ddb);";
    h += "--status-dot:#b39ddb;";
    h += "--log-level-warn:#d29922;";
    h += "--log-level-error:#f85149;";
    h += "--modal-overlay:rgba(0,0,0,0.3);";
    h += "--modal-shadow:0 20px 60px rgba(0,0,0,0.1);";
    h += "--scrollbar-thumb:#d1c4e9;";
    h += "--scrollbar-thumb-hover:#b39ddb;";
    h += "--btn-hover-shadow:0 4px 12px rgba(149,117,205,0.4);";
    h += "--theme-dot-color:#9575cd;";
    h += "}";

    h += "/* Light Yellow (淡黄色) */";
    h += '[data-theme="light-yellow"]{';
    h += "--bg-primary:#fef9e7;";
    h += "--bg-secondary:#ffffff;";
    h += "--bg-tertiary:#fdf2d6;";
    h += "--text-primary:#5a4a2a;";
    h += "--text-secondary:#9a7a4a;";
    h += "--text-tertiary:#baaa7a;";
    h += "--border-color:#f0e0b0;";
    h += "--accent-blue:#d4a843;";
    h += "--accent-green:#e6c76a;";
    h += "--msg-user-bg:linear-gradient(135deg,#d4a843,#f0d68a);";
    h += "--msg-ai-bg:#ffffff;";
    h += "--msg-ai-border:#f0e0b0;";
    h += "--header-bg:linear-gradient(135deg,#fef5e7,#fdebd0);";
    h += "--input-bg:#ffffff;";
    h += "--title-gradient:linear-gradient(90deg,#d4a843,#e6c76a);";
    h += "--status-dot:#e6c76a;";
    h += "--log-level-warn:#d29922;";
    h += "--log-level-error:#f85149;";
    h += "--modal-overlay:rgba(0,0,0,0.3);";
    h += "--modal-shadow:0 20px 60px rgba(0,0,0,0.1);";
    h += "--scrollbar-thumb:#f0e0b0;";
    h += "--scrollbar-thumb-hover:#e6c76a;";
    h += "--btn-hover-shadow:0 4px 12px rgba(212,168,67,0.4);";
    h += "--theme-dot-color:#d4a843;";
    h += "}";

    // ====== 平滑过渡 ======
    h += "html{transition:background-color 0.3s ease}";
    h += "body{transition:background-color 0.3s ease,color 0.3s ease}";

    // ====== 基础样式（使用CSS变量） ======
    h +=
        'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans SC",sans-serif;background:var(--bg-primary);color:var(--text-primary);height:100vh;display:flex;flex-direction:column;overflow:hidden}';
    h +=
        ".header{background:var(--header-bg);padding:16px 24px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}";
    h +=
        ".header h1{font-size:20px;font-weight:600;background:var(--title-gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent}";
    h +=
        ".header .status{display:flex;align-items:center;gap:12px;font-size:13px;color:var(--text-secondary)}";
    h +=
        ".header .status-dot{width:10px;height:10px;border-radius:50%;background:var(--status-dot);animation:pulse 2s infinite}";
    h += "@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}";
    h +=
        ".header .badge{font-size:11px;background:var(--bg-tertiary);padding:2px 8px;border-radius:12px;color:var(--text-secondary);border:1px solid var(--border-color)}";

    // ====== 主题选择器样式 ======
    h +=
        ".theme-selector{display:flex;align-items:center;gap:6px;margin-left:12px}";
    h +=
        ".theme-selector .theme-label{font-size:11px;color:var(--text-secondary);margin-right:2px}";
    h +=
        ".theme-dot{width:18px;height:18px;border-radius:50%;border:2px solid var(--border-color);cursor:pointer;transition:all 0.25s ease;position:relative;display:inline-block}";
    h +=
        ".theme-dot:hover{transform:scale(1.2);border-color:var(--text-secondary)}";
    h +=
        ".theme-dot.active{border-color:var(--text-primary);transform:scale(1.15);box-shadow:0 0 0 2px var(--bg-secondary),0 0 0 4px var(--accent-blue)}";
    h +=
        '.theme-dot[data-theme="light"]{background:#f5f5f5}';
    h +=
        '.theme-dot[data-theme="light-green"]{background:#81c784}';
    h +=
        '.theme-dot[data-theme="light-pink"]{background:#f48fb1}';
    h +=
        '.theme-dot[data-theme="light-blue"]{background:#64b5f6}';
    h +=
        '.theme-dot[data-theme="light-yellow"]{background:#e6c76a}';
    h +=
        '.theme-dot[data-theme="light-purple"]{background:#b39ddb}';
    h +=
        ".theme-dot .tooltip{visibility:hidden;opacity:0;position:absolute;top:calc(100% + 6px);left:50%;transform:translateX(-50%);background:var(--bg-secondary);color:var(--text-primary);font-size:10px;padding:3px 8px;border-radius:6px;border:1px solid var(--border-color);white-space:nowrap;transition:all 0.2s ease;z-index:100;pointer-events:none}";
    h +=
        ".theme-dot:hover .tooltip{visibility:visible;opacity:1}";

    // ====== 主布局 ======
    h += ".main-container{display:flex;flex:1;overflow:hidden}";
    h +=
        ".chat-panel{flex:1;display:flex;flex-direction:column;min-width:0;border-right:1px solid var(--border-color)}";
    h +=
        ".chat-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px}";
    h +=
        ".chat-messages .empty-hint{text-align:center;color:var(--text-tertiary);margin-top:80px;font-size:15px;line-height:2}";
    h +=
        ".chat-messages .empty-hint .big{font-size:48px;display:block;margin-bottom:16px}";
    h +=
        ".message{max-width:85%;padding:12px 16px;border-radius:16px;line-height:1.6;font-size:14px;word-break:break-word;white-space:pre-wrap;animation:fadeIn 0.3s ease}";
    h +=
        "@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}";
    h +=
        ".message.user{align-self:flex-end;background:var(--msg-user-bg);color:#fff;border-bottom-right-radius:4px}";
    h +=
        ".message.ai{align-self:flex-start;background:var(--msg-ai-bg);color:var(--text-primary);border:1px solid var(--msg-ai-border);border-bottom-left-radius:4px}";
    h +=
        ".message .msg-label{font-size:11px;font-weight:600;margin-bottom:6px;opacity:0.7;text-transform:uppercase;letter-spacing:0.5px}";
    h +=
        ".message .msg-time{font-size:11px;opacity:0.5;margin-top:8px;text-align:right;color:var(--text-tertiary)}";
    h += ".message.ai .msg-label{color:var(--accent-green)}";
    h += ".message.user .msg-label{color:rgba(255,255,255,0.7)}";
    h +=
        ".chat-input-area{padding:16px 20px;border-top:1px solid var(--border-color);background:var(--bg-primary);display:flex;gap:12px;align-items:flex-end;flex-shrink:0}";
    h +=
        ".chat-input-area textarea{flex:1;background:var(--input-bg);border:1px solid var(--border-color);border-radius:12px;padding:12px 16px;color:var(--text-primary);font-size:14px;font-family:inherit;resize:none;min-height:48px;max-height:120px;outline:none;transition:border-color 0.2s}";
    h += ".chat-input-area textarea:focus{border-color:var(--accent-blue)}";
    h += ".chat-input-area textarea::placeholder{color:var(--text-tertiary)}";
    h +=
        ".chat-input-area button{background:var(--msg-user-bg);color:#fff;border:none;border-radius:12px;padding:12px 24px;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.2s;white-space:nowrap;height:48px}";
    h +=
        ".chat-input-area button:hover:not(:disabled){transform:translateY(-1px);box-shadow:var(--btn-hover-shadow)}";
    h += ".chat-input-area button:disabled{opacity:0.5;cursor:not-allowed}";
    h +=
        ".chat-input-area button.loading{background:var(--bg-tertiary);pointer-events:none;color:var(--text-secondary)}";
    h +=
        ".console-panel{width:420px;display:flex;flex-direction:column;background:var(--bg-primary);flex-shrink:0}";
    h +=
        ".console-header{padding:12px 16px;border-bottom:1px solid var(--border-color);font-size:13px;font-weight:600;color:var(--text-secondary);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}";
    h += ".console-header .console-actions{display:flex;gap:8px}";
    h +=
        ".console-header .console-actions button{background:var(--bg-tertiary);border:1px solid var(--border-color);color:var(--text-secondary);padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer;transition:all 0.2s}";
    h +=
        ".console-header .console-actions button:hover{background:var(--border-color);color:var(--text-primary)}";
    h +=
        '.console-logs{flex:1;overflow-y:auto;padding:8px 0;font-family:"JetBrains Mono","Fira Code","Cascadia Code","Consolas",monospace;font-size:12px;line-height:1.6}';
    h +=
        ".console-logs .log-entry{padding:4px 16px;border-bottom:1px solid var(--border-color);animation:logFade 0.2s ease}";
    h +=
        "@keyframes logFade{from{opacity:0;background:rgba(0,0,0,0.03)}to{opacity:1;background:transparent}}";
    h +=
        ".console-logs .log-entry .log-time{color:var(--text-tertiary);margin-right:8px;font-size:11px}";
    h +=
        ".console-logs .log-entry .log-level{display:inline-block;width:44px;font-weight:600;font-size:11px;text-transform:uppercase}";
    h += ".console-logs .log-entry.log-level-log .log-level{color:var(--text-secondary)}";
    h += ".console-logs .log-entry.log-level-warn .log-level{color:var(--log-level-warn)}";
    h += ".console-logs .log-entry.log-level-error .log-level{color:var(--log-level-error)}";
    h += ".console-logs .log-entry .log-msg{color:var(--text-primary)}";
    h +=
        ".console-logs .log-entry.log-level-error{background:color-mix(in srgb,var(--log-level-error) 8%,transparent)}";
    h +=
        ".console-logs .log-entry.log-level-warn{background:color-mix(in srgb,var(--log-level-warn) 8%,transparent)}";
    h +=
        ".console-footer{padding:8px 16px;border-top:1px solid var(--border-color);font-size:11px;color:var(--text-tertiary);text-align:right;flex-shrink:0}";
    // 模态框样式
    h +=
        ".modal-overlay{display:none;position:fixed;inset:0;background:var(--modal-overlay);backdrop-filter:blur(4px);z-index:1000;align-items:center;justify-content:center}";
    h += ".modal-overlay.active{display:flex}";
    h +=
        ".modal-box{background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:16px;padding:28px 32px 24px;max-width:480px;width:90%;box-shadow:var(--modal-shadow);animation:modalIn 0.25s ease}";
    h +=
        "@keyframes modalIn{from{transform:scale(0.9);opacity:0}to{transform:scale(1);opacity:1}}";
    h += ".modal-box h3{font-size:15px;margin-bottom:8px;color:var(--text-primary)}";
    h +=
        ".modal-box p{font-size:14px;color:var(--text-secondary);margin-bottom:16px;line-height:1.5}";
    h +=
        ".modal-box input{width:100%;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:8px;padding:10px 14px;color:var(--text-primary);font-size:14px;outline:none;margin-bottom:12px}";
    h += ".modal-box input:focus{border-color:var(--accent-blue)}";
    h +=
        ".modal-box .modal-actions{display:flex;gap:8px;justify-content:flex-end}";
    h +=
        ".modal-box .modal-actions button{padding:8px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:all 0.2s}";
    h +=
        ".modal-box .modal-actions .btn-cancel{background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-color)}";
    h += ".modal-box .modal-actions .btn-cancel:hover{background:var(--border-color)}";
    h +=
        ".modal-box .modal-actions .btn-submit{background:var(--msg-user-bg);color:#fff}";
    h +=
        ".modal-box .modal-actions .btn-submit:hover{box-shadow:var(--btn-hover-shadow)}";
    h += "::-webkit-scrollbar{width:6px;height:6px}";
    h += "::-webkit-scrollbar-track{background:transparent}";
    h += "::-webkit-scrollbar-thumb{background:var(--scrollbar-thumb);border-radius:3px}";
    h += "::-webkit-scrollbar-thumb:hover{background:var(--scrollbar-thumb-hover)}";
    h +=
        "@media(max-width:768px){.main-container{flex-direction:column}.console-panel{width:100%;height:40vh;border-top:1px solid var(--border-color)}.chat-panel{height:60vh}}";
    h += "</style>";
    h += "</head>";
    // 默认使用 light 主题
    h += '<body data-theme="light">';

    // ---- 顶部栏 ----
    h += '<header class="header">';
    h += "<h1>\u{1F411} SheepKing AI Chat</h1>";
    h += '<div class="status">';
    h += '<span class="status-dot"></span><span>\u5DF2\u8FDE\u63A5</span><span class="badge">OrchestratorCodeAgent</span>';

    // ---- 主题选择器 ----
    h += '<div class="theme-selector">';
    h += '<span class="theme-label">\u4E3B\u9898</span>';
    h +=
        '<span class="theme-dot active" data-theme="light" onclick="setTheme(\'light\')" title="\u6D45\u8272\u9ED8\u8BA4"><span class="tooltip">\u6D45\u8272\u9ED8\u8BA4</span></span>';
    h +=
        '<span class="theme-dot" data-theme="light-green" onclick="setTheme(\'light-green\')" title="\u6D45\u7EFF\u8272"><span class="tooltip">\u6D45\u7EFF\u8272</span></span>';
    h +=
        '<span class="theme-dot" data-theme="light-pink" onclick="setTheme(\'light-pink\')" title="\u6D45\u7C89\u8272"><span class="tooltip">\u6D45\u7C89\u8272</span></span>';
    h +=
        '<span class="theme-dot" data-theme="light-blue" onclick="setTheme(\'light-blue\')" title="\u6D45\u84DD\u8272"><span class="tooltip">\u6D45\u84DD\u8272</span></span>';
    h +=
        '<span class="theme-dot" data-theme="light-yellow" onclick="setTheme(\'light-yellow\')" title="\u6D45\u9EC4\u8272"><span class="tooltip">\u6D45\u9EC4\u8272</span></span>';
    h +=
        '<span class="theme-dot" data-theme="light-purple" onclick="setTheme(\'light-purple\')" title="\u6D45\u7D2B\u8272"><span class="tooltip">\u6D45\u7D2B\u8272</span></span>';
    h += "</div>";

    h += "</div>"; // end .status
    h += "</header>";

    // ---- 主区域 ----
    h += '<div class="main-container">';

    // 左侧：对话面板
    h += '<div class="chat-panel">';
    h += '<div class="chat-messages" id="chatMessages">';
    h +=
        '<div class="empty-hint"><span class="big">\u{1F411}</span>\u5F00\u59CB\u548C AI \u5BF9\u8BDD\u5427!<br/>\u5728\u4E0B\u65B9\u8F93\u5165\u4F60\u7684\u95EE\u9898\uFF0CAI \u4F1A\u81EA\u52A8\u8C03\u5EA6\u5408\u9002\u7684\u6280\u80FD\u6765\u5904\u7406\u3002</div>';
    h += "</div>";
    h += '<div class="chat-input-area">';
    h +=
        '<textarea id="chatInput" placeholder="\u8F93\u5165\u4F60\u7684\u95EE\u9898..." rows="1" oninput="autoResize(this)" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();sendMessage()}"></textarea>';
    h += '<button id="sendBtn" onclick="sendMessage()">\u53D1\u9001</button>';
    h += "</div>";
    h += "</div>";

    // 右侧：控制台日志
    h += '<div class="console-panel">';
    h +=
        '<div class="console-header"><span>\u{1F4CB} \u63A7\u5236\u53F0\u65E5\u5FD7</span>';
    h +=
        '<div class="console-actions"><button onclick="clearLogs()">\u6E05\u7A7A</button><button onclick="toggleAutoScroll()" id="autoScrollBtn">\u81EA\u52A8\u6EDA\u52A8 \u2713</button></div>';
    h += "</div>";
    h += '<div class="console-logs" id="consoleLogs"></div>';
    h +=
        '<div class="console-footer" id="logCount">\u5171 0 \u6761\u65E5\u5FD7</div>';
    h += "</div>";

    h += "</div>"; // end main-container

    // ---- AI追问模态框 ----
    h += '<div class="modal-overlay" id="askModal">';
    h += '<div class="modal-box">';
    h += "<h3>\u{1F916} AI \u60F3\u95EE\u60A8\u4E00\u4E2A\u95EE\u9898</h3>";
    h += '<p id="askQuestion">\u8BF7\u7A0D\u5019...</p>';
    h +=
        '<input type="text" id="askInput" placeholder="\u8BF7\u8F93\u5165\u4F60\u7684\u56DE\u7B54..." />';
    h += '<div class="modal-actions">';
    h +=
        '<button class="btn-cancel" onclick="cancelAsk()">\u8DF3\u8FC7</button>';
    h +=
        '<button class="btn-submit" onclick="submitAsk()">\u63D0\u4EA4</button>';
    h += "</div>";
    h += "</div>";
    h += "</div>";

    // ---- JavaScript ----
    h += "<script>";
    // ====== 主题切换函数 ======
    h += "function setTheme(themeName){";
    h += 'document.documentElement.setAttribute("data-theme",themeName);';
    h += 'document.body.setAttribute("data-theme",themeName);';
    // 更新主题圆点高亮
    h += 'var dots=document.querySelectorAll(".theme-dot");';
    h += "for(var i=0;i<dots.length;i++){";
    h += "dots[i].classList.remove(\"active\");";
    h += 'if(dots[i].getAttribute("data-theme")===themeName){';
    h += "dots[i].classList.add(\"active\");";
    h += "}";
    h += "}";
    // 保存选择到localStorage
    h += 'try{localStorage.setItem("chat-theme",themeName)}catch(e){}';
    h += "}";

    // ====== 加载保存的主题 ======
    h += "try{";
    h += 'var savedTheme=localStorage.getItem("chat-theme");';
    h += "if(savedTheme){setTheme(savedTheme)}";
    h += "}catch(e){}";

    h +=
        'function autoResize(el){el.style.height="auto";el.style.height=Math.min(el.scrollHeight,120)+"px"}';
    h += 'var cm=document.getElementById("chatMessages");';
    h += 'var ci=document.getElementById("chatInput");';
    h += 'var sb=document.getElementById("sendBtn");';
    h += 'var cl=document.getElementById("consoleLogs");';
    h += 'var lc=document.getElementById("logCount");';
    h += 'var am=document.getElementById("askModal");';
    h += 'var aq=document.getElementById("askQuestion");';
    h += 'var ai=document.getElementById("askInput");';
    h += "var sending=false,autoScr=true,logCnt=0;";

    // SSE连接
    h += "function connectSSE(){";
    h += 'var es=new EventSource("/api/stream");';
    h += 'es.addEventListener("connected",function(){console.log("SSE OK")});';
    h +=
        'es.addEventListener("console",function(e){try{addLog(JSON.parse(e.data))}catch(_){}});';
    h +=
        'es.addEventListener("ask_user",function(e){try{var d=JSON.parse(e.data);showModal(d.question)}catch(_){}});';
    h += "es.onerror=function(){setTimeout(connectSSE,3000)}";
    h += "}";

    // 添加日志
    h += "function addLog(d){";
    h += 'var t=d.timestamp?new Date(d.timestamp).toLocaleTimeString():"";';
    h += "logCnt++;";
    h += 'var el=document.createElement("div");';
    h += 'el.className="log-entry log-level-"+d.level;';
    h +=
        'el.innerHTML="<span class=\\"log-time\\">"+t+"</span><span class=\\"log-level\\">["+d.level+"]</span><span class=\\"log-msg\\">"+esc(d.message)+"</span>";';
    h += "cl.appendChild(el);";
    h += 'lc.textContent="\u5171 "+logCnt+" \u6761\u65E5\u5FD7";';
    h += "if(autoScr)cl.scrollTop=cl.scrollHeight";
    h += "}";

    h +=
        'function clearLogs(){cl.innerHTML="";logCnt=0;lc.textContent="\u5171 0 \u6761\u65E5\u5FD7"}';
    h +=
        'function toggleAutoScroll(){autoScr=!autoScr;document.getElementById("autoScrollBtn").textContent=autoScr?"\u81EA\u52A8\u6EDA\u52A8 \u2713":"\u81EA\u52A8\u6EDA\u52A8 \u2717"}';

    // HTML转义
    h +=
        'function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML}';

    // 模态框
    h +=
        'function showModal(q){aq.textContent=q;ai.value="";am.classList.add("active");setTimeout(function(){ai.focus()},100)}';
    h +=
        'function cancelAsk(){am.classList.remove("active");fetch("/api/user-input",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input:"\u7528\u6237\u53D6\u6D88\u4E86\u8F93\u5165"})}).catch(function(){})}';
    h +=
        'function submitAsk(){var v=ai.value.trim()||"(\u7A7A)";am.classList.remove("active");addMsg("user","[\u56DE\u7B54AI\u8FFD\u95EE] "+v);fetch("/api/user-input",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input:v})}).catch(function(){})}';
    h +=
        'ai.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();submitAsk()}});';

    // 添加消息
    h += "function addMsg(role,content){";
    h += 'var hint=cm.querySelector(".empty-hint");if(hint)hint.remove();';
    h += "var now=new Date().toLocaleTimeString();";
    h += 'var div=document.createElement("div");';
    h += 'div.className="message "+role;';
    h +=
        'div.innerHTML="<div class=\\"msg-label\\">"+(role==="user"?"\u{1F9D1} \u4F60":"\u{1F411} AI")+"</div>"+esc(content)+"<div class=\\"msg-time\\">"+now+"</div>";';
    h += "cm.appendChild(div);cm.scrollTop=cm.scrollHeight";
    h += "}";

    // 发送消息
    h += "async function sendMessage(){";
    h += "var msg=ci.value.trim();if(!msg||sending)return;";
    h += 'addMsg("user",msg);ci.value="";ci.style.height="auto";';
    h +=
        'sending=true;sb.disabled=true;sb.textContent="AI \u601D\u8003\u4E2D...";sb.classList.add("loading");';
    h += "try{";
    h +=
        'var res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:msg})});';
    h +=
        'if(!res.ok)throw new Error((await res.json()).error||"\u8BF7\u6C42\u5931\u8D25");';
    h +=
        'var data=await res.json();addMsg("ai",data.output||"(\u65E0\u8FD4\u56DE\u7ED3\u679C)")';
    h += '}catch(e){addMsg("ai","\u274C "+e.message)}';
    h +=
        'finally{sending=false;sb.disabled=false;sb.textContent="\u53D1\u9001";sb.classList.remove("loading");ci.focus()}';
    h += "}";

    h += "connectSSE();ci.focus();";
    h += "<\/script>";
    h += "</body>";
    h += "</html>";

    return h;
}
