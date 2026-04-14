import fs from "fs";
import path from "path";
import { Skill, SkillConfig } from "./BaseSkill.js";
import { log } from "@clack/prompts";

export class SkillLoader {
    public skill: Skill;
    public config: SkillConfig;

    private constructor(
        public name: string,
        config: SkillConfig,
        skill: Skill,
    ) {
        this.config = config;
        this.skill = skill;
    }

    // 工厂方法，把 IO 移出构造函数
    static load(name: string): SkillLoader {
        if (!name) throw new Error("Skill名称不能为空");

        const config = SkillLoader.readSkillConfig(name);
        const skill = SkillLoader.loadSkill(name, config);

        return new SkillLoader(name, config, skill);
    }

    // 读取配置（静态）
    private static readSkillConfig(name: string): SkillConfig {
        const configPath = path.resolve(
            SkillLoader.SKILL_PATH,
            name,
            "config.json",
        );

        if (!fs.existsSync(configPath)) {
            throw new Error(`「${name}」配置文件不存在: ${configPath}`);
        }

        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

        // 必填字段校验
        const requiredFields = ["name", "description"];
        const missingRequired = requiredFields.filter(
            (field) => !(field in config) || config[field] === "",
        );
        if (missingRequired.length > 0) {
            log.error(
                `「${name}」配置文件缺少必填字段: ${missingRequired.join(", ")}`,
            );
            throw new Error(
                `「${name}」配置文件缺少必填字段: ${missingRequired.join(", ")}`,
            );
        }

        // 可选字段提示
        const optionalFields = ["status", "tools", "params"];
        optionalFields.forEach((field) => {
            if (!(field in config)) {
                log.warn(`「${name}」配置文件缺少可选字段: ${field}`);
            }
        });

        // 补充可选字段默认值
        return {
            status: "ONLINE",
            tools: [],
            params: [],
            ...config,
        } as SkillConfig;
    }

    // 加载 skill.md（静态）
    private static loadSkill(name: string, config: SkillConfig): Skill {
        const skillPath = path.resolve(
            SkillLoader.SKILL_PATH,
            name,
            "skill.md",
        );

        if (!fs.existsSync(skillPath)) {
            throw new Error(`「${name}」skill.md 不存在: ${skillPath}`);
        }

        const skillMarkdown = fs.readFileSync(skillPath, "utf-8");
        if (!skillMarkdown.trim()) {
            throw new Error(`「${name}」skill.md 内容为空`);
        }

        return new Skill({ ...config, skillMarkdown });
    }

    // 获取所有技能目录名（过滤掉文件）
    static GET_ALL_SKILLS(targetPath = ""): string[] {
        const basePath = targetPath || SkillLoader.SKILL_PATH;
        return fs
            .readdirSync(basePath, { withFileTypes: true })
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => dirent.name);
    }

    // 批量加载所有技能
    static loadAll(): SkillLoader[] {
        const skillNames = SkillLoader.GET_ALL_SKILLS();
        return skillNames
            .map((name) => {
                try {
                    return SkillLoader.load(name);
                } catch (error) {
                    console.error(`加载技能「${name}」失败:`, error);
                    return null;
                }
            })
            .filter(Boolean) as SkillLoader[];
    }

    static SKILL_PATH = path.resolve(process.cwd(), "./src/skills");
}
