/**
 * Config 模块
 *
 * 统一管理应用配置。配置来源为 data/config.json（JSON 文件），
 * 通过 readConfig / writeConfig 读写，设置页面调用 API 路由间接操作。
 *
 * @module config
 */

export type { AppConfig, ProviderConfig } from './types';
export type { ModelDef } from '../provider/models';
export {
	readConfig,
	writeConfig,
	addProvider,
	removeProvider,
	setActiveModel,
	getProviderForModel,
	getAllAvailableModels,
	getFirstProvider,
	getActiveModel,
	getContextWindow
} from './store';
