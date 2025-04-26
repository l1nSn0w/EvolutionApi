#!/bin/bash

# Configurações
EC2_IP="18.230.204.129"
EC2_USER="ec2-user"
PEM_KEY="../docker_key.pem"
REMOTE_DIR="/home/ec2-user/evolution-api"

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Preparando para restaurar volumes no servidor EC2...${NC}"

# Criar diretório no servidor para os backups
ssh -i $PEM_KEY $EC2_USER@$EC2_IP "mkdir -p /home/ec2-user/volume-backups"

# Verificar se os arquivos de backup existem localmente
if [ ! -f ~/volume-backups/evolution_instances.tar.gz ] || [ ! -f ~/volume-backups/evolution_redis.tar.gz ] || [ ! -f ~/volume-backups/postgres_data.tar.gz ]; then
    echo -e "${YELLOW}Arquivos de backup não encontrados. Executando backup primeiro...${NC}"
    ./backup-volumes.sh
fi

# Enviar arquivos de backup para o servidor
echo -e "${YELLOW}Enviando arquivos de backup para o servidor...${NC}"
scp -i $PEM_KEY ~/volume-backups/*.tar.gz $EC2_USER@$EC2_IP:/home/ec2-user/volume-backups/

# Executar script de restauração no servidor
echo -e "${YELLOW}Restaurando volumes no servidor EC2...${NC}"
ssh -i $PEM_KEY $EC2_USER@$EC2_IP << 'EOF'
# Parar contêineres se estiverem rodando
cd /home/ec2-user/evolution-api
sudo /usr/local/bin/docker-compose down

# Restaurar volume do PostgreSQL
echo "Restaurando volume do PostgreSQL..."
sudo docker run --rm -v evolution-api_postgres_data:/data -v /home/ec2-user/volume-backups:/backup alpine sh -c "rm -rf /data/* && tar -xzf /backup/postgres_data.tar.gz -C /data"

# Restaurar volume do Redis
echo "Restaurando volume do Redis..."
sudo docker run --rm -v evolution-api_evolution_redis:/data -v /home/ec2-user/volume-backups:/backup alpine sh -c "rm -rf /data/* && tar -xzf /backup/evolution_redis.tar.gz -C /data"

# Restaurar volume de instâncias
echo "Restaurando volume de instâncias..."
sudo docker run --rm -v evolution-api_evolution_instances:/data -v /home/ec2-user/volume-backups:/backup alpine sh -c "rm -rf /data/* && tar -xzf /backup/evolution_instances.tar.gz -C /data"

# Reiniciar contêineres
echo "Reiniciando contêineres..."
cd /home/ec2-user/evolution-api
sudo /usr/local/bin/docker-compose up -d
EOF

echo -e "${GREEN}Processo de restauração concluído!${NC}"
echo -e "${GREEN}Acesse a API no servidor: http://$EC2_IP:8080${NC}" 