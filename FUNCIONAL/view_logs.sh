#!/bin/bash

echo "========== Visualizando logs do webhook =========="
docker logs webhook_service

echo -e "\n========== Listando mensagens armazenadas =========="
docker exec webhook_service ls -la /app/data

echo -e "\n========== Para ver o conteúdo de uma mensagem específica, use: =========="
echo "docker exec webhook_service cat /app/data/NOME_DO_ARQUIVO.json" 