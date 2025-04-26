#!/bin/bash

# Diretório para armazenar backups
BACKUP_DIR=~/volume-backups
mkdir -p $BACKUP_DIR

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Iniciando backup dos volumes Docker...${NC}"

# Verificar se os contêineres estão rodando
if [ "$(docker ps -q -f name=evolution_api)" ]; then
    echo -e "${YELLOW}Parando contêineres para fazer backup seguro...${NC}"
    docker-compose down
fi

# Backup do volume de instâncias do WhatsApp
echo -e "${YELLOW}Fazendo backup do volume de instâncias...${NC}"
docker run --rm -v evolution-api_evolution_instances:/data -v $BACKUP_DIR:/backup alpine tar -czf /backup/evolution_instances.tar.gz -C /data ./

# Backup do volume do Redis
echo -e "${YELLOW}Fazendo backup do volume do Redis...${NC}"
docker run --rm -v evolution-api_evolution_redis:/data -v $BACKUP_DIR:/backup alpine tar -czf /backup/evolution_redis.tar.gz -C /data ./

# Backup do volume do PostgreSQL
echo -e "${YELLOW}Fazendo backup do volume do PostgreSQL...${NC}"
docker run --rm -v evolution-api_postgres_data:/data -v $BACKUP_DIR:/backup alpine tar -czf /backup/postgres_data.tar.gz -C /data ./

echo -e "${GREEN}Backup concluído! Arquivos salvos em $BACKUP_DIR${NC}"
echo -e "${GREEN}Reiniciando os contêineres...${NC}"
docker-compose up -d

echo -e "${YELLOW}Arquivos de backup:${NC}"
ls -lh $BACKUP_DIR

echo -e "\n${GREEN}Para enviar os backups para o servidor EC2, execute:${NC}"
echo "scp -i ../docker_key.pem ~/volume-backups/*.tar.gz ec2-user@18.230.204.129:/home/ec2-user/volume-backups/" 