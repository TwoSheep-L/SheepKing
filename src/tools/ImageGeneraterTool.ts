import { AgentTool } from "@/core/BaseAgentTool.js";
import { log, spinner } from "@clack/prompts";
import axios from "axios";

interface ImageGeneraterToolParams {
    prompt: string;
    size: "1k" | "2k" | "3k";
    max_images?: number;
}

export default class ImageGeneraterTool extends AgentTool {
    // 基础配置
    private baseURL = "https://ark.cn-beijing.volces.com/api/v3";
    private apiKey = "";

    constructor() {
        super({
            name: "ImageGeneraterTool",
            description: "图片生成工具",
            parameters: [
                {
                    name: "prompt",
                    type: "string",
                    description: "图片生成提示词",
                    required: true,
                },
                {
                    name: "size",
                    type: "string",
                    description: "图片尺寸",
                    required: true,
                },
                {
                    name: "max_images",
                    type: "number",
                    description: "生成图片数量，分镜数量,组图数量",
                    required: true,
                },
            ],
        });
    }

    async execute({
        prompt,
        size = "2k",
        max_images,
    }: ImageGeneraterToolParams): Promise<string> {
        if (!prompt) {
            return "prompt不能为空";
        }
        if (!this.apiKey) {
            return "请先在./src/tools/ImageGeneraterTool.ts 配置 API_KEY";
        }

        const s = spinner();
        try {
            log.info(`prompt[${size}](x${max_images || 1}): ` + prompt);
            s.start("图片生成中");

            // 构建请求体
            const requestData: any = {
                model: "doubao-seedream-5-0-260128",
                prompt: prompt,
                size: size,
                response_format: "url",
                output_format: "png",
                watermark: false,
                stream: false,
                sequential_image_generation: "disabled",
            };

            // 多图生成逻辑
            if (max_images) {
                requestData.sequential_image_generation = "auto";
                requestData.sequential_image_generation_options = {
                    max_images,
                };
            }

            //   log.message("requestData");
            //   log.message(JSON.stringify(requestData));

            // axios 发起请求
            const { data: imagesResponse } = await axios({
                method: "POST",
                url: `${this.baseURL}/images/generations`,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.apiKey}`,
                },
                data: requestData,
                timeout: 10 * 60 * 1000, // 10分钟超时
            });

            s.stop("图片生成完成.");

            if (!imagesResponse.data || !imagesResponse.data[0]) {
                return "图片生成失败";
            }

            console.log("imagesResponse", imagesResponse);

            const imageUrls = JSON.stringify(imagesResponse.data || "{}");
            return imageUrls;
        } catch (error: any) {
            s.stop("图片生成失败");
            const errMsg =
                error?.response?.data?.error?.message ||
                error.message ||
                "未知错误";
            log.error("图片生成失败：" + errMsg);
            return "图片生成失败：" + errMsg;
        }
    }
}
