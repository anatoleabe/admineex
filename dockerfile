# Use the official Node.js image as the base image
FROM node:latest

# Set the working directory in the container
WORKDIR /usr/src/app/codabe/admineex

# Copy application files
COPY ./server/app ./server/app
COPY ./server/config ./server/config
COPY ./server/modules ./server/modules
COPY ./server/node_modules ./server/node_modules
COPY ./server/public ./server/public
COPY ./server/resources ./server/resources
COPY ./server/app.js ./server/app.js
COPY ./server/Gruntfile.js ./server/Gruntfile.js
COPY ./server/package.json ./server/package.json
COPY ./Dockerfile.mongo ./Dockerfile.mongo

WORKDIR /usr/src/app/codabe/admineex/server
# Install dependencies for the main application
#RUN npm install

# Install dependencies for the public folder (if it has its own package.json)
WORKDIR /usr/src/app/codabe/admineex/server/public

#RM -rf ./node_modules

#RUN npm install

# Go back to the original working directory
WORKDIR /usr/src/app/codabe/admineex/server

# Expose the port that your app runs on
EXPOSE 4002

# Command to run your application
CMD ["node", "./app.js"]