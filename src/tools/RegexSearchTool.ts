import { AgentTool } from "@/core/BaseAgentTool.js";
import fs from "fs";
import path from "path";

interface IRegexSearchParams {
    directory: string;
    filePattern: string;
    searchType: "content" | "name";
    contentPattern?: string;
}

const DEFAULT_EXCLUDE = ["node_modules", ".git", "dist", ".next", ".cache", ".pnpm"];

/**
 * 递归遍历目录，获取所有文件路径
 */
function walkDir(dirPath: string): string[] {
    const results: string[] = [];
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
        return results;
    }

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            if (DEFAULT_EXCLUDE.includes(entry.name)) continue;
            results.push(...walkDir(fullPath));
        } else if (entry.isFile()) {
            results.push(fullPath);
        }
    }

    return results;
}

/**
 * 获取匹配行的上下共5行内容（包含匹配行本身，即匹配行前2行+匹配行+后2行）
 */
function getContextLines(lines: string[], matchIndex: number, contextRange: number = 2): { startLine: number; content: string } {
    const start = Math.max(0, matchIndex - contextRange);
    const end = Math.min(lines.length - 1, matchIndex + contextRange);
    const snippet = lines.slice(start, end + 1);
    const result = snippet.map((line, i) => {
        const lineNum = start + i + 1;
        const prefix = (start + i === matchIndex) ? ">" : " ";
        return `${prefix} ${lineNum}: ${line}`;
    }).join("\n");
    return { startLine: start + 1, content: result };
}

export default class RegexSearchTool extends AgentTool<IRegexSearchParams> {
    constructor() {
        super({
            name: "RegexSearchTool",
            description: "正则搜索工具：支持按文件名正则匹配查找文件，以及按文件内容正则匹配查找文件内容。可递归遍历目录，自动跳过 node_modules、.git 等目录。",
            parameters: [
                {
                    name: "directory",
                    type: "string",
                    description: "要搜索的目录路径（绝对路径或相对路径）",
                    required: true,
                },
                {
                    name: "filePattern",
                    type: "string",
                    description: "文件名匹配的正则表达式（如 '.*\\.ts$' 匹配所有ts文件，'.*' 匹配所有文件）",
                    required: true,
                },
                {
                    name: "searchType",
                    type: "string",
                    description: "搜索类型：'name' 为文件名查找（忽略 contentPattern），'content' 为内容查找（需要提供 contentPattern）",
                    required: true,
                },
                {
                    name: "contentPattern",
                    type: "string",
                    description: "内容匹配的正则表达式（仅在 searchType='content' 时使用），用于匹配文件中的文本内容",
                    required: false,
                },
            ],
        });
    }

    async execute(params: IRegexSearchParams): Promise<string> {
        const { directory, filePattern, searchType, contentPattern } = params;

        // 校验目录
        if (!fs.existsSync(directory)) {
            return `[错误] 目录不存在: ${directory}`;
        }
        if (!fs.statSync(directory).isDirectory()) {
            return `[错误] 路径不是目录: ${directory}`;
        }

        // 编译文件名正则
        let fileRegex: RegExp;
        try {
            fileRegex = new RegExp(filePattern);
        } catch (e) {
            return `[错误] 文件名正则表达式无效: ${filePattern}, 错误: ${e}`;
        }

        // 遍历目录获取所有文件
        const allFiles = walkDir(directory);

        // 按文件名正则过滤
        const matchedFiles = allFiles.filter((filePath) => {
            const fileName = path.basename(filePath);
            return fileRegex.test(fileName);
        });

        if (matchedFiles.length === 0) {
            return `在目录 ${directory} 中未找到文件名匹配正则 "${filePattern}" 的文件。`;
        }

        // ---- 文件名查找 ----
        if (searchType === "name") {
            const resultLines = matchedFiles.map((fp, i) => `${i + 1}. ${fp}`);
            return `🔍 文件名正则查找结果 (正则: ${filePattern})\n共找到 ${matchedFiles.length} 个匹配文件:\n\n${resultLines.join("\n")}`;
        }

        // ---- 内容查找 ----
        if (searchType === "content") {
            if (!contentPattern) {
                return `[错误] 内容查找模式需要提供 contentPattern 参数`;
            }

            let contentRegex: RegExp;
            try {
                contentRegex = new RegExp(contentPattern);
            } catch (e) {
                return `[错误] 内容正则表达式无效: ${contentPattern}, 错误: ${e}`;
            }

            const resultParts: string[] = [];
            let totalMatchFiles = 0;

            for (const filePath of matchedFiles) {
                let fileContent: string;
                try {
                    fileContent = fs.readFileSync(filePath, "utf-8");
                } catch {
                    continue; // 跳过无法读取的二进制文件等
                }

                const lines = fileContent.split("\n");
                const matchLines: number[] = [];

                for (let i = 0; i < lines.length; i++) {
                    if (contentRegex.test(lines[i])) {
                        matchLines.push(i);
                    }
                }

                if (matchLines.length > 0) {
                    totalMatchFiles++;
                    const fileBlocks: string[] = [];
                    for (const matchIdx of matchLines) {
                        const context = getContextLines(lines, matchIdx);
                        fileBlocks.push(context.content);
                    }
                    resultParts.push(
                        `━━━ 📄 ${filePath} (共 ${matchLines.length} 处匹配) ━━━\n${fileBlocks.join("\n---\n")}`
                    );
                }
            }

            if (totalMatchFiles === 0) {
                return `在目录 ${directory} 中，文件名匹配 "${filePattern}" 的文件里，未找到内容匹配正则 "${contentPattern}" 的结果。`;
            }

            return `🔍 内容正则查找结果\n正则: 文件名="${filePattern}" | 内容="${contentPattern}"\n共 ${totalMatchFiles} 个文件匹配\n\n${resultParts.join("\n\n")}`;
        }

        return `[错误] 不支持的搜索类型: ${searchType}，请使用 "name" 或 "content"`;
    }
}
