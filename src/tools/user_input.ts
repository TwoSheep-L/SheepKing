import { AgentTool } from "@/core/BaseAgentTool.js";
import { intro, outro, text } from "@clack/prompts";
export default class UserInputTool extends AgentTool {
    constructor() {
        super({
            name: "user_input",
            description: "请求用户输入",
            parameters: [
                {
                    name: "question",
                    type: "string",
                    description: "请求用户输入的提示",
                    required: true,
                },
            ],
        });
    }

    async execute({ question }: { question: string }): Promise<string> {
        intro("请求用户输入");
        const result = await text({
            message: question,
        });
        if (typeof result !== "string") {
            outro("取消输入");
            return "用户取消输入";
        }
        outro("√提交成功");
        return `用户输入:${result}`;
    }
}
