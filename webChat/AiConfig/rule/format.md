# React 前端开发规范手册

> 适用项目：twosheep-workshop（React + TypeScript + Vite + Less）
> 版本：v1.0

---

## 一、项目结构规范

### 1.1 顶层目录结构

```
src/
├── main.tsx              # 主入口文件
├── App.tsx               # 根组件
├── global.less           # 全局样式
│
├── components/           # 通用可复用组件（全局共享）
│   └── ComponentName/
│       ├── index.tsx
│       ├── style.module.less
│       ├── service.ts    # (可选) 组件专属API服务
│       ├── type.d.ts     # (可选) 组件专属类型定义
│       └── utils.ts      # (可选) 组件专属工具函数
│
├── pages/                # 页面模块（按业务域划分）
│   └── PageName/
│       ├── index.tsx
│       ├── style.module.less
│       ├── service.ts
│       ├── type.d.ts
│       └── components/   # (可选) 页面私有组件
│
├── Layout/               # 布局组件
│   ├── index.tsx
│   ├── style.module.less
│   └── components/
│
├── store/                # 全局状态管理（Redux）
│   ├── index.ts
│   └── reducers/
│
├── services/             # API 服务层
│   ├── admin.ts
│   ├── chat.ts
│   ├── user.ts
│   └── types/            # API 响应类型定义
│
├── utils/                # 工具函数
│   ├── routes.ts
│   └── request.ts
│
├── Hooks/                # 自定义 Hooks
│
├── types/                # 全局类型定义
│
├── assets/               # 静态资源（图片、字体等）
│
└── error/                # 错误页面
```

### 1.2 文件命名规范

| 类型 | 命名规则 | 示例 |
|------|---------|------|
| 组件目录/文件 | PascalCase | `AiChat/`, `SplitMaterial/` |
| 普通 TS/JS 文件 | camelCase | `request.ts`, `userInfo_reducer.ts` |
| 样式文件 | kebab-case + .module.less | `style.module.less` |
| 类型定义文件 | kebab-case + .d.ts | `userInfo.d.ts` |
| 服务文件 | camelCase | `admin.ts`, `AiImage.ts` |
| 常量/配置 | camelCase / UPPER_SNAKE_CASE | `routes.ts`, `API_BASE_URL` |

> **原则**：组件相关文件使用 PascalCase，非组件逻辑文件使用 camelCase。

---

## 二、组件编写规范

### 2.1 组件结构（推荐顺序）

```tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { message } from 'antd';
import type { FC } from 'react';

import styles from './style.module.less';
import type { YourComponentProps } from './type';

// 常量定义
const DEFAULT_VALUE = '';

// 组件定义
const ComponentName: FC<YourComponentProps> = (props) => {
  const { prop1, prop2 } = props;

  // ---- State ----
  const [state1, setState1] = useState<string>('');

  // ---- Redux ----
  const dispatch = useDispatch();
  const globalState = useSelector((state: RootState) => state.someModule);

  // ---- Refs ----
  const ref1 = useRef<HTMLDivElement>(null);

  // ---- 副作用 ----
  useEffect(() => {
    // 组件挂载/更新逻辑
    return () => {
      // 清理逻辑
    };
  }, []);

  // ---- 计算属性 ----
  const computedValue = useMemo(() => {
    return state1.toUpperCase();
  }, [state1]);

  // ---- 事件处理 ----
  const handleClick = useCallback(() => {
    // 事件处理逻辑
  }, []);

  const handleAsyncAction = useCallback(async () => {
    try {
      const res = await fetchData();
      setState1(res.data);
    } catch (error) {
      message.error('操作失败');
    }
  }, []);

  // ---- 渲染辅助 ----
  const renderItemList = () => {
    return list.map((item) => (
      <div key={item.id}>{item.name}</div>
    ));
  };

  // ---- 条件渲染 ----
  if (!data) return <Loading />;

  // ---- JSX ----
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>{computedValue}</h1>
        <button onClick={handleClick}>点击</button>
      </div>
      <div className={styles.content}>
        {renderItemList()}
      </div>
    </div>
  );
};

export default ComponentName;
```

### 2.2 组件类型定义（type.d.ts）

```ts
// 组件 Props 类型
export interface ComponentNameProps {
  /** 标题文本 */
  title: string;
  /** 数据列表 */
  dataList: DataItem[];
  /** 点击回调 */
  onSelect?: (item: DataItem) => void;
  /** 加载状态 */
  loading?: boolean;
}

// 数据项类型
export interface DataItem {
  id: string;
  name: string;
  [key: string]: unknown;
}
```

### 2.3 组件编写黄金规则

| 规则 | 说明 |
|------|------|
| ✅ **使用 FC 类型** | `const Comp: FC<Props> = (props) => {}` |
| ✅ **Props 解构** | 在函数参数中直接解构 props |
| ✅ **使用 useCallback** | 所有函数/事件处理都包裹 `useCallback` |
| ✅ **使用 useMemo** | 复杂计算使用 `useMemo` 缓存 |
| ✅ **清理副作用** | useEffect 返回清理函数 |
| ✅ **导出默认** | `export default ComponentName` |
| ❌ **避免类组件** | 统一使用函数组件 + Hooks |
| ❌ **避免内联函数** | 不使用 `onClick={() => {}}` 这种写法 |

---

## 三、样式规范（Less + CSS Modules）

### 3.1 样式文件命名

- 使用 `style.module.less` 作为文件名，启用 CSS Modules 隔离
- 全局样式放在 `src/global.less` 中

### 3.2 样式编写规范

```less
// style.module.less

// ---- 布局 ----
.container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

// ---- 头部 ----
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: #fff;
}

// ---- 内容区 ----
.content {
  flex: 1;
  padding: 24px;
}

// ---- 列表 ----
.list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.item {
  padding: 12px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  transition: all 0.3s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

// ---- 状态 ----
.active {
  color: #1890ff;
  font-weight: 600;
}

.disabled {
  opacity: 0.5;
  pointer-events: none;
}

// ---- 响应式 ----
@media (max-width: 768px) {
  .container {
    padding: 12px;
  }
}
```

### 3.3 样式规范要点

| 规则 | 说明 |
|------|------|
| ✅ **CSS Modules** | 所有样式使用 `.module.less`，避免全局污染 |
| ✅ **语义化类名** | 使用 `.container`、`.header`、`.content` 等 |
| ✅ **BEM 思想** | 虽然 CSS Modules 隔离了作用域，但建议嵌套层级清晰 |
| ✅ **CSS 变量** | 全局颜色/尺寸使用 CSS 变量或 Less 变量 |
| ✅ **响应式设计** | 关键布局添加媒体查询适配 |
| ❌ **避免 !important** | 尽量不使用 `!important` |
| ❌ **避免深层嵌套** | Less 嵌套不超过 4 层 |

---

## 四、TypeScript 规范

### 4.1 类型定义原则

```ts
// ✅ 优先使用 interface 定义对象类型
export interface UserInfo {
  id: string;
  name: string;
  email: string;
  avatar?: string; // 可选属性用 ?
  readonly createdAt: string; // 只读属性
}

// ✅ 复杂联合类型使用 type
export type RequestStatus = 'idle' | 'loading' | 'success' | 'error';

// ✅ 泛型约束
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// ✅ Record 类型映射
export type UserMap = Record<string, UserInfo>;

// ❌ 避免 any
// ❌ export function fetchData(): any { }
```

### 4.2 类型文件组织

```
types/
├── userInfo.d.ts        # 用户信息类型
├── route.d.ts           # 路由类型
├── AiChat.d.ts          # AI聊天类型
├── ApiRequest.d.ts      # API请求类型
└── vite-env.d.ts        # 环境类型

services/types/
├── AiImage.d.ts         # AI图片API响应类型
├── chat.d.ts            # 聊天API响应类型
└── user.d.ts            # 用户API响应类型
```

### 4.3 枚举与常量

```ts
// ✅ 使用 const enum 或联合类型
export const enum PageStatus {
  Loading = 'loading',
  Success = 'success',
  Error = 'error',
}

// ✅ 或者使用 as const
export const PAGE_SIZE = 20 as const;
export const API_BASE = '/api/v1' as const;
```

---

## 五、Redux 状态管理规范

### 5.1 Reducer 结构

```ts
// store/reducers/userInfo_reducer.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UserState {
  userInfo: UserInfo | null;
  isLogin: boolean;
  loading: boolean;
}

const initialState: UserState = {
  userInfo: null,
  isLogin: false,
  loading: false,
};

const userSlice = createSlice({
  name: 'userInfo',
  initialState,
  reducers: {
    setUserInfo(state, action: PayloadAction<UserInfo>) {
      state.userInfo = action.payload;
      state.isLogin = true;
    },
    clearUserInfo(state) {
      state.userInfo = null;
      state.isLogin = false;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
  },
});

export const { setUserInfo, clearUserInfo, setLoading } = userSlice.actions;
export default userSlice.reducer;
```

### 5.2 使用 Hooks

```ts
// 组件中使用 Redux
import { useSelector, useDispatch } from 'react-redux';

const dispatch = useDispatch();
const userInfo = useSelector((state: RootState) => state.userInfo);

// ✅ 使用 useCallback 包裹 dispatch 调用
const handleLogin = useCallback(() => {
  dispatch(setUserInfo({ id: '1', name: '张三' }));
}, [dispatch]);
```

---

## 六、API 服务规范

### 6.1 服务文件结构

```ts
// services/chat.ts
import request from '@/utils/request';
import type { ChatMessage, ChatResponse } from './types/chat';

/** 获取聊天列表 */
export function getChatList(params: { page: number; size: number }) {
  return request.get<ApiResponse<ChatMessage[]>>('/chat/list', { params });
}

/** 发送消息 */
export function sendMessage(data: { content: string; sessionId: string }) {
  return request.post<ApiResponse<ChatResponse>>('/chat/send', data);
}

/** SSE 流式对话（使用 Hook） */
// 建议封装在 Hooks 中，如 useSSE
```

### 6.2 请求工具使用规范

```ts
// utils/request.ts
// ✅ 统一使用封装的 request 工具
// ✅ 自动携带 token
// ✅ 统一处理错误
// ✅ 统一处理超时

import axios, { AxiosRequestConfig } from 'axios';

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 30000,
});

// 请求拦截器 - 添加 token
request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器 - 统一处理
request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // 统一错误处理
    return Promise.reject(error);
  }
);

export default request;
```

---

## 七、路由规范

### 7.1 路由配置

```ts
// config/routes.ts
export interface RouteConfig {
  path: string;
  name: string;
  component: React.LazyExoticComponent<React.FC>;
  auth?: boolean;       // 是否需要登录
  admin?: boolean;      // 是否需要管理员权限
  children?: RouteConfig[];
}

// ✅ 使用 React.lazy 懒加载
const Home = React.lazy(() => import('@/pages/Home'));
const Chat = React.lazy(() => import('@/pages/AI/Chat'));
const AdminLayout = React.lazy(() => import('@/pages/Admin/Layout'));
```

### 7.2 路由命名规范

| 路径 | 说明 |
|------|------|
| `/` | 首页 Home |
| `/login` | 登录页 |
| `/profile` | 个人中心 |
| `/ai/chat` | AI聊天 |
| `/ai/generate-image` | AI生成图片 |
| `/ai/split-material` | AI拆分素材 |
| `/admin/dashboard` | 管理后台仪表盘 |
| `/admin/users` | 用户管理 |
| `/admin/ai-chats` | 聊天记录管理 |
| `/admin/ai-images` | 图片管理 |

---

## 八、Hooks 规范

### 8.1 自定义 Hook 命名

```ts
// ✅ 以 use 开头，camelCase 命名
// ✅ 单一职责原则
// ✅ 返回对象时解构使用

// Hooks/useCheckMobile.ts
export function useCheckMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}

// Hooks/useSSE.ts - SSE流式请求
export function useSSE(options: SSEOptions): SSEReturn {
  // ...
}
```

### 8.2 Hook 使用规则

```ts
// ✅ 只在组件顶层调用 Hook
function Component() {
  const isMobile = useCheckMobile();
  // ...
}

// ❌ 不要在条件/循环中调用 Hook
// if (condition) {
//   const isMobile = useCheckMobile(); // ❌
// }
```

---

## 九、注释规范

### 9.1 注释风格

```ts
// ✅ 组件顶部添加功能说明
/**
 * Chat 聊天页面组件
 * 功能：展示聊天对话列表，支持发送消息、流式 SSE 响应
 */

// ✅ 复杂逻辑添加行内注释
// 对消息列表按时间分组，每天一个分组标签
const groupedMessages = useMemo(() => {
  return groupBy(messages, (msg) => formatDate(msg.createdAt));
}, [messages]);

// ✅ API 函数添加 JSDoc
/**
 * 发送聊天消息
 * @param content - 消息内容
 * @param sessionId - 会话ID
 * @returns 返回消息响应
 */
```

### 9.2 提交规范

```
feat: 新功能
fix: 修复bug
refactor: 重构
style: 样式修改
docs: 文档修改
chore: 构建/工具链
perf: 性能优化
```

---

## 十、图片/多媒体资源规范

### 10.1 资源存放

```
src/assets/
├── logo/          # Logo 图标
├── images/        # 通用图片
└── fonts/         # 字体文件

public/
├── fonts/         # 公共字体
└── favicon.ico    # 图标
```

### 10.2 资源引用

```ts
// ✅ 使用 import 引入（经过 webpack/vite 处理）
import logo from '@/assets/logo/logo.png';

// ✅ CSS 中使用相对路径
// background: url('~@/assets/logo/logo.png');
```

---

## 十一、错误处理规范

### 11.1 API 错误处理

```ts
try {
  const res = await fetchData();
  // ✅ 使用 Ant Design message 提示
  message.success('操作成功');
} catch (error) {
  // ✅ 统一错误处理
  if (error.response?.status === 401) {
    // 未授权，跳转登录
    navigate('/login');
  } else {
    message.error(error.message || '请求失败，请重试');
  }
}
```

### 11.2 组件错误边界

```tsx
// 使用 ErrorBoundary 包裹关键组件
<ErrorBoundary fallback={<ErrorPage />}>
  <YourComponent />
</ErrorBoundary>
```

---

## 十二、性能优化规范

| 优化点 | 做法 |
|--------|------|
| 组件懒加载 | 使用 `React.lazy` + `Suspense` |
| 避免重复渲染 | 使用 `React.memo`、`useMemo`、`useCallback` |
| 列表 key | 始终使用唯一且稳定的 key |
| 大列表 | 使用虚拟滚动（如 react-window） |
| 图片优化 | 使用懒加载、WebP 格式 |
| 请求缓存 | 合理使用 SWR/React Query 或手动缓存 |
| 事件监听 | useEffect 中及时移除事件监听 |

---

## 十三、快速参考

### 创建新组件的步骤

```
1. 在 components/ 或 pages/ 下创建 ComponentName/ 目录
2. 创建 index.tsx  → 组件代码
3. 创建 style.module.less → 样式代码
4. (可选) 创建 type.d.ts → 类型定义
5. (可选) 创建 service.ts → API 服务
6. 在路由配置中注册（页面组件）
```

### 常用 Ant Design 组件

| 场景 | 推荐组件 |
|------|---------|
| 布局 | Layout, Row, Col |
| 导航 | Menu, Breadcrumb |
| 数据录入 | Form, Input, Select, Upload |
| 数据展示 | Table, List, Card, Collapse |
| 反馈 | Modal, Drawer, message, notification |
| 通用 | Button, Spin, Empty, Skeleton |

---

> **维护说明**：本规范应与项目同步更新，如有新的最佳实践或工具引入，请及时更新本文档。
> 最后更新时间：2026-05-23
