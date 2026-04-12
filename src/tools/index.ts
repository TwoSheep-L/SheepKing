import ImageGenetate from "./ImageGenetate.js";
import { toolRegistery } from "./registery.js";
import SearchTool from "./search.js";
import SendQQMessage from "./SendQQMessage.js";
import UserInputTool from "./user_input.js";

// 注册工具
toolRegistery.registerTool(new ImageGenetate()); // 生成图片
toolRegistery.registerTool(new UserInputTool()); // 请求用户输入
toolRegistery.registerTool(new SearchTool()); // 搜索工具
toolRegistery.registerTool(new SendQQMessage()); // 发送QQ消息
