# Fluxo de Trabalho para Evolution API

Este documento descreve o fluxo de trabalho para desenvolver localmente e implantar na instância EC2.

## Desenvolvimento Local

Para desenvolver e testar localmente:

1. Clone o repositório:
   ```
   git clone https://github.com/l1nSn0w/EvolutionApi.git
   cd EvolutionApi
   ```

2. Configure o ambiente:
   ```
   cp .env.example .env
   # Edite o arquivo .env conforme necessário
   ```

3. Execute com Docker Compose:
   ```
   docker-compose up -d
   ```

4. Acesse a API em: http://localhost:8080

## Implantação na EC2

Para implantar na instância EC2:

1. Certifique-se de que suas alterações estão comitadas e enviadas para o GitHub:
   ```
   git add .
   git commit -m "Descrição das alterações"
   git push origin main
   ```

2. Execute o script de implantação:
   ```
   ./deploy-to-ec2.sh
   ```

3. Acesse a API na EC2 em: http://18.230.204.129:8080

## Fluxo de Trabalho Completo

1. **Desenvolvimento local**:
   - Desenvolva e teste suas alterações localmente
   - Faça commits das alterações no repositório local

2. **Envio para GitHub**:
   - Faça push das alterações para o seu repositório GitHub
   - Isso serve como backup e controle de versão

3. **Implantação na EC2**:
   - Execute o script de implantação para enviar as alterações para a EC2
   - Verifique se a aplicação está funcionando corretamente na EC2

## Comandos Úteis

### Verificar logs no servidor:
```
ssh -i ../docker_key.pem ec2-user@18.230.204.129 "cd /home/ec2-user/evolution-api && sudo docker-compose logs -f"
```

### Reiniciar contêineres no servidor:
```
ssh -i ../docker_key.pem ec2-user@18.230.204.129 "cd /home/ec2-user/evolution-api && sudo docker-compose restart"
```

### Atualizar contêineres no servidor:
```
ssh -i ../docker_key.pem ec2-user@18.230.204.129 "cd /home/ec2-user/evolution-api && sudo docker-compose pull && sudo docker-compose up -d"
``` 