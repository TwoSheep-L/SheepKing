import "@/tools/index.js";
import { CreatSkillCliMain } from "./cli/CreateSkill.js";
import { agentRegistery } from "@/skills/index.js";
import { BaseAgent } from "./core/BaseAgent.js";
import TestTool from "./tools/search.js";
import "@/skills/index.js";
import { OrchestratorAgent } from "./core/OrchestratorAgent.js";
import { sendPrivateMsg } from "./tools/SendQQMessage.js";
import { text, intro, outro, log } from "@clack/prompts";

async function main() {
    // await CreatSkillCliMain();

    // console.log(agentRegistery.getAgents());
    const agent = new OrchestratorAgent();
    await intro(`AI初始化完成,加载${agentRegistery.getAgents().length}个Skill`);

    if (agent) {
        for (let index = 0; index < 999; index++) {
            const userInput = await text({
                message: "对话:",
            });
            if (typeof userInput !== "string") return;
            let result = await agent.run(userInput);
            log.message(result.output || "");
        }
    }
}

await main();
