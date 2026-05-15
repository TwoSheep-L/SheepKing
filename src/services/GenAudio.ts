import axios from "axios";
import { v4 } from "uuid";
import fs from "fs";
import path from "path";

let BASE_URL = "https://openspeech.bytedance.com/api/v3/tts/unidirectional";
const API_KEY = "";

interface IAudioParams {
    text: string; // 要转换的文本
    context_texts: string; // 语音合成的辅助信息，用于模型对话式合成，能更好的体现语音情感,
    speaker: string; // 说话人
    fileName?: string; // 文件名
}

export const ferchAudio = async ({
    text,
    context_texts,
    speaker,
    fileName,
}: IAudioParams): Promise<string> => {
    return new Promise(async (resolve, reject) => {
        try {
            const response = await axios({
                method: "POST",
                url: BASE_URL,
                responseType: "stream",
                headers: {
                    "X-Api-Key": API_KEY,
                    "X-Api-Resource-Id": "seed-tts-2.0",
                    "X-Api-Request-Id": v4(),
                },
                data: {
                    user: {
                        uid: API_KEY,
                    },
                    req_params: {
                        text,
                        model: "seed-tts-2.0-expressive",
                        speaker: speaker,
                        audio_params: {
                            format: "mp3",
                            sample_rate: 24000,
                        },
                        additions: JSON.stringify({
                            context_texts: [context_texts],
                        }),
                    },
                },
            });

            let rawText = ""; // 接收原始文本（可能跨chunk断开）
            const audioParts: Buffer[] = []; // 收集所有音频片段

            response.data.on("data", (chunk: Buffer) => {
                rawText += chunk.toString("utf8");

                // 按换行分割，逐行处理完整的JSON
                const lines = rawText.split("\n");

                // 最后一行可能不完整，留到下次处理
                rawText = lines.pop() ?? "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;

                    try {
                        const json = JSON.parse(trimmed);

                        if (json.code !== 0) {
                            console.error(
                                "接口返回错误:",
                                json.code,
                                json.message,
                            );
                            continue;
                        }

                        // 最后一条消息
                        if (json.code === 20000000) {
                            console.log("传输完成");
                            continue;
                        }

                        // data字段是Base64编码的MP3片段
                        if (json.data && typeof json.data === "string") {
                            const audioBuffer = Buffer.from(
                                json.data,
                                "base64",
                            );
                            audioParts.push(audioBuffer);
                            //   console.log(`收到音频片段，大小: ${audioBuffer.length} bytes`);
                        }

                        // 最后一条消息
                        if (json.code === 20000000) {
                            console.log("传输完成");
                        }
                    } catch (e) {
                        // JSON不完整，等待下一个chunk
                        rawText = trimmed + "\n" + rawText;
                    }
                }
            });

            response.data.on("end", () => {
                // 处理剩余数据
                if (rawText.trim()) {
                    try {
                        const json = JSON.parse(rawText.trim());
                        if (json.data && typeof json.data === "string") {
                            audioParts.push(Buffer.from(json.data, "base64"));
                        }
                    } catch (e) {
                        // 忽略
                    }
                }

                if (audioParts.length === 0) {
                    console.error("没有收到任何音频数据");
                    return;
                }

                // 合并所有片段
                const finalBuffer = Buffer.concat(audioParts);
                const mp3Name = `${fileName || "audio"}.mp3`;
                let savePath = path.resolve("./audios", mp3Name);
                fs.writeFileSync(savePath, finalBuffer);
                resolve(savePath);
                // console.log(`✅ MP3保存成功`);
                // console.log(`   路径: ${mp3Path}`);
                // console.log(`   大小: ${finalBuffer.length} bytes`);
                // console.log(`   片段数: ${audioParts.length}`);
            });

            response.data.on("error", (err: Error) => {
                console.error("流错误:", err);
                // reject(err);
            });
        } catch (error: any) {
            console.log("请求错误:", error.response?.data || error.message);
            reject(error);
        }
    });
};
