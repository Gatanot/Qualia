import { describe, it, expect } from 'vitest';
import { ToolContext } from './env.js';

describe('ToolContext', () => {
	describe('resolvePath', () => {
		it('resolves relative path within workspace', () => {
			const ctx = new ToolContext('/home/user/project');
			const result = ctx.resolvePath('src/app.ts');
			expect(result.classification).toBe('safe');
		});

		it('classifies system paths as reject', () => {
			const ctx = new ToolContext('/home/user/project');
			const result = ctx.resolvePath('C:\\Windows\\System32\\kernel32.dll');
			expect(result.classification).toBe('reject');
		});

		it('resolves absolute path', () => {
			const ctx = new ToolContext('/home/user/project');
			const result = ctx.resolvePath('/home/user/project/src/app.ts');
			expect(result.path).toContain('src');
		});
	});

	describe('classifyCommand', () => {
		it('classifies safe commands', () => {
			const ctx = new ToolContext('/home/user/project');
			expect(ctx.classifyCommand('ls -la')).toBe('safe');
		});

		it('classifies dangerous commands as confirm', () => {
			const ctx = new ToolContext('/home/user/project');
			expect(ctx.classifyCommand('rm -rf /tmp/test')).toBe('confirm');
		});

		it('classifies system-dangerous commands as reject', () => {
			const ctx = new ToolContext('/home/user/project');
			expect(ctx.classifyCommand('format C:')).toBe('reject');
		});
	});

	describe('root', () => {
		it('exposes root path', () => {
			const ctx = new ToolContext('/home/user/project');
			expect(ctx.root).toBe('/home/user/project');
		});
	});
});
