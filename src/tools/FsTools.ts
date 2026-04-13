import { AgentTool } from "@/core/BaseAgentTool.js";
import { confirm, log } from "@clack/prompts";
import fs from "fs";

interface IFsToolParams {
    path: string;
    action: string;
    content: string;
}

export default class FsTool extends AgentTool<IFsToolParams> {
    constructor() {
        super({
            name: "FsTool",
            description: "文件操作工具",
            parameters: [
                {
                    name: "path",
                    type: "string",
                    description: "文件路径",
                    required: true,
                },
                {
                    name: "action",
                    type: "string",
                    description:
                        "操作类型 write, read, delete, exists, dir, mkdir, list, listDir delete",
                    required: true,
                },
                {
                    name: "content",
                    type: "string",
                    description: "文件内容",
                    required: false,
                },
            ],
        });
    }

    async execute(params: IFsToolParams): Promise<string> {
        const { path, action, content } = params;
        log.info(`执行文件操作工具 [${action}]${path}`);
        if (action === "write") {
            fs.writeFileSync(path, content);
            if (!fs.existsSync(path)) {
                return "[后置检测]创建失败,执行写入命令后检测文件不存在";
            }

            return "文件写入成功";
        }

        if (action === "read") {
            return fs.readFileSync(path, "utf-8");
        }

        // if(action === "delete"){
        //     fs.unlinkSync(path);

        //     return "文件删除成功";
        // }

        if (action === "exists") {
            return fs.existsSync(path) ? "文件存在" : "文件不存在";
        }

        if (action === "dir") {
            return fs.readdirSync(path).join(",");
        }

        if (action === "mkdir") {
            fs.mkdirSync(path);
            return "文件夹创建成功";
        }

        //获取目录下所有文件
        if (action === "list") {
            return fs.readdirSync(path).join(",");
        }

        //获取目录下所有目录
        if (action === "listDir") {
            return fs
                .readdirSync(path)
                .filter((item) => fs.statSync(path + "/" + item).isDirectory())
                .join(",");
        }

        if (action === "delete") {
            const userCheck = await confirm({
                message: `AI请求删除:${path} 是否要删除?`,
            });
            if (typeof userCheck === "symbol") {
                return "用户取消删除";
            } else {
                //判断path是文件还是目录
                if (fs.statSync(path).isDirectory()) {
                    fs.rmdirSync(path, { recursive: true });
                } else {
                    fs.unlinkSync(path);
                }
                return "文件删除成功";
            }
        }

        return "";
    }
}
