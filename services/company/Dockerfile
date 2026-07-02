FROM node:18-alpine

WORKDIR /app

# Copy package info
COPY services/company/package*.json ./services/company/
# Install dependencies
RUN cd services/company && npm install --only=production

# Copy protos and the service code
COPY protos ./protos
COPY services/company ./services/company

EXPOSE 3002 5002

CMD ["node", "services/company/server.js"]
