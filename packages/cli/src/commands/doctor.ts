import { existsSync, accessSync, constants } from 'node:fs';
import { readConfig, getActiveModel, getProviderForModel } from '@gatanot/qualia_core/config';
import { getConfigPath, getDataDir } from '@gatanot/qualia_core/paths';
import { type CliIO, type ParsedArgs } from './index.js';

export async function runDoctor(_args: ParsedArgs, io: CliIO): Promise<void> {
	const config = readConfig();
	const model = getActiveModel();
	const provider = config.activeModel ? getProviderForModel(config.activeModel) : undefined;
	const lines: string[] = [];

	lines.push(`Node: ${process.version}`);
	lines.push(`TTY: stdin=${io.stdin.isTTY ? 'yes' : 'no'} stdout=${io.stdout.isTTY ? 'yes' : 'no'}`);
	lines.push(`Config: ${getConfigPath()} ${existsSync(getConfigPath()) ? '存在' : '未创建'}`);
	lines.push(`Data: ${getDataDir()} ${canWrite(getDataDir()) ? '可写' : '不可写或不存在'}`);
	lines.push(`Storage: ${config.storageEnabled ? 'enabled' : 'disabled'}`);
	lines.push(`Active model: ${config.activeModel || '(none)'}`);
	lines.push(`Model resolved: ${model ? model.name : 'no'}`);
	lines.push(`Provider resolved: ${provider ? `${provider.name || provider.type} (${provider.type})` : 'no'}`);
	lines.push(`Provider credential: ${provider ? credentialStatus(provider.type, provider.apiKey) : 'no provider'}`);
	lines.push(`Workspace: ${io.cwd} ${canRead(io.cwd) ? '可读' : '不可读'}`);

	io.stdout.write(lines.join('\n') + '\n');
}

function canRead(path: string): boolean {
	try {
		accessSync(path, constants.R_OK);
		return true;
	} catch {
		return false;
	}
}

function canWrite(path: string): boolean {
	try {
		accessSync(path, constants.W_OK);
		return true;
	} catch {
		return false;
	}
}

function credentialStatus(type: string, apiKey: string): string {
	if (type === 'ollama') return 'ollama 不需要 API key';
	return apiKey ? '已配置' : '缺失';
}
