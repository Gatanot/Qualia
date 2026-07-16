import { describe, it, expect } from 'vitest';
import { classifyCommand } from './safeguard.js';

const ROOT = process.cwd();

describe('classifyCommand', () => {
	it('classifies pure readonly commands as safe', () => {
		expect(classifyCommand('ls -la', ROOT)).toBe('safe');
		expect(classifyCommand('git status', ROOT)).toBe('safe');
		expect(classifyCommand('cat package.json', ROOT)).toBe('safe');
		expect(classifyCommand('echo hi', ROOT)).toBe('safe');
	});

	it('rejects format / diskpart', () => {
		expect(classifyCommand('format c:', ROOT)).toBe('reject');
		expect(classifyCommand('diskpart', ROOT)).toBe('reject');
	});

	it('confirms dangerous commands', () => {
		expect(classifyCommand('rm -rf /', ROOT)).toBe('confirm');
		expect(classifyCommand('git push --force', ROOT)).toBe('confirm');
	});

	it('does not let readonly command + redirect bypass workspace-external confirm', () => {
		expect(classifyCommand('echo evil > ~/.bashrc', ROOT)).toBe('confirm');
		expect(classifyCommand('cat /etc/passwd > ~/stolen.txt', ROOT)).toBe('confirm');
		expect(classifyCommand('printf evil >> ~/.ssh/authorized_keys', ROOT)).toBe('confirm');
	});

	it('still confirms redirect into system paths', () => {
		expect(classifyCommand('echo x > /etc/hosts', ROOT)).toBe('confirm');
	});

	it('allows redirect into a workspace-relative path', () => {
		expect(classifyCommand('echo hi > out.txt', ROOT)).toBe('safe');
	});
});
