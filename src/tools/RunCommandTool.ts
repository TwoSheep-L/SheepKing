import { AgentTool } from "@/core/BaseAgentTool.js";
import { log } from "@clack/prompts";
import { exec } from "child_process";

interface RunCommandParams {
    command: string;
    cmd?: string;
    isAsync?: boolean;
}

/**
 * 执行终端命令
 * @param {string} command - 要执行的命令
 * @param {string} [cwd] - 执行命令的目录（可选，默认当前目录）
 * @returns {Promise<string>} - 返回执行结果
 */
function runCommand(command: string, cwd?: string) {
    return new Promise((resolve, reject) => {
        exec(command, { encoding: "utf8", cwd }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout || stderr);
        });
    });
}

//异步执行命令
async function runCommandAsync(command: string, cwd?: string) {
    log.warning(`异步执行命令 ${command}`);
    return new Promise((resolve, reject) => {
        exec(command, { encoding: "utf8", cwd }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            log.warning("Async - " + command + ":" + stdout || stderr);
            resolve(stdout || stderr);
        });
    });
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
        cmd = "",
        isAsync,
    }: RunCommandParams): Promise<string> {
        log.warn(`${isAsync ? "异步" : ""}执行命令 ${cmd}:${command}`);
        if (!isAsync) {
            let res: string = "";
            try {
                res = (await runCommand(command, cmd)) as string;
                return `执行命令"${cmd}: ${command}"成功: ${res}`;
            } catch (error) {
                return `执行命令"${cmd}: ${command}"失败: ${error}`;
            }
        }

        runCommandAsync(command, cmd);
        return `开始异步执行命令"${cmd}: ${command}"`;
    }
}
