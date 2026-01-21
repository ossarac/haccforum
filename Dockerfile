# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build frontend (produces dist/)
RUN npm run build

# Build backend (produces dist/server/)
# Use a separate config or move files after if they conflict, 
# but tsc -p tsconfig.server.json outputs to dist/server so it should be fine merging into dist/
RUN npm run server:build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built assets from builder
# Copy backend files
COPY --from=build /app/dist/server ./dist/server
# Copy frontend files (from dist root to public root or similar)
# We will serve frontend from ./dist/client in the code to keep it clean, 
# so let's move dist/* (excluding server) to dist/client 
COPY --from=build /app/dist/assets ./dist/client/assets
COPY --from=build /app/dist/index.html ./dist/client/index.html
COPY --from=build /app/dist/favicon.ico ./dist/client/favicon.ico
# Copy any other files in public if needed, or just the vite build output

# Expose port
ENV PORT=8080
EXPOSE 8080

# Start server
CMD ["node", "dist/server/index.js"]
