FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Criar diretório para dados persistentes
RUN mkdir -p /app/data && chmod 777 /app/data

# Expor a porta do aplicativo
EXPOSE 5000

# Executar usando Gunicorn para produção
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"] 