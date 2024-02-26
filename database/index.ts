import {Database} from "./models";
import * as manager from './manager';

export * from './models';

export default function (): Database {
    return manager;
}