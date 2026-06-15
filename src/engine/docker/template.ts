import {
  BuildOptionsMap, MessageListener, ServiceEngine,
  TemplateRepository,
  TemplateRepositoryConfig,
  TemplateRepositoryRegistry
} from "@nsm/engine";
import {AppContext} from "@nsm/app";
import {init as initImageEngine, processImage} from "@nsm/engine/docker/repository/filesystem/image";
import {getAllTemplates} from "@nsm/engine/docker/repository/filesystem/template";
import {TemplateNotFoundError, TemplateRepositoryConfigurationError} from "@nsm/engine/error";
import * as templateDirWatcher from "@nsm/engine/docker/repository/filesystem/monitoring/templateDirWatcher";
import path from "path";
import fs from "fs";
import {loadYamlFile} from "@nsm/util/yaml";
import {Template} from "@nsm/engine/template";
import winston from "winston";

type RepositoryRegistration = {
  id: string;
  repository: TemplateRepository;
}

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

  async buildImage(
    templateId: string,
    options: BuildOptionsMap,
    imageId?: string,
    messageListener?: MessageListener
  ) {
    const template = await this.getTemplate(templateId);
    if (template) {
      return processImage(imageId, template, options, messageListener);
    } else {
      throw new TemplateNotFoundError(templateId);
    }
  }

  async getTemplate(id: string) {
    if (this.templateCache.has(id)
      && this.templateHashCache.has(id)
      // template didn't change, so we can be sure that settings.yml didn't as well
      && this.templateHashCache.get(id) === templateDirWatcher.getTemplateHash(id)) {
      return this.templateCache.get(id);
    }

    const settingsPath = path.join(this.templatesPath, id, "settings.yml");
    if (!fs.existsSync(settingsPath)) {
      return undefined;
    }

    const settings = loadYamlFile(settingsPath);
    const template: Template = {
      id,
      name: settings.name,
      description: settings.description,
      settings,
    };
    this.templateCache.set(id, template);

    let hash: string;
    try {
      hash = templateDirWatcher.getTemplateHash(template.id);
    } catch (e) {
      this.logger.warn(`Failed to get hash for template ${id}: ${e.message}`);
      this.templateHashCache.delete(id);
    }
    if (hash) {
      this.templateHashCache.set(id, hash);
    }
    return template;
  }

  async getAllTemplates() {
    return getAllTemplates();
  }
}

export class DockerTemplateRepositoryRegistry implements TemplateRepositoryRegistry {
  private readonly repositories: RepositoryRegistration[];

  constructor(
    private readonly engine: ServiceEngine,
  ) {
    this.repositories = [];
  }

  async saveRepository(config: TemplateRepositoryConfig) {
    let repository: TemplateRepository;
    if (config.type === "filesystem") {
      repository = new FilesystemTemplateRepository(this.engine);
    } else {
      throw new TemplateRepositoryConfigurationError(config.id, `Unsupported repository type: ${config.type}`);
    }

    this.repositories.push({
      id: config.id,
      repository: repository,
    });
  }

  getRepository(id: string) {
    const registration = this.repositories.find((r) => r.id === id);

    return registration ? registration.repository : undefined;
  }

  getAllRepositories() {
    return this.repositories.map((registration) => registration.repository);
  }
}