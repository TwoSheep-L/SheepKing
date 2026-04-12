import { AgentTool } from "@/core/BaseAgentTool.js";

export default class ImageGenetate extends AgentTool {
    constructor() {
        super({
            name: "image_genetate",
            description: "生成图片",
            parameters: [
                {
                    name: "prompt",
                    type: "string",
                    description: "生成图片的提示",
                    required: true,
                },
                {
                    name: "imageUrl",
                    type: "string",
                    description: "根据对应图片生成的图片url,多个url逗号分隔",
                    required: false,
                },
            ],
        });
    }

    async execute({ prompt }: { prompt: string }): Promise<string> {
        console.log("propmt", prompt);
        let result = "http://api.aasdsx.com/image/genetate/aaaa.png";
        return result;
    }
}
