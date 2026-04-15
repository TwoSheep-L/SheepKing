import FsTool from "./FsTools.js";
import ImageGeneraterTool from "./ImageGeneraterTool.js";
import { toolRegistery } from "./registery.js";
import RunCommand from "./RunCommandTool.js";
import UserInputTool from "./user_input.js";
import VideoGeneraterTool from "./VideoGeneraterTool.js";

// 注册工具
toolRegistery.registerTool(new UserInputTool()); // 请求用户输入
toolRegistery.registerTool(new FsTool()); //  文件操作工具
toolRegistery.registerTool(new RunCommand()); // 执行命令行
toolRegistery.registerTool(new ImageGeneraterTool()); // 图片生成工具
toolRegistery.registerTool(new VideoGeneraterTool()); // 连续视频生成工具
