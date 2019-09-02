# Use a node alpine image install packages and run the start script
FROM node:12-alpine
WORKDIR /app
EXPOSE 3000

COPY package*.json /app/
ENV NODE_ENV production
RUN npm ci > /dev/null

VOLUME /app/output
RUN mkdir -p /app/tmp

ENV DESTINATION_DIR /app/output
COPY src /app/src

CMD [ "node", "src/index.js" ]
