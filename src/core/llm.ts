import OpenAI from "openai";
import dotenv from "dotenv";
import { ChatCompletionMessageParam } from "openai/resources.mjs";
dotenv.config();

// console.log("key", process.env.OPENAI_API_BASE);
const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE,
});

interface ICompletionParams {
    messages: ChatCompletionMessageParam[];
    tools?: any[];
    model?: string;
}

const chatCompletion = async ({
    messages,
    tools,
    model = process.env.OPENAI_API_MODEL,
}: ICompletionParams) => {
    try {
        return await client.chat.completions.create({
            messages,
            model: model || "gpt-3.5-turbo",
            tools: tools || [],
        });
    } catch (error) {
        console.log("error", error);
        throw error;
    }
};

export default chatCompletion;
