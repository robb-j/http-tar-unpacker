# Use a node alpine image install packages and run the start script
FROM node:12-alpine
WORKDIR /app
EXPOSE 3000
ENV NODE_ENV production
ENV WORK_DIR /app/output

COPY package*.json /app/
RUN mkdir src dist && chown -R node:node .
USER node
RUN npm ci > /dev/null

VOLUME /app/output

COPY --chown=node:node src /app/src

CMD [ "node", "src/index.js" ]
