import React from 'react';

const BlueHomepage = () => {
  // 功能卡片数据
  const featureCards = [
    {
      id: 1,
      title: '快速开发',
      description: '使用React和Tailwind CSS快速构建现代化界面',
      icon: '🚀',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      id: 2,
      title: '响应式设计',
      description: '完美适配各种屏幕尺寸，从手机到桌面端',
      icon: '📱',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      id: 3,
      title: '性能优化',
      description: '优化的代码结构和最佳实践确保最佳性能',
      icon: '⚡',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      id: 4,
      title: '易于维护',
      description: '清晰的代码结构和文档便于团队协作和维护',
      icon: '🔧',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* 深蓝色导航栏 */}
      <nav className="bg-gradient-to-r from-blue-800 to-blue-900 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">R</span>
              </div>
              <span className="text-xl font-bold">BlueReact</span>
            </div>
            
            <div className="hidden md:flex space-x-8">
              <a href="#home" className="hover:text-blue-300 transition-colors">首页</a>
              <a href="#features" className="hover:text-blue-300 transition-colors">功能</a>
              <a href="#about" className="hover:text-blue-300 transition-colors">关于</a>
              <a href="#contact" className="hover:text-blue-300 transition-colors">联系</a>
            </div>
            
            <button className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors">
              开始使用
            </button>
          </div>
        </div>
      </nav>

      {/* 主内容区域 */}
      <main className="container mx-auto px-4 py-12">
        {/* 欢迎标题区域 */}
        <section className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-blue-900 mb-6">
            欢迎来到<span className="text-blue-600"> BlueReact</span>
          </h1>
          <p className="text-xl text-blue-700 max-w-3xl mx-auto mb-10">
            一个基于React和Tailwind CSS构建的现代化蓝色主题首页组件
          </p>
          
          {/* 渐变按钮 */}
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-3 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 shadow-lg">
              立即开始
            </button>
            <button className="border-2 border-blue-500 text-blue-600 hover:bg-blue-50 px-8 py-3 rounded-lg text-lg font-semibold transition-colors">
              了解更多
            </button>
          </div>
        </section>

        {/* 蓝色渐变主内容区域 */}
        <section className="bg-gradient-to-br from-blue-100 via-white to-blue-50 rounded-2xl p-8 md:p-12 mb-16 shadow-xl">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold text-blue-900 mb-4">
                为什么选择BlueReact？
              </h2>
              <p className="text-blue-800 mb-6">
                BlueReact是一个精心设计的React组件，采用现代化的蓝色调设计语言，
                结合Tailwind CSS的实用性和React的组件化优势，为您提供出色的用户体验。
              </p>
              <ul className="space-y-3">
                <li className="flex items-center text-blue-700">
                  <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center mr-3">✓</span>
                  完全响应式设计
                </li>
                <li className="flex items-center text-blue-700">
                  <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center mr-3">✓</span>
                  现代化蓝色主题
                </li>
                <li className="flex items-center text-blue-700">
                  <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center mr-3">✓</span>
                  易于定制和扩展
                </li>
              </ul>
            </div>
            <div className="bg-gradient-to-tr from-blue-400 to-blue-600 rounded-xl p-6 h-64 flex items-center justify-center">
              <div className="text-white text-center">
                <div className="text-6xl mb-4">🎨</div>
                <p className="text-xl font-semibold">蓝色主题展示</p>
                <p className="opacity-90">渐变效果和卡片设计</p>
              </div>
            </div>
          </div>
        </section>

        {/* 功能卡片展示区 */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-center text-blue-900 mb-12">
            核心功能
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featureCards.map((card) => (
              <div 
                key={card.id}
                className={`${card.bgColor} border ${card.borderColor} rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}
              >
                <div className="text-4xl mb-4">{card.icon}</div>
                <h3 className="text-xl font-bold text-blue-800 mb-3">{card.title}</h3>
                <p className="text-blue-700">{card.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 统计信息区域 */}
        <section className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl p-8 mb-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-700">100%</div>
              <div className="text-blue-600">响应式</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-700">50+</div>
              <div className="text-blue-600">组件</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-700">24/7</div>
              <div className="text-blue-600">支持</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-700">1k+</div>
              <div className="text-blue-600">用户</div>
            </div>
          </div>
        </section>
      </main>

      {/* 页脚 */}
      <footer className="bg-gradient-to-r from-blue-900 to-blue-800 text-white py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-10 h-10 bg-blue-400 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xl">R</span>
                </div>
                <span className="text-2xl font-bold">BlueReact</span>
              </div>
              <p className="text-blue-200">
                一个现代化的React蓝色主题首页组件，专为构建美观的用户界面而设计。
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-bold mb-4">快速链接</h3>
              <ul className="space-y-2">
                <li><a href="#home" className="text-blue-200 hover:text-white transition-colors">首页</a></li>
                <li><a href="#features" className="text-blue-200 hover:text-white transition-colors">功能</a></li>
                <li><a href="#docs" className="text-blue-200 hover:text-white transition-colors">文档</a></li>
                <li><a href="#contact" className="text-blue-200 hover:text-white transition-colors">联系我们</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-xl font-bold mb-4">联系我们</h3>
              <p className="text-blue-200 mb-2">📧 contact@bluereact.com</p>
              <p className="text-blue-200 mb-2">📞 +1 (555) 123-4567</p>
              <p className="text-blue-200">📍 123 Blue Street, React City</p>
            </div>
          </div>
          
          <div className="border-t border-blue-700 mt-8 pt-6 text-center text-blue-300">
            <p>© {new Date().getFullYear()} BlueReact. 保留所有权利。</p>
            <p className="mt-2">使用React和Tailwind CSS构建</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BlueHomepage;