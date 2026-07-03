import { readConfig, writeConfig, type AppConfig } from '@gatanot/qualia_core/config';
import { getConfigPath } from '@gatanot/qualia_core/paths';
import { CliError } from '../errors.js';
import { type CliIO, type ParsedArgs } from './index.js';

const EDITABLE_KEYS = new Set<keyof AppConfig>([
	'activeModel',
	'storageEnabled',
	'searchEnabled',
	'searchProvider',
	'searxngURL',
	'compressionMode',
	'compressionThreshold'
]);

export async function runConfig(args: ParsedArgs, io: CliIO): Promise<void> {
	const sub = args.positionals[0] || 'get';
	if (sub === 'path') {
		io.stdout.write(`${getConfigPath()}\n`);
		return;
	}

	const config = readConfig();
	if (sub === 'get') {
		const key = args.positionals[1] as keyof AppConfig | undefined;
		if (!key) {
			io.stdout.write(JSON.stringify(config, null, 2) + '\n');
			return;
		}
		if (!(key in config)) throw new CliError('USAGE', `未知配置项：${key}`);
		io.stdout.write(JSON.stringify(config[key], null, 2) + '\n');
		return;
	}

	if (sub === 'set') {
		const key = args.positionals[1] as keyof AppConfig | undefined;
		const value = args.positionals[2];
		if (!key || value === undefined) throw new CliError('USAGE', '用法：qualia config set <key> <value>');
		if (!EDITABLE_KEYS.has(key)) throw new CliError('USAGE', `CLI 暂不允许修改该配置项：${key}`);
		(config as unknown as Record<string, unknown>)[key] = coerceValue(key, value);
		writeConfig(config);
		io.stdout.write(`已更新：${key}\n`);
		return;
	}

	throw new CliError('USAGE', `未知 config 子命令：${sub}`);
}

function coerceValue(key: keyof AppConfig, value: string): unknown {
	switch (key) {
		case 'storageEnabled':
		case 'searchEnabled':
			if (value === 'true' || value === 'on' || value === '1') return true;
			if (value === 'false' || value === 'off' || value === '0') return false;
			throw new CliError('USAGE', `${key} 只能是 true/false`);
		case 'compressionThreshold': {
			const parsed = Number.parseInt(value, 10);
			if (!Number.isInteger(parsed) || parsed <= 0) throw new CliError('USAGE', 'compressionThreshold 必须是正整数');
			return parsed;
		}
		case 'searchProvider':
			if (value !== 'searxng' && value !== 'tavily') throw new CliError('USAGE', 'searchProvider 只能是 searxng 或 tavily');
			return value;
		case 'compressionMode':
			if (value !== 'auto' && value !== 'custom') throw new CliError('USAGE', 'compressionMode 只能是 auto 或 custom');
			return value;
		default:
			return value;
	}
}
