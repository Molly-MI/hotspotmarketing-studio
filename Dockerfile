FROM node:24-alpine

WORKDIR /app
COPY --chown=node:node . .

USER node
ENV NODE_ENV=production
EXPOSE 8787

CMD ["node", "server.js"]
