export interface Command {
	name: string;
	aliases?: string[];
	description: string;
	usage?: string;
	run(args: string[]): Promise<number>;
}

const commands: Map<string, Command> = new Map();

export function register(cmd: Command): void {
	commands.set(cmd.name, cmd);
	if (cmd.aliases) {
		for (const alias of cmd.aliases) {
			commands.set(alias, cmd);
		}
	}
}

export async function dispatch(argv: string[]): Promise<number> {
	const [cmdName, ...rest] = argv;

	if (!cmdName || cmdName.startsWith('-')) {
		const cmd = commands.get('chat');
		if (cmd) return cmd.run(argv);
	}

	if (cmdName === '--help' || cmdName === '-h') {
		printAllHelp();
		return 0;
	}

	if (cmdName === '--version' || cmdName === '-v') {
		console.log('qualia v0.1.2');
		return 0;
	}

	const cmd = commands.get(cmdName);
	if (!cmd) {
		console.error(`未知命令: ${cmdName}`);
		console.error('运行 qualia --help 查看帮助。');
		return 2;
	}

	return cmd.run(rest);
}

export function printAllHelp(): void {
	console.log(`Qualia CLI v0.1.2 — local personal AI companion

Usage:
  qualia [command] [options]

Commands:`);

	for (const cmd of commands.values()) {
		const aliases = cmd.aliases?.length ? ` (${cmd.aliases.join(', ')})` : '';
		console.log(`  ${cmd.name}${aliases}`);
		console.log(`    ${cmd.description}`);
	}

	console.log(`
Options:
  --help, -h       Show this help
  --version, -v    Show version

Examples:
  qualia                          # Start interactive TUI
  qualia chat                     # Same as above
  qualia -p "Summarize this file" # Run once and exit
  qualia serve --port 8080        # Start web interface
  qualia model list               # List available models
`);
}
