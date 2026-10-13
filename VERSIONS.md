# Version record

Updated on 13 October 2026. Direct npm dependencies use exact versions;
`package-lock.json` records the complete dependency graph and integrity hashes.

| Component | Version or immutable reference |
| --- | --- |
| Local Node.js | 22.22.1 |
| Local npm | 9.2.0 |
| Container Node.js | 22.23.3 |
| Container PostgreSQL | 17.11 |
| NestJS common/core/platform/testing | 12.1.3 |
| NestJS JWT | 12.0.3 |
| NestJS Swagger | 12.0.2 |
| NestJS throttler | 6.7.1 |
| PostgreSQL client (`pg`) | 8.23.1 |
| TypeScript | 5.9.3 |
| Build Node image | `node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392` |
| Runtime Node image | `gcr.io/distroless/nodejs22-debian13:nonroot@sha256:ec2313763dd43931543bd03830466e0c409ce73a487e8d46f10db72d3b816c1c` |
| PostgreSQL image | `postgres:17-bookworm@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826` |

The image digests were obtained from successful Docker pulls. Update dependencies
and base images deliberately, then rerun unit, PostgreSQL integration, and container
smoke checks. Scanner/model/provider versions will be recorded as those components
are implemented.
