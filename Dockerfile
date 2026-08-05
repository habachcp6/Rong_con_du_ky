# Multi-stage Dockerfile for Cloud Run
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Firebase web configuration is optional and is compiled into the browser
# bundle only when the caller supplies build args. Server secrets never enter
# this stage; Gemini/Places values remain runtime environment or Secret Manager
# inputs.
ARG VITE_API_BASE_URL=/api
ARG VITE_FIREBASE_API_KEY=
ARG VITE_FIREBASE_AUTH_DOMAIN=
ARG VITE_FIREBASE_PROJECT_ID=
ARG VITE_FIREBASE_APP_ID=
ARG VITE_USE_FIREBASE_EMULATORS=false
ARG VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099
ARG VITE_FIREBASE_FIRESTORE_EMULATOR_HOST=127.0.0.1
ARG VITE_FIREBASE_FIRESTORE_EMULATOR_PORT=8080
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID \
    VITE_USE_FIREBASE_EMULATORS=$VITE_USE_FIREBASE_EMULATORS \
    VITE_FIREBASE_AUTH_EMULATOR_URL=$VITE_FIREBASE_AUTH_EMULATOR_URL \
    VITE_FIREBASE_FIRESTORE_EMULATOR_HOST=$VITE_FIREBASE_FIRESTORE_EMULATOR_HOST \
    VITE_FIREBASE_FIRESTORE_EMULATOR_PORT=$VITE_FIREBASE_FIRESTORE_EMULATOR_PORT

RUN npm run build

FROM node:24-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/build ./build
COPY --from=builder /app/content ./content

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"

USER node

CMD ["node", "build/server/index.js"]
