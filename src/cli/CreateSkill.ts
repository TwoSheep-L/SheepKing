import { BaseAgent } from "@/core/BaseAgent.js";
import { AgentTool } from "@/core/BaseAgentTool.js";
import { SkillLoader } from "@/core/SkillLoader.js";
import { toolRegistery } from "@/tools/registery.js";
import {
    intro,
    outro,
    text,
    confirm,
    spinner,
    multiselect,
    log,
} from "@clack/prompts";
import fs from "fs";
import path from "path";

// 用AI生成Skill
const AiCreateSkill = async (
    name: string,
    description: string,
    tools: AgentTool<any>[],
    params: { [key: string]: string }[],
): Promise<string> => {
    let paramsString = "";
    params.forEach((param) => {
        paramsString += `- ${param.name}: ${param.description}\n`;
    });

    let toolsString = "";
    tools.forEach((tool) => {
        toolsString += `- ${tool.name}: ${tool.description}\n`;
    });

    let systemPrompt = `你是一个 Skill 创建专家，根据用户的需求，结合用户提供的 SKILL 信息，创建一个 Skill.md 的内容。

## 核心概念：动态参数

动态参数是指在 Skill 文本中使用 \${参数名} 格式标记的占位符，它们会在运行时由 Agent 通过 context 自动注入真实值。

**关键规则：**
- 动态参数 **不是** Tool 的入参，**不需要** 在参数列表中单独声明
- 动态参数直接嵌入在 Skill 的描述文本/prompt 中
- 格式固定为 \${参数名}，例如：\${query}、\${name}、\${language}

**正确示例：**
&&&
你是一个搜索引擎大师，你的名字叫 \${name}，
当用户提问时，你需要基于 \${query} 进行深度搜索分析...
&&&
在上面的例子中，\${name} 和 \${query} 是动态参数，运行时会被自动替换为实际值，**不需要**将它们列为 Tool 的输入参数。

**错误示例（禁止这样做）：**
&&&
参数列表：
- name: string  ❌ 动态参数不应出现在参数列表中
- query: string ❌ 动态参数不应出现在参数列表中
&&&

## 工具规范
务必在skill中传入所有“可用工具列表”的工具，并确保它们在运行时被正确地注入。让Ai自主选择工具，并确保它们在运行时被正确地使用。


## 输出规范

- 不需要回复"好的"、"请问有什么可以帮您"等开场白，直接输出 Skill 内容
- 必须使用 Markdown 格式输出
- **最外层禁止使用代码块**（即禁止用 &&& 或 \`\`\` 包裹整个输出）
- Skill 内部的代码示例可以正常使用 &&& 表示代码块
- 所有动态参数必须使用 \${参数名} 格式

`;
    const agent = new BaseAgent({
        name: "SkillCreate",
        systemPrompt: systemPrompt,
        tools: [],
        maxIterations: 10,
    });
    const res = await agent.run(`Skill信息如下
Skill名称: ${name}
Skill描述: ${description}
可用工具列表: ${toolsString}
Skill动态参数: \n${paramsString}
`);
    return res?.output || "";
};

// CLI创建Skill
export async function CreatSkillCliMain() {
    intro("🎉 开始创建Skill");

    // Skill名字
    const skillName = await text({
        message: "请输入Skill名称(英文):",
        placeholder: "比如 SearchSkill",
        validate(value: string | undefined) {
            if (!value) {
                return "Skill名称不能为空";
            }
            if (value.length === 0) return "Skill名称不能为空";
            //不能有中文
            if (/[\u4e00-\u9fa5]/.test(value)) {
                return "Skill名称不能有中文";
            }
            //检测是否已经存在
            if (fs.existsSync(path.resolve(SkillLoader.SKILL_PATH, value))) {
                return "❌ Skill已存在";
            }
            return "";
        },
    });
    if (typeof skillName !== "string") return outro("❌ 取消创建");

    // skill描述
    const description = await text({
        message: "请输入Skill的描述:",
        placeholder: "比如 一个搜索大师.",
        validate(value: string | undefined) {
            if (!value) {
                return "Skill描述";
            }
            if (value.length === 0) return "Skill描述";
            return "";
        },
    });

    if (typeof description !== "string") return outro("❌ 取消创建");

    const tools = toolRegistery.getAllTools();
    const toolsOptions =
        tools.map((t) => {
            return {
                value: t.name,
                label: t.name,
                hint: t.description,
            };
        }) || [];
    // 工具选择
    let tool: string[] | symbol = [];

    if (tools && tools.length > 0) {
        tool = await multiselect({
            message: "请选择要使用的工具 可空(上下切换,空格选择):",
            options: toolsOptions,
        });
        if (typeof tool !== "object") return outro("❌ 取消创建");
    } else {
        log.info("没有可用工具,跳过工具选择");
    }

    // Skill参数
    let params: { [key: string]: string }[] = [];
    for (let index = 0; index < 999; index++) {
        const param = await text({
            message: `请输入Skill的参数${index + 1} (英文,空白按回车结束):`,
            placeholder: "query",
        });
        if (typeof param !== "string") break;

        if (!param.trim()) break; // 为空跳出

        let paramData = { [param]: "" };

        const paramDes = await text({
            message: `请输入参数{${param}}的描述:`,
            placeholder: `${param}描述内容`,
        });
        if (typeof paramDes !== "string") {
            paramData[param] = "";
        } else {
            paramData[param] = paramDes;
        }

        params.push(paramData);
    }

    // 使用AI创建
    const AiCreate = await confirm({
        message: "是否根据名字和描述使用AI创建Skill内容?",
    });
    if (typeof AiCreate !== "boolean") return outro("❌ 取消创建");
    let skillString = "";
    if (AiCreate) {
        const s = spinner();
        s.start("正在使用AI创建Skill内容...");
        skillString = await AiCreateSkill(
            skillName,
            description,
            tools,
            params,
        );
        let savePath = path.resolve(SkillLoader.SKILL_PATH, skillName);
        if (!fs.existsSync(savePath)) {
            fs.mkdirSync(savePath, { recursive: true });
        }
        fs.writeFileSync(path.join(savePath, "skill.md"), skillString);
        s.stop("Skill内容创建完成！");
        log.info(`Skill内容已保存到 ${savePath}`);
    } else {
        log.info(
            `请在Skill创建后在/src/skills/${skillName}/skill.md中编辑Skill内容}`,
        );
    }

    //创建config
    let config = {
        name: skillName,
        description: description,
        tools: tool,
        params: params,
        status: "ONLINE",
    };

    fs.writeFileSync(
        path.resolve(SkillLoader.SKILL_PATH, `./${skillName}/config.json`),
        JSON.stringify(config, null, 2),
    );

    outro("✅已完成创建！");
}
