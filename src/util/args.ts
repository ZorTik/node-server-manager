const prefixParams = (
  prefix: string,
  params: { [key: string]: string },
) => {
  const prefixedParams: { [key: string]: string } = {};
  for (let key in params) {
    prefixedParams[`${prefix}${key}`] = params[key];
  }

  return prefixedParams;
}

/**
 * Preprocesses parameter variables by replacing placeholders with corresponding argument values.
 *
 * @param params The parameter variables to preprocess, which may contain placeholders for arguments.
 * @param args The arguments to replace in the parameter variables
 */
const preprocessParamsFromServiceArgs = (
  params: { [key: string]: string },
  args: { [key: string]: string },
) => {
  let customParams = { ...params };
  for (let key in customParams) {
    // preprocess env value
    customParams[key] = preprocessParamValue(customParams[key], args);
  }

  return customParams;
}

/**
 * Preprocesses a parameter variable value.
 *
 * @param value The parameter variable value to preprocess, which may contain placeholders for arguments.
 * @param args The arguments to replace in the parameter variable value
 */
const preprocessParamValue = (
  value: string,
  args: { [key: string]: string },
): string => {
  return value.replace(/\$\{([^}]+)}/g, (match, key) => {
    return args[key] ?? match;
  });
}

export type Args = { [key: string]: string };
export type Params = { [key: string]: string };
export type ServiceArgs = {
  id: string;
  port: string;
  ports: string;
  ram: string;
  cpu: string;
  disk: string;
}

/**
 * A class responsible for resolving parameter variables by preprocessing them with provided arguments.
 *
 * @author ZorTik
 */
export class ParamsResolver {
  private args: Args;
  private serviceArgs: Args | undefined;

  constructor(
    private readonly params: Params,
  ) {
    this.args = {};
  }

  /**
   * Sets the service arguments.
   *
   * @param args The service arguments to set
   */
  setArgs(args: { [key: string]: string }) {
    this.args = args;

    return this;
  }

  /**
   * Sets the service reserved arguments.
   *
   * @param args The service reserved arguments to set
   */
  setServiceArgs(args: ServiceArgs) {
    this.serviceArgs = args;

    return this;
  }

  /**
   * Resolves final parameter variables.
   */
  getParams(): Params {
    let params: Params = this.params;
    params = preprocessParamsFromServiceArgs(
      params,
      prefixParams("args.", this.args),
    );
    if (this.serviceArgs) {
      params = preprocessParamsFromServiceArgs(
        params,
        prefixParams("service.", this.serviceArgs),
      );
    }

    return params;
  }
}