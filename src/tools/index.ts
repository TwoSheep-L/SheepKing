import FsTool from "./FsTools.js";
import { toolRegistery } from "./registery.js";
import RunCommand from "./RunCommandTool.js";
import UserInputTool from "./user_input.js";

// 注册工具
toolRegistery.registerTool(new UserInputTool()); // 请求用户输入
toolRegistery.registerTool(new FsTool()); //  文件操作工具
toolRegistery.registerTool(new RunCommand()); // 执行命令行
