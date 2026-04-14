import { AgentTool } from "@/core/BaseAgentTool.js";
import { log } from "@clack/prompts";

class ToolRegistery {
    private static instance: ToolRegistery;
    private tools: AgentTool<any>[] = [];

    private constructor() {}

    public static getInstance(): ToolRegistery {
        if (!ToolRegistery.instance) {
            ToolRegistery.instance = new ToolRegistery();
        }
        return ToolRegistery.instance;
    }

    public registerTool(tool: AgentTool<any>) {
        this.tools.push(tool);
        console.log(`[ToolsRegister]已注册工具：${tool.name}`);
    }

    public getAllTools(): AgentTool<any>[] {
        return this.tools;
    }

    public getToolByName(name: string): AgentTool<any> | undefined {
        return this.tools.find((tool) => tool.name === name);
    }
}

export const toolRegistery = ToolRegistery.getInstance();
