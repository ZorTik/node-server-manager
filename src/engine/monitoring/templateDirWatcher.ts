import {baseTemplatesDir, buildDir, debounce} from "@nsm/engine/monitoring/util";
import {hashElement} from "folder-hash";
import {getFilteredPaths} from "@nsm/engine/ignore";
import {getAllTemplates} from "@nsm/engine/template";
import winston from "winston";
import chokidar, {FSWatcher} from "chokidar";
import path from "path";

const hashCache: Map<string, string> = new Map();
const watchers: Map<string, FSWatcher> = new Map();
const hashingInProgress: Set<string> = new Set();

/**
 * Starts watching the template directories for changes.
 * When a change is detected, the template hash is updated and cached.
 */
export const watchTemplateDirChanges = async (logger: winston.Logger) => {
  const templates = getAllTemplates();

  // Populate on startup
  await Promise.all(templates.map(template => watchTemplateDir(template.id)));
  // Watch the base directory for new templates
  await watchBaseDir(logger);

  logger.info("Watching template directories for changes...");
}

/**
 * Watches the base templates directory for new template directories being added or removed.
 *
 * When a new template directory is added, it starts watching that directory for changes.
 * When a template directory is removed, it stops watching that directory and removes its hash from the cache.
 */
const watchBaseDir = async (logger: winston.Logger) => {
  const dir = baseTemplatesDir();

  const watcher = chokidar.watch(dir, {
    ignoreInitial: true,
    depth: 0,
  });
  watcher.on("addDir", async (path_) => {
    const template = path.basename(path_);
    if (template && !watchers.has(template)) {
      logger.info(`New template directory detected: ${template}. Starting to watch for changes...`);

      await watchTemplateDir(template);
    }
  });
  watcher.on("unlinkDir", async (path_) => {
    const template = path.basename(path_);
    if (template && watchers.has(template)) {
      const tWatcher = watchers.get(template);
      if (tWatcher) {
        logger.info(
          `Template directory removed: ${template}. Stopping watch and removing hash from cache...`);

        await tWatcher.close();
      }

      watchers.delete(template);
      hashCache.delete(template);
    }
  })
}

/**
 * Watches a specific template directory for changes and updates the hash cache when a change is detected.
 *
 * @param template The name of the template to watch.
 */
const watchTemplateDir = async (template: string) => {
  if (watchers.has(template)) {
    return;
  }

  await recalculateTemplateHash(template);

  const dir = buildDir(template);
  const excluded = getFilteredPaths(dir);

  const recalc = debounce(() => recalculateTemplateHash(template), 2000);

  const watcher = chokidar.watch(dir, {
    ignored: [...excluded.dirs, ...excluded.files],
    ignoreInitial: true,
    // Wait for a file to be fully written before triggering the change event
    // This is necessary to avoid hashing a file that is still being written, which can lead to incorrect hashes
    // and unnecessary rehashing.
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100
    }
  });
  watcher.on("all", recalc);

  watchers.set(template, watcher);
}

const recalculateTemplateHash = async (template: string) => {
  const dir = buildDir(template);
  const excluded = getFilteredPaths(dir);

  if (hashingInProgress.has(template)) {
    return;
  }

  hashingInProgress.add(template);

  try {
    const hash = await hashElement(dir, {
      encoding: 'hex',
      folders: {
        exclude: excluded.dirs
      },
      files: {
        exclude: excluded.files
      }
    });
    hashCache.set(template, hash.hash);
  } finally {
    hashingInProgress.delete(template);
  }
}

/**
 * Gets the cached hash of a template directory.
 *
 * @param template The name of the template.
 * @returns The cached hash of the template directory.
 * @throws If the template does not exist or if there is an error reading the directory.
 */
export const getTemplateHash = (template: string): string => {
  const hash = hashCache.get(template);
  if (!hash) {
    throw new Error(`No hash calculated for template ${template}.`);
  }

  return hash;
}