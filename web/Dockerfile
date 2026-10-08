FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
# NEXT_PUBLIC_* values are baked into the browser bundle at build time.
ARG NEXT_PUBLIC_OPEN_BOOK
ARG NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/
ARG NEXT_PUBLIC_WC_PROJECT_ID
ARG NEXT_PUBLIC_CHAINS
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
# PINATA_JWT is a runtime secret: pass it with -e / env_file, never as a build arg.
CMD ["node", "server.js"]
