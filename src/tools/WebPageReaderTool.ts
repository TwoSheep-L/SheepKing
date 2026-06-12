import { AgentTool } from "@/core/BaseAgentTool.js";
import axios from "axios";
import * as cheerio from "cheerio";

interface IWebPageReaderParams {
    url: string;
    maxLength?: number;
    extractMode?: "auto" | "article" | "full";
}

/**
 * WebPageReaderTool - 网页内容读取工具
 * 
 * 功能：获取指定URL的网页内容，提取可读的正文文本
 * 支持文章模式（自动提取正文）和全文模式（提取所有文本）
 * 自动处理编码、去除广告和导航等干扰元素
 */
export default class WebPageReaderTool extends AgentTool<IWebPageReaderParams> {
    constructor() {
        super({
            name: "WebPageReaderTool",
            description: "读取指定网页的详细内容，返回清洗后的可读文本。适用于需要查看新闻文章、百科词条、商品详情等网页内容的场景。可自动识别并提取正文，去除广告和导航干扰。",
            parameters: [
                {
                    name: "url",
                    type: "string",
                    description: "要读取的网页完整URL地址（含http://或https://）",
                    required: true,
                },
                {
                    name: "maxLength",
                    type: "number",
                    description: "返回内容的最大字符数，默认3000，最大10000",
                    required: false,
                },
                {
                    name: "extractMode",
                    type: "string",
                    description: "提取模式：'auto'自动识别正文（默认）、'article'专注文章正文、'full'获取全部文本",
                    required: false,
                },
            ],
        });

        this.timeout = 20000;
        this.maxRetries = 2;

        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        ];
    }

    private timeout: number;
    private maxRetries: number;
    private userAgents: string[];

    /**
     * 随机获取User-Agent
     */
    private getRandomUA(): string {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    /**
     * 构建请求头
     */
    private buildHeaders(url: string): Record<string, string> {
        const ua = this.getRandomUA();
        return {
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Referer': new URL(url).origin + '/',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
        };
    }

    /**
     * 判断URL是否有效
     */
    private isValidUrl(url: string): boolean {
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
            return false;
        }
    }

    /**
     * 提取页面标题
     */
    private extractTitle($: cheerio.CheerioAPI): string {
        // 优先使用 og:title
        const ogTitle = $('meta[property="og:title"]').attr('content');
        if (ogTitle) return ogTitle.trim();

        // 其次使用 title 标签
        const title = $('title').text().trim();
        if (title) return title;

        // 最后使用 h1
        const h1 = $('h1').first().text().trim();
        if (h1) return h1;

        return '无标题';
    }

    /**
     * 提取页面描述
     */
    private extractDescription($: cheerio.CheerioAPI): string {
        const ogDesc = $('meta[property="og:description"]').attr('content');
        if (ogDesc) return ogDesc.trim();

        const metaDesc = $('meta[name="description"]').attr('content');
        if (metaDesc) return metaDesc.trim();

        return '';
    }

    /**
     * 提取文章模式内容 - 智能识别正文区域
     */
    private extractArticleContent($: cheerio.CheerioAPI): string {
        // 常见的正文容器选择器（按优先级排列）
        const articleSelectors = [
            'article',
            '.article-content',
            '.post-content',
            '.entry-content',
            '.content-article',
            '.article-detail',
            '.news-content',
            '#content',
            '.content',
            '.main-content',
            '.article-body',
            '.text-content',
            '#article',
            '.detail-content',
            '.page-content',
            'main',
            '.rich-content',
            '.article-text',
            '.content-main',
            '.article_con',
            '.detail-article',
        ];

        // 尝试按选择器查找
        for (const selector of articleSelectors) {
            const el = $(selector);
            if (el.length > 0) {
                const text = el.text().trim();
                if (text.length > 100) {
                    return this.cleanText(text);
                }
            }
        }

        // 如果没找到明显的文章容器，使用启发式方法
        // 找到文本密度最大的区域
        let bestText = '';
        let bestScore = 0;

        $('div, section, p').each((_, el) => {
            const text = $(el).text().trim();
            // 计算文本长度 / 标签嵌套深度
            const childCount = $(el).children().length;
            const textLen = text.length;
            if (childCount > 0) {
                const score = textLen / childCount;
                if (score > bestScore && textLen > 200) {
                    bestScore = score;
                    bestText = text;
                }
            }
        });

        if (bestText) {
            return this.cleanText(bestText);
        }

        // 最后兜底：获取所有 p 标签文本
        let pText = '';
        $('p').each((_, el) => {
            const text = $(el).text().trim();
            if (text.length > 20) {
                pText += text + '\n\n';
            }
        });

        return this.cleanText(pText) || '未找到可读的正文内容';
    }

    /**
     * 清洗文本：去除多余空白、特殊字符
     */
    private cleanText(text: string): string {
        return text
            .replace(/\s+/g, ' ')           // 合并空白
            .replace(/\n{3,}/g, '\n\n')      // 限制空行
            .replace(/&nbsp;/g, ' ')         // HTML空格
            .replace(/&lt;/g, '<')           // HTML实体
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
    }

    /**
     * 提取全文模式内容
     */
    private extractFullContent($: cheerio.CheerioAPI): string {
        // 移除不需要的元素
        const removeSelectors = [
            'script', 'style', 'noscript', 'iframe',
            'svg', 'nav', '.nav', '.navbar', '.menu',
            '.sidebar', '#sidebar', '.footer', 'footer',
            '.header', 'header', '.ad', '.ads', '.advertisement',
            '.banner', '.popup', '.modal', '.cookie',
            '.comment', '.comments', '#comment',
        ];

        for (const sel of removeSelectors) {
            $(sel).remove();
        }

        // 获取 body 文本
        const body = $('body').text().trim();
        return this.cleanText(body);
    }

    /**
     * 提取页面元数据
     */
    private extractMetadata($: cheerio.CheerioAPI): Record<string, string> {
        const meta: Record<string, string> = {};

        // 提取各种meta信息
        const metaTags = [
            'author', 'keywords', 'og:type', 'og:site_name',
            'article:published_time', 'article:author',
            'twitter:card', 'twitter:site',
        ];

        for (const tag of metaTags) {
            const content = $(`meta[property="${tag}"], meta[name="${tag}"]`).attr('content');
            if (content) {
                meta[tag] = content.trim();
            }
        }

        return meta;
    }

    /**
     * 格式化输出
     */
    private formatOutput(
        title: string,
        description: string,
        content: string,
        url: string,
        meta: Record<string, string>,
        contentType: string
    ): string {
        let output = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        output += `  📄 网页内容 | ${contentType}\n`;
        output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        output += `📌 标题：${title}\n`;
        if (description) {
            output += `📝 描述：${description}\n`;
        }
        if (meta.author) {
            output += `✍️ 作者：${meta.author}\n`;
        }
        if (meta['article:published_time']) {
            output += `📅 发布时间：${meta['article:published_time']}\n`;
        }
        output += `🔗 链接：${url}\n`;
        if (meta['og:site_name']) {
            output += `🌐 站点：${meta['og:site_name']}\n`;
        }
        output += `\n`;

        output += `────────── 正文内容 ──────────\n\n`;
        output += content;
        output += `\n\n`;
        output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        output += `内容长度：${content.length} 字符\n`;
        output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

        return output;
    }

    async execute(params: IWebPageReaderParams): Promise<string> {
        const { url, maxLength = 3000, extractMode = "auto" } = params;

        // 验证URL
        if (!url?.trim()) {
            return '❌ 请输入要读取的网页URL';
        }

        let finalUrl = url.trim();
        if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
            finalUrl = 'https://' + finalUrl;
        }

        if (!this.isValidUrl(finalUrl)) {
            return `❌ 无效的URL地址: ${url}\n请输入完整的网址（以 http:// 或 https:// 开头）`;
        }

        let lastError = '';

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await axios.get(finalUrl, {
                    headers: this.buildHeaders(finalUrl),
                    timeout: this.timeout,
                    responseType: 'text',
                    maxRedirects: 5,
                    decompress: true,
                    // 自动处理编码
                    transformResponse: [(data) => data],
                });

                const html = response.data;
                if (!html || html.length < 100) {
                    throw new Error('返回内容为空或过短');
                }

                const $ = cheerio.load(html);
                const title = this.extractTitle($);
                const description = this.extractDescription($);
                const meta = this.extractMetadata($);

                // 根据模式提取内容
                let content = '';
                let contentType = '';

                switch (extractMode) {
                    case 'article':
                        content = this.extractArticleContent($);
                        contentType = '文章正文模式';
                        break;
                    case 'full':
                        content = this.extractFullContent($);
                        contentType = '全文模式';
                        break;
                    case 'auto':
                    default:
                        // 自动模式：先尝试文章模式，如果内容太少则用全文模式
                        content = this.extractArticleContent($);
                        if (content.length < 200) {
                            content = this.extractFullContent($);
                            contentType = '自动模式（全文）';
                        } else {
                            contentType = '自动模式（文章正文）';
                        }
                        break;
                }

                // 限制长度
                const maxChars = Math.min(Math.max(maxLength, 500), 10000);
                if (content.length > maxChars) {
                    content = content.substring(0, maxChars) + `\n\n... (已截断，共${content.length}字符，仅显示前${maxChars}字符)`;
                }

                return this.formatOutput(title, description, content, finalUrl, meta, contentType);

            } catch (err: any) {
                lastError = err.message || '未知错误';

                if (err.code === 'ECONNABORTED') {
                    lastError = `请求超时（${this.timeout}ms）`;
                } else if (err.code === 'ENOTFOUND') {
                    lastError = `无法解析域名，请检查URL是否正确`;
                } else if (err.code === 'ECONNREFUSED') {
                    lastError = `连接被拒绝，目标服务器可能不可用`;
                } else if (err.response?.status === 403) {
                    lastError = `访问被拒绝（403），该网站可能禁止爬虫访问`;
                } else if (err.response?.status === 404) {
                    lastError = `页面不存在（404）`;
                } else if (err.response?.status === 429) {
                    lastError = `请求过于频繁（429），请稍后再试`;
                }

                if (attempt >= this.maxRetries) {
                    return `❌ 读取网页失败: ${finalUrl}\n错误原因: ${lastError}\n\n建议：检查URL是否正确，或尝试其他网站。`;
                }

                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }

        return `❌ 读取网页失败: ${finalUrl}\n${lastError}`;
    }
}
