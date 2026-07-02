FROM node:18-alpine

WORKDIR /app

# Copy package info
COPY services/auth/package*.json ./services/auth/
# Install dependencies
RUN cd services/auth && npm install --only=production

# Copy protos and the service code
COPY protos ./protos
COPY services/auth ./services/auth

EXPOSE 3001 5001

CMD ["node", "services/auth/server.js"]
