import AudioGeneration from "./AudioGeneration.js";
import BaiduSearchTool from "./BaiduSearchTool.js";
import FsTool from "./FsTools.js";
import ImageGeneraterTool from "./ImageGeneraterTool.js";
import { toolRegistery } from "./registery.js";
import ReadCodeLinesTool from "./ReadCodeLinesTool.js";
import RegexSearchTool from "./RegexSearchTool.js";
import RunCommand from "./RunCommandTool.js";
import UserInputTool from "./user_input.js";
import VideoGeneraterTool from "./VideoGeneraterTool.js";
import WebPageReaderTool from "./WebPageReaderTool.js";
import WordDocumentTool from "./WordDocumentTool.js";

// 注册工具
toolRegistery.registerTool(new UserInputTool()); // 请求用户输入
toolRegistery.registerTool(new FsTool()); //  文件操作工具
toolRegistery.registerTool(new ReadCodeLinesTool()); // 按行读取代码工具（节省上下文空间）
toolRegistery.registerTool(new RegexSearchTool()); // 正则搜索工具（文件名/内容正则查找）
toolRegistery.registerTool(new RunCommand()); // 执行命令行
toolRegistery.registerTool(new ImageGeneraterTool()); // 图片生成工具
toolRegistery.registerTool(new VideoGeneraterTool()); // 连续视频生成工具
toolRegistery.registerTool(new AudioGeneration());
toolRegistery.registerTool(new WordDocumentTool()); // Word文档生成工具
toolRegistery.registerTool(new BaiduSearchTool()); // 百度爬虫搜索工具
toolRegistery.registerTool(new WebPageReaderTool()); // 网页内容读取工具
