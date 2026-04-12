import { AgentTool } from "@/core/BaseAgentTool.js";

interface TestToolParams {
    search: string;
}

export default class SearchTool extends AgentTool<TestToolParams> {
    constructor() {
        super({
            name: "search",
            description: "搜索工具",
            parameters: [
                {
                    name: "search",
                    type: "string",
                    description: "search",
                    required: true,
                },
            ],
        });
    }
    async execute(params: TestToolParams) {
        console.log("params: ", params);
        return `搜索结果：热搜是 雷峰塔`;
    }
}
