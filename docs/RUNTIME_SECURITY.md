# Runtime image remediation

On 13 October 2026, the runtime stage moved from Node's Debian 12 slim image to
the maintained Distroless Node 22 Debian 13 non-root image. Both build and runtime
use Node 22.23.3; the build stages retain the existing pinned Node image and npm
lockfile. The runtime has no npm CLI or shell and runs as UID/GID 10000. The Node
binary remains on PATH for migrations, health checks, and verification commands.

The runtime reference is pinned by digest in the Dockerfile. See
[Distroless Node documentation](https://github.com/GoogleContainerTools/distroless/blob/main/nodejs/README.md)
and [the version record](../VERSIONS.md).

An initial local comparison used the same Trivy database updated on 12 October
2026 at 19:08 UTC. The old image reported 4 critical, 65 high, 111 medium, 78 low,
and 4 unknown package findings. The remediated full image reported 0 critical,
0 high, 23 medium, 8 low, and 0 unknown. Medium/low findings remain visible;
this is a reduction in known reported vulnerabilities, not a security guarantee.

The actual image passed an isolated runtime check using secret-file mounts,
administrative migrations, PostgreSQL UID 10001, API UID 10000, a read-only API
root, dropped capabilities, and denied runtime database DDL. Real HTTP health,
registration, login, and task CRUD passed. The temporary test containers and
database were removed; the development and cloud databases were not used.

Kubernetes/Dockerfile static assessment passed 333 checks with no parsing errors
or failed controls. The full Jenkins run remains the release assessment: it
rebuilds committed source, tests it, scans it, generates the SBOM, and binds the
OPA decision to its immutable image. Cloud rollout is a later protected step.
