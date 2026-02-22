export function baseTemplatesDir() {
  return `${process.cwd()}/templates`;
}

// Returns the build directory for the template
export function buildDir(template: string) {
  return `${baseTemplatesDir()}/${template}`;
}

/**
 * Returns a debounced version of the given function.
 * The debounced function will only be called after it has not been called for the specified number of milliseconds.
 *
 * @param fn The function to debounce. Can be async or sync.
 * @param ms The number of milliseconds to wait before calling the function after the last call.
 * @returns A debounced version of the given function.
 */
export const debounce = (fn: () => void | Promise<void>, ms: number) => {
  let timer: NodeJS.Timeout | null = null;

  return () => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      timer = null;
      fn();
    }, ms);
  };
};