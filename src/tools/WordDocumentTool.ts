/**
 * ========================================
 * WordDocumentTool - Word文档生成工具
 * ========================================
 * 
 * 功能清单：
 * 1. 创建Word文档（.docx格式）
 * 2. 添加标题（支持1-6级标题）
 * 3. 添加段落文本（支持字体、字号、颜色、加粗、斜体、下划线、对齐方式）
 * 4. 添加表格（支持合并单元格、表头样式、边框设置）
 * 5. 添加图片（支持尺寸设置）
 * 6. 添加有序/无序列表
 * 7. 添加分页符
 * 8. 添加超链接
 * 9. 设置页面边距、纸张方向、纸张大小
 * 10. 添加页眉页脚
 * 11. 读取已有Word文档内容（文本提取）
 * 
 * 依赖库：npm install docx
 */

import { AgentTool } from "@/core/BaseAgentTool.js";
import { log } from "@clack/prompts";
import fs from "fs";
import path from "path";

// ========== 类型定义 ==========

/** 对齐方式枚举 */
type AlignmentType = "left" | "center" | "right" | "justified";

/** 纸张方向 */
type PageOrientation = "portrait" | "landscape";

/** 纸张大小 */
type PageSize = "A4" | "A3" | "A5" | "Letter" | "Legal";

/** 文本格式化选项 */
interface TextFormat {
    text: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    fontSize?: number;      // 单位：半磅（28 = 14pt）
    fontColor?: string;     // 十六进制颜色，如 "FF0000"
    fontFamily?: string;    // 字体名称
}

/** 段落配置 */
interface ParagraphConfig {
    texts: (string | TextFormat)[];
    alignment?: AlignmentType;
    spacingBefore?: number;  // 段前间距（单位：缇，1/20磅）
    spacingAfter?: number;   // 段后间距
    lineSpacing?: number;    // 行距倍数
    indentFirstLine?: number; // 首行缩进（缇）
    pageBreakBefore?: boolean; // 段前分页
    headingLevel?: 1 | 2 | 3 | 4 | 5 | 6; // 标题级别
    numbering?: "bullet" | "decimal"; // 列表类型
}

/** 表格单元格配置 */
interface TableCellConfig {
    text: string;
    bold?: boolean;
    fontSize?: number;
    fontColor?: string;
    alignment?: AlignmentType;
    shading?: string;       // 背景色
    colSpan?: number;       // 合并列数
    rowSpan?: number;       // 合并行数
    width?: number;         // 宽度（百分比或缇）
}

/** 表格行配置 */
interface TableRowConfig {
    cells: TableCellConfig[];
    isHeader?: boolean;     // 是否为表头行
}

/** 表格配置 */
interface TableConfig {
    rows: TableRowConfig[];
    width?: number;         // 表格宽度（百分比）
    borderSize?: number;    // 边框大小
    borderColor?: string;   // 边框颜色
}

/** 图片配置 */
interface ImageConfig {
    path: string;           // 图片路径（本地绝对路径）
    width?: number;         // 显示宽度（单位：EMU，1英寸=914400 EMU）
    height?: number;        // 显示高度
    alignment?: AlignmentType;
}

/** 页眉页脚配置 */
interface HeaderFooterConfig {
    text: string;
    fontSize?: number;
    fontColor?: string;
    alignment?: AlignmentType;
}

/** 页面设置 */
interface PageSetupConfig {
    orientation?: PageOrientation;
    pageSize?: PageSize;
    marginTop?: number;      // 上边距（缇，1英寸=1440缇）
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
}

/** 文档构建配置 */
interface DocumentConfig {
    title?: string;
    pageSetup?: PageSetupConfig;
    header?: HeaderFooterConfig;
    footer?: HeaderFooterConfig;
}

/** WordDocumentTool 参数接口 */
interface IWordDocumentParams {
    action:
        | "create"          // 创建文档（核心操作）
        | "read";           // 读取文档文本内容
    outputPath: string;      // 输出文件路径（如 D:/文档/报告.docx）
    config?: string;         // JSON字符串，文档配置（页面设置、页眉页脚等）
    sections?: string;       // JSON字符串，文档内容区块数组
}

// ========== 工具类 ==========

/**
 * WordDocumentTool
 * 
 * 使用 docx 库生成 .docx 格式的 Word 文档，
 * 支持丰富的文本格式、表格、图片、页眉页脚等功能。
 */
export default class WordDocumentTool extends AgentTool<IWordDocumentParams> {

    constructor() {
        super({
            name: "WordDocumentTool",
            description: "一个功能全面的Word文档生成工具，支持创建和读取.docx格式文件。" +
                "功能包括：添加标题/段落文本（支持字体、字号、颜色、加粗、斜体、对齐）、" +
                "添加表格（含合并单元格、表头样式）、插入图片、有序/无序列表、分页符、" +
                "页面设置（边距/纸张/方向）、页眉页脚等。",
            parameters: [
                {
                    name: "action",
                    type: "string",
                    description:
                        "操作类型：create（创建文档）、read（读取文档文本内容）",
                    required: true,
                },
                {
                    name: "outputPath",
                    type: "string",
                    description: "输出文件路径，如 D:/文档/报告.docx",
                    required: true,
                },
                {
                    name: "config",
                    type: "string",
                    description:
                        "JSON字符串，文档全局配置，如：{\"title\":\"文档标题\",\"pageSetup\":{\"orientation\":\"portrait\",\"pageSize\":\"A4\",\"marginTop\":1440,\"marginBottom\":1440,\"marginLeft\":1800,\"marginRight\":1800},\"header\":{\"text\":\"页眉文字\"},\"footer\":{\"text\":\"页脚文字\"}}",
                    required: false,
                },
                {
                    name: "sections",
                    type: "string",
                    description:
                        "JSON字符串，文档内容区块数组，每个区块为一个步骤。支持以下区块类型：\n" +
                        "1. 标题区块：{\"type\":\"heading\",\"text\":\"标题内容\",\"level\":1,\"alignment\":\"center\"}\n" +
                        "2. 段落区块：{\"type\":\"paragraph\",\"texts\":[{\"text\":\"加粗文字\",\"bold\":true},{\"text\":\"普通文字\"}],\"alignment\":\"left\",\"spacingBefore\":200,\"spacingAfter\":200}\n" +
                        "3. 纯文本段落：{\"type\":\"paragraph\",\"text\":\"这是一段文字\",\"alignment\":\"left\"}\n" +
                        "4. 表格区块：{\"type\":\"table\",\"rows\":[{\"cells\":[{\"text\":\"表头1\",\"bold\":true,\"shading\":\"D9E2F3\"},{\"text\":\"表头2\",\"bold\":true}],\"isHeader\":true},{\"cells\":[{\"text\":\"单元格1\"},{\"text\":\"单元格2\"}]}]}\n" +
                        "5. 图片区块：{\"type\":\"image\",\"path\":\"D:/图片.png\",\"width\":914400,\"height\":914400,\"alignment\":\"center\"}\n" +
                        "6. 列表区块：{\"type\":\"list\",\"items\":[\"项目1\",\"项目2\"],\"listType\":\"bullet\"}\n" +
                        "7. 分页符：{\"type\":\"pageBreak\"}\n" +
                        "8. 水平线：{\"type\":\"horizontalLine\"}",
                    required: false,
                },
            ],
        });
    }

    /**
     * 执行工具
     */
    async execute(params: IWordDocumentParams): Promise<string> {
        const { action, outputPath } = params;

        log.info(`执行Word文档工具 [${action}]${outputPath}`);

        try {
            switch (action) {
                case "create":
                    return await this.createDocument(params);
                case "read":
                    return await this.readDocument(outputPath);
                default:
                    return `未知操作类型: ${action}，支持的操作: create, read`;
            }
        } catch (error: any) {
            return `Word文档操作失败: ${error.message}`;
        }
    }

    /**
     * ========== 创建Word文档 ==========
     */
    private async createDocument(params: IWordDocumentParams): Promise<string> {
        const { outputPath, config, sections } = params;

        // 解析配置
        const docConfig: DocumentConfig = config ? JSON.parse(config) : {};
        const docSections: any[] = sections ? JSON.parse(sections) : [];

        if (docSections.length === 0) {
            return "❌ 文档内容为空，请提供 sections 参数";
        }

        // 动态导入 docx（需要用户先安装）
        let docx: any;
        try {
            docx = await import("docx");
        } catch {
            return (
                "❌ 缺少依赖库 'docx'，请先安装：\n" +
                "npm install docx\n" +
                "或\n" +
                "yarn add docx"
            );
        }

        const {
            Document,
            Packer,
            Paragraph,
            TextRun,
            Table,
            TableRow,
            TableCell,
            ImageRun,
            PageBreak,
            HorizontalLine,
            AlignmentType: DocxAlignment,
            HeadingLevel,
            BorderStyle,
            ShadingType,
            WidthType,
            Header,
            Footer,
            PageNumber,
            NumberFormat,
            LevelFormat,
            convertInchesToTwip,
            convertMillimetersToEmu,
        } = docx;

        // ========== 构建文档内容 ==========
        const children: any[] = [];

        for (const block of docSections) {
            const blockChildren = this.buildBlock(block, docx);
            if (Array.isArray(blockChildren)) {
                children.push(...blockChildren);
            } else {
                children.push(blockChildren);
            }
        }

        // ========== 页面设置 ==========
        const pageSetup: any = {};
        if (docConfig.pageSetup) {
            const ps = docConfig.pageSetup;

            // 纸张方向
            if (ps.orientation === "landscape") {
                pageSetup.orientation = "landscape";
            }

            // 纸张大小
            if (ps.pageSize) {
                const sizes: Record<string, { width: number; height: number }> = {
                    A4: { width: 11906, height: 16838 },     // 210×297mm
                    A3: { width: 16838, height: 23811 },     // 297×420mm
                    A5: { width: 8391, height: 11906 },      // 148×210mm
                    Letter: { width: 12240, height: 15840 }, // 8.5×11in
                    Legal: { width: 12240, height: 20160 },  // 8.5×14in
                };
                const size = sizes[ps.pageSize];
                if (size) {
                    pageSetup.size = size;
                }
            }

            // 页面边距（默认1英寸=1440缇）
            pageSetup.margins = {
                top: ps.marginTop ?? 1440,
                bottom: ps.marginBottom ?? 1440,
                left: ps.marginLeft ?? 1800,
                right: ps.marginRight ?? 1800,
            };
        }

        // ========== 创建文档（修复版：移除无效的 styles/features 参数）==========
        const document = new Document({
            title: docConfig.title || "Word文档",
            sections: [
                {
                    properties: {
                        ...(Object.keys(pageSetup).length > 0 ? { page: pageSetup } : {}),
                    },
                    // 页眉
                    ...(docConfig.header
                        ? {
                            headers: {
                                default: new Header({
                                    children: [
                                        this.buildTextRunParagraph(
                                            docConfig.header.text,
                                            docConfig.header.fontSize,
                                            docConfig.header.fontColor,
                                            docConfig.header.alignment,
                                            docx,
                                        ),
                                    ],
                                }),
                            },
                        }
                        : {}),
                    // 页脚
                    ...(docConfig.footer
                        ? {
                            footers: {
                                default: new Footer({
                                    children: [
                                        this.buildTextRunParagraph(
                                            docConfig.footer.text,
                                            docConfig.footer.fontSize,
                                            docConfig.footer.fontColor,
                                            docConfig.footer.alignment,
                                            docx,
                                        ),
                                    ],
                                }),
                            },
                        }
                        : {}),
                    children,
                },
            ],
        });

        // ========== 生成文件 ==========
        const buffer = await Packer.toBuffer(document);

        // 确保目录存在
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, buffer);

        // 验证
        if (!fs.existsSync(outputPath)) {
            return "⚠️ 文件写入失败，未知错误";
        }

        const fileSize = fs.statSync(outputPath).size;
        const fileSizeKB = (fileSize / 1024).toFixed(1);

        return `✅ Word文档创建成功！\n📄 路径：${outputPath}\n📏 大小：${fileSizeKB} KB`;
    }

    /**
     * 构建内容区块
     */
    private buildBlock(block: any, docx: any): any | any[] {
        const { type } = block;

        switch (type) {
            // ===== 标题 =====
            case "heading": {
                const level = block.level || 1;
                const alignment = this.parseAlignment(block.alignment, docx);
                const headingMap: Record<number, any> = {
                    1: docx.HeadingLevel.HEADING_1,
                    2: docx.HeadingLevel.HEADING_2,
                    3: docx.HeadingLevel.HEADING_3,
                    4: docx.HeadingLevel.HEADING_4,
                    5: docx.HeadingLevel.HEADING_5,
                    6: docx.HeadingLevel.HEADING_6,
                };

                return new docx.Paragraph({
                    heading: headingMap[level] || docx.HeadingLevel.HEADING_1,
                    alignment: alignment,
                    spacing: { before: 240, after: 120 },
                    children: [
                        new docx.TextRun({
                            text: block.text,
                            bold: true,
                            size: this.getHeadingSize(level),
                            font: block.fontFamily || "Microsoft YaHei",
                        }),
                    ],
                });
            }

            // ===== 段落 =====
            case "paragraph": {
                const alignment = this.parseAlignment(block.alignment, docx);

                // 支持 texts 数组（多种格式混排）
                if (block.texts && Array.isArray(block.texts)) {
                    const textRuns = block.texts.map((t: any) => {
                        if (typeof t === "string") {
                            return new docx.TextRun({ text: t });
                        }
                        return new docx.TextRun({
                            text: t.text,
                            bold: t.bold,
                            italics: t.italic,
                            underline: t.underline ? { type: docx.UnderlineType.SINGLE } : undefined,
                            size: t.fontSize,
                            color: t.fontColor,
                            font: t.fontFamily,
                        });
                    });

                    return new docx.Paragraph({
                        alignment: alignment,
                        spacing: {
                            before: block.spacingBefore ?? 100,
                            after: block.spacingAfter ?? 100,
                            line: block.lineSpacing ? Math.round(block.lineSpacing * 240) : undefined,
                        },
                        indent: block.indentFirstLine
                            ? { firstLine: block.indentFirstLine }
                            : undefined,
                        children: textRuns,
                    });
                }

                // 纯文本段落
                return new docx.Paragraph({
                    alignment: alignment,
                    spacing: {
                        before: block.spacingBefore ?? 100,
                        after: block.spacingAfter ?? 100,
                    },
                    children: [
                        new docx.TextRun({
                            text: block.text || "",
                            size: block.fontSize,
                            color: block.fontColor,
                            bold: block.bold,
                            italics: block.italic,
                            font: block.fontFamily || "Microsoft YaHei",
                        }),
                    ],
                });
            }

            // ===== 表格 =====
            case "table": {
                if (!block.rows || !Array.isArray(block.rows)) {
                    return new docx.Paragraph({ children: [new docx.TextRun("（表格数据为空）")] });
                }

                const tableRows = block.rows.map((row: any) => {
                    const cells = row.cells.map((cell: any) => {
                        const cellChildren = [
                            new docx.Paragraph({
                                alignment: this.parseAlignment(cell.alignment, docx),
                                children: [
                                    new docx.TextRun({
                                        text: cell.text || "",
                                        bold: cell.bold,
                                        size: cell.fontSize || 21, // 10.5pt
                                        color: cell.fontColor,
                                        font: "Microsoft YaHei",
                                    }),
                                ],
                            }),
                        ];

                        const cellConfig: any = {
                            children: cellChildren,
                        };

                        // 合并列
                        if (cell.colSpan && cell.colSpan > 1) {
                            cellConfig.columnSpan = cell.colSpan;
                        }

                        // 合并行（垂直合并用")
                        if (cell.rowSpan && cell.rowSpan > 1) {
                            cellConfig.rowSpan = cell.rowSpan;
                        }

                        // 背景色
                        if (cell.shading) {
                            cellConfig.shading = {
                                type: docx.ShadingType.CLEAR,
                                fill: cell.shading,
                            };
                        }

                        // 宽度
                        if (cell.width) {
                            cellConfig.width = {
                                size: cell.width,
                                type: docx.WidthType.PERCENTAGE,
                            };
                        }

                        return new docx.TableCell(cellConfig);
                    });

                    return new docx.TableRow({ children: cells });
                });

                const tableConfig: any = { rows: tableRows };

                // 表格宽度
                if (block.width) {
                    tableConfig.width = {
                        size: block.width,
                        type: docx.WidthType.PERCENTAGE,
                    };
                }

                return new docx.Table(tableConfig);
            }

            // ===== 图片 =====
            case "image": {
                if (!block.path) {
                    return new docx.Paragraph({ children: [new docx.TextRun("（图片路径为空）")] });
                }

                if (!fs.existsSync(block.path)) {
                    return new docx.Paragraph({
                        children: [new docx.TextRun(`⚠️ 图片不存在: ${block.path}`)],
                    });
                }

                const imageBuffer = fs.readFileSync(block.path);
                const alignment = this.parseAlignment(block.alignment, docx);

                return new docx.Paragraph({
                    alignment: alignment,
                    children: [
                        new docx.ImageRun({
                            data: imageBuffer,
                            transformation: {
                                width: block.width || 457200, // 默认约5英寸
                                height: block.height || 457200,
                            },
                        }),
                    ],
                });
            }

            // ===== 列表 =====
            case "list": {
                if (!block.items || !Array.isArray(block.items)) {
                    return new docx.Paragraph({ children: [new docx.TextRun("（列表数据为空）")] });
                }

                const listType = block.listType || "bullet";
                const isBullet = listType === "bullet";

                return block.items.map((item: string, index: number) => {
                    return new docx.Paragraph({
                        bullet: isBullet ? { level: 0 } : undefined,
                        numbering: !isBullet
                            ? {
                                reference: "default-numbering",
                                instance: index + 1,
                                level: 0,
                            }
                            : undefined,
                        spacing: { before: 60, after: 60 },
                        indent: { left: 720 },
                        children: [
                            new docx.TextRun({
                                text: item,
                                size: 21,
                                font: "Microsoft YaHei",
                            }),
                        ],
                    });
                });
            }

            // ===== 分页符 =====
            case "pageBreak": {
                return new docx.Paragraph({
                    children: [new docx.PageBreak()],
                });
            }

            // ===== 水平线 =====
            case "horizontalLine": {
                return new docx.Paragraph({
                    thematicBreak: true,
                    spacing: { before: 200, after: 200 },
                    children: [],
                });
            }

            default:
                return new docx.Paragraph({
                    children: [new docx.TextRun(`（未知区块类型: ${type}）`)],
                });
        }
    }

    /**
     * 构建单行文本段落（用于页眉页脚）
     */
    private buildTextRunParagraph(
        text: string,
        fontSize?: number,
        fontColor?: string,
        alignment?: string,
        docx?: any,
    ): any {
        if (!docx) return null;
        return new docx.Paragraph({
            alignment: this.parseAlignment(alignment || "center", docx),
            children: [
                new docx.TextRun({
                    text: text || "",
                    size: fontSize || 18,
                    color: fontColor || "888888",
                    font: "Microsoft YaHei",
                }),
            ],
        });
    }

    /**
     * 解析对齐方式
     */
    private parseAlignment(alignment?: string, docx?: any): any {
        if (!docx || !alignment) return undefined;
        const map: Record<string, any> = {
            left: docx.AlignmentType.LEFT,
            center: docx.AlignmentType.CENTER,
            right: docx.AlignmentType.RIGHT,
            justified: docx.AlignmentType.JUSTIFIED,
        };
        return map[alignment] || undefined;
    }

    /**
     * 获取标题字号（半磅单位）
     */
    private getHeadingSize(level: number): number {
        const sizes: Record<number, number> = {
            1: 44, // 22pt
            2: 36, // 18pt
            3: 32, // 16pt
            4: 28, // 14pt
            5: 24, // 12pt
            6: 21, // 10.5pt
        };
        return sizes[level] || 28;
    }

    /**
     * ========== 读取Word文档文本内容 ==========
     * 使用 mammoth 库读取 .docx 文件的文本内容
     */
    private async readDocument(outputPath: string): Promise<string> {
        if (!fs.existsSync(outputPath)) {
            return `❌ 文件不存在: ${outputPath}`;
        }

        // 尝试使用 mammoth 库读取
        try {
            const mammoth = await import("mammoth");
            const buffer = fs.readFileSync(outputPath);
            const result = await mammoth.extractRawText({ buffer });
            return `📖 文档内容：\n---\n${result.value}\n---\n${
                result.messages.length > 0
                    ? `\n⚠️ 警告信息：\n${result.messages.map((m: any) => `[${m.type}] ${m.message}`).join("\n")}`
                    : ""
            }`;
        } catch {
            return (
                "⚠️ 读取文档需要安装 mammoth 库：\n" +
                "npm install mammoth\n\n" +
                `文件路径：${outputPath}\n文件大小：${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`
            );
        }
    }
}
