# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Set API base URL for production build to use relative path
ENV VITE_API_BASE_URL=/api

# Build frontend (produces dist/client)
# We pass --outDir to ensure it goes to the right place for the server to find
RUN npm run build -- --outDir dist/client

# Build backend (produces dist/server)
RUN npm run server:build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built assets from builder
COPY --from=build /app/dist ./dist

# Expose port
ENV PORT=8080
EXPOSE 8080

# Start server
CMD ["node", "dist/server/index.js"]
