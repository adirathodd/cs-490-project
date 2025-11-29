# Build stage: install dependencies and compile React
FROM node:20-alpine AS build

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package descriptors and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your React source files into the container
COPY . .

# Build the React app for production
RUN npm run build

# Runtime stage: serve the compiled app via Nginx
FROM nginx:alpine
COPY --from=build /usr/src/app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]