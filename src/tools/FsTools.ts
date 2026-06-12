import { AgentTool } from "@/core/BaseAgentTool.js";
import { confirm, log } from "@clack/prompts";
import fs from "fs";
import path from "path";
import { generateDiff, formatDiffForSSE } from "./DiffUtils.js";

interface IFsToolParams {
    path: string;
    action: string;
    content: string;
    lineNumber?: number;
}

interface TreeNode {
    name: string;
    type: "file" | "directory";
    path: string;
    children?: TreeNode[];
}

const DEFAULT_EXCLUDE = ["node_modules", ".git", "dist", ".next", ".cache"];

function getTree(dirPath: string, currentDepth: number = 0): TreeNode {
    const name = path.basename(dirPath);
    const node: TreeNode = {
        name,
        type: "directory",
        path: dirPath,
        children: [],
    };

    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
        return node;
    }

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            if (DEFAULT_EXCLUDE.includes(entry.name)) {
                node.children!.push({
                    name: entry.name,
                    type: "directory",
                    path: fullPath,
                    children: [],
                });
                continue;
            }
            node.children!.push(getTree(fullPath, currentDepth + 1));
        } else if (entry.isFile()) {
            node.children!.push({
                name: entry.name,
                type: "file",
                path: fullPath,
            });
        }
    }

    return node;
}

function formatTree(
    node: TreeNode,
    prefix: string = "",
    isLast: boolean = true,
): string {
    const connector = isLast ? "└── " : "├── ";
    const icon = node.type === "directory" ? "📁" : "📄";
    let result = `${prefix}${connector}${icon} ${node.name}\n`;

    if (node.children && node.children.length > 0) {
        const childPrefix = prefix + (isLast ? "    " : "│   ");
        node.children.forEach((child, index) => {
            const isLastChild = index === node.children!.length - 1;
            result += formatTree(child, childPrefix, isLastChild);
        });
    }

    return result;
}

/**
 * 尝试广播文件 diff 到前端（通过全局 broadcastDiff 函数）
 * 仅在 webChat server 环境下有效，CLI 模式下静默跳过
 * 增加了调试日志，便于排查广播未生效的问题
 */
function tryBroadcastDiff(diffData: Record<string, unknown>): void {
    try {
        const broadcastFn = (global as any).__broadcastDiff;
        if (typeof broadcastFn === 'function') {
            broadcastFn(diffData);
            // 注意：此处的 log 会通过 @clack/prompts 拦截，以 [Tool] 前缀显示在前端控制台
            // 真正的 file_diff SSE 事件由 __broadcastDiff 内的 broadcastSSE 发送
        } else {
            // CLI 模式下没有 broadcastDiff 是正常行为，但记录一条调试信息
            console.log("[FsTool] __broadcastDiff 未定义（CLI 模式），跳过 SSE 广播");
        }
    } catch (err) {
        // 即使是 server 模式，也要捕获错误避免影响文件操作
        console.error("[FsTool] broadcastDiff 调用失败:", err instanceof Error ? err.message : String(err));
    }
}

export default class FsTool extends AgentTool<IFsToolParams> {
    constructor() {
        super({
            name: "FsTool",
            description: "文件操作工具,务必传入文件的绝对路径",
            parameters: [
                {
                    name: "path",
                    type: "string",
                    description: "文件路径",
                    required: true,
                },
                {
                    name: "action",
                    type: "string",
                    description:
                        "操作类型 write, read, delete, exists, dir, mkdir, list, listDir, delete, treeList, insertLine",
                    required: true,
                },
                {
                    name: "content",
                    type: "string",
                    description: "文件内容",
                    required: false,
                },
                {
                    name: "lineNumber",
                    type: "number",
                    description: "行号，用于 insertLine 操作",
                    required: false,
                },
            ],
        });
    }

    async execute(params: IFsToolParams): Promise<string> {
        const { path: filePath, action, content, lineNumber } = params;
        log.info(`执行文件操作工具 [${action}]${filePath}`);

        // ===== write: 写入文件（带 diff 展示）=====
        if (action === "write") {
            // 读取旧文件内容（如果存在）
            let oldContent = "";
            let fileExists = false;
            try {
                if (fs.existsSync(filePath)) {
                    oldContent = fs.readFileSync(filePath, "utf-8");
                    fileExists = true;
                }
            } catch {
                // 读取失败视为无旧内容
            }

            // 执行写入
            fs.writeFileSync(filePath, content);

            // 后置检测
            if (!fs.existsSync(filePath)) {
                return "[后置检测]创建失败,执行写入命令后检测文件不存在";
            }

            // 生成并广播 diff
            const diff = generateDiff(
                filePath,
                "write",
                oldContent,
                content,
                !fileExists
            );

            // 通过 console.log 输出 diff 摘要（CLI 模式下可见，同时会在控制台面板展示）
            log.info(`📊 文件变更: +${diff.additions} / -${diff.deletions} 行`);

            // 广播 diff 到前端（SSE）- 前端 ChatPanel 会收到并展示 DiffView
            tryBroadcastDiff(formatDiffForSSE(diff));

            // 返回结果（包含 diff 文本，让 AI 也能感知到变更）
            return `文件写入成功\n${diff.text}`;
        }

        // ===== read: 读取文件 =====
        if (action === "read") {
            return fs.readFileSync(filePath, "utf-8");
        }

        // ===== exists: 检查文件是否存在 =====
        if (action === "exists") {
            return fs.existsSync(filePath) ? "文件存在" : "文件不存在";
        }

        // ===== dir: 读取目录列表 =====
        if (action === "dir") {
            return fs.readdirSync(filePath).join(",");
        }

        // ===== mkdir: 创建目录 =====
        if (action === "mkdir") {
            fs.mkdirSync(filePath);
            return "文件夹创建成功";
        }

        // ===== list: 读取目录列表 =====
        if (action === "list") {
            return fs.readdirSync(filePath).join(",");
        }

        // ===== treeList: 目录树 =====
        if (action === "treeList") {
            const tree = getTree(filePath);

            let output = `📁 ${tree.name}\n`;
            if (tree.children && tree.children.length > 0) {
                tree.children.forEach((child, index) => {
                    const isLast = index === tree.children!.length - 1;
                    output += formatTree(child, "", isLast);
                });
            }

            return output;
        }

        // ===== listDir: 仅列出子目录 =====
        if (action === "listDir") {
            return fs
                .readdirSync(filePath)
                .filter((item) =>
                    fs.statSync(filePath + "/" + item).isDirectory(),
                )
                .join(",");
        }

        // ===== delete: 删除文件/目录 =====
        if (action === "delete") {
            const userCheck = await confirm({
                message: `AI请求删除:${filePath} 是否要删除?`,
            });
            if (typeof userCheck === "symbol") {
                return "用户取消删除";
            } else {
                if (fs.statSync(filePath).isDirectory()) {
                    fs.rmdirSync(filePath, { recursive: true });
                } else {
                    fs.unlinkSync(filePath);
                }
                return "文件删除成功";
            }
        }

        // ===== insertLine: 在指定行插入内容（带 diff 展示）=====
        if (action === "insertLine") {
            // 读取旧内容
            const oldContent = fs.readFileSync(filePath, "utf-8");

            // 执行插入
            const fileContent = fs.readFileSync(filePath, "utf-8");
            const lines = fileContent.split("\n");
            const targetLine = lineNumber ?? lines.length + 1;

            if (targetLine < 1) {
                lines.unshift(content);
            } else if (targetLine > lines.length) {
                lines.push(content);
            } else {
                lines.splice(targetLine - 1, 0, content);
            }

            const newContent = lines.join("\n");
            fs.writeFileSync(filePath, newContent);

            // 生成并广播 diff
            const diff = generateDiff(
                filePath,
                "insertLine",
                oldContent,
                newContent
            );

            log.info(`📊 文件变更: +${diff.additions} / -${diff.deletions} 行`);
            tryBroadcastDiff(formatDiffForSSE(diff));

            return `行插入成功\n${diff.text}`;
        }

        return "";
    }
}
