import {
  RepositoryRegistration, ServiceEngine,
  TemplateRepository,
  TemplateRepositoryConfig,
  TemplateRepositoryRegistry
} from "@nsm/engine";
import {TemplateRepositoryConfigurationError} from "@nsm/engine/error";
import DockerClient from "dockerode";
import {FilesystemTemplateRepository} from "@nsm/engine/docker/repository/filesystem/repository";
import {
  DockerRegistryImagePuller,
  DockerRegistryTemplateRepository
} from "@nsm/engine/docker/repository/registry/repository";
import z from "zod";
import {templateModel} from "@nsm/engine/template";

const dockerRegistryConfigModel = z.object({
  puller: z.object({
    registry: z.string().optional(),
    auth: z.object({
      username: z.string().optional(),
      password: z.string().optional()
    }).optional()
  }).optional(),
  templates: z.array(
    templateModel.extend({
      image: z.string(),
    })
  )
});

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
      repository = this.buildDockerRegistryRepository(config);
    } else {
      throw new TemplateRepositoryConfigurationError(config.id, `Unsupported repository type: ${config.type}`);
    }

    this.repositories.push({
      id: config.id,
      repository: repository,
    });
  }

  private buildDockerRegistryRepository(config: TemplateRepositoryConfig): DockerRegistryTemplateRepository {
    // validate config
    try {
      dockerRegistryConfigModel.parse(config.config);
    } catch (e) {
      if (e instanceof z.ZodError) {
        throw new TemplateRepositoryConfigurationError(
          config.id,
          e
        );
      }

      throw e;
    }

    const puller = new DockerRegistryImagePuller(this.client, config.config.puller ?? {});

    return new DockerRegistryTemplateRepository({
      puller,
      templates: config.config.templates
    });
  }

  getRepository(id: string) {
    return this.repositories.find((r) => r.id === id);
  }

  getAllRepositories() {
    return this.repositories;
  }
}