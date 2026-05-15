import { BaseAgent } from "../BaseAgent.js";
import { FlowStep, MaestroStepType } from "./types.js";

// 步骤
export default class MaestroStep {
    public id: string;
    public type: MaestroStepType;
    public agent: BaseAgent;
    public input: any;
    public dependsOn?: string[];

    constructor({
        type,
        agent,
        id,
        input,
    }: Pick<FlowStep, "type" | "agent" | "id" | "input">) {
        this.id = id; // 步骤
        this.type = type;
        this.agent = agent;
        this.input = input;
    }

    public build(): FlowStep {
        return {
            id: this.id,
            type: this.type,
            agent: this.agent,
            input: this.input,
            dependsOn: this.dependsOn || [],
        };
    }
}
