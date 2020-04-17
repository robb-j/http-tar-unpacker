# Use a node alpine image install packages and run the start script
FROM node:12-alpine
WORKDIR /app
EXPOSE 3000

ENV NODE_ENV production
ENV WORK_DIR /app/workdir

RUN mkdir src workdir && chown -R node:node .
USER node
VOLUME /app/workdir

COPY --chown=node:node package*.json /app/
RUN npm ci && npm cache clean --force

COPY --chown=node:node src /app/src

CMD [ "node", "src/index.js" ]
