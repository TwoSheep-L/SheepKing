import { AgentTool } from "@/core/BaseAgentTool.js";

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
    }

    public getAllTools(): AgentTool<any>[] {
        return this.tools;
    }

    public getToolByName(name: string): AgentTool<any> | undefined {
        return this.tools.find((tool) => tool.name === name);
    }
}

export const toolRegistery = ToolRegistery.getInstance();
