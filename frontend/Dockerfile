# Use an official Node.js image to build the React app
FROM node:20-alpine as build

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy the source code
COPY frontend/ ./

# Build the app for production
RUN npm run build

# Use an Nginx image to serve the compiled app
FROM nginx:alpine
COPY --from=build /usr/src/app/build /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]