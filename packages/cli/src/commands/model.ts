import { getAllAvailableModels, readConfig, setActiveModel } from '@gatanot/qualia_core/config';
import { CliError } from '../errors.js';
import { type CliIO, type ParsedArgs } from './index.js';

export async function runModel(args: ParsedArgs, io: CliIO): Promise<void> {
	const sub = args.positionals[0] || 'list';
	if (sub === 'list') {
		const config = readConfig();
		const models = getAllAvailableModels();
		if (models.length === 0) {
			io.stdout.write('没有可用模型。请先配置供应商。\n');
			return;
		}
		for (const item of models) {
			const active = item.model.id === config.activeModel ? '*' : ' ';
			io.stdout.write(`${active} ${item.model.id}\t${item.model.name}\t${item.providerName}\n`);
		}
		return;
	}

	if (sub === 'use') {
		const modelId = args.positionals[1];
		if (!modelId) throw new CliError('USAGE', '用法：qualia model use <modelId>');
		setActiveModel(modelId);
		io.stdout.write(`已选择模型：${modelId}\n`);
		return;
	}

	throw new CliError('USAGE', `未知 model 子命令：${sub}`);
}
