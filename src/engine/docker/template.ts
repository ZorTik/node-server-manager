import {
  MessageListener, RepositoryRegistration, ServiceEngine,
  TemplateRepository,
  TemplateRepositoryConfig,
  TemplateRepositoryRegistry
} from "@nsm/engine";
import {AppContext} from "@nsm/app";
import {init as initImageEngine, processImage} from "@nsm/engine/docker/repository/filesystem/image";
import {getAllTemplates} from "@nsm/engine/docker/repository/filesystem/template";
import {InternalError, TemplateNotFoundError, TemplateRepositoryConfigurationError} from "@nsm/engine/error";
import * as templateDirWatcher from "@nsm/engine/docker/repository/filesystem/monitoring/templateDirWatcher";
import path from "path";
import fs from "fs";
import {loadYamlFile} from "@nsm/util/yaml";
import {Template, templateSettingsModel} from "@nsm/engine/template";
import winston from "winston";
import z from "zod";
import {ParamsResolver} from "@nsm/util/args";
import DockerClient from "dockerode";

type BuildStageSettings = {
  buildargs?: { [key: string]: string };
}

const settingsYamlModel = templateSettingsModel.extend({
  name: z.string(),
  description: z.string(),
});

const buildStageSettingsYamlModel = z.object({
  buildargs: z.record(z.string(), z.string()).optional(),
});

/**
 * A template repository that loads templates from the filesystem.
 * The template dir is determined from the app config.
 *
 * @author ZorTik
 */
class FilesystemTemplateRepository implements TemplateRepository {
  private readonly templateCache: Map<string, Template>;
  private readonly templateHashCache: Map<string, string>;

  private templatesPath: string;
  private logger: winston.Logger;

  constructor(
    private readonly engine: ServiceEngine,
  ) {
    this.templateCache = new Map();
    this.templateHashCache = new Map();
  }

  async init(ctx: AppContext) {
    this.templatesPath = ctx.appConfig.getTemplatesPath();
    this.logger = ctx.logger;

    initImageEngine(this.engine, templateDirWatcher, ctx.database, ctx.appConfig, ctx.logger);
    templateDirWatcher.watchTemplateDirChanges(ctx.logger);
  }

  async prepareImage(
    templateId: string,
    args: { [key: string]: string },
    imageId?: string,
    messageListener?: MessageListener
  ) {
    const template = await this.getTemplate(templateId);
    if (template) {
      const buildStageSettings = this.loadBuildStageFile(templateId);
      if (!buildStageSettings) {
        throw new InternalError(`Failed to load build-stage.yml for template ${templateId}`);
      }
      const buildArgs = buildStageSettings.buildargs
        ? (
          new ParamsResolver(buildStageSettings.buildargs)
            .setArgs(args)
            .getParams()
        )
      : {};

      return processImage(imageId, template, buildArgs, messageListener);
    } else {
      throw new TemplateNotFoundError(templateId);
    }
  }

  async getTemplate(id: string) {
    if (this.templateCache.has(id)
      && this.templateHashCache.has(id)
      // template didn't change, so we can be sure that settings.yml didn't as well
      && this.templateHashCache.get(id) === await templateDirWatcher.getTemplateHash(id)) {
      return this.templateCache.get(id);
    }

    const settings = this.loadSettingsFile(id);
    if (!settings) {
      return undefined;
    }

    try {
      if (!this.loadBuildStageFile(id)) {
        // invalid build-stage file
        return undefined;
      }
    } catch (e) {
      this.logger.error(`Failed to load build-stage.yml for template ${id}: ${e.message}`);
      this.logger.error(e);

      return undefined;
    }

    const template: Template = {
      id,
      name: settings.name,
      description: settings.description,
      config: settings,
    };
    this.templateCache.set(id, template);

    await this.updateCachedHash(id);
    return template;
  }

  private loadBuildStageFile(templateId: string): BuildStageSettings {
    const buildStagePath = path.join(this.templatesPath, templateId, "build-stage.yml");
    if (!fs.existsSync(buildStagePath)) {
      return {
        buildargs: {}
      };
    }

    try {
      return buildStageSettingsYamlModel.parse(loadYamlFile(buildStagePath));
    } catch (e) {
      if (e instanceof z.ZodError) {
        this.logger.warn(`Invalid build-stage.yml for template ${templateId}: ${e.message}`);

        return undefined;
      }

      throw e;
    }
  }

  private loadSettingsFile(templateId: string) {
    const settingsPath = path.join(this.templatesPath, templateId, "settings.yml");
    if (!fs.existsSync(settingsPath)) {
      return undefined;
    }

    try {
      return settingsYamlModel.parse(loadYamlFile(settingsPath));
    } catch (e) {
      if (e instanceof z.ZodError) {
        this.logger.warn(`Invalid settings.yml for template ${templateId}: ${e.message}`);

        return undefined;
      }

      throw e;
    }
  }

  private async updateCachedHash(templateId: string) {
    let hash: string;
    try {
      hash = await templateDirWatcher.getTemplateHash(templateId);
    } catch (e) {
      this.logger.warn(`Failed to get hash for template ${templateId}: ${e.message}`);
      this.templateHashCache.delete(templateId);
    }
    if (hash) {
      this.templateHashCache.set(templateId, hash);
    }
  }

  async getAllTemplates() {
    return (
      await Promise.all(
        getAllTemplates().map(async (t) => this.getTemplate(t.id))
      )
    ).filter((t): t is Template => t != undefined);
  }
}

interface ImagePuller {
  /**
   * Pulls the specified image from the registry and returns its ID.
   *
   * @param image The image to pull.
   * @param imageId An optional image ID to pull.
   * @param messageListener An optional message listener to receive progress updates during the pull operation.
   * @returns The ID of the pulled image.
   * @throws If there is an error pulling the image.
   */
  pullImage(image: string, imageId?: string, messageListener?: MessageListener): Promise<string>;
}

interface DockerRegistryImagePullerOptions {
  registry?: string;
  auth?: {
    username?: string;
    password?: string;
  };
}

class DockerRegistryImagePuller implements ImagePuller {
  private readonly DEFAULT_REGISTRY = 'https://index.docker.io/v1/';

  constructor(
    private readonly docker: DockerClient,
    private readonly options: DockerRegistryImagePullerOptions,
  ) {}

  /**
   * Helper to safely format and send messages to the listener with specific log levels
   */
  private emitLog(listener: MessageListener | undefined, text: string, level: "error" | "info" = "info"): void {
    if (listener?.onEngineMessage) {
      listener.onEngineMessage({
        level,
        message: text,
      });
    }
  }

  /**
   * Pulls the specified image from the registry using dockerode.
   */
  async pullImage(
    image: string,
    imageId?: string,
    messageListener?: MessageListener
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const registry = this.options.registry || this.DEFAULT_REGISTRY;
      const auth = this.options.auth?.username && this.options.auth?.password
        ? {
          username: this.options.auth.username,
          password: this.options.auth.password,
          serveraddress: registry
        }
        : undefined;

      this.emitLog(messageListener, `Pulling "${image}" via ${registry}`, "info");

      this.docker.pull(image, { authconfig: auth }, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) {
          this.emitLog(messageListener, `Initial pull request failed: ${err.message}`, "error");

          return reject(err);
        }

        this.follow(stream, messageListener, reject, resolve, image, imageId);
      });
    });
  }

  private follow(
    stream: NodeJS.ReadableStream,
    messageListener: MessageListener,
    reject: (reason?: any) => void,
    resolve: (value: (PromiseLike<unknown> | unknown)) => void,
    image: string,
    imageId: string,
  ) {
    this.docker.modem.followProgress(
      stream,
      async (finishErr: Error | null, _: any[]) => {
        return await this.onFinish(finishErr, messageListener, reject, resolve, image, imageId);
      },
      (progressEvent: any) => {
        this.onProgress(progressEvent, messageListener);
      }
    );
  }

  private async onFinish(
    finishErr: Error,
    messageListener: MessageListener,
    reject: (reason?: any) => void,
    resolve: (value: (PromiseLike<unknown> | unknown)) => void,
    image: string,
    imageId: string,
  ) {
    if (finishErr) {
      this.emitLog(messageListener, `Pull stream failed: ${finishErr.message}`, "error");
      return reject(finishErr);
    }

    this.emitLog(messageListener, `Successfully finished pulling image: ${image}`, "info");

    try {
      // if an explicit imageId was provided, return it
      if (imageId) {
        return resolve(imageId);
      }

      const dockerImage = this.docker.getImage(image);
      const inspectData = await dockerImage.inspect();

      return resolve(inspectData.Id);
    } catch (inspectError) {
      this.emitLog(messageListener, `Failed to inspect image, using fallback reference`, "info");

      return resolve(`unknown-sha-for-${image}`);
    }
  }

  private onProgress(progressEvent: any, messageListener: MessageListener) {
    if (messageListener?.onMessage) {
      const status = progressEvent.status || '';
      const id = progressEvent.id ? `[${progressEvent.id}] ` : '';
      const progress = progressEvent.progress ? ` ${progressEvent.progress}` : '';

      this.emitLog(messageListener, `${id}${status}${progress}`, "info");
    }
  }
}

interface DockerRegistryTemplateDefinition extends Template {
  image: string;
}

interface DockerRegistryRepositoryOptions {
  puller: ImagePuller;
  templates: DockerRegistryTemplateDefinition[]
}

class DockerRegistryTemplateRepository implements TemplateRepository {
  constructor(
    private readonly options: DockerRegistryRepositoryOptions,
  ) {
  }

  async init(ctx: AppContext): Promise<void> {
  }

  async prepareImage(templateId: string, _: {
    [p: string]: string
  }, imageId?: string, messageListener?: MessageListener): Promise<string> {
    const template = this.options.templates.find((t) => t.id === templateId);
    if (!template) {
      throw new TemplateNotFoundError(templateId);
    }

    if (imageId) {
      // TODO: check if the image has changed, otherwise rebuild
    }

    imageId = await this.options.puller.pullImage(template.image, imageId, messageListener);
    return imageId;
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    return this.options.templates.find((t) => t.id === id);
  }

  async getAllTemplates(): Promise<Template[]> {
    return this.options.templates;
  }
}

/**
 * A default template repository registry for the docker engine.
 *
 * @author ZorTik
 */
export class DockerTemplateRepositoryRegistry implements TemplateRepositoryRegistry {
  private readonly repositories: RepositoryRegistration[];

  constructor(
    private readonly engine: ServiceEngine,
    private readonly client: DockerClient,
  ) {
    this.repositories = [];
  }

  async saveRepository(config: TemplateRepositoryConfig) {
    let repository: TemplateRepository;
    if (config.type === "filesystem") {
      repository = new FilesystemTemplateRepository(this.engine);
    } else if (config.type === "docker-registry") {
      // TODO: validate config
      const puller = new DockerRegistryImagePuller(this.client, config.config.puller);
      repository = new DockerRegistryTemplateRepository({
        puller,
        templates: config.config.templates
      });
    } else {
      throw new TemplateRepositoryConfigurationError(config.id, `Unsupported repository type: ${config.type}`);
    }

    this.repositories.push({
      id: config.id,
      repository: repository,
    });
  }

  getRepository(id: string) {
    return this.repositories.find((r) => r.id === id);
  }

  getAllRepositories() {
    return this.repositories;
  }
}