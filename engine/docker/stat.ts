import {ServiceEngine} from "../engine";
import DockerClient from "dockerode";

function calcCpuUsage(precpu: DockerClient.CPUStats, cpu: DockerClient.CPUStats) {
    const cpu_delta = cpu.cpu_usage.total_usage - precpu.cpu_usage.total_usage;
    const system_cpu_delta = cpu.system_cpu_usage - precpu.system_cpu_usage;
    const number_cpus = cpu.online_cpus;
    return (cpu_delta / system_cpu_delta) * number_cpus * 100.0;
}

export default function (self: ServiceEngine, client: DockerClient): ServiceEngine['stat'] {
    return async (id) => {
        const { memory_stats, precpu_stats, cpu_stats } = await client.getContainer(id).stats({ stream: false });

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
                //percent: cpu_stats.cpu_usage.total_usage / cpu_stats.system_cpu_usage,
                percent: calcCpuUsage(precpu_stats, cpu_stats),
            },
        }
    }
}