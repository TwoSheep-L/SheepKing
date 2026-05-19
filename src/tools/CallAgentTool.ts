import { agentSessionPool } from "@/core/AgentSessionPool.js";
import { AgentTool } from "@/core/BaseAgentTool.js";
import { agentRegistery } from "@/skills/index.js";
import { log } from "@clack/prompts";
import { v4 } from "uuid";

interface CallAgentToolParams {
    agent_name: string;
    input?: string;
    context?: { [key: string]: string };
    session_id?: string;
}

/**
 * 将错误对象格式化为详细的错误信息字符串，
 * 包含完整堆栈等，让上层 AI Agent 能获取完整错误上下文。
 */
function formatAgentError(error: unknown): string {
    if (error instanceof Error) {
        const lines: string[] = [`调用子Agent异常: ${error.message}`];
        const err = error as any;
        if (err.code !== undefined) lines.push(`错误码: ${err.code}`);
        if (err.stack) lines.push(`堆栈:\n${err.stack}`);
        return lines.join("\n");
    }
    return `调用子Agent异常: ${String(error)}`;
}

export default class CallAgentTool extends AgentTool<CallAgentToolParams> {
    constructor() {
        super({
            name: "call_agent",
            description: "调用其他代理",
            parameters: [
                {
                    name: "agent_name",
                    type: "string",
                    description: "代理名称",
                    required: true,
                },
                {
                    name: "input",
                    type: "string",
                    description: "输入的userPrompt",
                    required: false,
                },
                {
                    name: "context",
                    type: "object",
                    description:
                        "对应上下文,{[key:string]:string},用于替换systmPrompt中的变量",
                    required: false,
                },
                {
                    name: "session_id",
                    type: "string",
                    description:
                        "Agent对话ID,用于追踪对话,传入此ID即可继续和该Agent对话,不传则开启新的对话",
                    required: false,
                },
            ],
        });
    }

    async execute({
        agent_name,
        input,
        context,
        session_id,
    }: CallAgentToolParams): Promise<string> {
        let agent = agentRegistery.getAgent(agent_name);
        if (!agent) {
            return `${agent_name}不存在!`;
        } else {
            if (session_id) {
                // 继续对话
                const agent = agentSessionPool.getAgent(session_id);
                if (agent) {
                    log.step(`【继续对话】(${agent.name})${session_id}`);
                    try {
                        const res = await agent.run(input || "", context || {});
                        let output = res.output;
                        log.message(output || "");
                        return `session_id:${session_id}\n${output}`;
                    } catch (error: any) {
                        // 🐛 修复: 将完整的错误信息返回给上层 Agent，而不是只取 message
                        const errDetail = formatAgentError(error);
                        log.error(`子Agent "${agent.name}" 运行异常，已捕获并返回`);
                        return `session_id:${session_id}\n${errDetail}`;
                    }
                }
            } else {
                // 新对话
                const id = v4();

                try {
                    log.step(`【新对话】(${agent.name})${id}`);
                    let result = await agent.run(input || "");
                    log.message(result.output || "");
                    agentSessionPool.addAgent(id, agent);
                    return `session_id:${id}\n${result.output}`;
                } catch (error: any) {
                    // 🐛 修复: 将完整的错误信息返回给上层 Agent
                    const errDetail = formatAgentError(error);
                    log.error(`子Agent "${agent.name}" 运行异常，已捕获并返回`);
                    return `session_id:${id}\n${errDetail}`;
                }
            }
            return "";
        }
    }
}
