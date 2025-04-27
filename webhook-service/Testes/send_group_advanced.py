import requests
import json
import argparse

def send_text_message(instance, group_id, text, api_key, mention_all=False):
    """Envia uma mensagem de texto para um grupo."""
    server_url = "http://localhost:8080"
    url = f"{server_url}/message/sendText/{instance}"
    
    payload = {
        "number": group_id,
        "options": {
            "delay": 1000,
            "presence": "composing"
        },
        "text": text
    }
    
    # Adicionar menção para todos se solicitado
    if mention_all:
        payload["options"]["mentions"] = {
            "everyOne": True
        }
    
    headers = {
        "apikey": api_key,
        "Content-Type": "application/json"
    }
    
    response = requests.request("POST", url, json=payload, headers=headers)
    return response

def send_image_message(instance, group_id, image_url, caption, api_key):
    """Envia uma imagem com legenda para um grupo."""
    server_url = "http://localhost:8080"
    url = f"{server_url}/message/sendMedia/{instance}"
    
    payload = {
        "number": group_id,
        "mediaMessage": {
            "mediatype": "image",
            "media": image_url,
            "caption": caption
        }
    }
    
    headers = {
        "apikey": api_key,
        "Content-Type": "application/json"
    }
    
    response = requests.request("POST", url, json=payload, headers=headers)
    return response

def main():
    parser = argparse.ArgumentParser(description='Enviar mensagens para grupos no WhatsApp')
    parser.add_argument('--type', choices=['text', 'image'], default='text', help='Tipo de mensagem')
    parser.add_argument('--group', default="120363168643011557@g.us", help='ID do grupo')
    parser.add_argument('--text', help='Texto da mensagem')
    parser.add_argument('--image', help='URL da imagem (para mensagens de imagem)')
    parser.add_argument('--caption', help='Legenda da imagem')
    parser.add_argument('--mention-all', action='store_true', help='Mencionar todos no grupo')
    
    args = parser.parse_args()
    
    # Configuração
    instance = "Teste"
    api_key = "123456"
    
    if args.type == 'text':
        if not args.text:
            args.text = "Olá grupo! Esta é uma mensagem de teste enviada via API da Evolution. 🚀"
        
        response = send_text_message(instance, args.group, args.text, api_key, args.mention_all)
    
    elif args.type == 'image':
        if not args.image:
            args.image = "https://i.imgur.com/3OJ8qnz.jpeg"  # Imagem padrão
        
        if not args.caption:
            args.caption = "Imagem enviada via Evolution API 📸"
            
        response = send_image_message(instance, args.group, args.image, args.caption, api_key)
    
    # Verificar se a requisição foi bem sucedida
    if response.status_code == 201 or response.status_code == 200:
        print("Mensagem enviada com sucesso!")
        print("\nResposta da API:")
        print(json.dumps(response.json(), indent=2))
    else:
        print(f"Erro ao enviar mensagem. Status code: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    main() 