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
                        return `session_id:${session_id}\n${output}`;
                    } catch (error: any) {
                        return `session_id:${session_id}\n${error.message}`;
                    }
                }
            } else {
                // 新对话
                const id = v4();

                try {
                    log.step(`【新对话】(${agent.name})${id}`);
                    let result = await agent.run(input || "");
                    agentSessionPool.addAgent(id, agent);
                    return `session_id:${id}\n${result.output}`;
                } catch (error: any) {
                    return `session_id:${id}\n${error.message}`;
                }
            }
            return "";
        }
    }
}
