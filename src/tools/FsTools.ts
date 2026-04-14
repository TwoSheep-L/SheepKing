import { AgentTool } from "@/core/BaseAgentTool.js";
import { confirm, log } from "@clack/prompts";
import fs from "fs";
import path from "path";

interface IFsToolParams {
    path: string;
    action: string;
    content: string;
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

export default class FsTool extends AgentTool<IFsToolParams> {
    constructor() {
        super({
            name: "FsTool",
            description: "文件操作工具",
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
                        "操作类型 write, read, delete, exists, dir, mkdir, list, listDir, delete, treeList",
                    required: true,
                },
                {
                    name: "content",
                    type: "string",
                    description: "文件内容",
                    required: false,
                },
            ],
        });
    }

    async execute(params: IFsToolParams): Promise<string> {
        const { path: filePath, action, content } = params;
        log.info(`执行文件操作工具 [${action}]${filePath}`);

        if (action === "write") {
            fs.writeFileSync(filePath, content);
            if (!fs.existsSync(filePath)) {
                return "[后置检测]创建失败,执行写入命令后检测文件不存在";
            }
            return "文件写入成功";
        }

        if (action === "read") {
            return fs.readFileSync(filePath, "utf-8");
        }

        if (action === "exists") {
            return fs.existsSync(filePath) ? "文件存在" : "文件不存在";
        }

        if (action === "dir") {
            return fs.readdirSync(filePath).join(",");
        }

        if (action === "mkdir") {
            fs.mkdirSync(filePath);
            return "文件夹创建成功";
        }

        if (action === "list") {
            return fs.readdirSync(filePath).join(",");
        }

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

        if (action === "listDir") {
            return fs
                .readdirSync(filePath)
                .filter((item) =>
                    fs.statSync(filePath + "/" + item).isDirectory(),
                )
                .join(",");
        }

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

        return "";
    }
}
