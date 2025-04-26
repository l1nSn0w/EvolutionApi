from flask import Flask, request, jsonify
import logging
import json
import os
import sys
import requests

# URL do webhook do Make
MAKE_WEBHOOK_URL = "https://hook.us2.make.com/cig25e7rx3x5xdf85vlyx35xx8xa931j"

# Configuração de logging mínimo
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('webhook')

app = Flask(__name__)

@app.route('/')
def home():
    return jsonify({
        "status": "online",
        "service": "Evolution API Webhook Handler",
        "version": "1.0.0"
    })

@app.route('/webhook', methods=['POST'])
def webhook():
    """
    Endpoint principal para receber webhooks da Evolution API
    """
    data = request.json
    
    # Log para debug - confirmar que o webhook está sendo chamado
    logger.info("Webhook recebido!")
    
    # Processar a mensagem diretamente
    process_message(data)
    
    return jsonify({"status": "success", "message": "Webhook processado com sucesso"})

def send_to_make(webhook_data):
    """
    Encaminha o webhook para o Make
    """
    try:
        logger.info("Encaminhando para o Make...")
        response = requests.post(MAKE_WEBHOOK_URL, json=webhook_data)
        
        if response.status_code == 200:
            logger.info(f"✅ Encaminhado com sucesso para o Make! Resposta: {response.text}")
            return True
        else:
            logger.error(f"❌ Erro ao encaminhar para o Make: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        logger.error(f"❌ Erro ao encaminhar para o Make: {str(e)}")
        return False

def process_message(data):
    """
    Função para processar as mensagens recebidas
    """
    try:
        # Log para debug - confirmar que o processamento começou
        logger.info("Iniciando processamento da mensagem...")
        
        # Verificação da estrutura de dados diretamente do formato recebido
        message_data = data.get('data', {})

        # Debug da estrutura resumida
        logger.info("Processando mensagem...")

        # Condição 1: Verificar se fromMe é False
        is_from_me = message_data.get('key', {}).get('fromMe', True)
        
        # Condição 2: Verificar se há contextInfo com externalAdReply que contém sourceId
        context_info = message_data.get('contextInfo', {})
        
        # Verificar se externalAdReply existe e contém sourceId
        if 'externalAdReply' in context_info and 'sourceId' in context_info.get('externalAdReply', {}):
            source_id = context_info.get('externalAdReply', {}).get('sourceId', '')
            
            # Verificar se ambas as condições são verdadeiras
            if is_from_me is False:
                # Condição satisfeita
                logger.info("\n--------------------------------------------")
                logger.info("🎯🎯🎯 CONDIÇÃO SATISFEITA! 🎯🎯🎯")
                logger.info(f"🔍 sourceId: {source_id}")
                
                # Informações adicionais úteis
                title = context_info.get('externalAdReply', {}).get('title', 'Sem título')
                logger.info(f"📱 Título: {title}")
                url = context_info.get('externalAdReply', {}).get('sourceUrl', 'Sem URL')
                logger.info(f"🔗 URL: {url}")
                
                # Encaminhar o webhook original completo para o Make
                success = send_to_make(data)
                if success:
                    logger.info("✨ Webhook encaminhado com sucesso para o Make!")
                else:
                    logger.error("⚠️ Falha ao encaminhar webhook para o Make")
                
                logger.info("--------------------------------------------\n")
            else:
                logger.info("❌ fromMe é True, condição não satisfeita")
        else:
            logger.info("❌ Não encontrou externalAdReply com sourceId")
                
    except Exception as e:
        logger.error(f"Erro ao processar mensagem: {str(e)}")
        logger.error(f"Stack trace: {e.__traceback__}")

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port) 