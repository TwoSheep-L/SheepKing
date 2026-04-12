import { AgentTool } from "@/core/BaseAgentTool.js";
import axios from "axios";

// ===================== 核心配置 =====================
const NAPCAT_CONFIG = {
    baseURL: "http://43.142.255.71:4125", // NapCat HTTP 地址+端口
    token: "1234566", // 在 NapCat 配置文件中设置的 token
    timeout: 5000, // 请求超时时间
};

// 创建专用 axios 实例（自动携带请求头、统一处理配置）
const napcatApi = axios.create({
    baseURL: NAPCAT_CONFIG.baseURL,
    timeout: NAPCAT_CONFIG.timeout,
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NAPCAT_CONFIG.token}`, // 鉴权请求头
    },
});

// ===================== 常用 API 封装 =====================

/**
 * 发送私聊消息（最新标准接口）
 * @param {number} userId QQ号
 * @param {string} message 消息内容
 */
export async function sendPrivateMsg(userId: string, message: string) {
    try {
        const res = await napcatApi.post("/send_private_msg", {
            user_id: userId,
            message: message,
        });
        console.log("私聊消息发送成功:", res.data);
        return "私聊消息发送成功:" + res.data;
    } catch (error: any) {
        console.error(
            "发送私聊消息失败:",
            error.response?.data || error.message,
        );
        return "发送私聊消息失败:" + error.response?.data || error.message;
    }
}

export default class SendQQMessage extends AgentTool {
    constructor() {
        super({
            name: "send_qq_message",
            description: "发送QQ私聊消息",
            parameters: [
                {
                    name: "qq",
                    type: "string",
                    description: "对方的qq号",
                    required: true,
                },
                {
                    name: "value",
                    type: "string",
                    description: "发送的内容",
                    required: true,
                },
            ],
        });
    }

    async execute({
        qq,
        value,
    }: {
        qq: string;
        value: string;
    }): Promise<string> {
        // 1234566
        const res = await sendPrivateMsg(qq, value);
        return res;
    }
}
