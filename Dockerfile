# ==========================================
# Stage 1: Build & Dependencies
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency records
COPY package*.json ./

# Install all dependencies (including devDependencies for tsc)
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Copy application source code
COPY . .

# Build the TypeScript project
RUN npm run build

# ==========================================
# Stage 2: Production release (Lightweight)
# ==========================================
FROM node:22-alpine

WORKDIR /app

# Set environments
ENV NODE_ENV=production

# Copy package files to install production dependencies
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev --legacy-peer-deps || npm install --omit=dev --legacy-peer-deps

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist
# knexfile.ts and knexfile.js needed for migrations
COPY --from=builder /app/knexfile.ts ./
COPY --from=builder /app/knexfile.js ./
# Copy original source so swagger-jsdoc can parse the JSDoc comments from the TS files
COPY --from=builder /app/src ./src

# Create runtime directories if not exist
RUN mkdir -p logs public storages

# Use non-root user
# Change ownership of /app to node user
RUN chown -R node:node /app
USER node

# Expose port
EXPOSE 9888

# Start the application
CMD ["npm", "start"]
