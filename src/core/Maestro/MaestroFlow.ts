import MaestroStep from "./MaestroStep.js";
import MaestroContext from "./MaestroContext.js";
import { FlowStep, FlowStepDataMap } from "./types.js";
import { AgentRunResult } from "../BaseAgent.js";

export default class MaestroFlow {
    public id: string;
    public steps: string[];
    public context: MaestroContext;
    private stepMapData: FlowStepDataMap; // 步骤数据映射

    constructor(id: string) {
        this.id = id;
        this.context = new MaestroContext({
            flowId: this.id,
        });
        this.steps = [];
    }

    public setStepMapData(id, data: MaestroStep | MaestroStep[]) {
        let saveData;
        if (Array.isArray(data)) {
            data.forEach((item) => {});
        }

        this.stepMapData[id] = {
            type,
        };
    }

    // 增加步骤 - 顺序
    public addStep({
        agent,
        id,
        input,
    }: Pick<MaestroStep, "agent" | "id" | "input">) {
        let setp = new MaestroStep({
            type: "sequential", // 按照顺序
            agent,
            id,
            input,
        });
        this.steps.push(id);
        return this;
    }

    // 增加步骤 - 并行
    public addParallelStep(
        stemps: Pick<MaestroStep, "agent" | "id" | "input">[],
    ) {
        let findRes = stemps.find((t) => {
            return this.steps.find((d) => {
                return d.id === t.id;
            });
        });

        if (findRes) {
            // log.error(`并行步骤中存在重复id:${findRes.id}`);
            throw new Error(`并行步骤中存在重复id:${findRes.id}`);
            return this;
        }

        let step = stemps.map((item) => {
            return new MaestroStep({
                type: "sequential", // 按照顺序
                agent: item.agent,
                id: item.id,
                input: item.input,
            });
        });
        step.forEach((item) => {
            this.steps.push(item);
        });
        return this;
    }

    // 增加步骤 - 条件
    // public addConditional(steps: MaestroStep[]) {
    //   steps.forEach((step) => {
    //     this.steps.push(step);
    //   });
    //   let setp = new MaestroStep({
    //     type: "conditional", // 条件
    //     agent,
    //     id,
    //   });
    //   this.steps.push(setp);
    //   return setp;
    // }

    //删除步骤
    public removeStep(id: string) {
        this.steps = this.steps.filter((step) => step.id !== id);
    }

    //build
    public build(): {
        id: string;
        steps: FlowStep[];
        context: MaestroContext;
    } {
        return {
            id: this.id,
            steps: this.steps.map((step) => step.build()),
            context: this.context,
        };
    }

    // 执行步骤
    static async run(datas: FlowStep[]) {
        let runResult: (AgentRunResult | undefined)[] = [];
        for (let index = 0; index < datas.length; index++) {
            let runStep = datas[index];

            let type = runStep?.type;

            // 顺序执行
            if (type === "sequential") {
                const res = await runStep?.agent.run(runStep?.input);
                runResult.push(res);
                if (!res) continue; // 如果结果为空，跳过

                //把结果存入到上下文中

                continue;
            }

            // 并行执行
            if (type === "parallel") {
                let runSteps: FlowStep[] = []; // 并行执行的步骤
                datas.filter((t) => {
                    if (t.id === runStep?.id) {
                        runSteps.push(t);
                    }
                });
                let parallelResult = await Promise.all(
                    runSteps.map((step) => {
                        return step.agent.run(step.input);
                    }),
                );
                parallelResult.forEach((result) => {
                    runResult.push(result);
                });
                continue;
            }

            const result = await runStep?.agent.run(runStep?.input);
            runResult.push(result);
        }
        return runResult;
    }
}
