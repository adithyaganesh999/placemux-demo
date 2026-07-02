FROM node:18-alpine

WORKDIR /app

# Copy package info
COPY services/admin/package*.json ./services/admin/
# Install dependencies
RUN cd services/admin && npm install --only=production

# Copy protos and the service code
COPY protos ./protos
COPY services/admin ./services/admin

EXPOSE 3006 5006

CMD ["node", "services/admin/server.js"]
