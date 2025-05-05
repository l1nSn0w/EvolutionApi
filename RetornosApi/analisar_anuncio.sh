#!/bin/bash

# Definir códigos de cores ANSI
RESET="\033[0m"
BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
BLUE="\033[34m"
MAGENTA="\033[35m"
CYAN="\033[36m"
RED="\033[31m"
BG_BLUE="\033[44m"
BG_GREEN="\033[42m"
BG_RED="\033[41m"

# Função para imprimir cabeçalhos coloridos
print_header() {
    echo -e "${BG_BLUE}${BOLD} $1 ${RESET}"
}

# Função para mostrar progresso
show_progress() {
    echo -e "${BLUE}${BOLD}[INFO]${RESET} $1"
}

# Função para exibir sucesso
show_success() {
    echo -e "${GREEN}${BOLD}[SUCESSO]${RESET} $1"
}

# Função para exibir aviso
show_warning() {
    echo -e "${YELLOW}${BOLD}[AVISO]${RESET} $1"
}

# Função para exibir erro
show_error() {
    echo -e "${RED}${BOLD}[ERRO]${RESET} $1"
}

# Função para exibir resultados
show_result() {
    echo -e "${CYAN}${BOLD}[RESULTADO]${RESET} $1"
}

# Função para mostrar estatísticas
show_stats() {
    echo -e "${MAGENTA}${BOLD}[ESTATÍSTICA]${RESET} $1"
}

# Barra de progresso
progress_bar() {
    local step=$1
    local total=6 # Total de etapas do processo
    local size=30 # Tamanho da barra de progresso
    local percent=$((step * 100 / total))
    local progress=$((step * size / total))
    
    printf "${BOLD}[" 
    for ((i=0; i<size; i++)); do
        if [ $i -lt $progress ]; then
            printf "${GREEN}#"
        else
            printf "${RESET}."
        fi
    done
    printf "${RESET}${BOLD}] %d%%${RESET}\r" $percent
    
    if [ $step -eq $total ]; then
        echo
    fi
}

# Verifica se um argumento foi fornecido
if [ $# -eq 0 ]; then
    show_error "Nenhum nome de anúncio fornecido"
    echo
    echo -e "Uso: ${BOLD}$0 \"NOME_DO_ANUNCIO\"${RESET}"
    echo -e "Exemplo: ${BOLD}$0 \"AD03 - 05/03 - note 14 pro\"${RESET}"
    exit 1
fi

# Configurar variáveis
ANUNCIO="$1"
DIR="/Users/lynconkusminski/Documents/GitHub/EvolutionApi/Teste Evolution API/evolution-api/RetornosApi"
CAMPAIGN_FILE="$DIR/campaing-analytics.txt"
LEADS_FILE="$DIR/leadByPhone.txt"

# Criar um nome de arquivo seguro substituindo espaços e barras por underscores
SAFE_FILENAME=$(echo "$ANUNCIO" | sed 's/[[:space:]]/_/g' | sed 's/\//_/g')
OUTPUT_FILE="$DIR/analise_${SAFE_FILENAME}.txt"

# Verificar se os arquivos existem
if [ ! -f "$CAMPAIGN_FILE" ]; then
    show_error "Arquivo $CAMPAIGN_FILE não encontrado."
    exit 1
fi

if [ ! -f "$LEADS_FILE" ]; then
    show_error "Arquivo $LEADS_FILE não encontrado."
    exit 1
fi

# Exibir cabeçalho
clear
echo
echo -e "${BG_BLUE}${BOLD}                                                                      ${RESET}"
echo -e "${BG_BLUE}${BOLD}                ANÁLISE DE ANÚNCIOS - EVOLUTION API                   ${RESET}"
echo -e "${BG_BLUE}${BOLD}                                                                      ${RESET}"
echo

echo -e "${BOLD}Anúncio:${RESET} ${CYAN}$ANUNCIO${RESET}"
echo -e "${BOLD}Arquivo de saída:${RESET} ${CYAN}$OUTPUT_FILE${RESET}"
echo

# Iniciar arquivo de saída
cat > "$OUTPUT_FILE" << EOF
# ANÁLISE DO ANÚNCIO: $ANUNCIO
Data/Hora: $(date)

## 1. DADOS DO ANÚNCIO EM CAMPAIGN-ANALYTICS.TXT
EOF

# Barra de progresso inicial
progress_bar 0
echo

# Buscar informações do anúncio
print_header "ETAPA 1/6: BUSCANDO DADOS DO ANÚNCIO"
show_progress "Extraindo métricas gerais de $CAMPAIGN_FILE..."
echo -e "\n### 1.1 Métricas Gerais\n" >> "$OUTPUT_FILE"
grep -A 15 "$ANUNCIO" "$CAMPAIGN_FILE" | head -n 15 >> "$OUTPUT_FILE"

# Buscar dados de descartes
show_progress "Extraindo dados de descartes..."
echo -e "\n### 1.2 Dados de Descartes\n" >> "$OUTPUT_FILE"
grep -A 5 "$ANUNCIO" "$CAMPAIGN_FILE" | grep -E "discarded_leads|discard_rate" >> "$OUTPUT_FILE"

# Buscar motivos de descarte
show_progress "Extraindo motivos de descarte..."
echo -e "\n### 1.3 Motivos de Descarte\n" >> "$OUTPUT_FILE"
grep -A 30 "$ANUNCIO" "$CAMPAIGN_FILE" | grep -A 15 "discard_reasons_array" >> "$OUTPUT_FILE"

progress_bar 1
echo

# Buscar telefones associados ao anúncio
print_header "ETAPA 2/6: IDENTIFICANDO TELEFONES ASSOCIADOS"
show_progress "Buscando telefones associados ao anúncio..."
echo -e "\n## 2. TELEFONES ASSOCIADOS AO ANÚNCIO\n" >> "$OUTPUT_FILE"
PHONES=$(grep -A 1 -B 20 "$ANUNCIO" "$LEADS_FILE" | grep -E "telefone.*: " | sort | uniq | sed 's/.*"telefone": "\([^"]*\)".*/\1/')
echo "$PHONES" > /tmp/phones.txt
PHONE_COUNT=$(echo "$PHONES" | wc -l | tr -d ' ')

show_stats "Total de telefones encontrados: ${BOLD}$PHONE_COUNT${RESET}"
echo "Total de telefones associados: $PHONE_COUNT" >> "$OUTPUT_FILE"
echo -e "\`\`\`" >> "$OUTPUT_FILE"
echo "$PHONES" >> "$OUTPUT_FILE"
echo -e "\`\`\`\n" >> "$OUTPUT_FILE"

progress_bar 2
echo

# Verificar telefones com status LEAD DESCARTADO
print_header "ETAPA 3/6: ANALISANDO LEADS DESCARTADOS"
show_progress "Verificando telefones com status LEAD DESCARTADO..."
echo -e "## 3. LEADS DESCARTADOS\n" >> "$OUTPUT_FILE"
DISCARDED_PHONES=""
TOTAL_DISCARDED=0

echo -e "### 3.1 Telefones com Status LEAD DESCARTADO\n" >> "$OUTPUT_FILE"
echo -e "\`\`\`" >> "$OUTPUT_FILE"

while read phone; do
    if grep -A 50 "\"telefone\": \"$phone\"" "$LEADS_FILE" | grep -A 2 "$ANUNCIO" > /dev/null && 
       grep -A 50 "\"telefone\": \"$phone\"" "$LEADS_FILE" | grep -A 2 "LEAD DESCARTADO" > /dev/null; then
        echo "$phone"
        DISCARDED_PHONES="$DISCARDED_PHONES $phone"
        TOTAL_DISCARDED=$((TOTAL_DISCARDED + 1))
    fi
done < /tmp/phones.txt >> "$OUTPUT_FILE"

echo -e "\`\`\`\n" >> "$OUTPUT_FILE"
echo "Total de telefones descartados: $TOTAL_DISCARDED" >> "$OUTPUT_FILE"

show_stats "Telefones descartados: ${BOLD}$TOTAL_DISCARDED${RESET} de ${BOLD}$PHONE_COUNT${RESET} ($(echo "scale=1; $TOTAL_DISCARDED*100/$PHONE_COUNT" | bc)%)"

progress_bar 3
echo

# Verificar motivos de descarte por telefone
print_header "ETAPA 4/6: ANALISANDO MOTIVOS DE DESCARTE"
show_progress "Extraindo motivos de descarte para cada telefone..."
echo -e "\n### 3.2 Motivos de Descarte por Telefone\n" >> "$OUTPUT_FILE"

for phone in $DISCARDED_PHONES; do
    echo -e "\n#### Telefone: $phone\n" >> "$OUTPUT_FILE"
    echo -e "\`\`\`" >> "$OUTPUT_FILE"
    grep -A 200 "\"telefone\": \"$phone\"" "$LEADS_FILE" | grep -A 10 "descartes" | grep -A 5 "motivo" | head -n 10 >> "$OUTPUT_FILE"
    echo -e "\`\`\`\n" >> "$OUTPUT_FILE"
    
    echo -e "Anúncios associados a este telefone:\n" >> "$OUTPUT_FILE"
    echo -e "\`\`\`" >> "$OUTPUT_FILE"
    grep -A 100 "\"telefone\": \"$phone\"" "$LEADS_FILE" | grep -A 10 "anuncios" | grep -A 2 "ad_name" | head -n 15 >> "$OUTPUT_FILE"
    echo -e "\`\`\`\n" >> "$OUTPUT_FILE"
done

# Resumo dos motivos de descarte
show_progress "Gerando resumo estatístico dos motivos de descarte..."
echo -e "\n## 4. RESUMO DOS MOTIVOS DE DESCARTE\n" >> "$OUTPUT_FILE"

# Obter contagem de motivos de descarte
MOTIVOS=$(for phone in $DISCARDED_PHONES; do
    grep -A 200 "\"telefone\": \"$phone\"" "$LEADS_FILE" | 
    grep -A 10 "descartes" | 
    grep -A 2 "motivo" | 
    grep "motivo" | 
    head -n 1 | 
    sed 's/.*"motivo": "\([^"]*\)".*/\1/'
done | sort | uniq -c | sort -nr)

echo -e "\`\`\`" >> "$OUTPUT_FILE"
echo "$MOTIVOS" >> "$OUTPUT_FILE"
echo -e "\`\`\`\n" >> "$OUTPUT_FILE"

# Exibir resumo no console
echo
echo -e "${BOLD}Motivos de descarte:${RESET}"
echo "$MOTIVOS" | while read line; do
    count=$(echo "$line" | sed 's/^ *\([0-9]*\) .*/\1/')
    reason=$(echo "$line" | sed 's/^ *[0-9]* \(.*\)/\1/')
    percentage=$(echo "scale=1; $count*100/$TOTAL_DISCARDED" | bc)
    
    # Colorir com base na frequência
    if [ "$percentage" -ge 50 ]; then
        color_code="${RED}"
    elif [ "$percentage" -ge 30 ]; then
        color_code="${YELLOW}"
    else
        color_code="${GREEN}"
    fi
    
    printf "  ${color_code}%-30s${RESET} %3d leads (%5.1f%%)\n" "$reason" $count $percentage
done

progress_bar 4
echo

# Verificar discrepâncias
print_header "ETAPA 5/6: VALIDANDO CONTAGENS"
show_progress "Verificando discrepâncias nas contagens..."
echo -e "\n## 5. VALIDAÇÃO DE CONTAGEM\n" >> "$OUTPUT_FILE"

# Obter contagem de descartes do campaign-analytics.txt - método melhorado
# Primeiro, vamos encontrar a seção exata do anúncio
ANUNCIO_SECTION=$(grep -A 50 -B 10 "\"$ANUNCIO\"" "$CAMPAIGN_FILE")
# Agora, buscamos discarded_leads nesta seção
CAMPAIGN_DISCARDED=$(echo "$ANUNCIO_SECTION" | grep -o '"discarded_leads": [0-9]*' | head -n 1 | grep -o '[0-9]*')
CAMPAIGN_DISCARD_RATE=$(echo "$ANUNCIO_SECTION" | grep -o '"discard_rate": [0-9.]*' | head -n 1 | grep -o '[0-9.]*')

# Se ainda não encontrou, tente uma abordagem alternativa
if [ -z "$CAMPAIGN_DISCARDED" ]; then
    show_warning "Usando método alternativo para encontrar discarded_leads..."
    echo "Usando método alternativo para encontrar discarded_leads..." >> "$OUTPUT_FILE"
    # Extrair trecho maior do arquivo e buscar a seção relevante
    CAMPAIGN_DISCARDED=$(grep -A 50 -B 50 "$ANUNCIO" "$CAMPAIGN_FILE" | grep -o '"discarded_leads": [0-9]*' | head -n 1 | grep -o '[0-9]*')
    CAMPAIGN_DISCARD_RATE=$(grep -A 50 -B 50 "$ANUNCIO" "$CAMPAIGN_FILE" | grep -o '"discard_rate": [0-9.]*' | head -n 1 | grep -o '[0-9.]*')
fi

# Certifique-se de que apenas o primeiro número foi extraído (sem quebras de linha)
CAMPAIGN_DISCARDED=$(echo "$CAMPAIGN_DISCARDED" | head -n 1)
CAMPAIGN_DISCARD_RATE=$(echo "$CAMPAIGN_DISCARD_RATE" | head -n 1)

echo "Contagem no campaign-analytics.txt: ${CAMPAIGN_DISCARDED:-'Não encontrado'} leads descartados (Taxa: ${CAMPAIGN_DISCARD_RATE:-'Não encontrada'}%)" >> "$OUTPUT_FILE"
echo "Contagem no leadByPhone.txt: $TOTAL_DISCARDED telefones com status LEAD DESCARTADO" >> "$OUTPUT_FILE"

# Exibir comparação no console
echo
echo -e "${BLUE}Comparação de contagens:${RESET}"
echo -e "  ${CYAN}campaign-analytics.txt:${RESET} ${BOLD}${CAMPAIGN_DISCARDED:-'?'}${RESET} leads descartados (${CAMPAIGN_DISCARD_RATE:-'?'}%)"
echo -e "  ${CYAN}leadByPhone.txt:${RESET} ${BOLD}${TOTAL_DISCARDED}${RESET} telefones com LEAD DESCARTADO"

# Verificar se as variáveis não estão vazias antes de comparar
if [ -n "$CAMPAIGN_DISCARDED" ] && [ -n "$TOTAL_DISCARDED" ]; then
    # Remover qualquer caractere não-numérico do valor de CAMPAIGN_DISCARDED
    CAMPAIGN_DISCARDED_CLEAN=$(echo "$CAMPAIGN_DISCARDED" | tr -cd '0-9')
    
    if [ "$CAMPAIGN_DISCARDED_CLEAN" -eq "$TOTAL_DISCARDED" ]; then
        echo -e "\nConclusão: As contagens CORRESPONDEM! ✅" >> "$OUTPUT_FILE"
        show_success "As contagens ${BOLD}CORRESPONDEM!${RESET} ✅"
    else
        echo -e "\nConclusão: As contagens são DIFERENTES! ⚠️" >> "$OUTPUT_FILE"
        echo "EXPLICAÇÃO POSSÍVEL:" >> "$OUTPUT_FILE"
        echo "- As contagens podem diferir porque a função getCampaignAnalytics conta por lead_id, não por telefone" >> "$OUTPUT_FILE"
        echo "- Um telefone pode ter múltiplos lead_ids associados, resultando em mais descartes" >> "$OUTPUT_FILE"
        echo "- Um telefone pode estar associado a múltiplos anúncios, o que pode afetar a contagem" >> "$OUTPUT_FILE"
        
        show_warning "As contagens são ${BOLD}DIFERENTES!${RESET} ⚠️"
        echo "  Explicação possível:"
        echo "  - Contagens por lead_id vs. telefone"
        echo "  - Múltiplos lead_ids por telefone"
        echo "  - Telefones associados a múltiplos anúncios"
    fi
else
    echo -e "\nConclusão: Não foi possível comparar as contagens ⚠️" >> "$OUTPUT_FILE"
    echo "EXPLICAÇÃO POSSÍVEL:" >> "$OUTPUT_FILE"
    echo "- Não foi possível encontrar o valor de 'discarded_leads' no arquivo campaign-analytics.txt" >> "$OUTPUT_FILE"
    echo "- O anúncio pode estar em um formato diferente ou não existir no arquivo" >> "$OUTPUT_FILE"
    echo "- Valores encontrados: campaign_discarded='$CAMPAIGN_DISCARDED', total_discarded='$TOTAL_DISCARDED'" >> "$OUTPUT_FILE"
    
    show_error "Não foi possível comparar as contagens! ⚠️"
    echo "  Possível problema com formato dos dados."
fi

progress_bar 5
echo

# Conclusão
print_header "ETAPA 6/6: FINALIZANDO ANÁLISE"
show_progress "Gerando conclusão da análise..."
echo -e "\n## 6. CONCLUSÃO\n" >> "$OUTPUT_FILE"
echo "A análise do anúncio \"$ANUNCIO\" mostra que:" >> "$OUTPUT_FILE"
echo "- Foram encontrados $TOTAL_DISCARDED telefones com status LEAD DESCARTADO associados a este anúncio" >> "$OUTPUT_FILE"
echo "- Os principais motivos de descarte são:" >> "$OUTPUT_FILE"
echo "$MOTIVOS" | sed 's/^ *\([0-9]*\) \(.*\)/- \2: \1 ocorrências/' >> "$OUTPUT_FILE"
echo -e "\nEsta análise foi gerada automaticamente em $(date)" >> "$OUTPUT_FILE"

# Limpar arquivos temporários
rm /tmp/phones.txt

progress_bar 6
echo
echo

# Exibir mensagem final
echo -e "${BG_GREEN}${BOLD}                      ANÁLISE CONCLUÍDA!                      ${RESET}"
echo
show_success "Resultados completos salvos em: ${CYAN}$OUTPUT_FILE${RESET}"
echo
echo -e "Para visualizar o relatório, execute: ${BOLD}cat \"$OUTPUT_FILE\"${RESET}"
echo -e "Ou abra o arquivo em um editor Markdown para melhor visualização."
echo 