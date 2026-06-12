import { AgentTool } from "@/core/BaseAgentTool.js";
import axios from "axios";
import * as cheerio from "cheerio";

interface IBaiduSearchParams {
    query: string;
    page?: number;
}

/**
 * BaiduSearchTool - 百度爬虫搜索工具
 * 
 * 功能：通过百度搜索引擎爬取搜索结果，返回完整的标题、摘要、链接信息
 * 支持搜索百科、商品、新闻、网页等各种内容
 * 模拟真实浏览器行为，防止被拦截
 */
export default class BaiduSearchTool extends AgentTool<IBaiduSearchParams> {
    constructor() {
        super({
            name: "BaiduSearchTool",
            description: "联网搜索工具，通过百度搜索引擎搜索各种内容（百科、商品、新闻、网页等），返回完整的搜索结果标题、摘要和链接。适用于需要获取实时网络信息的场景。",
            parameters: [
                {
                    name: "query",
                    type: "string",
                    description: "搜索关键词或问题，支持中文",
                    required: true,
                },
                {
                    name: "page",
                    type: "number",
                    description: "页码，从0开始，默认为0（第一页）",
                    required: false,
                },
            ],
        });

        this.timeout = 15000;
        this.maxRetries = 2;
        this.resultLimit = 10;

        // 模拟多种浏览器UA，随机切换
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
        ];
    }

    private timeout: number;
    private maxRetries: number;
    private resultLimit: number;
    private userAgents: string[];

    /**
     * 随机获取一个User-Agent
     */
    private getRandomUA(): string {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }

    /**
     * 构建请求头
     */
    private buildHeaders(): Record<string, string> {
        return {
            'User-Agent': this.getRandomUA(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Referer': 'https://www.baidu.com/',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
        };
    }

    /**
     * 解析百度搜索结果HTML
     * 百度搜索结果有多种结构，需要兼容处理
     */
    private parseSearchResults(html: string): Array<{
        title: string;
        snippet: string;
        link: string;
        source?: string;
        type?: string;
    }> {
        const $ = cheerio.load(html);
        const results: Array<{
            title: string;
            snippet: string;
            link: string;
            source?: string;
            type?: string;
        }> = [];

        // ========== 策略1: 解析通用搜索结果块 ==========
        // 百度PC端搜索结果容器有多个可能的选择器
        const selectors = [
            '.result',              // 旧版通用结果
            '.result.c-container',  // 新版通用结果
            '[data-log]',           // 带数据日志的结果
            '.c-container',         // 通用容器
        ];

        let parsedCount = 0;
        for (const selector of selectors) {
            if (parsedCount >= this.resultLimit) break;
            
            $(selector).each((idx, el) => {
                if (parsedCount >= this.resultLimit) return false;

                // 跳过广告
                if ($(el).find('[data-hook]').length > 0) return;
                if ($(el).text().includes('广告') && $(el).find('.ec-tuiguang').length > 0) return;

                const titleEl = $(el).find('h3 a, .t a, .c-title a');
                const title = titleEl.text().trim();
                if (!title) return;

                // 获取链接
                let link = titleEl.attr('href') || '';
                // 百度跳转链接需要转换
                if (link && !link.startsWith('http')) {
                    if (link.startsWith('/link?')) {
                        link = `https://www.baidu.com${link}`;
                    } else if (link.startsWith('//')) {
                        link = `https:${link}`;
                    }
                }

                // 获取摘要 - 多种可能的摘要选择器
                const snippetSelectors = [
                    '.c-abstract',
                    '.c-span-last',
                    '.content-right_8Zs40',
                    '.c-row .c-span-last',
                    '.c-summary',
                    '.abstract',
                ];
                let snippet = '';
                for (const sSelector of snippetSelectors) {
                    const s = $(el).find(sSelector).text().trim();
                    if (s) {
                        snippet = s;
                        break;
                    }
                }
                if (!snippet) {
                    // 尝试获取段落文本作为摘要
                    snippet = $(el).find('p').first().text().trim();
                }
                if (!snippet) {
                    snippet = $(el).text().substring(0, 150).replace(title, '').trim().substring(0, 100);
                }

                // 获取来源网站
                let source = '';
                const sourceEl = $(el).find('.c-showurl, .c-url, .source');
                if (sourceEl.length) {
                    source = sourceEl.text().trim();
                }

                results.push({
                    title,
                    snippet: snippet || '暂无摘要',
                    link: link || '暂无链接',
                    source: source || '',
                    type: 'web',
                });
                parsedCount++;
            });
            if (parsedCount >= this.resultLimit) break;
        }

        // ========== 策略2: 如果策略1没找到结果，尝试更宽松的解析 ==========
        if (results.length === 0) {
            $('h3').each((idx, el) => {
                if (results.length >= this.resultLimit) return false;
                const aEl = $(el).find('a');
                const title = aEl.text().trim();
                if (!title || title.length < 4) return;

                let link = aEl.attr('href') || '';
                if (link && !link.startsWith('http')) {
                    if (link.startsWith('/link?')) {
                        link = `https://www.baidu.com${link}`;
                    }
                }

                // 找附近的内容作为摘要
                let snippet = '';
                let parent = $(el).parent();
                for (let i = 0; i < 5; i++) {
                    const text = parent.text().replace(title, '').trim();
                    if (text.length > 20) {
                        snippet = text.substring(0, 150);
                        break;
                    }
                    parent = parent.parent();
                }

                results.push({
                    title,
                    snippet: snippet || '暂无摘要',
                    link: link || '暂无链接',
                    type: 'web',
                });
            });
        }

        return results;
    }

    /**
     * 解析百度搜索结果中的百科卡片（如搜索人物、地点等）
     */
    private parseBaikeCard($: cheerio.CheerioAPI): string | null {
        // 百度百科卡片
        const baikeSelectors = [
            '.c-container.baike-core',
            '.baike-card',
            '.c-row .baike-content',
            '.op_exactqa_detail',
            '.op_exactqa_summary',
        ];

        for (const sel of baikeSelectors) {
            const el = $(sel);
            if (el.length > 0) {
                return el.text().trim().substring(0, 500);
            }
        }

        // 检测是否有百科框（右侧知识卡片）
        const rightCard = $('#content_right .c-container');
        if (rightCard.length > 0) {
            const cardText = rightCard.text().trim();
            if (cardText.length > 30) {
                return cardText.substring(0, 500);
            }
        }

        return null;
    }

    /**
     * 格式化结果为易读文本
     */
    private formatResults(
        results: Array<{ title: string; snippet: string; link: string; source?: string; type?: string }>,
        query: string,
        baikeCard: string | null,
        page: number
    ): string {
        if (results.length === 0) {
            return `🔍 搜索"${query}"未找到相关结果，建议换个关键词试试。`;
        }

        let output = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        output += `  🔍 百度搜索结果 | "${query}" | 第${page + 1}页\n`;
        output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        // 如果有百科卡片，优先展示
        if (baikeCard) {
            output += `📖 【知识卡片】\n${baikeCard}\n\n`;
            output += `────────── 搜索结果 ──────────\n\n`;
        }

        results.forEach((item, idx) => {
            output += `【结果 ${idx + 1}】\n`;
            output += `📌 ${item.title}\n`;
            if (item.source) {
                output += `🌐 来源：${item.source}\n`;
            }
            output += `📝 ${item.snippet}\n`;
            if (item.link) {
                output += `🔗 ${item.link}\n`;
            }
            output += `\n`;
        });

        output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        output += `共找到 ${results.length} 条结果 | 数据来源：百度搜索\n`;
        output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

        return output;
    }

    /**
     * 执行搜索
     */
    async execute(params: IBaiduSearchParams): Promise<string> {
        const { query, page = 0 } = params;

        if (!query?.trim()) {
            return '❌ 搜索关键词不能为空，请输入你要搜索的内容';
        }

        // 构建百度搜索URL
        const pn = page * 10; // 百度分页: 第一页pn=0, 第二页pn=10...
        const searchUrl = 'https://www.baidu.com/s';
        const searchParams = {
            wd: query.trim(),
            pn: pn,
            ie: 'utf-8',
            tn: 'SE_baiduhome_pg',  // 搜索来源标识
        };

        let lastError = '';

        // 带重试的搜索请求
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await axios.get(searchUrl, {
                    params: searchParams,
                    headers: this.buildHeaders(),
                    timeout: this.timeout,
                    responseType: 'text',
                    // 跟随重定向
                    maxRedirects: 5,
                    // 允许压缩响应
                    decompress: true,
                });

                const html = response.data;
                if (!html || html.length < 200) {
                    throw new Error('返回内容过短，可能被拦截');
                }

                // 检查是否被百度验证码拦截
                if (html.includes('百度安全验证') || html.includes('请输入验证码')) {
                    // 使用备用搜索尝试
                    return await this.fallbackSearch(query, page);
                }

                // 解析结果
                const $ = cheerio.load(html);
                const results = this.parseSearchResults(html);
                const baikeCard = this.parseBaikeCard($);

                return this.formatResults(results, query, baikeCard, page);

            } catch (err: any) {
                lastError = err.message || '未知错误';
                if (err.code === 'ECONNABORTED') {
                    lastError = '请求超时';
                } else if (err.code === 'ENOTFOUND') {
                    lastError = '网络连接失败，请检查网络';
                } else if (err.response?.status === 403) {
                    lastError = '被百度拦截（403），尝试使用备用方案';
                } else if (err.response?.status === 429) {
                    lastError = '请求过于频繁，请稍后再试';
                }

                // 最后一次尝试失败，使用备用方案
                if (attempt >= this.maxRetries) {
                    return await this.fallbackSearch(query, page);
                }

                // 等待后重试
                await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }

        return await this.fallbackSearch(query, page);
    }

    /**
     * 备用搜索方案 - 使用百度搜索的其他接口
     */
    private async fallbackSearch(query: string, page: number): Promise<string> {
        try {
            // 备用方案1：使用百度搜索的简化版接口
            const fallbackUrl = 'https://www.baidu.com/s';
            const response = await axios.get(fallbackUrl, {
                params: {
                    wd: query.trim(),
                    pn: page * 10,
                    ie: 'utf-8',
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9',
                },
                timeout: 10000,
                responseType: 'text',
            });

            const html = response.data;
            const $ = cheerio.load(html);

            // 尝试解析通用结果
            const results: Array<{ title: string; snippet: string; link: string }> = [];
            
            // 查找所有链接
            $('a').each((idx, el) => {
                if (results.length >= 8) return false;
                const href = $(el).attr('href') || '';
                const text = $(el).text().trim();
                
                // 过滤有效结果
                if (text.length > 5 && href && !href.startsWith('#') && !href.includes('baidu.com')) {
                    results.push({
                        title: text,
                        snippet: '',
                        link: href,
                    });
                }
            });

            // 尝试从页面文本中提取更多信息
            const bodyText = $('body').text();
            const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 10);
            
            if (results.length === 0 && lines.length > 0) {
                // 如果还是没找到，直接返回页面文本摘要
                const pageText = lines.slice(0, 30).join('\n').substring(0, 1500);
                return `🔍 搜索"${query}"的结果页面内容摘要：\n\n${pageText}\n\n(注：由于访问限制，返回的是页面文本摘要)`;
            }

            if (results.length === 0) {
                return `🔍 搜索"${query}"未能获取到结果，可能是搜索频率过高被限流，请稍后再试。`;
            }

            // 格式化备用结果
            let output = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            output += `  🔍 百度搜索(备用) | "${query}"\n`;
            output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            results.forEach((item, idx) => {
                output += `【结果 ${idx + 1}】\n📌 ${item.title}\n🔗 ${item.link}\n\n`;
            });
            output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

            return output;

        } catch (err: any) {
            return `❌ 搜索"${query}"失败（主备方案均不可用）: ${err.message}\n\n建议：检查网络连接，或稍后再试。`;
        }
    }
}
