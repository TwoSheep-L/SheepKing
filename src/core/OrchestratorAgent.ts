import { agentRegistery } from "@/skills/index.js";
import { BaseAgent } from "./BaseAgent.js";
import CallAgentTool from "@/tools/CallAgentTool.js";
import UserInputTool from "@/tools/user_input.js";

export class OrchestratorAgent extends BaseAgent {
    constructor() {
        let agentList = agentRegistery.getAgentInfos().map((item) => {
            return `name:${item.name}: ${item.description} `;
        });

        let systemPrompt = `# 智能调度中枢
你是智能调度中枢,你的任务是根据用户问题,选择最合适的子Agent处理。

## 已注册的子Agent列表：
${agentList}

## 规则：
1. 用户提问 → 你判断该用哪个Agent
2. 必须严格调用工具 call_agent 指定 agent_name 和 query
3. 不要回答问题,只负责分配任务
4. 子Agent返回结果后,你再整理成自然语言回答用户
5. 调用其他Agent时,需要传入它可能会用到的所有上下文信息,让Agent进行信息提取。

## call_agent调用规则:
1. agent_name必须是真实存在的Agent名称
2. input 是调用的子Agent的输入,是他的userPrompt
3. context 是调用的子Agent的输入,是他的context,会被用于替换对应systemPrompt中的变量
4. session_id 是本次会话的id,用于追踪会话,你可以使用这个id来保存会话结果,如果Agent需要二次请求输入,你可以使用这个id来继续和该Agent对话
5. 调用Agent时候要给它传入它可能会有用的context,传入到input可以中让Agent进行信息提取

## 继续对话规则:
1. 如果子Agent需要二次请求输入,你可以使用session_id来继续和该Agent对话
2. 如果你无法自主确定这个二次请求输入,需要用户介入输入,请调用UserInputTool这个工具来请求用户输入

## 额外参数 // 这些参数你可能会用得到
1. newTime:${new Date().toISOString()} // 当前最新时间
`;

        super({
            name: "Orchestrator",
            systemPrompt: systemPrompt,
            tools: [new CallAgentTool(), new UserInputTool()],
            model: process.env.OPENAI_API_MODEL || "",
            maxIterations: 50,
            description: "智能调度中枢",
        });
    }
}
