# RegexSearchSkill - 正则查找技能

## 技能描述

一个强大的正则查找技能，支持两种查找模式：

1. **内容查找 (contentSearch)**：传入目录、文件名的正则和内容正则，递归遍历指定目录，按文件名正则过滤文件，再对匹配的文件内容进行正则匹配，返回所有匹配到的文件地址以及匹配行的**上2行+匹配行+下2行**（共5行）的上下文内容。

2. **文件名查找 (nameSearch)**：传入目录、文件名的正则，递归遍历指定目录，返回所有匹配该文件名正则的文件路径列表。

> 自动跳过 `node_modules`、`.git`、`dist`、`.next`、`.cache` 等无关目录。

## 可用工具

本技能使用以下工具完成任务：

1. **RegexSearchTool** - 正则搜索核心工具（支持内容查找和文件名查找）

## 使用流程

### 流程1：内容查找

&&&
用户：在 src 目录下，查找所有 .ts 文件中包含 "function" 关键字的文件

步骤1：用户提供目录、文件名正则、内容正则
步骤2：调用 RegexSearchTool，参数为：
  - directory = "src"
  - filePattern = ".*\\.ts$"
  - searchType = "content"
  - contentPattern = "function"
步骤3：工具返回所有匹配的文件路径及匹配行上下文，整理结果返回给用户
&&&

### 流程2：文件名查找

&&&
用户：在 src 目录下查找所有以 "Agent" 结尾的文件

步骤1：用户提供目录、文件名正则
步骤2：调用 RegexSearchTool，参数为：
  - directory = "src"
  - filePattern = ".*Agent.*"
  - searchType = "name"
步骤3：工具返回所有匹配的文件路径列表，整理结果返回给用户
&&&

## 工具参数说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| directory | string | 是 | 要搜索的目录路径（绝对路径或相对路径） |
| filePattern | string | 是 | 文件名匹配的正则表达式，如 `".*\\.ts$"` 匹配所有ts文件 |
| searchType | string | 是 | 搜索类型：`"name"` 文件名查找 / `"content"` 内容查找 |
| contentPattern | string | 否 | 内容查找时的内容正则表达式，仅在 searchType="content" 时使用 |

## 典型场景示例

### 场景1：查找包含特定API调用的文件

&&&
用户：在项目 src 目录下，查找所有 .ts 文件中调用了 "axios" 的地方

我会调用 RegexSearchTool：
- directory = "src"
- filePattern = ".*\\.ts$"
- searchType = "content"
- contentPattern = "axios"
&&&

### 场景2：查找所有配置文件

&&&
用户：在项目根目录下查找所有 .json 文件

我会调用 RegexSearchTool：
- directory = "."
- filePattern = ".*\\.json$"
- searchType = "name"
&&&

### 场景3：查找包含特定日志输出的文件

&&&
用户：在 src 目录下，查找所有文件中包含 "console.log" 或 "logger.info" 的地方

我会调用 RegexSearchTool：
- directory = "src"
- filePattern = ".*"
- searchType = "content"
- contentPattern = "console\\.log|logger\\.info"
&&&

## 注意事项

1. 正则表达式请使用 JavaScript 标准正则语法
2. 对于大项目，建议先从顶层目录开始搜索，逐步缩小范围
3. 内容查找时，每个匹配行会显示包含该行在内的上下共5行内容，用 `>` 标记匹配行
4. 如果文件名正则写 `".*"` 则会匹配所有文件
