/**
 * 运行时执行器
 * 专注于插件化的AI调用处理
 */
import { ImageModelV2, LanguageModelV2, LanguageModelV2Middleware } from '@ai-sdk/provider'
import {
  experimental_generateImage as generateImage,
  generateObject,
  generateText,
  LanguageModel,
  streamObject,
  streamText
} from 'ai'

import { globalModelResolver } from '../models'
import { type ModelConfig } from '../models/types'
import { type AiPlugin, type AiRequestContext, definePlugin } from '../plugins'
import { type ProviderId } from '../providers'
import { ImageGenerationError, ImageModelResolutionError } from './errors'
import { PluginEngine } from './pluginEngine'
import { type RuntimeConfig } from './types'

export class RuntimeExecutor<T extends ProviderId = ProviderId> {
  public pluginEngine: PluginEngine<T>
  // private options: ProviderSettingsMap[T]
  private config: RuntimeConfig<T>

  constructor(config: RuntimeConfig<T>) {
    // if (!isProviderSupported(config.providerId)) {
    //   throw new Error(`Unsupported provider: ${config.providerId}`)
    // }

    // 存储options供后续使用
    // this.options = config.options
    this.config = config
    // 创建插件客户端
    this.pluginEngine = new PluginEngine(config.providerId, config.plugins || [])
  }

  private createResolveModelPlugin(middlewares?: LanguageModelV2Middleware[]) {
    return definePlugin({
      name: '_internal_resolveModel',
      enforce: 'post',

      resolveModel: async (modelId: string) => {
        // 注意：extraModelConfig 暂时不支持，已在新架构中移除
        return await this.resolveModel(modelId, middlewares)
      }
    })
  }

  private createResolveImageModelPlugin() {
    return definePlugin({
      name: '_internal_resolveImageModel',
      enforce: 'post',

      resolveModel: async (modelId: string) => {
        return await this.resolveImageModel(modelId)
      }
    })
  }

  private createConfigureContextPlugin() {
    return definePlugin({
      name: '_internal_configureContext',
      configureContext: async (context: AiRequestContext) => {
        context.executor = this
      }
    })
  }

  // === 高阶重载：直接使用模型 ===

  /**
   * 流式文本生成
   */
  async streamText(
    params: Parameters<typeof streamText>[0],
    options?: {
      middlewares?: LanguageModelV2Middleware[]
    }
  ): Promise<ReturnType<typeof streamText>> {
    const { model, ...restParams } = params

    // 根据 model 类型决定插件配置
    if (typeof model === 'string') {
      this.pluginEngine.usePlugins([
        this.createResolveModelPlugin(options?.middlewares),
        this.createConfigureContextPlugin()
      ])
    } else {
      this.pluginEngine.usePlugins([this.createConfigureContextPlugin()])
    }

    return this.pluginEngine.executeStreamWithPlugins(
      'streamText',
      model,
      restParams,
      async (resolvedModel, transformedParams, streamTransforms) => {
        const experimental_transform =
          params?.experimental_transform ?? (streamTransforms.length > 0 ? streamTransforms : undefined)

        const finalParams = {
          model: resolvedModel,
          ...transformedParams,
          experimental_transform
        } as Parameters<typeof streamText>[0]

        return await streamText(finalParams)
      }
    )
  }

  // === 其他方法的重载 ===

  /**
   * 生成文本
   */
  async generateText(
    params: Parameters<typeof generateText>[0],
    options?: {
      middlewares?: LanguageModelV2Middleware[]
    }
  ): Promise<ReturnType<typeof generateText>> {
    const { model, ...restParams } = params

    // 根据 model 类型决定插件配置
    if (typeof model === 'string') {
      this.pluginEngine.usePlugins([
        this.createResolveModelPlugin(options?.middlewares),
        this.createConfigureContextPlugin()
      ])
    } else {
      this.pluginEngine.usePlugins([this.createConfigureContextPlugin()])
    }

    return this.pluginEngine.executeWithPlugins(
      'generateText',
      model,
      restParams,
      async (resolvedModel, transformedParams) =>
        generateText({ model: resolvedModel, ...transformedParams } as Parameters<typeof generateText>[0])
    )
  }

  /**
   * 生成结构化对象
   */
  async generateObject(
    params: Parameters<typeof generateObject>[0],
    options?: {
      middlewares?: LanguageModelV2Middleware[]
    }
  ): Promise<ReturnType<typeof generateObject>> {
    const { model, ...restParams } = params

    // 根据 model 类型决定插件配置
    if (typeof model === 'string') {
      this.pluginEngine.usePlugins([
        this.createResolveModelPlugin(options?.middlewares),
        this.createConfigureContextPlugin()
      ])
    } else {
      this.pluginEngine.usePlugins([this.createConfigureContextPlugin()])
    }

    return this.pluginEngine.executeWithPlugins(
      'generateObject',
      model,
      restParams,
      async (resolvedModel, transformedParams) =>
        generateObject({ model: resolvedModel, ...transformedParams } as Parameters<typeof generateObject>[0])
    )
  }

  /**
   * 流式生成结构化对象
   */
  async streamObject(
    params: Parameters<typeof streamObject>[0],
    options?: {
      middlewares?: LanguageModelV2Middleware[]
    }
  ): Promise<ReturnType<typeof streamObject>> {
    const { model, ...restParams } = params

    // 根据 model 类型决定插件配置
    if (typeof model === 'string') {
      this.pluginEngine.usePlugins([
        this.createResolveModelPlugin(options?.middlewares),
        this.createConfigureContextPlugin()
      ])
    } else {
      this.pluginEngine.usePlugins([this.createConfigureContextPlugin()])
    }

    return this.pluginEngine.executeWithPlugins(
      'streamObject',
      model,
      restParams,
      async (resolvedModel, transformedParams) =>
        streamObject({ model: resolvedModel, ...transformedParams } as Parameters<typeof streamObject>[0])
    )
  }

  /**
   * 生成图像
   */
  async generateImage(
    params: Omit<Parameters<typeof generateImage>[0], 'model'> & { model: string | ImageModelV2 }
  ): Promise<ReturnType<typeof generateImage>> {
    try {
      const { model, ...restParams } = params

      // 根据 model 类型决定插件配置
      if (typeof model === 'string') {
        this.pluginEngine.usePlugins([this.createResolveImageModelPlugin(), this.createConfigureContextPlugin()])
      } else {
        this.pluginEngine.usePlugins([this.createConfigureContextPlugin()])
      }

      return await this.pluginEngine.executeImageWithPlugins(
        'generateImage',
        model,
        restParams,
        async (resolvedModel, transformedParams) => {
          return await generateImage({ model: resolvedModel, ...transformedParams })
        }
      )
    } catch (error) {
      if (error instanceof Error) {
        const modelId = typeof params.model === 'string' ? params.model : params.model.modelId
        throw new ImageGenerationError(
          `Failed to generate image: ${error.message}`,
          this.config.providerId,
          modelId,
          error
        )
      }
      throw error
    }
  }

  // === 辅助方法 ===

  /**
   * 解析模型：如果是字符串则创建模型，如果是模型则直接返回
   */
  private async resolveModel(
    modelOrId: LanguageModel,
    middlewares?: LanguageModelV2Middleware[]
  ): Promise<LanguageModelV2> {
    if (typeof modelOrId === 'string') {
      // 🎯 字符串modelId，使用新的ModelResolver解析，传递完整参数
      return await globalModelResolver.resolveLanguageModel(
        modelOrId, // 支持 'gpt-4' 和 'aihubmix:anthropic:claude-3.5-sonnet'
        this.config.providerId, // fallback provider
        this.config.providerSettings, // provider options
        middlewares // 中间件数组
      )
    } else {
      // 已经是模型，直接返回
      return modelOrId
    }
  }

  /**
   * 解析图像模型：如果是字符串则创建图像模型，如果是模型则直接返回
   */
  private async resolveImageModel(modelOrId: ImageModelV2 | string): Promise<ImageModelV2> {
    try {
      if (typeof modelOrId === 'string') {
        // 字符串modelId，使用新的ModelResolver解析
        return await globalModelResolver.resolveImageModel(
          modelOrId, // 支持 'dall-e-3' 和 'aihubmix:openai:dall-e-3'
          this.config.providerId // fallback provider
        )
      } else {
        // 已经是模型，直接返回
        return modelOrId
      }
    } catch (error) {
      throw new ImageModelResolutionError(
        typeof modelOrId === 'string' ? modelOrId : modelOrId.modelId,
        this.config.providerId,
        error instanceof Error ? error : undefined
      )
    }
  }

  // === 静态工厂方法 ===

  /**
   * 创建执行器 - 支持已知provider的类型安全
   */
  static create<T extends ProviderId>(
    providerId: T,
    options: ModelConfig<T>['providerSettings'],
    plugins?: AiPlugin[]
  ): RuntimeExecutor<T> {
    return new RuntimeExecutor({
      providerId,
      providerSettings: options,
      plugins
    })
  }

  /**
   * 创建OpenAI Compatible执行器
   */
  static createOpenAICompatible(
    options: ModelConfig<'openai-compatible'>['providerSettings'],
    plugins: AiPlugin[] = []
  ): RuntimeExecutor<'openai-compatible'> {
    return new RuntimeExecutor({
      providerId: 'openai-compatible',
      providerSettings: options,
      plugins
    })
  }
}
