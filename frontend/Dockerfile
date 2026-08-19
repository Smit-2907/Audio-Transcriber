FROM node:18-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Next.js telemetry disable for privacy
ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
