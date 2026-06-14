export class AsyncTask<T> {
  constructor(
    public readonly promise: Promise<T>,
  ) {}
}

export async function resolveSequentially(...funcs: any[]) {
  for (const func of funcs) {
    if (typeof func == "function") {
      await func();
    } else {
      await (func as Promise<any>);
    }
  }
}
