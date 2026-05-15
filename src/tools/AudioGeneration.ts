import { ferchAudio } from "@/services/GenAudio.js";
import { AgentTool } from "@/core/BaseAgentTool.js";
import { log } from "@clack/prompts";
import fs from "fs";

interface IAudioParams {
    text: string; // 要转换的文本
    context_texts: string; // 语音合成的辅助信息，用于模型对话式合成，能更好的体现语音情感,
    speaker: string; // 说话人
    fileName?: string; // 文件名
}

interface IAudioResult {
    data: IAudioParams[]; // 音频数据
}

async function mergeMP3WithBuffer(inputFiles: string[], outputFile: string) {
    const buffers = [];

    for (const file of inputFiles) {
        const buffer = fs.readFileSync(file);
        buffers.push(buffer);
    }

    const merged = Buffer.concat(buffers);
    fs.writeFileSync(outputFile, merged);
    console.log("合并完成:", outputFile);
}

export default class AudioGeneration extends AgentTool<IAudioResult> {
    constructor() {
        super({
            name: "AudioData",
            description: "用于生成音频数据",
            parameters: [
                {
                    name: "data",
                    type: "array",
                    description:
                        "JSONOArray 里面三个字段, text=要转换的文本, context_texts=可空,语音合成的辅助信息，用于模型对话式合成，能更好的体现语音情感, speaker=说话人",
                    required: true,
                },
            ],
        });
    }

    async execute({ data }: IAudioResult): Promise<string> {
        log.info("开始生成音频数据.");
        let allFile: string[] = [];
        for (let i = 0; i < data.length; i++) {
            const item = data[i] as IAudioParams;
            item.fileName = `audio${i + 1}`;
            console.log("item", item);
            const path = await ferchAudio(item);
            console.log("音频数据", path);
            allFile.push(path);
        }

        log.info("音频数据生成完成,开始合成.");
        await mergeMP3WithBuffer(allFile, "./res.mp3");
        log.success("音频数据合成完成.");

        return `分段音频路径为:${allFile.join(",")}，合称音频结果为:${"./res.mp3"}`;
    }
}
