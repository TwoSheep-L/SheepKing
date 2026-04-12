import { BaseAgent } from "./BaseAgent.js";

type session_id = string;

class AgentSessionPool {
    private static instance: AgentSessionPool;
    private agentMap: Map<session_id, BaseAgent>;

    private constructor() {
        this.agentMap = new Map();
    }

    public static getInstance(): AgentSessionPool {
        if (!AgentSessionPool.instance) {
            AgentSessionPool.instance = new AgentSessionPool();
        }
        return AgentSessionPool.instance;
    }

    public addAgent(session_id: session_id, agent: BaseAgent) {
        this.agentMap.set(session_id, agent);
    }

    public getAgent(session_id: session_id): BaseAgent | undefined {
        return this.agentMap.get(session_id);
    }
}

export const agentSessionPool = AgentSessionPool.getInstance();
