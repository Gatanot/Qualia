import type { AutocompleteItem, SlashCommand } from './autocomplete.js';
import { CombinedAutocompleteProvider } from './autocomplete.js';
import { getAllAvailableModels } from '@gatanot/qualia_core/config';
import { createStorage } from '@gatanot/qualia_core/storage';

function modelCommand(): SlashCommand {
	return {
		name: 'model',
		description: 'Switch model',
		argumentHint: '<model_id>',
		getArgumentCompletions(prefix: string): AutocompleteItem[] {
			const models = getAllAvailableModels();
			const lower = prefix.toLowerCase();
			return models
				.filter((m) => m.model.id.toLowerCase().startsWith(lower))
				.map((m) => ({
					value: m.model.id,
					label: m.model.id,
					description: m.model.name
				}));
		}
	};
}

function sessionCommand(): SlashCommand {
	return {
		name: 'session',
		description: 'View/switch sessions',
		argumentHint: '[session_title]',
		async getArgumentCompletions(prefix: string): Promise<AutocompleteItem[]> {
			try {
				const storage = createStorage({ enabled: true });
				const sessions = await storage.listSessions();
				const lower = prefix.toLowerCase();
				return sessions
					.filter((s) => s.id.toLowerCase().startsWith(lower) || s.title.toLowerCase().includes(lower))
					.slice(0, 10)
					.map((s) => ({
						value: s.id,
						label: s.title
					}));
			} catch {
				return [];
			}
		}
	};
}

export function createCommands(): SlashCommand[] {
	return [
		modelCommand(),
		{ name: 'new', description: 'New conversation' },
		sessionCommand(),
		{ name: 'provider', description: 'Add provider API key', argumentHint: '<type> <key>' },
		{ name: 'undo', description: 'Undo last input' },
		{ name: 'exit', description: 'Exit' },
		{ name: 'end', description: 'Exit and stop the Qualia backend' },
	];
}

export function createAutocompleteProvider(workspace: string): CombinedAutocompleteProvider {
	const commands = createCommands();
	return new CombinedAutocompleteProvider(commands, workspace);
}

export type SlashResult =
	| { type: 'send'; value: string }
	| { type: 'command'; action: string; arg?: string }
	| { type: 'none' };

export function parseSlashCommand(text: string): SlashResult {
	const trimmed = text.trim();
	if (!trimmed.startsWith('/')) return { type: 'send', value: text };

	const spaceIdx = trimmed.indexOf(' ');
	const cmd = spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx);
	const arg = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();

	switch (cmd) {
		case 'model':
			return { type: 'command', action: 'model', arg: arg || undefined };
		case 'new':
			return { type: 'command', action: 'new' };
		case 'session':
			return { type: 'command', action: 'session', arg: arg || undefined };
		case 'provider':
			return { type: 'command', action: 'provider', arg: arg || undefined };
		case 'undo':
			return { type: 'command', action: 'undo' };
		case 'end':
			return { type: 'command', action: 'end' };
		default:
			return { type: 'send', value: text };
	}
}
