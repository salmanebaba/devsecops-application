FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM gcr.io/distroless/nodejs22-debian13:nonroot@sha256:ec2313763dd43931543bd03830466e0c409ce73a487e8d46f10db72d3b816c1c AS runtime
ENV NODE_ENV=production PORT=3000 PATH=/nodejs/bin:/usr/local/bin:/usr/bin:/bin
WORKDIR /app
COPY --from=production-dependencies --chown=10000:10000 /app/node_modules ./node_modules
COPY --from=build --chown=10000:10000 /app/dist ./dist
COPY --chown=10000:10000 migrations ./migrations
USER 10000:10000
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=6 CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["/nodejs/bin/node"]
CMD ["dist/main.js"]
