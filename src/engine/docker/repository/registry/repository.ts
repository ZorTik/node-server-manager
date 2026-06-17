import {MessageListener, TemplateRepository} from "@nsm/engine";
import DockerClient from "dockerode";
import {Template} from "@nsm/engine/template";
import {AppContext} from "@nsm/app";
import {TemplateNotFoundError} from "@nsm/engine/error";

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

export class DockerRegistryImagePuller implements ImagePuller {
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

export class DockerRegistryTemplateRepository implements TemplateRepository {
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