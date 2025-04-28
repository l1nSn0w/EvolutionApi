import logging
import requests
import json
from datetime import datetime, timedelta
from urllib.parse import urlparse

# Configurações da Kommo OAuth2
KOMMO_CLIENT_ID = "cc3d1fc9-71d6-478c-bf9b-ef6fa002080d"  # ID de integração da Kommo
KOMMO_CLIENT_SECRET = "hdhCMay0IaUMgiq3MYhGADbRlpeFvfWwbllUzqA7YQOXGzDKgMWnXXwDzpppE6As"  # Chave secreta da Kommo
KOMMO_REDIRECT_URI = "https://cd3a-2804-1b3-6080-144e-24a5-9ce2-55c-6b7f.ngrok-free.app/kommo/callback"  # URL do ngrok

logger = logging.getLogger('webhook')

def exchange_code_for_tokens(code, referer=None):
    """
    Troca o código de autorização por tokens de acesso e atualização
    """
    try:
        # Determinar o domínio com base no referer
        domain = referer if referer else "kommo.com"
        
        # Trocar o código por tokens
        logger.info(f"Trocando código de autorização por tokens...")
        token_url = f"https://{domain}/oauth2/access_token"
        
        # Preparar payload para a requisição
        payload = {
            "client_id": KOMMO_CLIENT_ID,
            "client_secret": KOMMO_CLIENT_SECRET,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": KOMMO_REDIRECT_URI
        }
        
        # Fazer a requisição para obter os tokens
        response = requests.post(token_url, json=payload)
        
        # Verificar se a requisição foi bem-sucedida
        if response.status_code == 200:
            # Extrair os tokens da resposta
            tokens_data = response.json()
            logger.info(f"Resposta da API Kommo: {response.status_code} - {response.text}")
            
            # Calcular quando o token expira
            expires_in = tokens_data.get('expires_in', 86400)  # Padrão: 24 horas
            expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            
            # Extrair account_id do token JWT
            account_id = None
            if 'access_token' in tokens_data:
                try:
                    import base64
                    # Dividir o token JWT em suas partes (header.payload.signature)
                    jwt_parts = tokens_data['access_token'].split('.')
                    if len(jwt_parts) >= 2:
                        # Ajustar o padding para base64
                        padded = jwt_parts[1] + '=' * (4 - len(jwt_parts[1]) % 4)
                        # Decodificar e converter para JSON
                        jwt_payload = json.loads(base64.b64decode(padded))
                        
                        # Extrair o account_id do payload
                        account_id = jwt_payload.get('account_id')
                        logger.info(f"Account ID extraído do JWT: {account_id}")
                        
                        # Converter account_id para string para armazenar no banco
                        if account_id is not None:
                            account_id = str(account_id)
                except Exception as jwt_err:
                    logger.error(f"Erro ao decodificar JWT: {str(jwt_err)}")
            
            # Se não conseguiu extrair do JWT, tentar do base_domain
            if not account_id:
                base_domain = tokens_data.get('base_domain', '')
                if base_domain and '.' in base_domain:
                    account_id = base_domain.split('.')[0]
                    logger.info(f"Account ID extraído do base_domain: {account_id}")
            
            # Preparar dicionário de tokens
            tokens = {
                'access_token': tokens_data.get('access_token'),
                'refresh_token': tokens_data.get('refresh_token'),
                'expires_at': expires_at,
                'account_id': account_id,
                'domain': domain
            }
            
            return tokens
        else:
            # Se houver erro, registrar e retornar None
            logger.error(f"Erro ao trocar código por tokens: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        # Registrar qualquer exceção
        logger.error(f"Erro ao trocar código por tokens: {str(e)}")
        return None

def save_kommo_tokens(session, KommoToken, account_id, access_token, refresh_token, expires_at, domain='kommo.com'):
    """
    Salva ou atualiza os tokens da Kommo no banco de dados
    """
    try:
        # Verificar se já existe um token para esta conta
        existing_token = session.query(KommoToken).filter_by(account_id=account_id).first()
        
        if existing_token:
            # Se existir, atualizar os tokens
            existing_token.access_token = access_token
            existing_token.refresh_token = refresh_token
            existing_token.expires_at = expires_at
            existing_token.domain = domain
            existing_token.updated_at = datetime.utcnow()
            
            session.commit()
            logger.info(f"Tokens atualizados para a conta: {account_id}")
            return True
        else:
            # Se não existir, criar um novo registro
            new_token = KommoToken(
                account_id=account_id,
                access_token=access_token,
                refresh_token=refresh_token,
                expires_at=expires_at,
                domain=domain
            )
            
            session.add(new_token)
            session.commit()
            logger.info(f"Novos tokens salvos para a conta: {account_id}")
            return True
    except Exception as e:
        # Se houver erro, fazer rollback e registrar
        session.rollback()
        logger.error(f"Erro ao salvar tokens: {str(e)}")
        return False

def refresh_kommo_token(refresh_token, domain=None):
    """
    Renovar token expirado usando o refresh_token
    """
    try:
        # Usar o domínio passado ou o padrão
        if not domain:
            domain = "kommo.com"
        
        # URL para renovação de token
        token_url = "https://kommo.com/oauth2/access_token"
        
        # Payload para a requisição
        payload = {
            "client_id": KOMMO_CLIENT_ID,
            "client_secret": KOMMO_CLIENT_SECRET,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "redirect_uri": KOMMO_REDIRECT_URI
        }
        
        # Fazer a requisição para renovar o token
        response = requests.post(token_url, json=payload)
        
        # Verificar se a requisição foi bem-sucedida
        if response.status_code == 200:
            tokens_data = response.json()
            logger.info(f"Resposta da renovação de token Kommo: {response.status_code} - {response.text}")
            
            # Calcular quando o novo token expira
            expires_in = tokens_data.get('expires_in', 86400)  # Padrão: 24 horas
            expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            
            # Extrair account_id do token JWT
            account_id = None
            if 'access_token' in tokens_data:
                try:
                    import base64
                    # Dividir o token JWT em suas partes (header.payload.signature)
                    jwt_parts = tokens_data['access_token'].split('.')
                    if len(jwt_parts) >= 2:
                        # Ajustar o padding para base64
                        padded = jwt_parts[1] + '=' * (4 - len(jwt_parts[1]) % 4)
                        # Decodificar e converter para JSON
                        jwt_payload = json.loads(base64.b64decode(padded))
                        
                        # Extrair o account_id do payload
                        account_id = jwt_payload.get('account_id')
                        logger.info(f"Account ID extraído do JWT: {account_id}")
                        
                        # Converter account_id para string para armazenar no banco
                        if account_id is not None:
                            account_id = str(account_id)
                except Exception as jwt_err:
                    logger.error(f"Erro ao decodificar JWT durante renovação: {str(jwt_err)}")
            
            # Se não conseguiu extrair do JWT, tentar do base_domain
            if not account_id:
                base_domain = tokens_data.get('base_domain', '')
                if base_domain and '.' in base_domain:
                    account_id = base_domain.split('.')[0]
                    logger.info(f"Account ID extraído do base_domain: {account_id}")
                # Se ainda não tiver account_id, usar o domínio fornecido
                elif domain and domain != "kommo.com":
                    domain_parts = domain.split('.')
                    if len(domain_parts) > 1:
                        account_id = domain_parts[0]
                        logger.info(f"Account ID extraído do domínio fornecido: {account_id}")
            
            # Preparar dicionário de tokens
            tokens = {
                'access_token': tokens_data.get('access_token'),
                'refresh_token': tokens_data.get('refresh_token'),
                'expires_at': expires_at,
                'account_id': account_id,
                'domain': domain
            }
            
            return tokens
        else:
            logger.error(f"Erro ao renovar token: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        logger.error(f"Erro ao renovar token: {str(e)}")
        return None

def get_kommo_leads(db, KommoToken, account_id):
    """
    Obtém o token de acesso válido para uma conta Kommo específica.
    Se o token estiver expirado, tenta renovar.
    """
    try:
        # Buscar o token no banco de dados
        token_record = db.query(KommoToken).filter_by(account_id=account_id).first()
        
        if not token_record:
            logger.error(f"Token não encontrado para a conta: {account_id}")
            return None
        
        # Verificar se o token ainda é válido
        if token_record.expires_at <= datetime.utcnow():
            logger.info(f"Token expirado para a conta: {account_id}. Renovando...")
            
            # Renovar o token
            new_tokens = refresh_kommo_token(token_record.refresh_token, token_record.domain)
            
            if new_tokens:
                # Atualizar o token no banco de dados
                token_record.access_token = new_tokens['access_token']
                token_record.refresh_token = new_tokens['refresh_token']
                token_record.expires_at = new_tokens['expires_at']
                token_record.updated_at = datetime.utcnow()
                
                db.commit()
                logger.info(f"Token renovado com sucesso para a conta: {account_id}")
                
                return new_tokens['access_token']
            else:
                logger.error(f"Falha ao renovar token para a conta: {account_id}")
                return None
        else:
            # Se o token ainda for válido, retornar
            return token_record.access_token
    except Exception as e:
        logger.error(f"Erro ao obter token Kommo: {str(e)}")
        return None

def get_kommo_auth_url():
    """
    Gera a URL de autorização para a Kommo
    """
    auth_url = (
        f"https://www.kommo.com/oauth/authorize"
        f"?client_id={KOMMO_CLIENT_ID}"
        f"&redirect_uri={KOMMO_REDIRECT_URI}"
        f"&mode=post_message"
    )
    return auth_url

def get_lead_details(lead_id, domain, access_token):
    """
    Obtém detalhes de um lead específico do Kommo
    """
    try:
        # URL da API
        api_url = f"https://{domain}/api/v4/leads/{lead_id}"
        
        # Parâmetros para incluir informações de contatos
        params = {
            "with": "contacts,catalog_elements,custom_fields_values"
        }
        
        # Cabeçalhos com o token de acesso
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        # Fazer a requisição para obter os detalhes do lead
        logger.info(f"Buscando detalhes do lead {lead_id} com parâmetros: {params}")
        response = requests.get(api_url, headers=headers, params=params)
        
        # Verificar se a requisição foi bem-sucedida
        if response.status_code == 200:
            lead_data = response.json()
            return lead_data
        else:
            logger.error(f"Erro ao obter detalhes do lead: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        logger.error(f"Erro ao obter detalhes do lead: {str(e)}")
        return None

def get_contact_details(contact_id, domain, access_token):
    """
    Obtém detalhes de um contato específico do Kommo
    """
    try:
        # URL da API
        api_url = f"https://{domain}/api/v4/contacts/{contact_id}"
        
        # Cabeçalhos com o token de acesso
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        # Fazer a requisição para obter os detalhes do contato
        response = requests.get(api_url, headers=headers)
        
        # Verificar se a requisição foi bem-sucedida
        if response.status_code == 200:
            contact_data = response.json()
            return contact_data
        else:
            logger.error(f"Erro ao obter detalhes do contato: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        logger.error(f"Erro ao obter detalhes do contato: {str(e)}")
        return None

def process_kommo_webhook(data):
    """
    Processa um webhook recebido da Kommo
    """
    try:
        logger.info("Webhook recebido da Kommo!")
        
        # Verificar o tipo de dados recebidos
        account_id = None
        domain = None
        webhook_type = 'unknown'
        
        if isinstance(data, dict):
            # Formatos diferentes de eventos da Kommo
            if 'account' in data and isinstance(data['account'], dict):
                account_id = data.get('account', {}).get('id')
                domain = data.get('account', {}).get('subdomain')
                webhook_type = data.get('event_type', 'unknown')
            else:
                # Procurar padrões específicos em dados de formulário
                for key in data.keys():
                    if key == 'account[id]':
                        account_id = data.get(key)
                    if key == 'account[subdomain]':
                        domain = data.get(key)
                    if key.startswith('leads[status][0][id]'):
                        webhook_type = 'lead_status_changed'
                    elif key.startswith('leads[add][0][id]'):
                        webhook_type = 'lead_added'
                    elif key.startswith('contacts[add][0][id]'):
                        webhook_type = 'contact_added'
        
        if not account_id:
            logger.warning("ID da conta não encontrado no webhook")
        else:
            logger.info(f"Account ID: {account_id}")
            
        if domain:
            logger.info(f"Domínio: {domain}")
            full_domain = f"{domain}.kommo.com"
        else:
            full_domain = "kommo.com"
            logger.warning("Domínio não encontrado, usando o padrão: kommo.com")
        
        logger.info(f"Tipo de webhook: {webhook_type}")
        
        # Aqui você pode adicionar mais lógica para processar diferentes tipos de webhooks
        if webhook_type == 'lead_status_changed':
            lead_id = None
            status_id = None
            
            # Tentar extrair informações em diferentes formatos
            if isinstance(data, dict):
                if 'payload' in data and isinstance(data['payload'], dict):
                    lead_id = data['payload'].get('id')
                    status_id = data['payload'].get('status_id')
                else:
                    # Procurar em padrões de formulário
                    for key in data.keys():
                        if key.startswith('leads[status][0][id]'):
                            lead_id = data.get(key)
                        if key.startswith('leads[status][0][status_id]'):
                            status_id = data.get(key)
            
            logger.info(f"Status do lead alterado: {lead_id} -> {status_id}")
            
            # Se temos um lead_id e account_id, vamos buscar detalhes do lead
            if lead_id and account_id:
                # Verificar se temos dados de sessão disponíveis
                from sqlalchemy.orm import Session
                import importlib
                
                try:
                    # Tentar importar o módulo app e acessar Session e KommoToken
                    app_module = importlib.import_module('app')
                    session_class = getattr(app_module, 'Session')
                    kommo_token_class = getattr(app_module, 'KommoToken')
                    
                    # Criar uma sessão
                    db_session = session_class()
                    
                    try:
                        logger.info(f"Buscando token para a conta {account_id}")
                        # Buscar token de acesso para esta conta
                        kommo_token = db_session.query(kommo_token_class).filter_by(account_id=account_id).first()
                        
                        if kommo_token:
                            # Verificar se o token está válido
                            if kommo_token.expires_at <= datetime.utcnow():
                                # Token expirado, renovar
                                logger.info(f"Token expirado para a conta {account_id}, renovando...")
                                new_tokens = refresh_kommo_token(kommo_token.refresh_token, kommo_token.domain)
                                
                                if new_tokens:
                                    # Atualizar o token
                                    kommo_token.access_token = new_tokens['access_token']
                                    kommo_token.refresh_token = new_tokens['refresh_token']
                                    kommo_token.expires_at = datetime.utcnow() + timedelta(seconds=new_tokens.get('expires_in', 86400))
                                    db_session.commit()
                                    logger.info(f"Token renovado com sucesso para a conta {account_id}")
                                    access_token = new_tokens['access_token']
                                else:
                                    logger.error(f"Falha ao renovar token para a conta {account_id}")
                                    return {
                                        "status": "error", 
                                        "message": "Falha ao renovar token de acesso"
                                    }
                            else:
                                # Token válido
                                access_token = kommo_token.access_token
                                
                            # Buscar detalhes do lead
                            logger.info(f"Buscando detalhes do lead {lead_id}")
                            lead_details = get_lead_details(lead_id, full_domain, access_token)
                            
                            if lead_details:
                                logger.info("==================== DETALHES DO LEAD ====================")
                                logger.info(f"Lead ID: {lead_id}")
                                
                                # Extrair informações úteis do lead
                                lead_name = lead_details.get("name", "Nome não disponível")
                                lead_price = lead_details.get("price", 0)
                                lead_status_id = lead_details.get("status_id")
                                lead_pipeline_id = lead_details.get("pipeline_id")
                                
                                logger.info(f"Nome: {lead_name}")
                                logger.info(f"Valor: {lead_price}")
                                logger.info(f"Status ID: {lead_status_id}")
                                logger.info(f"Pipeline ID: {lead_pipeline_id}")
                                
                                # Buscar contatos vinculados
                                contacts = []
                                if "_embedded" in lead_details and "contacts" in lead_details["_embedded"]:
                                    contacts = lead_details["_embedded"]["contacts"]
                                    logger.info(f"Contatos vinculados: {len(contacts)}")
                                    
                                    for i, contact in enumerate(contacts):
                                        contact_id = contact.get("id")
                                        is_main = contact.get("is_main", False)
                                        logger.info(f"Contato {i+1}: ID={contact_id}, Principal={is_main}")
                                        
                                        # Buscar detalhes do contato
                                        if contact_id:
                                            logger.info(f"Buscando detalhes do contato {contact_id}")
                                            contact_details = get_contact_details(contact_id, full_domain, access_token)
                                            
                                            if contact_details:
                                                # Extrair informações úteis do contato
                                                contact_name = contact_details.get("name", "Nome não disponível")
                                                first_name = contact_details.get("first_name", "")
                                                last_name = contact_details.get("last_name", "")
                                                
                                                logger.info(f"Detalhes do Contato {i+1}: {contact_name} ({first_name} {last_name})")
                                                
                                                # Procurar campos personalizados (telefone, email, etc.)
                                                custom_fields = contact_details.get("custom_fields_values", [])
                                                if custom_fields:
                                                    logger.info("Campos personalizados do contato:")
                                                    for field in custom_fields:
                                                        field_id = field.get("field_id")
                                                        field_name = field.get("field_name", "Campo sem nome")
                                                        field_code = field.get("field_code", "")
                                                        
                                                        # Extrair valores
                                                        values = field.get("values", [])
                                                        if values:
                                                            value = values[0].get("value", "Sem valor")
                                                            logger.info(f"  - {field_name} ({field_code}): {value}")
                                                            
                                                            # Destacar telefones e emails
                                                            if field_code == "PHONE":
                                                                logger.info(f"  📞 Telefone encontrado: {value}")
                                                            elif field_code == "EMAIL":
                                                                logger.info(f"  📧 Email encontrado: {value}")
                                            else:
                                                logger.error(f"Falha ao buscar detalhes do contato {contact_id}")
                                else:
                                    # Log para identificar o problema
                                    logger.warning("Não foram encontrados contatos associados ao lead")
                                    logger.info(f"Estrutura do lead_details: {json.dumps(lead_details, indent=2)}")
                                    
                                    # Tentar buscar contatos de forma alternativa
                                    try:
                                        # Verificar se há contato principal
                                        main_contact_id = lead_details.get('main_contact', {}).get('id')
                                        if main_contact_id:
                                            logger.info(f"Encontrado contato principal ID={main_contact_id}")
                                            contact_details = get_contact_details(main_contact_id, full_domain, access_token)
                                            
                                            if contact_details:
                                                # Extrair informações úteis do contato
                                                contact_name = contact_details.get("name", "Nome não disponível")
                                                first_name = contact_details.get("first_name", "")
                                                last_name = contact_details.get("last_name", "")
                                                
                                                logger.info(f"Detalhes do Contato Principal: {contact_name} ({first_name} {last_name})")
                                                
                                                # Procurar campos personalizados (telefone, email, etc.)
                                                custom_fields = contact_details.get("custom_fields_values", [])
                                                if custom_fields:
                                                    logger.info("Campos personalizados do contato principal:")
                                                    for field in custom_fields:
                                                        field_name = field.get("field_name", "Campo sem nome")
                                                        field_code = field.get("field_code", "")
                                                        
                                                        # Extrair valores
                                                        values = field.get("values", [])
                                                        if values:
                                                            value = values[0].get("value", "Sem valor")
                                                            logger.info(f"  - {field_name} ({field_code}): {value}")
                                                            
                                                            # Destacar telefones e emails
                                                            if field_code == "PHONE":
                                                                logger.info(f"  📞 Telefone encontrado: {value}")
                                                            elif field_code == "EMAIL":
                                                                logger.info(f"  📧 Email encontrado: {value}")
                                        else:
                                            # Buscar contatos para o lead através da API separada
                                            logger.info(f"Buscando contatos através da API separada para o lead {lead_id}")
                                            contacts_api_url = f"https://{full_domain}/api/v4/leads/{lead_id}/contacts"
                                            headers = {
                                                "Authorization": f"Bearer {access_token}",
                                                "Content-Type": "application/json"
                                            }
                                            
                                            contacts_response = requests.get(contacts_api_url, headers=headers)
                                            if contacts_response.status_code == 200:
                                                contacts_data = contacts_response.json()
                                                if "_embedded" in contacts_data and "contacts" in contacts_data["_embedded"]:
                                                    contacts_list = contacts_data["_embedded"]["contacts"]
                                                    logger.info(f"Contatos encontrados via API separada: {len(contacts_list)}")
                                                    
                                                    for i, contact in enumerate(contacts_list):
                                                        contact_id = contact.get("id")
                                                        if contact_id:
                                                            logger.info(f"Processando contato {i+1}: ID={contact_id}")
                                                            contact_details = get_contact_details(contact_id, full_domain, access_token)
                                                            
                                                            if contact_details:
                                                                # Extrair informações úteis do contato
                                                                contact_name = contact_details.get("name", "Nome não disponível")
                                                                logger.info(f"Detalhes do Contato {i+1}: {contact_name}")
                                                                
                                                                # Procurar campos personalizados como telefone, email, etc.
                                                                custom_fields = contact_details.get("custom_fields_values", [])
                                                                if custom_fields:
                                                                    logger.info("Campos personalizados do contato:")
                                                                    for field in custom_fields:
                                                                        field_name = field.get("field_name", "Campo sem nome")
                                                                        field_code = field.get("field_code", "")
                                                                        
                                                                        values = field.get("values", [])
                                                                        if values:
                                                                            value = values[0].get("value", "Sem valor")
                                                                            logger.info(f"  - {field_name} ({field_code}): {value}")
                                                                            
                                                                            if field_code == "PHONE":
                                                                                logger.info(f"  📞 Telefone encontrado: {value}")
                                                                            elif field_code == "EMAIL":
                                                                                logger.info(f"  📧 Email encontrado: {value}")
                                            else:
                                                logger.warning(f"Não foi possível obter contatos via API separada: {contacts_response.status_code}")
                                    except Exception as contact_err:
                                        logger.error(f"Erro ao buscar contatos alternativamente: {str(contact_err)}")
                                
                                logger.info("==========================================================")
                            else:
                                logger.error(f"Falha ao buscar detalhes do lead {lead_id}")
                        else:
                            logger.warning(f"Nenhum token encontrado para a conta {account_id}")
                    finally:
                        # Fechar a sessão
                        db_session.close()
                        
                except Exception as e:
                    logger.error(f"Erro ao buscar detalhes de lead/contato: {str(e)}")
            
            # Retornar resposta de sucesso
            return {
                "status": "success", 
                "message": f"Alteração de status processada: {lead_id}"
            }
            
        elif webhook_type == 'lead_added':
            lead_id = None
            # Tentar extrair o ID do lead em diferentes formatos
            if isinstance(data, dict):
                if 'payload' in data and isinstance(data['payload'], dict):
                    lead_id = data['payload'].get('id')
                else:
                    # Procurar em padrões de formulário
                    for key in data.keys():
                        if key.startswith('leads[add][0][id]'):
                            lead_id = data.get(key)
                            break
                
            logger.info(f"Novo lead adicionado: {lead_id}")
            
            # Lógica adicional semelhante ao lead_status_changed poderia ser adicionada aqui
            
            return {
                "status": "success", 
                "message": f"Novo lead processado: {lead_id}"
            }
            
        elif webhook_type == 'contact_added':
            contact_id = None
            
            # Tentar extrair o ID do contato em diferentes formatos
            if isinstance(data, dict):
                if 'payload' in data and isinstance(data['payload'], dict):
                    contact_id = data['payload'].get('id')
                else:
                    # Procurar em padrões de formulário
                    for key in data.keys():
                        if key.startswith('contacts[add][0][id]'):
                            contact_id = data.get(key)
                            break
            
            logger.info(f"Novo contato adicionado: {contact_id}")
            
            # Lógica adicional para processar um novo contato poderia ser adicionada aqui
            
            return {
                "status": "success", 
                "message": f"Novo contato processado: {contact_id}"
            }
            
        # Outros tipos de webhooks...
        else:
            logger.info(f"Tipo de webhook não processado especificamente: {webhook_type}")
            return {
                "status": "success", 
                "message": f"Webhook recebido: {webhook_type}"
            }
            
    except Exception as e:
        logger.error(f"Erro ao processar webhook da Kommo: {str(e)}")
        return {"error": f"Erro ao processar webhook: {str(e)}"}

def search_lead_by_phone(phone, access_token, domain, logger):
    """
    Busca leads no Kommo pelo número de telefone
    """
    try:
        if not phone:
            return {"status": "error", "message": "Número de telefone não informado"}
        
        # Formatar o telefone (remover espaços, parênteses, traços e +)
        formatted_phone = ''.join(filter(str.isdigit, phone))
        
        # Se começar com 55 (Brasil), verificar se tem 12 ou 13 dígitos 
        # para determinar se é preciso remover o 9 da frente
        if formatted_phone.startswith('55') and (len(formatted_phone) == 12 or len(formatted_phone) == 13):
            # Se tiver 13 dígitos, pode ter o 9 na frente (formato 55DDDigitos)
            if len(formatted_phone) == 13:
                # Verificar se o 3º dígito é 9 (depois do código do país 55)
                if formatted_phone[2] == '9':
                    # Se for, buscar com e sem o 9
                    search_phones = [formatted_phone, formatted_phone[:2] + formatted_phone[3:]]
                else:
                    search_phones = [formatted_phone]
            else:
                # Se tiver 12 dígitos, tenta também com o 9 na frente
                search_phones = [formatted_phone, formatted_phone[:2] + '9' + formatted_phone[2:]]
        else:
            # Para outros formatos, usa o número como está
            search_phones = [formatted_phone]
        
        # Gerar consultas para busca com diferentes formatos
        search_queries = []
        for phone_number in search_phones:
            # Tentar diferentes formatações comuns
            search_queries.extend([
                phone_number,  # Formato numérico puro
                f"+{phone_number}",  # Com +
                f"+{phone_number[:2]} {phone_number[2:]}"  # Com + e espaço após código do país
            ])
            
            # Se começar com 55 (Brasil), adicionar formatos específicos
            if phone_number.startswith('55'):
                ddd = phone_number[2:4]
                numero = phone_number[4:]
                search_queries.extend([
                    f"({ddd}) {numero}",  # (DDD) NNNNNNNN
                    f"+55 ({ddd}) {numero}",  # +55 (DDD) NNNNNNNN
                    f"+55{ddd}{numero}"  # +55DDDNNNNNNNN
                ])
                
                # Se o número tiver 8 ou 9 dígitos (após DDD), adicionar formatos com hífen
                if len(numero) == 8:
                    search_queries.append(f"({ddd}) {numero[:4]}-{numero[4:]}")  # (DDD) NNNN-NNNN
                elif len(numero) == 9:
                    search_queries.append(f"({ddd}) {numero[:5]}-{numero[5:]}")  # (DDD) NNNNN-NNNN
        
        # URL da API para buscar leads
        api_url = f"https://{domain}/api/v4/leads"
        
        # Parâmetros para incluir contatos e encontrar por telefone
        params = {
            "with": "contacts,custom_fields_values",
            "query": search_queries[0]  # Usar primeiro formato para consulta principal
        }
        
        # Cabeçalhos com o token de acesso
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        # Fazer a requisição para obter os leads
        logger.info(f"Buscando leads com o telefone {phone} - Formatações: {search_queries}")
        response = requests.get(api_url, headers=headers, params=params)
        
        # Verificar se a requisição foi bem-sucedida
        if response.status_code == 200:
            leads_data = response.json()
            
            if leads_data.get('_embedded') and leads_data['_embedded'].get('leads'):
                leads = leads_data['_embedded']['leads']
                
                # Adicionamos mais informações para debug
                return {
                    "status": "success",
                    "message": f"Encontrado(s) {len(leads)} lead(s)",
                    "query": search_queries[0],
                    "all_queries": search_queries,
                    "leads": leads
                }
            else:
                # Se não encontrou com o primeiro formato, tentar com os demais
                for query in search_queries[1:]:
                    params["query"] = query
                    response = requests.get(api_url, headers=headers, params=params)
                    
                    if response.status_code == 200:
                        leads_data = response.json()
                        
                        if leads_data.get('_embedded') and leads_data['_embedded'].get('leads'):
                            leads = leads_data['_embedded']['leads']
                            
                            return {
                                "status": "success",
                                "message": f"Encontrado(s) {len(leads)} lead(s)",
                                "query": query,
                                "leads": leads
                            }
                
                # Se chegou aqui, não encontrou nenhum lead com nenhum formato
                return {
                    "status": "success",
                    "message": "Nenhum lead encontrado com este número",
                    "queries": search_queries,
                    "leads": []
                }
        else:
            logger.error(f"Erro ao buscar leads no Kommo: {response.status_code} - {response.text}")
            return {
                "status": "error",
                "message": f"Erro na API do Kommo: {response.status_code}",
                "response": response.text
            }
                
    except Exception as e:
        logger.error(f"Erro ao buscar leads no Kommo: {str(e)}")
        return {"status": "error", "message": str(e)}

def get_pipeline_details(domain, access_token):
    """
    Obtém a lista de pipelines e seus estágios
    """
    try:
        # URL da API
        api_url = f"https://{domain}/api/v4/leads/pipelines"
        
        # Cabeçalhos com o token de acesso
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        # Fazer a requisição para obter os pipelines
        logger.info(f"Buscando pipelines no Kommo")
        response = requests.get(api_url, headers=headers)
        
        # Verificar se a requisição foi bem-sucedida
        if response.status_code == 200:
            pipelines_data = response.json()
            
            # Formatar os dados de pipelines
            pipelines = {}
            if "_embedded" in pipelines_data and "pipelines" in pipelines_data["_embedded"]:
                for pipeline in pipelines_data["_embedded"]["pipelines"]:
                    pipeline_id = pipeline.get("id")
                    pipeline_name = pipeline.get("name")
                    
                    # Obter estágios deste pipeline
                    stages = {}
                    if "_embedded" in pipeline and "statuses" in pipeline["_embedded"]:
                        for stage in pipeline["_embedded"]["statuses"]:
                            stage_id = stage.get("id")
                            stage_name = stage.get("name")
                            stage_color = stage.get("color")
                            stages[stage_id] = {
                                "name": stage_name,
                                "color": stage_color
                            }
                    
                    pipelines[pipeline_id] = {
                        "name": pipeline_name,
                        "stages": stages
                    }
            
            return pipelines
        else:
            logger.error(f"Erro ao obter pipelines: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        logger.error(f"Erro ao obter pipelines: {str(e)}")
        return None 