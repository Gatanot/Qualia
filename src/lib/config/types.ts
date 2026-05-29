/**
 * 单个 AI 供应商的配置
 */
export interface ProviderConfig {
	/** 供应商类型，目前仅支持 'openai' */
	type: string;
	/** 用户自定义名称，用于识别不同配置 */
	name: string;
	/** API 密钥 */
	apiKey: string;
	/** API 基础地址 */
	baseURL: string;
	/** 默认模型名称 */
	model: string;
	/** 模型上下文窗口大小，默认 128000 */
	contextWindow?: number;
	/** 请求超时（毫秒） */
	timeout?: number;
	/** 最大重试次数 */
	maxRetries?: number;
}

/**
 * 应用全局配置
 */
export interface AppConfig {
	/** 已保存的供应商列表 */
	providers: ProviderConfig[];
	/** 当前活跃供应商名称 */
	activeProvider: string;
	/** 是否启用对话持久化存储 */
	storageEnabled: boolean;
	/** 自定义系统提示词 */
	systemPrompt: string;
}
