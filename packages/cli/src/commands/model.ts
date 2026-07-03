import { readConfig, getAllAvailableModels, setActiveModel } from '@gatanot/qualia_core/config';
import type { Command } from './index.js';

async function run(args: string[]): Promise<number> {
	const sub = args[0];

	if (!sub || sub === 'list') {
		const models = getAllAvailableModels();
		if (models.length === 0) {
			console.log('没有可用模型。请先在 settings 中配置供应商。');
			return 0;
		}
		const config = readConfig();
		for (const { model, providerName } of models) {
			const active = model.id === config.activeModel ? ' [active]' : '';
			console.log(`${model.id}${active}  (${providerName})  ctx: ${(model.contextWindow / 1024).toFixed(0)}K`);
		}
		return 0;
	}

	if (sub === 'use') {
		const modelId = args[1];
		if (!modelId) {
			console.error('用法: qualia model use <modelId>');
			return 2;
		}
		setActiveModel(modelId);
		console.log(`已切换到: ${modelId}`);
		return 0;
	}

	console.error(`未知子命令: ${sub}`);
	console.error('用法: qualia model [list|use <id>]');
	return 2;
}

export const modelCommand: Command = {
	name: 'model',
	aliases: ['models'],
	description: '查看或切换模型',
	usage: 'qualia model [list|use <modelId>]',
	run,
};
