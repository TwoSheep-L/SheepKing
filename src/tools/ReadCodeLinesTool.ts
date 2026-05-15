import { AgentTool } from "@/core/BaseAgentTool.js";
import { log } from "@clack/prompts";
import fs from "fs";

interface IReadCodeLinesParams {
    path: string;
    startLine: number;
    endLine: number;
}

export default class ReadCodeLinesTool extends AgentTool<IReadCodeLinesParams> {
    constructor() {
        super({
            name: "ReadCodeLinesTool",
            description:
                "按行号范围读取文件的指定代码行，可有效减少上下文占用空间。支持读取文件的任意行区间，返回时自动标注行号。",
            parameters: [
                {
                    name: "path",
                    type: "string",
                    description: "文件路径（绝对路径或相对当前工作目录的路径）",
                    required: true,
                },
                {
                    name: "startLine",
                    type: "number",
                    description: "起始行号（从1开始，包含该行）",
                    required: true,
                },
                {
                    name: "endLine",
                    type: "number",
                    description:
                        "结束行号（包含该行，如果超出文件总行数则自动截断）",
                    required: true,
                },
            ],
        });
    }

    async execute(params: IReadCodeLinesParams): Promise<string> {
        const { path: filePath, startLine, endLine } = params;
        log.info(`读取代码行 ${filePath} [${startLine}-${endLine}] `);

        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            return `[错误] 文件不存在: ${filePath}`;
        }

        // 读取文件内容
        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n");
        const totalLines = lines.length;

        // 参数校验
        const validStartLine = Math.max(1, Math.floor(startLine));
        const validEndLine = Math.min(totalLines, Math.floor(endLine));

        if (validStartLine > totalLines) {
            return `[错误] 起始行号 ${startLine} 超出文件总行数 ${totalLines}`;
        }

        if (validStartLine > validEndLine) {
            return `[错误] 起始行号 ${validStartLine} 不能大于结束行号 ${validEndLine}`;
        }

        // 提取指定行（转为0-based索引）
        const selectedLines = lines.slice(validStartLine - 1, validEndLine);

        // 构建返回内容
        let result = `📄 文件: ${filePath}\n`;
        result += `📊 文件总行数: ${totalLines} 行\n`;
        result += `🔍 读取范围: 第 ${validStartLine} 行 ~ 第 ${validEndLine} 行 (共 ${validEndLine - validStartLine + 1} 行)\n`;
        result += `${"─".repeat(60)}\n\n`;

        // 带行号输出
        const lineNumberWidth = String(validEndLine).length;
        selectedLines.forEach((line, index) => {
            const lineNumber = validStartLine + index;
            const lineNumStr = String(lineNumber).padStart(
                lineNumberWidth,
                " ",
            );
            result += ` ${lineNumStr} | ${line}\n`;
        });

        // 显示截断标记
        if (validStartLine > 1 && validEndLine < totalLines) {
            result += `\n${"─".repeat(60)}\n`;
            result += `💡 提示: 文件共有 ${totalLines} 行，当前仅读取了第 ${validStartLine}-${validEndLine} 行。`;
            result += ` 如需读取其他行，请再次调用 ReadCodeLinesTool 指定不同的行号范围。\n`;
        } else if (validStartLine > 1) {
            result += `\n${"─".repeat(60)}\n`;
            result += `💡 提示: 文件共有 ${totalLines} 行，当前读取了第 ${validStartLine} 行至末尾。`;
            result += ` 如需读取开头部分，请指定较小的行号范围。\n`;
        } else if (validEndLine < totalLines) {
            result += `\n${"─".repeat(60)}\n`;
            result += `💡 提示: 文件共有 ${totalLines} 行，当前仅读取了前 ${validEndLine} 行。`;
            result += ` 如需读取后续内容，请再次调用 ReadCodeLinesTool 指定更大的行号范围。\n`;
        }

        return result;
    }
}
