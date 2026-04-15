// VideoGeneraterTool.ts
import { AgentTool } from "@/core/BaseAgentTool.js";
import { log, spinner } from "@clack/prompts";
import axios from "axios";

// 连续视频生成 + 音频可选 + 首尾帧 完整参数
interface VideoGeneraterToolParams {
    prompts: string[];
    imageUrls?: string[];
    // 首尾帧模式（可选）
    lastFrameUrl?: string;
    duration?: number;
    ratio?: "adaptive" | "16:9" | "9:16" | "1:1";
    // 核心：可选音频
    generate_audio?: boolean;
    watermark?: boolean;
}

export default class VideoGeneraterTool extends AgentTool {
    private baseURL = "https://ark.cn-beijing.volces.com/api/v3";
    private apiKey = "";

    constructor() {
        super({
            name: "VideoGeneraterTool",
            description:
                "连续视频生成工具，支持多图顺序生成、首尾帧模式、可选生成音频",
            parameters: [
                {
                    name: "prompts",
                    type: "array",
                    description: "连续视频提示词列表",
                    required: true,
                },
                {
                    name: "imageUrls",
                    type: "array",
                    description: "按顺序的首帧图片URL列表，连续视频使用",
                    required: false,
                },
                {
                    name: "duration",
                    type: "number",
                    description: "单段视频时长(秒)，默认5",
                    required: false,
                },
                {
                    name: "ratio",
                    type: "string",
                    description: "视频比例，默认adaptive",
                    required: false,
                },
                {
                    name: "generate_audio",
                    type: "boolean",
                    description: "是否生成音频，默认false",
                    required: false,
                },
            ],
        });
    }

    // 任务轮询
    private async pollTaskStatus(taskId: string): Promise<any> {
        const maxRetry = 60;
        let count = 0;
        while (count < maxRetry) {
            try {
                const { data } = await axios({
                    method: "GET",
                    url: `${this.baseURL}/contents/generations/tasks/${taskId}`,
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                });
                if (data.status === "succeeded") {
                    log.success(`任务状态：${JSON.stringify(data)}`);
                    return data;
                }
                if (data.status === "failed")
                    throw new Error(data.error?.message || "任务失败");
                log.info(`任务状态：${data.status}，10秒后重试`);
                await new Promise((resolve) => setTimeout(resolve, 10000));
                count++;
            } catch (e) {
                throw e;
            }
        }
        throw new Error("任务超时");
    }

    async execute({
        prompts,
        imageUrls,
        duration = 5,
        ratio = "adaptive",
        generate_audio = false,
        watermark = false,
    }: VideoGeneraterToolParams): Promise<string> {
        if (!this.apiKey) {
            return "请先在./src/tools/ContinuousVideoGen.ts 配置 API_KEY";
        }
        if (!prompts || prompts.length === 0) return "提示词列表不能为空";
        if (imageUrls && imageUrls.length !== prompts.length)
            return "图片数量与提示词数量不匹配";

        const s = spinner();
        const videoUrls: string[] = [];
        s.start(`生成 ${prompts.length} 段连续视频`);

        try {
            for (let i = 0; i < prompts.length; i++) {
                const prompt = prompts[i];
                const imageUrl = imageUrls?.[i];
                const seq = i + 1;
                log.info(`生成第 ${seq} 段视频`);

                // 构建请求内容
                const content: any[] = [{ type: "text", text: prompt }];

                // 首帧图片
                if (imageUrl) {
                    content.push({
                        type: "image_url",
                        image_url: { url: imageUrl },
                        role: "first_frame",
                    });
                }

                let lastFrameUrl = imageUrls?.[i + 1];

                // 尾帧图片（仅单段首尾帧使用）
                if (lastFrameUrl) {
                    content.push({
                        type: "image_url",
                        image_url: { url: lastFrameUrl },
                        role: "last_frame",
                    });
                }
                log.info(`首位帧: ${imageUrl}, 尾帧: ${lastFrameUrl}`);

                // 创建任务
                const { data: createRes } = await axios({
                    method: "POST",
                    url: `${this.baseURL}/contents/generations/tasks`,
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                    data: {
                        model: "doubao-seedance-1-5-pro-251215",
                        content,
                        generate_audio,
                        ratio,
                        duration,
                        watermark,
                    },
                });
                log.success(`任务创建成功，任务ID: ${createRes.id}`);

                const taskRes = await this.pollTaskStatus(createRes.id);
                videoUrls.push(taskRes.content.video_url);
                log.success(`第 ${seq} 段完成`);
            }

            s.stop("全部连续视频生成完成");
            const audioTip = generate_audio ? "（已生成音频）" : "";
            return `连续视频生成完成${audioTip}.
videoResponse {
  model: 'doubao-seedance-1-5-pro-251215',
  created: ${Math.floor(Date.now() / 1000)},
  data: [${videoUrls.map((u, idx) => `\n  { index: ${idx + 1}, url: '${u}', duration: ${duration} }`)}
  ],
  usage: { generated_videos: ${videoUrls.length}, generate_audio: ${generate_audio} }
}`;
        } catch (error: any) {
            s.stop("生成失败");
            const msg = error.response?.data?.error?.message || error.message;
            log.error(msg);
            return `视频生成失败：${msg}`;
        }
    }
}
