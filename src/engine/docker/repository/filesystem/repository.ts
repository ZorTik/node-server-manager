import {Template, templateSettingsModel} from "@nsm/engine/template";
import {MessageListener, ServiceEngine, TemplateRepository} from "@nsm/engine";
import winston from "winston";
import {AppContext} from "@nsm/app";
import {init as initImageEngine, processImage} from "@nsm/engine/docker/repository/filesystem/image";
import * as templateDirWatcher from "@nsm/engine/docker/repository/filesystem/monitoring/templateDirWatcher";
import {InternalError, TemplateNotFoundError} from "@nsm/engine/error";
import {ParamsResolver} from "@nsm/util/args";
import path from "path";
import fs from "fs";
import {loadYamlFile} from "@nsm/util/yaml";
import z from "zod";
import { getAllTemplates } from "./template";

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
export class FilesystemTemplateRepository implements TemplateRepository {
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