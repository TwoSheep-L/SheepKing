import { ChatCompletionMessageParam } from "openai/resources.mjs";

export default class BaseMessage {
    public messages: ChatCompletionMessageParam[] = [];

    constructor(systemPrompt: string) {
        this.messages.push({ role: "system", content: systemPrompt });
    }

    addUserMessage(message: string) {
        this.messages.push({ role: "user", content: message });
    }

    addAssistantMessage(message: string) {
        this.messages.push({ role: "assistant", content: message });
    }

    addMessage(message: ChatCompletionMessageParam) {
        this.messages.push(message);
    }

    changeSystemPrompt(systemPrompt: string) {
        this.messages[0] = { role: "system", content: systemPrompt };
    }

    //在SystemPrompt中注入Context
    injectContext(context: {
        [key: string]: string;
    }): ChatCompletionMessageParam[] {
        if (!this.messages[0]) return [];
        let systemPrompt: string = (this.messages[0].content || "") as string;
        for (const key in context) {
            let reg = new RegExp(`\${${key}}`, "g");
            systemPrompt = systemPrompt.replaceAll(reg, context[key] || "");
        }
        this.messages[0].content = systemPrompt;
        return this.messages;
    }
}
