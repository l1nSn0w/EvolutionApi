import requests
import json

# Configuração
server_url = "http://localhost:8080"  # URL do servidor local
instance = "Teste"  # Nome da instância
api_key = "123456"  # Substitua pela sua API key real

# URL para buscar todos os grupos com parâmetro getParticipants
url = f"{server_url}/group/fetchAllGroups/{instance}"

# Parâmetros da query
params = {
    "getParticipants": "true"  # true para obter lista de participantes, false para não obter
}

# Cabeçalhos com a API key
headers = {
    "apikey": api_key
}

# Fazer a requisição
try:
    response = requests.request("GET", url, headers=headers, params=params)
    
    # Verificar se a requisição foi bem sucedida
    if response.status_code == 200:
        print("Requisição bem sucedida!")
        
        # Converter resposta para JSON
        groups = json.loads(response.text)
        
        print(f"\nTotal de grupos encontrados: {len(groups)}")
        
        # Exibir informações simplificadas de cada grupo
        for i, group in enumerate(groups, 1):
            print(f"\n{i}. Grupo: {group.get('subject', 'Sem nome')}")
            print(f"   ID: {group.get('id', 'N/A')}")
            print(f"   Membros: {group.get('size', 0)}")
            print(f"   Proprietário: {group.get('owner', 'N/A')}")
            print(f"   Anúncios: {'Sim' if group.get('announce', False) else 'Não'}")
            print(f"   Restrito: {'Sim' if group.get('restrict', False) else 'Não'}")
            
        # Perguntar se deseja ver detalhes completos
        ver_detalhes = input("\nDeseja ver os detalhes completos de algum grupo? (S/N): ")
        if ver_detalhes.upper() == 'S':
            try:
                grupo_num = int(input(f"Digite o número do grupo (1-{len(groups)}): "))
                if 1 <= grupo_num <= len(groups):
                    print("\nDetalhes completos:")
                    print(json.dumps(groups[grupo_num-1], indent=2))
                else:
                    print("Número inválido!")
            except ValueError:
                print("Entrada inválida!")
    else:
        print(f"Erro na requisição. Status code: {response.status_code}")
        print(response.text)
except Exception as e:
    print(f"Ocorreu um erro: {e}") 