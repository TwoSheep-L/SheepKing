import { text, intro, log } from "@clack/prompts";
intro(`初始化中...`);
import "@/tools/index.js";
import { agentRegistery } from "@/skills/index.js";
import { OrchestratorAgent } from "./core/OrchestratorAgent.js";

async function main() {
    const agent = new OrchestratorAgent();
    log.success(`AI初始化完成,加载${agentRegistery.getAgents().length}个Skill`);

    if (agent) {
        for (let index = 0; index < 999; index++) {
            const userInput = await text({
                message: "对话:",
                placeholder: "请输入对话内容...",
            });
            if (typeof userInput !== "string") return;
            let result = await agent.run(userInput);
            log.message(result.output || "");
        }
    }
}

await main();
