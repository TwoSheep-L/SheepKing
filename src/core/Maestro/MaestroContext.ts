import { FlowContext } from "./types.js";

export default class MaestroContext {
    public flowId: string;
    public input: any;
    public outputs: any;
    public metadata: any;
    constructor({ flowId, input, outputs, metadata }: FlowContext) {
        this.flowId = flowId;
        this.input = input;
        this.outputs = outputs;
        this.metadata = metadata;
    }
}
