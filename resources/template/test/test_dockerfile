FROM busybox

# Don't change this!
WORKDIR /data
COPY . .

# Built-in args. Don't change.
ARG SERVICE_ID
ARG SERVICE_PORT
ARG SERVICE_PORTS
ARG SERVICE_RAM
ARG SERVICE_CPU
ARG SERVICE_DISK

# Optional ones. From settings.yml

# port1 port2 port3
EXPOSE $SERVICE_PORTS

ENTRYPOINT ["tail", "-f", "/dev/null"]