FROM node:18-alpine

WORKDIR /app

# Copy package info
COPY services/interview/package*.json ./services/interview/
# Install dependencies
RUN cd services/interview && npm install --only=production

# Copy protos and the service code
COPY protos ./protos
COPY services/interview ./services/interview

EXPOSE 3005 5003

CMD ["node", "services/interview/server.js"]
