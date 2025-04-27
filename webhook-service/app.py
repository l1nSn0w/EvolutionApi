from flask import Flask, request, jsonify, render_template
import logging
import json
import os
import sys
import requests
import datetime
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Boolean, inspect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.sql import text

# URL do webhook do Make
MAKE_WEBHOOK_URL = "https://hook.us2.make.com/cig25e7rx3x5xdf85vlyx35xx8xa931j"

# Token de acesso do Facebook Graph API
FB_ACCESS_TOKEN = "EAAU85NkleoUBO9DtADN5yv65TFm7yCA1Y8POz5qMMmcleOCpf5EZAZBCKMtRChZBGzZBVdoWDCUbwgFJyorvHw6UZCfUMrFeU3dvdZAnEJ8MKzjEPiOHHfo4FHTrKymZBVxWwGxqfNAHcxhYdGtrzz7zA5VDy368yx3zjtRmZB0KabtjUqTq3kNYiYR9CSLbsj3foaoqZCJZA0ZAfaA9nui"

# Configuração de logging mínimo
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('webhook')

# Configuração do PostgreSQL
DB_USER = "user"
DB_PASS = "pass"
DB_HOST = "postgres"  # nome do serviço no docker-compose
DB_PORT = "5432"
DB_NAME = "evolution"
DB_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Configuração do SQLAlchemy
engine = create_engine(DB_URL, connect_args={"options": "-c timezone=utc"})
Session = sessionmaker(bind=engine)
Base = declarative_base()

# Modelo para a tabela de mensagens
class WebhookMessage(Base):
    __tablename__ = 'webhook_messages'
    
    id = Column(Integer, primary_key=True)
    telefone = Column(String(50))
    nome = Column(String(100))
    dispositivo = Column(String(20))
    mensagem = Column(Text)
    source_id = Column(String(50), nullable=True)
    title = Column(String(255), nullable=True)
    url = Column(String(255), nullable=True)
    encaminhado_make = Column(Boolean, default=False)
    date_time = Column(String(30), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    ad_name = Column(String(255), nullable=True)
    adset_name = Column(String(255), nullable=True)
    adset_id = Column(String(50), nullable=True)
    campaign_name = Column(String(255), nullable=True)
    campaign_id = Column(String(50), nullable=True)

# Criar a tabela se não existir
def init_db():
    try:
        # Verificar se a tabela existe
        inspector = inspect(engine)
        if not inspector.has_table('webhook_messages'):
            Base.metadata.create_all(engine)
            logger.info("Tabela webhook_messages criada com sucesso!")
        else:
            # Verificar colunas existentes
            columns = [c['name'] for c in inspector.get_columns('webhook_messages')]
            
            # Verificar e adicionar colunas que não existem
            colunas_para_adicionar = {
                'date_time': 'VARCHAR(30)',
                'ad_name': 'VARCHAR(255)',
                'adset_name': 'VARCHAR(255)',
                'adset_id': 'VARCHAR(50)',
                'campaign_name': 'VARCHAR(255)',
                'campaign_id': 'VARCHAR(50)'
            }
            
            for coluna, tipo in colunas_para_adicionar.items():
                if coluna not in columns:
                    with engine.connect() as conn:
                        conn.execute(text(f"ALTER TABLE webhook_messages ADD COLUMN {coluna} {tipo}"))
                        conn.commit()
                    logger.info(f"Coluna {coluna} adicionada à tabela webhook_messages!")
            
            logger.info("Tabela webhook_messages já existe com todas as colunas necessárias.")
    except Exception as e:
        logger.error(f"Erro ao inicializar banco de dados: {str(e)}")

# Inicializar o banco de dados
init_db()

app = Flask(__name__)

@app.route('/')
def home():
    return jsonify({
        "status": "online",
        "service": "Evolution API Webhook Handler",
        "version": "1.0.0"
    })

@app.route('/dashboard')
def dashboard():
    """
    Página do dashboard para visualizar mensagens
    """
    return render_template('dashboard.html')

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

def get_facebook_ad_data(source_id):
    """
    Busca informações do anúncio no Facebook Graph API
    """
    try:
        logger.info(f"Buscando informações do anúncio {source_id} no Facebook")
        url = f"https://graph.facebook.com/v21.0/{source_id}?fields=id,name,adset{{name}},campaign{{name}}&access_token={FB_ACCESS_TOKEN}"
        
        response = requests.get(url)
        
        if response.status_code == 200:
            data = response.json()
            logger.info(f"✅ Dados do anúncio obtidos com sucesso: {data}")
            
            # Extrair informações relevantes
            ad_info = {
                'ad_name': data.get('name'),
                'adset_name': data.get('adset', {}).get('name'),
                'adset_id': data.get('adset', {}).get('id'),
                'campaign_name': data.get('campaign', {}).get('name'),
                'campaign_id': data.get('campaign', {}).get('id')
            }
            
            return ad_info
        else:
            logger.error(f"❌ Erro ao obter dados do anúncio: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        logger.error(f"❌ Erro ao consultar API do Facebook: {str(e)}")
        return None

def salvar_mensagem_db(telefone, nome, dispositivo, mensagem, source_id=None, title=None, url=None, 
                       encaminhado_make=False, date_time=None, ad_name=None, adset_name=None, 
                       adset_id=None, campaign_name=None, campaign_id=None):
    """
    Salva a mensagem no banco de dados PostgreSQL
    """
    try:
        session = Session()
        
        # Criar nova mensagem
        nova_mensagem = WebhookMessage(
            telefone=telefone,
            nome=nome,
            dispositivo=dispositivo,
            mensagem=mensagem,
            source_id=source_id,
            title=title,
            url=url,
            encaminhado_make=encaminhado_make,
            date_time=date_time,
            ad_name=ad_name,
            adset_name=adset_name,
            adset_id=adset_id,
            campaign_name=campaign_name,
            campaign_id=campaign_id
        )
        
        # Adicionar e commitar
        session.add(nova_mensagem)
        session.commit()
        
        logger.info(f"✅ Mensagem salva no banco de dados com ID: {nova_mensagem.id}")
        return nova_mensagem.id
    except Exception as e:
        logger.error(f"❌ Erro ao salvar mensagem no banco de dados: {str(e)}")
        if session:
            session.rollback()
        return None
    finally:
        if session:
            session.close()

def process_message(data):
    """
    Função para processar as mensagens recebidas
    """
    try:
        # Log para debug - confirmar que o processamento começou
        logger.info("Iniciando processamento da mensagem...")
        logger.info(data)
        
        # Verificação da estrutura de dados diretamente do formato recebido
        message_data = data.get('data', {})
        
        # Extrair date_time do webhook, se disponível
        date_time = data.get('date_time')
        if date_time:
            logger.info(f"⏰ Data/Hora: {date_time}")

        # Debug da estrutura resumida
        logger.info("Processando mensagem...")

        # Extrair informações do usuário
        telefone_completo = message_data.get('key', {}).get('remoteJid', 'Desconhecido')
        # Extrair apenas o número de telefone (antes do @)
        telefone = telefone_completo.split('@')[0] if '@' in telefone_completo else telefone_completo
        nome = message_data.get('pushName', 'Desconhecido')
        source = message_data.get('source', 'Desconhecido')
        
        # Extrair a mensagem (texto)
        mensagem = message_data.get('message', {}).get('conversation', '')
        if not mensagem and 'message' in message_data and 'extendedTextMessage' in message_data['message']:
            mensagem = message_data['message']['extendedTextMessage'].get('text', '')
        
        # Imprimir informações do usuário
        logger.info(f"📞 Telefone: {telefone}")
        logger.info(f"👤 Nome: {nome}")
        logger.info(f"📱 Dispositivo: {source}")

        # Condição 1: Verificar se fromMe é False
        is_from_me = message_data.get('key', {}).get('fromMe', True)
        
        # Variáveis para o DB
        source_id = None
        title = None
        url = None
        encaminhado = False
        ad_name = None
        adset_name = None
        adset_id = None
        campaign_name = None
        campaign_id = None
        
        # CORREÇÃO: Verificar a estrutura correta para acessar contextInfo
        # Primeiro verificamos em message.extendedTextMessage
        context_info = None
        if 'message' in message_data:
            if 'extendedTextMessage' in message_data['message']:
                context_info = message_data['message']['extendedTextMessage'].get('contextInfo', {})
            # Também verificar em message diretamente
            elif 'contextInfo' in message_data['message']:
                context_info = message_data['message'].get('contextInfo', {})
        
        # Se ainda não encontramos, verificar no nível principal
        if not context_info:
            context_info = message_data.get('contextInfo', {})
            
        logger.info(f"Context Info: {context_info}")
        
        # Flag para verificar se atende às condições para salvar
        should_save = False
        
        # Verificar se externalAdReply existe e contém sourceId
        if context_info and 'externalAdReply' in context_info:
            external_ad_reply = context_info['externalAdReply']
            if 'sourceId' in external_ad_reply:
                source_id = external_ad_reply.get('sourceId', '')
                
                # Verificar se ambas as condições são verdadeiras
                if is_from_me is False:
                    # Condições satisfeitas - definir flag para salvar
                    should_save = True
                    
                    # Log
                    logger.info("\n--------------------------------------------")
                    logger.info("🎯🎯🎯 CONDIÇÃO SATISFEITA! 🎯🎯🎯")
                    logger.info(f"🔍 sourceId: {source_id}")
                    
                    # Informações adicionais úteis
                    title = external_ad_reply.get('title', 'Sem título')
                    logger.info(f"📱 Título: {title}")
                    url = external_ad_reply.get('sourceUrl', 'Sem URL')
                    logger.info(f"🔗 URL: {url}")
                    
                    # Buscar informações do anúncio no Facebook
                    ad_info = get_facebook_ad_data(source_id)
                    if ad_info:
                        ad_name = ad_info.get('ad_name')
                        adset_name = ad_info.get('adset_name')
                        adset_id = ad_info.get('adset_id')
                        campaign_name = ad_info.get('campaign_name')
                        campaign_id = ad_info.get('campaign_id')
                        
                        logger.info(f"📊 Informações do anúncio:")
                        logger.info(f"   - Nome do anúncio: {ad_name}")
                        logger.info(f"   - Nome do conjunto: {adset_name}")
                        logger.info(f"   - ID do conjunto: {adset_id}")
                        logger.info(f"   - Nome da campanha: {campaign_name}")
                        logger.info(f"   - ID da campanha: {campaign_id}")
                    
                    # Encaminhar o webhook original completo para o Make
                    success = send_to_make(data)
                    if success:
                        encaminhado = True
                        logger.info("✅ Encaminhado com sucesso para o Make!")
                        logger.info(f"📞 Telefone: {telefone} | 👤 Nome: {nome} | 📱 Dispositivo: {source}")
                    else:
                        logger.error("⚠️ Falha ao encaminhar webhook para o Make")
                    
                    logger.info("--------------------------------------------\n")
                else:
                    logger.info("❌ fromMe é True, condição não satisfeita")
            else:
                logger.info("❌ Não encontrou sourceId em externalAdReply")
        else:
            logger.info("❌ Não encontrou externalAdReply no contextInfo")
        
        # Salvar a mensagem no banco de dados APENAS se as condições forem satisfeitas
        if should_save:
            mensagem_id = salvar_mensagem_db(
                telefone=telefone,
                nome=nome,
                dispositivo=source,
                mensagem=mensagem,
                source_id=source_id,
                title=title,
                url=url,
                encaminhado_make=encaminhado,
                date_time=date_time,
                ad_name=ad_name,
                adset_name=adset_name,
                adset_id=adset_id,
                campaign_name=campaign_name,
                campaign_id=campaign_id
            )
            
            if mensagem_id:
                logger.info(f"📊 Mensagem registrada no banco de dados com ID: {mensagem_id}")
        else:
            logger.info("⏩ Mensagem não salva no banco de dados - não atende às condições necessárias")
                
    except Exception as e:
        logger.error(f"Erro ao processar mensagem: {str(e)}")
        logger.error(f"Stack trace: {e.__traceback__}")

@app.route('/messages', methods=['GET'])
def get_messages():
    """
    Endpoint para listar as mensagens salvas (com limite de 100)
    Permite filtrar por data:
    - /messages?date=2025-04-27  (mensagens de uma data específica)
    - /messages?start_date=2025-04-26&end_date=2025-04-27  (mensagens entre duas datas)
    - /messages  (todas as mensagens)
    """
    try:
        # Obter parâmetros de consulta
        single_date = request.args.get('date')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        session = Session()
        query = session.query(WebhookMessage)
        
        # Aplicar filtros de data se fornecidos
        if single_date:
            # Filtrar por uma data específica (ignora hora)
            query = query.filter(WebhookMessage.date_time.like(f"{single_date}%"))
            logger.info(f"Filtrando mensagens pela data: {single_date}")
        elif start_date and end_date:
            # Filtrar entre duas datas
            # Adicionar "T23:59:59.999Z" à end_date para incluir todo o dia
            end_date_with_time = f"{end_date}T23:59:59.999Z"
            query = query.filter(
                WebhookMessage.date_time >= f"{start_date}T00:00:00.000Z",
                WebhookMessage.date_time <= end_date_with_time
            )
            logger.info(f"Filtrando mensagens entre as datas: {start_date} e {end_date}")
        
        # Ordenar por data_time decrescente (mais recentes primeiro)
        # Usar created_at como fallback para mensagens sem date_time
        messages = query.order_by(
            WebhookMessage.date_time.desc().nullslast(), 
            WebhookMessage.created_at.desc()
        ).limit(100).all()
        
        result = []
        for msg in messages:
            # Formatar created_at em UTC explicicamente
            created_at_utc = msg.created_at.strftime('%Y-%m-%d %H:%M:%S UTC')
            
            result.append({
                'id': msg.id,
                'telefone': msg.telefone,
                'nome': msg.nome,
                'dispositivo': msg.dispositivo,
                'mensagem': msg.mensagem,
                'source_id': msg.source_id,
                'title': msg.title,
                'url': msg.url,
                'encaminhado_make': msg.encaminhado_make,
                'date_time': msg.date_time,
                'created_at': created_at_utc,
                'ad_name': msg.ad_name,
                'adset_name': msg.adset_name,
                'adset_id': msg.adset_id,
                'campaign_name': msg.campaign_name,
                'campaign_id': msg.campaign_id
            })
        
        return jsonify({
            "status": "success", 
            "count": len(result),
            "messages": result,
            "filters": {
                "date": single_date,
                "start_date": start_date,
                "end_date": end_date
            }
        })
    except Exception as e:
        logger.error(f"Erro ao consultar mensagens: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if session:
            session.close()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port) 