/**
 * 🐑 SheepKing Web Chat - 入口文件
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.less';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('找不到 #root 元素，请检查 index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
