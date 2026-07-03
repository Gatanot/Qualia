export class CLIError extends Error {
	constructor(
		message: string,
		public readonly code: number,
		public readonly details?: string
	) {
		super(message);
		this.name = 'CLIError';
	}

	static config(message: string): CLIError {
		return new CLIError(message, 3);
	}

	static model(message: string): CLIError {
		return new CLIError(message, 4);
	}

	static cancelled(message: string): CLIError {
		return new CLIError(message, 5);
	}

	static agent(message: string): CLIError {
		return new CLIError(message, 6);
	}

	static tool(message: string): CLIError {
		return new CLIError(message, 7);
	}
}
