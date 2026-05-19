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

/**
 * 将错误对象格式化为详细的错误信息字符串，
 * 包含 code/cmd/stack 等，让上层 AI Agent 能获取完整错误上下文。
 */
function formatAgentError(error: unknown): string {
    if (error instanceof Error) {
        const lines: string[] = [`工具执行异常: ${error.message}`];
        const err = error as any;
        if (err.code !== undefined) lines.push(`错误码: ${err.code}`);
        if (err.cmd) lines.push(`命令: ${err.cmd}`);
        if (err.stderr) lines.push(`stderr: ${err.stderr}`);
        if (err.stdout) lines.push(`stdout: ${err.stdout}`);
        if (err.stack) lines.push(`堆栈:\n${err.stack}`);
        return lines.join("\n");
    }
    return `工具执行异常: ${String(error)}`;
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
                    // 🐛 Bug修复: 不能直接continue跳过！必须为每个tool_call_id添加对应的tool响应消息，
                    // 否则消息序列中assistant的tool_calls与后续tool消息数量不匹配，OpenAI会报错：
                    // "An assistant message with 'tool_calls' must be followed by tool messages
                    //  responding to each 'tool_call_id'."
                    // 这里改为返回错误提示，确保每个tool_call都有对应的响应
                    console.log(`tool "${toolCall.function.name}" not found, returning error response`);
                    this.message.addMessage({
                        role: "tool",
                        content: `错误: 工具 "${toolCall.function.name}" 不存在，请检查工具名称是否正确`,
                        tool_call_id: toolCall.id,
                    });
                    continue;
                }
                const arguMents = JSON.parse(toolCall.function.arguments);
                let toolResult: string = "";
                try {
                    toolResult = await tool.execute(arguMents);
                } catch (error: any) {
                    // 🐛 修复: 将完整的错误信息（含堆栈、code、cmd等）返回给Agent，
                    // 而不是只取 error.message，让 AI 能根据详细错误做出正确决策
                    toolResult = formatAgentError(error);
                    log.error(`工具 "${tool.name}" 执行异常，已捕获并返回给 Agent`);
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
