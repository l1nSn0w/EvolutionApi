FROM node:18-alpine

WORKDIR /app

# Copiar apenas os arquivos de dependência primeiro
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar o resto dos arquivos
COPY . .

EXPOSE 3000

# Configurar o React para aceitar conexões de qualquer host
ENV HOST=0.0.0.0
ENV WDS_SOCKET_PORT=0

CMD ["npm", "start"] 