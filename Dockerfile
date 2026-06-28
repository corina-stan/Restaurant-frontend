# Stage 1: Build the React Application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install dependencies using clean install
RUN npm ci

# Copy the entire codebase
COPY . .

# Run Vite build to generate production assets in /app/dist
RUN npm run build

# Stage 2: Serve the compiled static assets with Nginx
FROM nginx:1.25-alpine

# Copy the static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Replace the default Nginx configuration
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
