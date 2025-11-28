FROM node:18-slim

# Install FFmpeg and verify
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    ffmpeg -version

# Set working directory
WORKDIR /app

# Copy package files first (for better Docker layer caching)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY . .

# Create media directory
RUN mkdir -p /app/media

# Expose ports
EXPOSE 3000 1935 8888

# Start the server
CMD ["node", "server.js"]

