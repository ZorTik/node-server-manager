import DockerClient, {ContainerStats} from "dockerode";

function calcCpuUsage(precpu: DockerClient.CPUStats, cpu: DockerClient.CPUStats) {
    const cpu_delta = cpu?.cpu_usage.total_usage - precpu?.cpu_usage.total_usage;
    const system_cpu_delta = cpu?.system_cpu_usage - precpu?.system_cpu_usage;
    const number_cpus = cpu?.online_cpus;
    const result = (cpu_delta / system_cpu_delta) * number_cpus * 100.0;
    if (result == null) {
        return 0.0;
    } else {
        return result;
    }
}

export function adaptContainerStatsFromDocker(id: string, stats: ContainerStats) {
    const { memory_stats, precpu_stats, cpu_stats } = stats;

    return {
        id,
        memory: {
            used: memory_stats?.usage,
            total: memory_stats?.limit,
            percent: memory_stats?.usage / memory_stats?.limit,
        },
        cpu: {
            used: cpu_stats?.cpu_usage.total_usage,
            total: cpu_stats?.system_cpu_usage,
            //percent: cpu_stats.cpu_usage.total_usage / cpu_stats.system_cpu_usage,
            percent: calcCpuUsage(precpu_stats, cpu_stats),
        },
    }
}