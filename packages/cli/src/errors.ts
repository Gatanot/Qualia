export type CliErrorCode =
	| 'USAGE'
	| 'CONFIG'
	| 'MODEL'
	| 'CANCELLED'
	| 'AGENT'
	| 'TOOL'
	| 'IO';

const EXIT_CODES: Record<CliErrorCode, number> = {
	USAGE: 2,
	CONFIG: 3,
	MODEL: 4,
	CANCELLED: 5,
	AGENT: 6,
	TOOL: 7,
	IO: 1
};

export class CliError extends Error {
	readonly code: CliErrorCode;
	readonly exitCode: number;

	constructor(code: CliErrorCode, message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = 'CliError';
		this.code = code;
		this.exitCode = EXIT_CODES[code];
	}
}

export function exitCodeFor(error: unknown): number {
	if (error instanceof CliError) return error.exitCode;
	return 1;
}

export function messageFor(error: unknown): string {
	if (error instanceof Error && error.message) return error.message;
	return '未知错误';
}
