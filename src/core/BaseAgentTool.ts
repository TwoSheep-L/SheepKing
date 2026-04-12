export interface AgentCallFuncParame {
    name: string;
    type: string;
    description: string;
    required: boolean;
}

export interface BaseAgentToolProps {
    name: string;
    description: string;
    parameters: AgentCallFuncParame[];
    // callBack: (params: any) => Promise<any>;
}

export default class BaseAgentTool {
    name: string;
    description: string;
    parameters: AgentCallFuncParame[];
    // callBack: (params: any) => Promise<any>;

    constructor({ name, description, parameters }: BaseAgentToolProps) {
        this.name = name;
        this.description = description;
        this.parameters = parameters; // JSON Schema
        // this.callBack = callBack;
    }

    // 转成 OpenAI function calling 格式
    public toOpenAITool() {
        let parameters: any = {
            type: "object",
            properties: {},
            required: [],
        };
        this.parameters.forEach((param) => {
            parameters.properties[param.name] = {
                type: param.type,
                description: param.description,
            };

            if (param.required) {
                parameters.required.push(param.name);
            }
        });

        return {
            type: "function",
            function: {
                name: this.name,
                description: this.description,
                parameters: parameters,
            },
        };
    }

    // async call(params: any) {
    //   return this.callBack(params);
    // }
}

// 一个抽象Tool的定义
export abstract class AgentTool<T = any> extends BaseAgentTool {
    abstract execute(params: T): Promise<string>;
}
