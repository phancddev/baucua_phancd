# Backend Dockerfile
# ./Dockerfile

# Build stage
FROM node:18-alpine AS builder

# Add necessary packages
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built assets from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/. .

ENV NODE_ENV=production
ENV PORT=9000

EXPOSE 9000 3000

CMD ["npm", "run", "start"]