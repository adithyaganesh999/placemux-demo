FROM node:18-alpine

WORKDIR /app

# Copy package info
COPY gateway/package*.json ./gateway/
# Install dependencies
RUN cd gateway && npm install --only=production

# Copy protos and the gateway code
COPY protos ./protos
COPY gateway ./gateway

EXPOSE 3000

CMD ["node", "gateway/server.js"]
