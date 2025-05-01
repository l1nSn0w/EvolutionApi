#!/bin/bash

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Iniciando ambiente de desenvolvimento...${NC}"

# Parar containers existentes (opcional)
echo -e "${YELLOW}Parando containers existentes...${NC}"
docker-compose down

# Iniciar com docker-compose de desenvolvimento
echo -e "${YELLOW}Iniciando containers com configuração de desenvolvimento...${NC}"
docker-compose -f docker-compose.dev.yaml up -d

echo -e "${GREEN}Ambiente de desenvolvimento iniciado!${NC}"
echo -e "${GREEN}Acesse a API em: http://localhost:8080${NC}"
echo -e "${GREEN}Acesse o webhook-service-react frontend em: http://localhost:3000${NC}"
echo -e "${GREEN}O webhook-service-react backend está rodando na porta 5002${NC}"

# Mostrar logs (opcional - descomente se desejar ver os logs)
# echo -e "${YELLOW}Mostrando logs (Ctrl+C para sair)...${NC}"
# docker-compose -f docker-compose.dev.yaml logs -f 