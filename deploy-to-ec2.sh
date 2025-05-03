#!/bin/bash

# Configurações
EC2_IP="15.229.11.54"
EC2_USER="ec2-user"
PEM_KEY="../docker_key.pem"
REMOTE_DIR="/home/ec2-user/evolution-api"

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Iniciando deploy para EC2 (IP: $EC2_IP)...${NC}"

# Fazer backup dos arquivos de configuração no servidor
echo -e "${YELLOW}Fazendo backup de configurações existentes...${NC}"
ssh -i $PEM_KEY $EC2_USER@$EC2_IP << 'EOF'
if [ -d "/home/ec2-user/evolution-api" ]; then
    # Criar diretório de backup se não existir
    mkdir -p /home/ec2-user/evolution-api-backups
    
    # Backup do arquivo .env se existir
    if [ -f "/home/ec2-user/evolution-api/.env" ]; then
        cp /home/ec2-user/evolution-api/.env /home/ec2-user/evolution-api-backups/.env.bak
    fi
fi
EOF

# Criar diretório remoto se não existir
echo -e "${YELLOW}Criando diretório no servidor...${NC}"
ssh -i $PEM_KEY $EC2_USER@$EC2_IP "mkdir -p $REMOTE_DIR"

# Copiar arquivos essenciais para o servidor
echo -e "${YELLOW}Copiando arquivos para o servidor...${NC}"
scp -i $PEM_KEY docker-compose.yaml $EC2_USER@$EC2_IP:$REMOTE_DIR/

# Comentado: Copiar a pasta webhook-service para o servidor
# echo -e "${YELLOW}Copiando pasta webhook-service para o servidor...${NC}"
# ssh -i $PEM_KEY $EC2_USER@$EC2_IP "mkdir -p $REMOTE_DIR/webhook-service"
# scp -i $PEM_KEY -r webhook-service/* $EC2_USER@$EC2_IP:$REMOTE_DIR/webhook-service/

# Copiar a pasta webhook-service-react (frontend e backend) para o servidor, excluindo node_modules
echo -e "${YELLOW}Copiando pasta webhook-service-react para o servidor (sem node_modules)...${NC}"
ssh -i $PEM_KEY $EC2_USER@$EC2_IP "mkdir -p $REMOTE_DIR/webhook-service-react/frontend $REMOTE_DIR/webhook-service-react/backend"

# Criar arquivo temporário para rsync excludes
cat > /tmp/rsync-exclude.txt << EOF
node_modules/
.git/
.env.development
EOF

# Usar rsync para copiar, excluindo node_modules
rsync -av --exclude-from="/tmp/rsync-exclude.txt" -e "ssh -i $PEM_KEY" webhook-service-react/frontend/ $EC2_USER@$EC2_IP:$REMOTE_DIR/webhook-service-react/frontend/
rsync -av --exclude-from="/tmp/rsync-exclude.txt" -e "ssh -i $PEM_KEY" webhook-service-react/backend/ $EC2_USER@$EC2_IP:$REMOTE_DIR/webhook-service-react/backend/

# Limpar arquivo temporário
rm /tmp/rsync-exclude.txt

# Copiar os arquivos .dockerignore para o servidor
echo -e "${YELLOW}Copiando arquivos de configuração para o servidor...${NC}"
scp -i $PEM_KEY webhook-service-react/frontend/.dockerignore $EC2_USER@$EC2_IP:$REMOTE_DIR/webhook-service-react/frontend/
scp -i $PEM_KEY webhook-service-react/frontend/nginx.conf $EC2_USER@$EC2_IP:$REMOTE_DIR/webhook-service-react/frontend/
scp -i $PEM_KEY webhook-service-react/backend/.dockerignore $EC2_USER@$EC2_IP:$REMOTE_DIR/webhook-service-react/backend/

# Criar arquivo .env específico para produção no servidor
echo -e "${YELLOW}Criando arquivo .env de produção para o frontend...${NC}"
ssh -i $PEM_KEY $EC2_USER@$EC2_IP "echo \"REACT_APP_API_URL=http://$EC2_IP:5002\" > $REMOTE_DIR/webhook-service-react/frontend/.env"

# Restaurar configurações dos backups
echo -e "${YELLOW}Restaurando configurações...${NC}"
ssh -i $PEM_KEY $EC2_USER@$EC2_IP << 'EOF'
# Restaurar .env do backup se existir, senão copiar o exemplo
if [ -f "/home/ec2-user/evolution-api-backups/.env.bak" ]; then
    cp /home/ec2-user/evolution-api-backups/.env.bak /home/ec2-user/evolution-api/.env
else
    # Se não existir um backup, copiar o exemplo se disponível
    if [ -f "/home/ec2-user/evolution-api/.env.example" ]; then
        cp /home/ec2-user/evolution-api/.env.example /home/ec2-user/evolution-api/.env
    fi
fi
EOF

# Instalar Docker e Docker Compose no servidor se ainda não estiver instalado
echo -e "${YELLOW}Verificando e instalando Docker e Docker Compose no servidor...${NC}"
ssh -i $PEM_KEY $EC2_USER@$EC2_IP << 'EOF'
if ! command -v docker &> /dev/null; then
    echo "Instalando Docker..."
    sudo yum update -y
    sudo amazon-linux-extras install docker -y
    sudo service docker start
    sudo usermod -a -G docker ec2-user
    sudo chkconfig docker on
fi

# Instalar Docker Compose v2
if ! command -v docker compose &> /dev/null; then
    echo "Instalando Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.3/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    docker-compose --version
fi

# Certifique-se de que o usuário tem permissões do Docker
sudo usermod -aG docker $USER
EOF

# Limpar recursos não utilizados do Docker
echo -e "${YELLOW}Limpando recursos não utilizados do Docker...${NC}"
ssh -i $PEM_KEY $EC2_USER@$EC2_IP "docker system prune -af"

# Reiniciar a sessão SSH para aplicar as permissões do grupo Docker
echo -e "${YELLOW}Reiniciando a sessão SSH para aplicar as permissões...${NC}"
ssh -i $PEM_KEY $EC2_USER@$EC2_IP "sudo systemctl restart docker"

# Iniciar os contêineres no servidor (preservando volumes)
echo -e "${YELLOW}Atualizando e iniciando contêineres no servidor (preservando dados)...${NC}"
ssh -i $PEM_KEY $EC2_USER@$EC2_IP "cd $REMOTE_DIR && sudo /usr/local/bin/docker-compose down webhook-service-frontend && sudo /usr/local/bin/docker-compose build --no-cache webhook-service-frontend && sudo /usr/local/bin/docker-compose up -d"

echo -e "${GREEN}Deploy concluído com sucesso!${NC}"
echo -e "${GREEN}Acesse a API em: http://$EC2_IP:8080${NC}"
# echo -e "${GREEN}O webhook interno está rodando na porta 5001${NC}"
echo -e "${GREEN}O novo webhook-service-react backend está rodando na porta 5002${NC}"
echo -e "${GREEN}O novo webhook-service-react frontend está rodando na porta 3000${NC}" 