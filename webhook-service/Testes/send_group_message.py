import requests
import json

# Configuração
server_url = "http://localhost:8080"  # URL do servidor local
instance = "Teste"  # Nome da instância
api_key = "123456"  # API key

# Dados do grupo
group_id = "120363168643011557@g.us"  # ID do grupo "Projeto - Smartify"

# URL para enviar mensagem de texto
url = f"{server_url}/message/sendText/{instance}"

# Payload com os dados da mensagem
payload = {
    "number": group_id,  # ID do grupo
    "options": {
        "delay": 1000,  # Delay em ms
        "presence": "composing"  # Status de digitando
    },
    "text": "Agora vou automatizar o envio de mensagens para o grupo, mandando o melhor feedback possivel pro Matheusssziiiinnn"

}

# Cabeçalhos com a API key
headers = {
    "apikey": api_key,
    "Content-Type": "application/json"
}

# Fazer a requisição
try:
    response = requests.request("POST", url, json=payload, headers=headers)
    
    # Verificar se a requisição foi bem sucedida
    if response.status_code == 201 or response.status_code == 200:
        print("Mensagem enviada com sucesso!")
        print("\nResposta da API:")
        print(json.dumps(response.json(), indent=2))
    else:
        print(f"Erro ao enviar mensagem. Status code: {response.status_code}")
        print(response.text)
except Exception as e:
    print(f"Ocorreu um erro: {e}") 