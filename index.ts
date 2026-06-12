// 主入口 - 命令注册
import { commandPermissions } from './src/utils/getDatas';
import { FishingService } from './src/services/fishing';
import { getNPCList, getNPCMenu, chatWithNPC } from './src/services/npc';

// 转账命令处理
function transfer(fromUser: string, toUser: string, amount: number): string {
  if (amount <= 0) return '转账金额不能为负数';
  if (fromUser === toUser) return '不能转给自己';
  // 执行转账逻辑...
  return `${fromUser} 向 ${toUser} 转账 ${amount} 金币成功`;
}

const fishingService = new FishingService();

// 注册命令列表
const commands = [
  { name: '签到', handler: () => {} },
  { name: '抽奖', handler: () => {} },
  { name: '查询', handler: () => {} },
  { name: '转账', handler: (args: string[]) => {
    // 支持 @QQ或QQ号 金额
    const [target, amount] = args;
    return transfer('currentUser', target, Number(amount));
  }},
  { name: '钓鱼', handler: async (args: string[]) => {
    // 开始钓鱼
    const result = await fishingService.fish('currentUser');
    return result.success ? '🎣 钓到一条鱼！' : '🎣 鱼逃跑了！';
  }},
  { name: '鱼塘', handler: async (args: string[]) => {
    // 查看鱼塘
    const pond = await fishingService.viewPond('currentUser');
    return `🐟 您的鱼塘有 ${pond.length} 条鱼`;
  }},
  { name: '卖鱼', handler: async (args: string[]) => {
    // 卖鱼
    const [fishId] = args;
    const coins = await fishingService.sellFish('currentUser', fishId);
    return `💰 卖鱼获得 ${coins} 金币`;
  }},
  { name: '钓鱼菜单', handler: () => {
    return fishingService.getFishingMenu();
  }},
  { name: 'NPC', handler: async (args: string[]) => {
    // NPC交互：NPC <NPC名称> [消息]
    const [npcName, ...messageParts] = args;
    const message = messageParts.join(' ');
    if (!message) {
      return getNPCMenu(npcName);
    }
    return chatWithNPC(npcName, message);
  }},
  { name: 'NPC列表', handler: () => {
    // 查看所有可交互NPC
    const npcList = getNPCList();
    if (npcList.length === 0) return '暂无可用NPC';
    return `📋 可交互NPC列表：\n${npcList.map((name, i) => `${i + 1}. ${name}`).join('\n')}`;
  }}
];
