import {ServiceEngine} from "../engine";
import DockerClient from "dockerode";

export default function (self: ServiceEngine, client: DockerClient): ServiceEngine['stat'] {
    return async (id) => {
        const { memory_stats, cpu_stats } = await client.getContainer(id).stats({ stream: false });
        return {
            id,
            memory: {
                used: memory_stats.usage,
                total: memory_stats.limit,
                percent: memory_stats.usage / memory_stats.limit,
            },
            cpu: {
                used: cpu_stats.cpu_usage.total_usage,
                total: cpu_stats.system_cpu_usage,
                percent: cpu_stats.cpu_usage.total_usage / cpu_stats.system_cpu_usage,
            },
        }
    }
}