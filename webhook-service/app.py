from flask import Flask, request, jsonify, render_template, flash, redirect, url_for
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
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
from urllib.parse import urlparse

# Importar funções do módulo kommo_utils
from kommo_utils import (
    KOMMO_CLIENT_ID, 
    KOMMO_CLIENT_SECRET, 
    KOMMO_REDIRECT_URI,
    exchange_code_for_tokens, 
    save_kommo_tokens, 
    refresh_kommo_token, 
    get_kommo_leads, 
    get_kommo_auth_url,
    get_lead_details,
    get_contact_details,
    process_kommo_webhook,
    search_lead_by_phone,
    get_pipeline_details
)

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
    created_at = Column(DateTime, default=datetime.utcnow)
    ad_name = Column(String(255), nullable=True)
    adset_name = Column(String(255), nullable=True)
    adset_id = Column(String(50), nullable=True)
    campaign_name = Column(String(255), nullable=True)
    campaign_id = Column(String(50), nullable=True)

# Modelo para armazenar tokens da Kommo
class KommoToken(Base):
    __tablename__ = 'kommo_tokens'
    
    id = Column(Integer, primary_key=True)
    account_id = Column(String(50), unique=True)
    access_token = Column(Text)
    refresh_token = Column(Text)
    expires_at = Column(DateTime)
    domain = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Criar a tabela se não existir
def init_db():
    try:
        # Verificar se a tabela exists
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
        
        # Verificar se a tabela kommo_tokens existe
        if not inspector.has_table('kommo_tokens'):
            Base.metadata.create_all(engine)
            logger.info("Tabela kommo_tokens criada com sucesso!")
        else:
            # Verificar colunas existentes na tabela kommo_tokens
            kommo_columns = [c['name'] for c in inspector.get_columns('kommo_tokens')]
            
            # Verificar e adicionar colunas que não existem
            kommo_colunas_para_adicionar = {
                'domain': 'VARCHAR(100)'
            }
            
            for coluna, tipo in kommo_colunas_para_adicionar.items():
                if coluna not in kommo_columns:
                    with engine.connect() as conn:
                        conn.execute(text(f"ALTER TABLE kommo_tokens ADD COLUMN {coluna} {tipo}"))
                        conn.commit()
                    logger.info(f"Coluna {coluna} adicionada à tabela kommo_tokens!")
            
            logger.info("Tabela kommo_tokens já existe com todas as colunas necessárias.")
            
    except Exception as e:
        logger.error(f"Erro ao inicializar banco de dados: {str(e)}")

# Inicializar o banco de dados
init_db()

# Inicializar a aplicação Flask
app = Flask(__name__)
app.secret_key = 'webhook-evolution-api-secure-key-123'  # Chave para mensagens flash

# Configuração de logging mínimo
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('webhook')

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
    # Verificar se existe algum token Kommo no banco de dados
    session = Session()
    try:
        # Buscar o primeiro token Kommo disponível
        kommo_token = session.query(KommoToken).first()
        
        # Preparar dados para o template
        kommo_token_info = None
        if kommo_token:
            # Ajustar o fuso horário para Brasil (UTC-3)
            def adjust_timezone(dt):
                from datetime import timedelta
                # Subtrair 3 horas do UTC para converter para o horário de Brasília
                adjusted_dt = dt - timedelta(hours=3)
                return adjusted_dt.strftime('%d/%m/%Y %H:%M:%S')
            
            is_expired = kommo_token.expires_at <= datetime.now()
            
            kommo_token_info = {
                'account_id': kommo_token.account_id,
                'domain': kommo_token.domain,
                'expires_at': adjust_timezone(kommo_token.expires_at),
                'is_expired': is_expired,
                'created_at': adjust_timezone(kommo_token.created_at),
                'updated_at': adjust_timezone(kommo_token.updated_at)
            }
    finally:
        session.close()
    
    return render_template('dashboard.html', 
                           kommo_client_id=KOMMO_CLIENT_ID,
                           kommo_redirect_uri=KOMMO_REDIRECT_URI,
                           kommo_token_info=kommo_token_info)

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

@app.route('/kommo/callback')
def kommo_callback():
    """
    Callback para receber o código de autorização da Kommo
    """
    try:
        # Obter o código de autorização da consulta de URL
        code = request.args.get('code')
        
        if not code:
            return jsonify({"error": "Código de autorização não fornecido"}), 400
        
        # Obter o referer para determinar o domínio
        referer = request.args.get('referer')
        if not referer:
            referer_header = request.headers.get('Referer')
            if referer_header:
                parsed_url = urlparse(referer_header)
                referer = parsed_url.netloc
        
        logger.info(f"Código de autorização recebido da Kommo: {code[:20]}...")
        
        # Trocar o código por tokens
        tokens = exchange_code_for_tokens(code, referer)
        
        if not tokens:
            return jsonify({"error": "Falha ao obter tokens"}), 500
        
        # Extrair informações dos tokens
        access_token = tokens.get('access_token')
        refresh_token = tokens.get('refresh_token')
        expires_at = tokens.get('expires_at')
        account_id = tokens.get('account_id')
        domain = tokens.get('domain', referer or 'kommo.com')
        
        # Verificar se conseguimos o account_id
        if not account_id:
            # Se não tiver account_id, usar o domínio como identificador
            if domain and domain != "kommo.com":
                # Extrair a primeira parte do domínio como identificador
                domain_parts = domain.split('.')
                if len(domain_parts) > 0:
                    account_id = domain_parts[0]
                    logger.info(f"Account ID extraído do domínio: {account_id}")
                    
            if not account_id:
                # Gerar um identificador aleatório como último recurso
                import uuid
                account_id = f"unknown_{uuid.uuid4().hex[:8]}"
                logger.warning(f"Não foi possível extrair account_id, usando valor gerado: {account_id}")
        
        # Salvar tokens no banco de dados
        session = Session()
        try:
            # Salvar tokens no banco de dados
            save_kommo_tokens(session, KommoToken, account_id, access_token, refresh_token, expires_at, domain)
            
            # HTML de sucesso
            html_response = f"""
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Autorização Kommo - Sucesso</title>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                        max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                        text-align: center;
                }}
                    .success {{
                        color: #28a745;
                    padding: 20px;
                        border: 1px solid #28a745;
                        border-radius: 5px;
                        margin: 20px 0;
                }}
                .btn {{
                    display: inline-block;
                        background-color: #007bff;
                    color: white;
                    padding: 10px 20px;
                    text-decoration: none;
                        border-radius: 5px;
                    margin-top: 20px;
                }}
            </style>
        </head>
        <body>
            <h1>Autorização Kommo</h1>
                
                <div class="success">
                    <p>Os tokens de acesso para sua conta Kommo foram obtidos e armazenados com segurança.</p>
                    <p><strong>ID da Conta:</strong> {account_id}</p>
                    <p><strong>Domínio:</strong> {domain}</p>
                </div>
                
                <p>Você pode voltar ao painel agora.</p>
                
                <a href="/dashboard" class="btn">Voltar ao Painel</a>
        </body>
        </html>
        """
            
            return html_response
        
        except Exception as e:
            session.rollback()
            logger.error(f"Erro ao salvar tokens: {str(e)}")
            return jsonify({"error": f"Erro ao salvar tokens: {str(e)}"}), 500
        finally:
            session.close()
            
    except Exception as e:
        logger.error(f"Erro no callback da Kommo: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/kommo/manual-auth')
def kommo_manual_auth():
    """
    Rota para utilizar manualmente um código de autorização da Kommo
    """
    try:
        # Obter o código de autorização da consulta de URL
        code = request.args.get('code')
        
        if not code:
            flash('Código de autorização não fornecido', 'error')
            return redirect(url_for('dashboard'))
        
        # Obter o domínio da consulta de URL
        domain = request.args.get('domain')
        
        # Trocar o código por tokens
        logger.info("Iniciando troca manual de código de autorização Kommo...")
        
        # Trocar o código por tokens
        tokens = exchange_code_for_tokens(code, domain)
        
        if not tokens:
            flash('Falha ao obter tokens', 'error')
            return redirect(url_for('dashboard'))
        
        # Extrair informações dos tokens
        access_token = tokens.get('access_token')
        refresh_token = tokens.get('refresh_token')
        expires_at = tokens.get('expires_at')
        account_id = tokens.get('account_id')
        domain = tokens.get('domain', 'kommo.com')
        
        # Verificar se conseguimos o account_id
        if not account_id:
            # Se não tiver account_id, usar o domínio como identificador
            if domain and domain != "kommo.com":
                # Extrair a primeira parte do domínio como identificador
                domain_parts = domain.split('.')
                if len(domain_parts) > 0:
                    account_id = domain_parts[0]
                    logger.info(f"Account ID extraído do domínio: {account_id}")
                    
            if not account_id:
                # Gerar um identificador aleatório como último recurso
                import uuid
                account_id = f"unknown_{uuid.uuid4().hex[:8]}"
                logger.warning(f"Não foi possível extrair account_id, usando valor gerado: {account_id}")
        
        # Salvar tokens no banco de dados
        session = Session()
        try:
            save_kommo_tokens(session, KommoToken, account_id, access_token, refresh_token, expires_at, domain)
            flash(f'Tokens salvos com sucesso para a conta {account_id}', 'success')
        except Exception as e:
            session.rollback()
            flash(f'Erro ao salvar tokens: {str(e)}', 'error')
        finally:
            session.close()
        
        return redirect(url_for('dashboard'))
            
    except Exception as e:
        flash(f'Erro: {str(e)}', 'error')
        return redirect(url_for('dashboard'))

@app.route('/kommo/auth')
def kommo_auth_page():
    """
    Página para iniciar o fluxo de autorização OAuth da Kommo
    """
    try:
        # Gerar a URL de autorização para a Kommo
        auth_url = get_kommo_auth_url()
        
        # Criar página HTML
        html_response = f"""
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Autorização Kommo</title>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .instructions {{
                    border: 1px solid #ddd;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 5px;
                }}
                .btn {{
                    display: inline-block;
                    background-color: #007bff;
                    color: white;
                    padding: 10px 20px;
                    text-decoration: none;
                    border-radius: 5px;
                }}
                .details {{
                    background-color: #f8f9fa;
                    padding: 15px;
                    margin-top: 20px;
                    border-radius: 5px;
                }}
            </style>
        </head>
        <body>
            <h1>Autorização Kommo</h1>
            
                <p>Clique no botão abaixo para autorizar a integração com sua conta Kommo:</p>
                <a href="{auth_url}" class="btn" target="_blank">Autorizar na Kommo</a>
                
            <div class="instructions">
                <p>Após autorizar, você será redirecionado de volta para esta aplicação.</p>
                </div>
                
            <div class="details">
                <h3>Detalhes da integração:</h3>
                <ul>
                    <li>Client ID: {KOMMO_CLIENT_ID}</li>
                    <li>Redirect URI: {KOMMO_REDIRECT_URI}</li>
                </ul>
            </div>
        </body>
        </html>
        """
        
        return html_response
        
    except Exception as e:
        logger.error(f"Erro ao gerar página de autorização Kommo: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/kommo/auth-url')
def get_kommo_auth_url_endpoint():
    """
    Gera a URL de autorização para a Kommo (para uso via API)
    """
    try:
        auth_url = get_kommo_auth_url()
        
        return jsonify({
            "status": "success",
            "url": auth_url,
            "message": "Acesse esta URL para autorizar o aplicativo na Kommo"
        })
        
    except Exception as e:
        logger.error(f"Erro ao gerar URL de autorização Kommo: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/kommo/token-info')
def get_token_info():
    """
    Retorna informações sobre os tokens armazenados
    """
    try:
        session = Session()
        tokens = session.query(KommoToken).all()
        
        token_info = []
        for token in tokens:
            # Verificar se o token expirou
            is_expired = token.expires_at <= datetime.now()
            
            # Adicionar informações do token à lista
            token_info.append({
                "account_id": token.account_id,
                "domain": token.domain,
                "expires_at": token.expires_at.isoformat(),
                "is_expired": is_expired,
                "created_at": token.created_at.isoformat(),
                "updated_at": token.updated_at.isoformat()
            })
        
        return jsonify({
            "status": "success",
            "token_count": len(token_info),
            "tokens": token_info
        })
        
    except Exception as e:
        logger.error(f"Erro ao obter informações dos tokens: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

@app.route('/kommo/revoke-token')
def revoke_kommo_token():
    """
    Revoga (remove) um token armazenado
    """
    try:
        account_id = request.args.get('account_id')
        
        if not account_id:
            flash("ID da conta não fornecido", "danger")
            return redirect(url_for('dashboard'))
            
        session = Session()
        try:
            token = session.query(KommoToken).filter_by(account_id=account_id).first()
                
            if not token:
                flash(f"Token para a conta {account_id} não encontrado", "warning")
                return redirect(url_for('dashboard'))
                    
            # Remover o token
            session.delete(token)
            session.commit()
                
            flash(f"Integração com a Kommo removida com sucesso!", "success")
            return redirect(url_for('dashboard'))
        finally:
            session.close()
            
    except Exception as e:
        logger.error(f"Erro ao revogar token: {str(e)}")
        flash(f"Erro ao remover integração: {str(e)}", "danger")
        return redirect(url_for('dashboard'))

@app.route('/kommo/webhook', methods=['POST'])
def kommo_webhook():
    """
    Endpoint para receber webhooks da Kommo
    """
    try:
        # Obter dados do corpo da requisição
        content_type = request.headers.get('Content-Type', '')
        
        # Registrar cabeçalhos da requisição
        headers = {key: value for key, value in request.headers.items()}
        
        # Log do content-type
        logger.info(f"Content-Type recebido: {content_type}")
        
        # Processar o corpo da requisição com base no content-type
        if 'application/json' in content_type:
            data = request.json
        elif 'application/x-www-form-urlencoded' in content_type:
            data = request.form.to_dict()
        elif 'multipart/form-data' in content_type:
            data = request.form.to_dict()
            # Processar arquivos, se houver
            files = {key: request.files[key].filename for key in request.files}
            if files:
                data['files'] = files
        else:
            # Tentar obter dados brutos
            try:
                raw_data = request.get_data(as_text=True)
                data = {'raw_data': raw_data}
            except:
                data = {'error': 'Formato de dados não suportado'}
        
        # Log detalhado dos dados recebidos
        logger.info("==================== WEBHOOK KOMMO RECEBIDO ====================")
        logger.info(f"Cabeçalhos: {json.dumps(headers, indent=2)}")
        logger.info(f"Corpo: {json.dumps(data, indent=2) if isinstance(data, dict) else str(data)}")
        logger.info("================================================================")
        
        # Processar o webhook com a função de utilidades
        result = process_kommo_webhook(data)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Erro no webhook da Kommo: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/upload', methods=['POST'])
def upload_file():
    """
    Endpoint para upload de arquivos
    """
    # Verificar se o arquivo foi enviado
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "Nenhum arquivo enviado"}), 400
        
    file = request.files['file']
    
    # Verificar se um arquivo foi selecionado
    if file.filename == '':
        return jsonify({"status": "error", "message": "Nenhum arquivo selecionado"}), 400
        
    # Salvar o arquivo temporariamente
    filename = secure_filename(file.filename)
    filepath = os.path.join('/tmp', filename)
    file.save(filepath)
    
    return jsonify({
        "status": "success",
        "message": "Arquivo enviado com sucesso",
        "filename": filename
    })

@app.route('/status')
def status():
    """
    Verifica o status do serviço
    """
    try:
        # Verificar a conexão com o banco de dados
        session = Session()
        session.execute(text("SELECT 1"))
        db_status = "connected"
        session.close()
    except Exception:
        db_status = "disconnected"
    
    return jsonify({
        "status": "online",
        "service": "webhook",
        "db_status": db_status,
        "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    })

@app.route('/kommo/search-lead')
def search_lead_by_phone_endpoint():
    """
    Endpoint para buscar leads no Kommo pelo número de telefone
    """
    try:
        phone = request.args.get('phone')
        
        if not phone:
            return jsonify({"status": "error", "message": "Número de telefone não informado"}), 400
        
        # Buscar conta Kommo para usar na API
        session = Session()
        try:
            # Buscar o primeiro token disponível
            kommo_token = session.query(KommoToken).first()
            
            if not kommo_token:
                return jsonify({
                    "status": "error",
                    "message": "Nenhum token de acesso para o Kommo configurado."
                }), 401
            
            # Verificar se o token está válido e renovar se necessário
            if kommo_token.expires_at <= datetime.utcnow():
                new_tokens = refresh_kommo_token(kommo_token.refresh_token, kommo_token.domain)
                
                if not new_tokens:
                    return jsonify({
                        "status": "error",
                        "message": "Falha ao renovar token de acesso para o Kommo."
                    }), 401
                
                # Atualizar o token
                kommo_token.access_token = new_tokens['access_token']
                kommo_token.refresh_token = new_tokens['refresh_token']
                kommo_token.expires_at = new_tokens['expires_at']
                session.commit()
            
            # Construir o domínio completo
            domain = kommo_token.domain
            if not domain.startswith('http'):
                # Verificar se já termina com .kommo.com para evitar duplicação
                if not domain.endswith('.kommo.com'):
                    domain = f"{domain}.kommo.com"
            
            # Chamar a função do módulo kommo_utils
            result = search_lead_by_phone(phone, kommo_token.access_token, domain, logger)
            
            # Verificar se o resultado contém erro
            if result.get("status") == "error":
                return jsonify(result), 500
            
            # Caso contrário, retornar o resultado
            return jsonify(result)
            
        finally:
            session.close()
            
    except Exception as e:
        logger.error(f"Erro ao buscar leads no Kommo: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/kommo/pipelines')
def get_kommo_pipelines():
    """
    Endpoint para buscar pipelines e estágios do Kommo
    """
    try:
        # Buscar conta Kommo para usar na API
        session = Session()
        try:
            # Buscar o primeiro token disponível
            kommo_token = session.query(KommoToken).first()
            
            if not kommo_token:
                return jsonify({
                    "status": "error",
                    "message": "Nenhum token de acesso para o Kommo configurado."
                }), 401
            
            # Verificar se o token está válido e renovar se necessário
            if kommo_token.expires_at <= datetime.utcnow():
                new_tokens = refresh_kommo_token(kommo_token.refresh_token, kommo_token.domain)
                
                if not new_tokens:
                    return jsonify({
                        "status": "error",
                        "message": "Falha ao renovar token de acesso para o Kommo."
                    }), 401
                
                # Atualizar o token
                kommo_token.access_token = new_tokens['access_token']
                kommo_token.refresh_token = new_tokens['refresh_token']
                kommo_token.expires_at = new_tokens['expires_at']
                session.commit()
            
            # Construir o domínio completo
            domain = kommo_token.domain
            if not domain.startswith('http'):
                # Verificar se já termina com .kommo.com para evitar duplicação
                if not domain.endswith('.kommo.com'):
                    domain = f"{domain}.kommo.com"
            
            # Chamar a função do módulo kommo_utils
            pipelines = get_pipeline_details(domain, kommo_token.access_token)
            
            if not pipelines:
                return jsonify({
                    "status": "error",
                    "message": "Falha ao obter pipelines do Kommo."
                }), 500
            
            # Retornar os detalhes dos pipelines
            return jsonify({
                "status": "success",
                "pipelines": pipelines
            })
            
        finally:
            session.close()
            
    except Exception as e:
        logger.error(f"Erro ao buscar pipelines no Kommo: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port) 