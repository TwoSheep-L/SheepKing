# BlueReact 首页组件

一个现代化的蓝色调React首页组件，使用Tailwind CSS进行样式设计。

## 功能特性

- 🎨 **蓝色主题设计** - 深蓝色导航栏和渐变背景
- 📱 **完全响应式** - 适配各种屏幕尺寸
- 🚀 **现代化UI** - 使用Tailwind CSS和渐变效果
- 🃏 **功能卡片** - 4个精心设计的蓝色调卡片
- 🎯 **易于使用** - 简单的导入和使用方式

## 组件结构

```
BlueHomepage.jsx
├── 深蓝色导航栏
├── 欢迎标题区域
├── 蓝色渐变主内容区
├── 功能卡片展示区（4个卡片）
├── 统计信息区域
└── 页脚信息
```

## 安装和使用

### 1. 确保已安装React和Tailwind CSS

```bash
# 如果使用Create React App
npx create-react-app my-app
cd my-app

# 安装Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 2. 配置Tailwind CSS

在 `tailwind.config.js` 中添加：

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

在 `src/index.css` 中添加：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 3. 复制组件文件

将 `BlueHomepage.jsx` 复制到你的React项目的 `src/components` 目录中。

### 4. 使用组件

在 `App.js` 中：

```jsx
import React from 'react';
import BlueHomepage from './components/BlueHomepage';

function App() {
  return (
    <div className="App">
      <BlueHomepage />
    </div>
  );
}

export default App;
```

## 自定义配置

### 修改卡片内容

在 `BlueHomepage.jsx` 中修改 `featureCards` 数组：

```javascript
const featureCards = [
  {
    id: 1,
    title: '你的标题',
    description: '你的描述',
    icon: '🎯',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  // ... 更多卡片
];
```

### 修改颜色主题

组件使用了以下蓝色调类名：

- 深蓝色：`bg-blue-800`, `bg-blue-900`
- 中等蓝色：`bg-blue-600`, `bg-blue-700`
- 浅蓝色：`bg-blue-50`, `bg-blue-100`
- 渐变：`from-blue-... to-blue-...`

## 浏览器支持

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 许可证

MIT