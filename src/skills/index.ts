import { BaseAgent } from "@/core/BaseAgent.js";
import { AgentTool } from "@/core/BaseAgentTool.js";
import { SkillLoader } from "@/core/SkillLoader.js";
import { toolRegistery } from "@/tools/registery.js";
import { log } from "@clack/prompts";

class AgentRegister {
    private static instance: AgentRegister;
    private Agents: Map<string, BaseAgent> = new Map();

    private constructor() {}

    // 获取实例
    public static getInstance(): AgentRegister {
        if (!AgentRegister.instance) {
            AgentRegister.instance = new AgentRegister();
        }
        return AgentRegister.instance;
    }

    // 插入一个Agent
    public addAgent(agent: BaseAgent) {
        this.Agents.set(agent.name, agent);
    }

    // 获取所有Agent名字
    public getAgentNames() {
        return Array.from(this.Agents.keys());
    }

    // 获取一个Agent
    public getAgent(name: string) {
        return this.Agents.get(name);
    }

    // 获取所有Agent
    public getAgents() {
        return Array.from(this.Agents.values());
    }

    // 获取所有AgentInfo
    public getAgentInfos() {
        return this.getAgents().map((agent) => {
            return {
                name: agent.name,
                description: agent.description,
                module: agent.model,
                maxIterations: agent.maxIterations,
            };
        });
    }

    // 根据Skill名字创建Agent
    public CreateAgentBySkillName = (skillName = "") => {
        const loader = SkillLoader.load(skillName);
        const skill = loader.skill;

        //获取对应tools
        let tools = skill.tools
            .map((toolName) => {
                let tool = toolRegistery.getToolByName(toolName);
                if (tool) {
                    return tool;
                } else {
                    console.error(
                        `Skill【${skillName}】依赖的工具【${toolName}】不存在 `,
                    );
                }
                return null;
            })
            .filter(Boolean);

        const agent = new BaseAgent({
            name: skill.name,
            systemPrompt: skill.skillMarkdown,
            tools: tools as AgentTool<any>[],
            maxIterations: 50,
            description: skill.description,
            params: skill.params,
        });
        this.addAgent(agent);
        return agent;
    };
}

const registery = AgentRegister.getInstance();

//注册所有Skill的Agent
SkillLoader.GET_ALL_SKILLS().forEach((skillName) => {
    registery.CreateAgentBySkillName(skillName);
});

export const agentRegistery = registery;
