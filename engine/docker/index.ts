import {BuildOptions, ServiceEngine} from "../engine";


export default async function (): Promise<ServiceEngine> {
    // TODO
    return {
        create(buildDir: string, options: BuildOptions): Promise<string> {

        },
        resume(id: string, options: BuildOptions): Promise<string | undefined> {

        },
        stop(id: string): Promise<boolean> {

        },
        delete(id: string): Promise<boolean> {

        }
    }
}