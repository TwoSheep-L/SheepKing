import { BaseAgent } from "../BaseAgent.js";
import MaestroContext from "./MaestroContext.js";
import MaestroStep from "./MaestroStep.js";

export interface MaestroFlow {
    id: string;
    steps: MaestroStep[];
    context: MaestroContext;
}

// 调度上下文
export interface FlowContext {
    flowId: string;
    input?: any; // 原始输入
    outputs?: Map<string, any>; // 每步的输出
    metadata?: Record<string, any>;
}

export type MaestroStepType = "sequential" | "parallel" | "conditional";

// 调度步骤
export interface FlowStep {
    id: string;
    type: MaestroStepType;
    agent: BaseAgent;
    input: any;
    dependsOn?: string[]; // 依赖的步骤ID
}

// 编排中的步骤数据
export interface FlowStepData {
    type: MaestroStepType;
    steps: MaestroStep[];
}

// 调度步骤
export type FlowStepDataMap = Record<string, FlowStepData>;
