FROM nginx:1.25-alpine

# Copy the pre-built static files directly
COPY dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
