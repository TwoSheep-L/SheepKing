import { ChatCompletionMessageParam } from "openai/resources.mjs";
import chatCompletion from "./llm.js";
import { AgentTool } from "./BaseAgentTool.js";
import BaseMessage from "./BaseMessage.js";
import { log } from "@clack/prompts";

export interface AgentRunResult {
    output: string | null;
    messages: ChatCompletionMessageParam[];
    iterations: number;
}

export interface AgentConfig {
    name: string;
    systemPrompt: string;
    tools?: AgentTool<any>[];
    model?: string;
    maxIterations?: number;
    description?: string;
    params?: { [key: string]: string };
}

export class BaseAgent {
    name: string;
    systemPrompt: string;
    tools: AgentTool<any>[];
    model: string;
    maxIterations: number;
    description?: string;
    params: { [key: string]: string };
    message: BaseMessage;

    constructor({
        name,
        systemPrompt,
        tools,
        model,
        maxIterations = 10,
        description,
        params,
    }: AgentConfig) {
        this.name = name;
        this.systemPrompt = systemPrompt;
        this.tools = tools || [];
        this.model = model || process.env.OPENAI_API_MODEL || "";
        this.maxIterations = maxIterations || 10;
        this.description = description || "";
        this.params = params || {};

        this.message = new BaseMessage(systemPrompt);
    }

    async run(
        userMessage: string,
        context: { [key: string]: string } = {},
    ): Promise<AgentRunResult> {
        this.message.injectContext(context); // 注入上下文
        this.message.addUserMessage(userMessage);

        // 处理tools
        let toolsParams = this.tools?.map((tool) => {
            return tool.toOpenAITool();
        });

        // console.log("toolsParams", JSON.stringify(toolsParams));

        //AI主要循环
        for (let i = 0; i < this.maxIterations; i++) {
            const resources = await chatCompletion({
                messages: this.message.messages,
                model: this.model,
                tools: toolsParams || [],
            });

            if (!resources.choices[0]) {
                console.log("no choices");
                break;
            }
            const message = resources.choices[0].message;
            this.message.addMessage(message);

            //没有tool_calls，直接返回
            if (!message.tool_calls?.length) {
                return {
                    output: message.content,
                    messages: this.message.messages,
                    iterations: i + 1,
                };
            }

            //有工具调用 继续走流程
            for (const toolCall of message.tool_calls) {
                const tool = this.tools.find(
                    (tool) => tool.name === toolCall.function.name,
                );
                if (!tool) {
                    console.log("no tool");
                    continue;
                }
                const arguMents = JSON.parse(toolCall.function.arguments);
                let toolResult: string = "";
                try {
                    toolResult = await tool.execute(arguMents);
                } catch (error: any) {
                    toolResult = error.message;
                    log.error("Tool error");
                }

                this.message.addMessage({
                    role: "tool",
                    content: toolResult,
                    tool_call_id: toolCall.id,
                });
            }
        }

        return {
            output: "达到最大迭代次数",
            messages: this.message.messages,
            iterations: this.maxIterations,
        };
    }
}
