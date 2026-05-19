import { AgentTool } from "@/core/BaseAgentTool.js";
import { log } from "@clack/prompts";
import { exec } from "child_process";

interface RunCommandParams {
    command: string;
    /** 执行命令的工作目录（对应参数 schema 中的 cwd） */
    cwd?: string;
    isAsync?: boolean;
}

/**
 * 将错误对象格式化为详细的错误信息字符串（包含 code/cmd/stack 等），
 * 让上层 AI Agent 能获取完整的错误上下文，从而做出正确的修复决策。
 */
function formatError(error: unknown): string {
    if (error instanceof Error) {
        const lines: string[] = [`执行命令失败: ${error.message}`];
        const err = error as any;
        if (err.code !== undefined) lines.push(`退出码: ${err.code}`);
        if (err.cmd) lines.push(`完整命令: ${err.cmd}`);
        if (err.killed !== undefined) lines.push(`killed: ${err.killed}`);
        if (err.signal) lines.push(`信号: ${err.signal}`);
        if (err.stderr) lines.push(`stderr: ${err.stderr}`);
        if (err.stdout) lines.push(`stdout: ${err.stdout}`);
        if (err.stack) lines.push(`堆栈:\n${err.stack}`);
        return lines.join("\n");
    }
    return `执行命令失败: ${String(error)}`;
}

/**
 * 执行终端命令（同步等待结果）
 * @param {string} command - 要执行的命令
 * @param {string} [cwd] - 执行命令的目录（可选，默认当前目录）
 * @returns {Promise<string>} - 返回执行结果（stdout）
 */
function runCommand(command: string, cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(command, { encoding: "utf8", cwd }, (error, stdout, stderr) => {
            if (error) {
                // 将 stderr 也附加到 error 对象上，方便 formatError 提取
                (error as any).stderr = stderr;
                (error as any).stdout = stdout;
                reject(error);
                return;
            }
            resolve(stdout || stderr || "(无输出)");
        });
    });
}

/**
 * 异步执行命令（后台运行，不等待结果）
 * 已增加错误捕获，避免 unhandled promise rejection
 */
async function runCommandAsync(command: string, cwd?: string) {
    log.warning(`异步执行命令 ${command}`);
    try {
        await new Promise<string>((resolve, reject) => {
            exec(command, { encoding: "utf8", cwd }, (error, stdout, stderr) => {
                if (error) {
                    (error as any).stderr = stderr;
                    (error as any).stdout = stdout;
                    reject(error);
                    return;
                }
                log.warning("Async - " + command + ":" + (stdout || stderr || "(无输出)"));
                resolve(stdout || stderr || "");
            });
        });
    } catch (error) {
        // 异步命令失败只打印警告，不中断主流程
        log.warning(`异步命令执行失败 (已捕获): ${formatError(error)}`);
    }
}

export default class RunCommand extends AgentTool<RunCommandParams> {
    constructor() {
        super({
            name: "RunCommand",
            description: "执行终端命令",
            parameters: [
                {
                    name: "command",
                    type: "string",
                    description: "要执行的命令",
                    required: true,
                },
                {
                    name: "cwd",
                    type: "string",
                    description: "执行命令的目录",
                    required: false,
                },
                {
                    name: "isAsync",
                    type: "boolean",
                    description: "是否异步执行命令",
                    required: false,
                },
            ],
        });
    }

    async execute({
        command,
        cwd = "",
        isAsync,
    }: RunCommandParams): Promise<string> {
        log.warn(`${isAsync ? "异步" : ""}执行命令 [${cwd || "默认目录"}]: ${command}`);
        if (!isAsync) {
            try {
                const res = await runCommand(command, cwd);
                return `执行命令成功:\n${res}`;
            } catch (error) {
                // 返回详细的错误信息，让 AI Agent 能根据错误内容做出判断
                return formatError(error);
            }
        }

        // 异步执行：不等待结果，但内部已捕获错误避免未处理 rejection
        runCommandAsync(command, cwd);
        return `开始异步执行命令"${command}" (工作目录: ${cwd || "默认"})`;
    }
}
