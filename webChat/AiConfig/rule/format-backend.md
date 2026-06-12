# 后端 API 开发规范手册

> 适用项目：twosheep-workshop 后端服务（对接前端 React + TypeScript）
> 技术栈推荐：Node.js / Egg.js / NestJS / Java Spring Boot
> 版本：v1.0

---

## 一、API 接口设计规范

### 1.1 RESTful 风格

```
# ✅ 推荐的 URL 设计
GET     /api/v1/users              # 获取用户列表
GET     /api/v1/users/:id          # 获取单个用户
POST    /api/v1/users              # 创建用户
PUT     /api/v1/users/:id          # 更新用户
DELETE  /api/v1/users/:id          # 删除用户

# 业务资源
GET     /api/v1/chat/sessions              # 聊天会话列表
POST    /api/v1/chat/sessions              # 创建会话
GET     /api/v1/chat/sessions/:id/messages # 获取会话消息
POST    /api/v1/chat/sessions/:id/messages # 发送消息

GET     /api/v1/ai/images                  # AI图片列表
POST    /api/v1/ai/images/generate         # 生成图片
POST    /api/v1/ai/split-material          # 拆分素材

GET     /api/v1/admin/users                # 管理后台-用户列表
GET     /api/v1/admin/chat-records         # 管理后台-聊天记录
GET     /api/v1/admin/image-records        # 管理后台-图片记录
```

### 1.2 API 版本控制

```ts
// ✅ 统一使用 /api/v1/ 前缀
// 后续版本迭代使用 /api/v2/、/api/v3/ 等

const API_VERSION = '/api/v1';
const API_BASE = `${API_VERSION}`;
```

### 1.3 统一响应格式

```ts
// ✅ 成功响应
{
  "code": 0,           // 业务状态码，0 表示成功
  "message": "success",
  "data": { ... }      // 实际数据
}

// ✅ 列表响应（带分页）
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [ ... ],    // 数据列表
    "total": 100,       // 总记录数
    "page": 1,          // 当前页码
    "pageSize": 20      // 每页大小
  }
}

// ✅ 错误响应
{
  "code": 10001,        // 业务错误码（非0）
  "message": "参数错误", // 错误描述
  "data": null
}
```

### 1.4 业务错误码规范

| 错误码范围 | 说明 |
|-----------|------|
| 0 | 成功 |
| 10000 ~ 10099 | 通用错误（参数校验、认证授权） |
| 10100 ~ 10199 | 用户模块错误 |
| 10200 ~ 10299 | 聊天模块错误 |
| 10300 ~ 10399 | AI 图片模块错误 |
| 10400 ~ 10499 | AI 拆分素材模块错误 |
| 10500 ~ 10599 | 管理后台错误 |
| 50000 | 服务器内部错误 |

```ts
// 错误码枚举定义示例
export enum ErrorCode {
  SUCCESS = 0,

  // 通用错误 10000~10099
  PARAM_ERROR = 10001,
  UNAUTHORIZED = 10002,
  FORBIDDEN = 10003,
  NOT_FOUND = 10004,
  RATE_LIMIT = 10005,

  // 用户模块 10100~10199
  USER_NOT_FOUND = 10101,
  USER_EXISTS = 10102,
  LOGIN_FAILED = 10103,
  TOKEN_EXPIRED = 10104,

  // 聊天模块 10200~10299
  SESSION_NOT_FOUND = 10201,
  MESSAGE_SEND_FAILED = 10202,

  // AI图片模块 10300~10399
  IMAGE_GEN_FAILED = 10301,
  IMAGE_NOT_FOUND = 10302,

  // 服务器错误
  INTERNAL_ERROR = 50000,
}
```

---

## 二、数据库设计规范

### 2.1 命名规范

| 对象 | 命名规则 | 示例 |
|------|---------|------|
| 数据库 | snake_case | `twosheep_workshop` |
| 表名 | snake_case（复数） | `users`, `chat_sessions`, `ai_images` |
| 字段 | snake_case | `user_id`, `created_at`, `is_deleted` |
| 索引 | `idx_表名_字段` | `idx_users_email` |
| 主键 | `id`（自增或UUID） | `id BIGINT AUTO_INCREMENT` |

### 2.2 必备字段

```sql
-- 每张表必须包含以下字段
CREATE TABLE `example_table` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`  TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '逻辑删除: 0-未删除, 1-已删除',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='示例表';
```

### 2.3 常用表设计参考

```sql
-- 用户表
CREATE TABLE `users` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `username`    VARCHAR(50)  NOT NULL COMMENT '用户名',
  `email`       VARCHAR(100) NOT NULL COMMENT '邮箱',
  `password`    VARCHAR(255) NOT NULL COMMENT '加密密码',
  `avatar`      VARCHAR(500) DEFAULT NULL COMMENT '头像URL',
  `role`        VARCHAR(20)  NOT NULL DEFAULT 'user' COMMENT '角色: user/admin',
  `status`      TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '状态: 1-启用, 0-禁用',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted`  TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_users_email` (`email`),
  KEY `idx_users_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 聊天会话表
CREATE TABLE `chat_sessions` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT       NOT NULL COMMENT '用户ID',
  `title`       VARCHAR(200) DEFAULT NULL COMMENT '会话标题',
  `model`       VARCHAR(50)  NOT NULL DEFAULT 'gpt-3.5-turbo' COMMENT 'AI模型',
  `status`      VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT '状态: active/archived',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted`  TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_sessions_user_id` (`user_id`),
  KEY `idx_sessions_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='聊天会话表';

-- AI图片生成记录表
CREATE TABLE `ai_images` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`     BIGINT       NOT NULL COMMENT '用户ID',
  `prompt`      TEXT         NOT NULL COMMENT '图片描述',
  `model`       VARCHAR(50)  NOT NULL COMMENT '生成模型',
  `image_url`   VARCHAR(500) NOT NULL COMMENT '图片URL',
  `width`       INT          DEFAULT NULL COMMENT '图片宽度',
  `height`      INT          DEFAULT NULL COMMENT '图片高度',
  `status`      VARCHAR(20)  NOT NULL DEFAULT 'pending' COMMENT '状态: pending/success/failed',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted`  TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_ai_images_user_id` (`user_id`),
  KEY `idx_ai_images_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI图片生成记录表';
```

---

## 三、接口数据格式规范（前后端对接）

### 3.1 用户模块接口

```ts
// === 用户注册 ===
// POST /api/v1/users/register
// Request:
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "encrypted_password"
}
// Response:
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com"
  }
}

// === 用户登录 ===
// POST /api/v1/users/login
// Request:
{
  "email": "test@example.com",
  "password": "encrypted_password"
}
// Response:
{
  "code": 0,
  "message": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "userInfo": {
      "id": 1,
      "username": "testuser",
      "email": "test@example.com",
      "avatar": null,
      "role": "user"
    }
  }
}

// === 获取用户信息 ===
// GET /api/v1/users/profile
// Headers: Authorization: Bearer {token}
// Response:
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com",
    "avatar": "https://...",
    "role": "user",
    "createdAt": "2026-01-01T00:00:00Z"
  }
}
```

### 3.2 聊天模块接口

```ts
// === 创建会话 ===
// POST /api/v1/chat/sessions
// Request:
{
  "title": "AI对话",
  "model": "gpt-4"
}
// Response:
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1001,
    "title": "AI对话",
    "model": "gpt-4",
    "status": "active",
    "createdAt": "2026-01-01T00:00:00Z"
  }
}

// === 发送消息（普通） ===
// POST /api/v1/chat/sessions/:id/messages
// Request:
{
  "content": "Hello, AI!",
  "role": "user"
}
// Response:
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 5001,
    "sessionId": 1001,
    "content": "你好！有什么可以帮你的？",
    "role": "assistant",
    "createdAt": "2026-01-01T00:00:00Z"
  }
}

// === 发送消息（SSE 流式） ===
// POST /api/v1/chat/sessions/:id/messages/stream
// Headers: Accept: text/event-stream
// Request:
{
  "content": "用流式回复我",
  "role": "user"
}
// Response (SSE):
// data: {"type":"text","content":"正在"}
// data: {"type":"text","content":"思考"}
// data: {"type":"text","content":"中..."}
// data: {"type":"done","messageId":5002}
```

### 3.3 AI 图片生成接口

```ts
// === 生成图片 ===
// POST /api/v1/ai/images/generate
// Request:
{
  "prompt": "一只可爱的猫咪，数字艺术风格",
  "model": "dall-e-3",
  "width": 1024,
  "height": 1024,
  "count": 1
}
// Response:
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "task_abc123",
    "status": "processing"
  }
}

// === 查询生成结果 ===
// GET /api/v1/ai/images/tasks/:taskId
// Response:
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "task_abc123",
    "status": "completed",        // processing / completed / failed
    "images": [
      {
        "id": 1,
        "url": "https://...",
        "width": 1024,
        "height": 1024
      }
    ]
  }
}
```

### 3.4 AI 拆分素材接口

```ts
// === 拆分素材 ===
// POST /api/v1/ai/split-material
// Request:
{
  "imageUrl": "https://...原始图片URL",
  "prompt": "拆分提示词",
  "imageModel": "gpt-4o",            // AI生图模型
  "outputCount": 4                    // 每层输出数量
}
// Response:
{
  "code": 0,
  "message": "success",
  "data": {
    "taskId": "split_task_001",
    "status": "processing",
    "layers": [
      {
        "name": "背景层",
        "status": "completed",
        "images": [
          { "id": 1, "url": "https://...png", "width": 512, "height": 512 }
        ]
      },
      {
        "name": "角色层",
        "status": "processing",
        "images": []
      }
    ]
  }
}
```

---

## 四、后端代码规范

### 4.1 目录结构规范

```
server/
├── src/
│   ├── controller/     # 控制器（接收请求，调用service）
│   ├── service/        # 业务逻辑层
│   ├── model/          # 数据模型 / ORM 实体
│   ├── middleware/      # 中间件（鉴权、日志、限流等）
│   ├── utils/          # 工具函数
│   ├── config/         # 配置文件
│   ├── constant/       # 常量/枚举定义
│   ├── type/           # 类型定义
│   └── app.ts          # 应用入口
├── migrations/         # 数据库迁移文件
├── seeds/              # 数据填充
├── test/               # 测试
├── package.json
└── tsconfig.json
```

### 4.2 分层职责

| 层级 | 职责 | 规范 |
|------|------|------|
| **Controller** | 接收请求、参数校验、调用Service、返回响应 | 不写业务逻辑，只做参数校验和响应编排 |
| **Service** | 核心业务逻辑、事务管理 | 可调用多个 Model/DAO，负责事务 |
| **Model/DAO** | 数据访问层、ORM操作 | 只做单表操作，不做跨表业务 |
| **Middleware** | 请求预处理 | 认证、日志、限流、错误捕获 |

### 4.3 Controller 规范

```ts
// ✅ 标准 Controller 写法
import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { AuthGuard } from '../middleware/auth.guard';

@Controller('api/v1/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // 获取用户列表
  @Get()
  @UseGuards(AuthGuard)
  async getUsers(@Query('page') page: number, @Query('pageSize') size: number) {
    const data = await this.userService.getUserList({ page, pageSize: size });
    return { code: 0, message: 'success', data };
  }

  // 获取单个用户
  @Get(':id')
  @UseGuards(AuthGuard)
  async getUser(@Param('id') id: string) {
    const data = await this.userService.getUserById(Number(id));
    if (!data) {
      return { code: 10101, message: '用户不存在', data: null };
    }
    return { code: 0, message: 'success', data };
  }

  // 创建用户
  @Post()
  async createUser(@Body() body: CreateUserDto) {
    const data = await this.userService.createUser(body);
    return { code: 0, message: 'success', data };
  }
}
```

### 4.4 Service 规范

```ts
// ✅ 标准 Service 写法
import { Injectable } from '@nestjs/common';
import { UserModel } from '../model/user.model';

@Injectable()
export class UserService {
  constructor(private readonly userModel: UserModel) {}

  // 获取用户列表（带分页）
  async getUserList(params: { page: number; pageSize: number }) {
    const { page, pageSize } = params;
    const offset = (page - 1) * pageSize;
    const [list, total] = await Promise.all([
      this.userModel.findMany({ skip: offset, take: pageSize }),
      this.userModel.count(),
    ]);
    return { list, total, page, pageSize };
  }

  // 获取单个用户
  async getUserById(id: number) {
    return this.userModel.findUnique({ where: { id } });
  }

  // 创建用户（带事务）
  async createUser(data: { username: string; email: string; password: string }) {
    // 密码加密
    const hashedPassword = await bcrypt.hash(data.password, 10);
    return this.userModel.create({
      data: {
        ...data,
        password: hashedPassword,
      },
    });
  }
}
```

### 4.5 命名规范

| 元素 | 规则 | 示例 |
|------|------|------|
| 类名 | PascalCase | `UserService`, `AuthController` |
| 方法名 | camelCase | `getUserList()`, `createUser()` |
| 变量名 | camelCase | `userList`, `hashedPassword` |
| 常量 | UPPER_SNAKE_CASE | `MAX_LOGIN_ATTEMPTS`, `TOKEN_EXPIRES_IN` |
| 文件 | kebab-case | `user.controller.ts`, `auth.guard.ts` |
| 数据库字段 | snake_case | `user_id`, `created_at` |
| API 路径 | kebab-case | `/api/v1/chat-sessions` |

---

## 五、安全规范

### 5.1 认证与授权

```ts
// ✅ JWT Token 认证
// 1. 登录成功后返回 token
// 2. 前端携带 token 在 Authorization header
// 3. 后端验证 token 有效性

// Token 格式
{
  "alg": "HS256",
  "typ": "JWT"
}
{
  "userId": 1,
  "role": "user",
  "iat": 1700000000,
  "exp": 1700086400    // 默认24小时过期
}

// ✅ 密码加密
// 使用 bcrypt 或 argon2 加密，禁止明文存储
const hashedPassword = await bcrypt.hash(password, 10);
const isValid = await bcrypt.compare(inputPassword, hashedPassword);
```

### 5.2 接口安全规范

| 规范 | 说明 |
|------|------|
| ✅ **HTTPS** | 生产环境强制 HTTPS |
| ✅ **速率限制** | 登录接口限制 5次/分钟，普通接口 100次/分钟 |
| ✅ **参数校验** | 所有输入参数必须校验类型和格式 |
| ✅ **SQL注入防护** | 使用 ORM 框架，禁止拼接 SQL |
| ✅ **XSS防护** | 输出 HTML 时做转义处理 |
| ✅ **CORS配置** | 只允许白名单域名跨域访问 |

---

## 六、日志规范

### 6.1 日志级别

| 级别 | 使用场景 |
|------|---------|
| ERROR | 系统异常、数据库错误、第三方服务调用失败 |
| WARN | 参数异常、业务逻辑警告、降级处理 |
| INFO | 关键业务流程记录（登录、注册、下单等） |
| DEBUG | 开发调试信息，生产环境关闭 |

### 6.2 日志格式

```ts
// ✅ 统一结构化日志
{
  "timestamp": "2026-01-01T00:00:00.000Z",
  "level": "INFO",
  "context": "UserService",
  "message": "用户登录成功",
  "userId": 1,
  "ip": "192.168.1.1",
  "duration": 123,       // 请求耗时(ms)
  "traceId": "trace_xxx" // 链路追踪ID
}
```

---

## 七、错误处理规范

### 7.1 全局异常过滤器

```ts
// ✅ 统一异常处理
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let code = 50000;
    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
      code = exception.getStatus() === 400 ? 10001 : code;
      message = exception.message;
    } else if (exception instanceof BusinessException) {
      code = exception.errorCode;
      message = exception.message;
    }

    logger.error(`[${code}] ${message}`, exception);

    response.status(200).json({ code, message, data: null });
  }
}
```

### 7.2 业务异常类

```ts
// ✅ 自定义业务异常
export class BusinessException extends Error {
  constructor(
    public errorCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'BusinessException';
  }
}
```

---

## 八、性能与测试规范

### 8.1 数据库查询优化

```ts
// ✅ 使用索引查询
// ✅ 避免 N+1 查询，使用 Include/Join
// ✅ 大列表使用分页查询
// ✅ 使用 Redis 缓存热点数据

// ✅ 示例：缓存热点数据
const CACHE_KEY = `user:${userId}`;
let user = await redis.get(CACHE_KEY);
if (!user) {
  user = await userModel.findUnique({ where: { id: userId } });
  await redis.set(CACHE_KEY, JSON.stringify(user), 'EX', 3600);
}
```

### 8.2 接口性能目标

| 指标 | 目标 |
|------|------|
| 接口平均响应时间 | < 200ms |
| 数据库查询耗时 | < 50ms |
| 第三方API调用超时 | 30s（普通）/ 10min（图片生成） |
| 单接口 QPS | > 1000 |
| 可用性 | 99.9% |

### 8.3 单元测试

```ts
// ✅ 使用 Jest 编写测试
describe('UserService', () => {
  it('should create a new user', async () => {
    const result = await userService.createUser({
      username: 'test',
      email: 'test@test.com',
      password: '123456',
    });
    expect(result).toHaveProperty('id');
    expect(result.username).toBe('test');
  });

  it('should throw error when email exists', async () => {
    await expect(
      userService.createUser({
        username: 'test2',
        email: 'existing@test.com',
        password: '123456',
      }),
    ).rejects.toThrow(BusinessException);
  });
});
```

---

## 九、前端对接注意事项

### 9.1 前端 Service 层对应关系

| 前端服务文件 | 对应后端接口 |
|-------------|-------------|
| `src/services/user.ts` | `/api/v1/users/*` |
| `src/services/chat.ts` | `/api/v1/chat/*` |
| `src/services/AiImage.ts` | `/api/v1/ai/images/*` |
| `src/services/AiSplitMaterial.ts` | `/api/v1/ai/split-material/*` |
| `src/services/admin.ts` | `/api/v1/admin/*` |

### 9.2 接口变更通知

```
1. 新增接口 → 在对应 service 文件中添加方法
2. 修改接口 → 同步更新 service 和 type.d.ts
3. 废弃接口 → 标注 @deprecated，保留至少一个版本
4. 接口文档 → 保持与后端 swagger/文档同步
```

### 9.3 前后端字段命名映射

```ts
// ✅ 后端使用 snake_case，前端 TypeScript 使用 camelCase
// 由前端 require.ts 中的拦截器做自动转换

// 后端返回:
{ "user_id": 1, "created_at": "2026-01-01T00:00:00Z" }

// 前端使用:
{ userId: 1, createdAt: "2026-01-01T00:00:00Z" }

// ✅ 或者统一使用 camelCase（推荐）
// 后端也直接返回 camelCase 格式，减少转换开销
```

---

## 十、快速参考

### 新增一个业务模块的步骤

```
后端：
1. 创建数据库表（migration）
2. 创建 Model/DAO
3. 创建 Service（业务逻辑）
4. 创建 Controller（路由注册）
5. 添加参数校验 DTO
6. 编写单元测试

前端同步：
1. 添加 API 类型定义（src/services/types/）
2. 添加 Service 方法（src/services/）
3. 添加页面/组件
```

### 常用中间件清单

| 中间件 | 功能 |
|--------|------|
| AuthGuard | JWT 鉴权 |
| RateLimitGuard | 接口速率限制 |
| LoggingInterceptor | 请求日志记录 |
| TransformInterceptor | 响应格式统一 |
| TimeoutInterceptor | 请求超时处理 |

---

> **维护说明**：本规范应随项目迭代同步更新，新增模块或调整架构时请及时修改本文档。
> 最后更新时间：2026-05-23
