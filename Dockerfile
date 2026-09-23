FROM node:22-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy application
COPY . .

# Build application
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.js"]
