# frontend/Dockerfile

# Build stage
FROM node:18-alpine AS builder

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Create writable directories for nginx non root operation
RUN mkdir -p /tmp/nginx/client_temp /tmp/nginx/proxy_temp /tmp/nginx/fastcgi_temp /tmp/nginx/uwsgi_temp /tmp/nginx/scgi_temp && \
    chown -R nginx:nginx /tmp/nginx

# Copy built files from builder stage
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Set proper ownership of required directories for nginx user
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /tmp/nginx

# Switch to non root user
USER nginx

# Expose port 8080 (matches Kubernetes deployment)
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]