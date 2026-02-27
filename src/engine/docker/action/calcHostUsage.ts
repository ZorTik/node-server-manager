import DockerClient from "dockerode";
import ds from "check-disk-space";

export default function calcHostUsage(client: DockerClient) {
  return async () => {
    const { Volumes } = await client.listVolumes();
    let free_ = 0;
    let size_ = 0;
    for (const vol of Volumes) {
      if (!vol.Labels || !('nsm' in vol.Labels)) {
        // Not a NSM volume.
        continue;
      }
      const { free, size } = await ds(vol.Mountpoint);
      free_ += free;
      size_ += size;
    }
    return [free_, size_];
  }
}