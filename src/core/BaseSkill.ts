// 技能配置
export interface SkillConfig {
    name: string;
    description: string;
    tools?: string[];
    params?: { [key: string]: string }; // 动态参数
}

// 技能参数
export interface SkillParam extends SkillConfig {
    skillMarkdown: string;
}

export class Skill {
    name: string;
    description: string;
    tools: string[];
    params: { [key: string]: string };
    skillMarkdown: string;
    constructor({
        name,
        description,
        tools,
        params,
        skillMarkdown,
    }: SkillParam) {
        this.name = name;
        this.description = description;
        this.tools = tools || [];
        this.params = params || {};
        this.skillMarkdown = skillMarkdown || "";
    }
}
