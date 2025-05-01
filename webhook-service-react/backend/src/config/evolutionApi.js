/**
 * Configurações da Evolution API
 */

// Obter variáveis de ambiente
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://evolution_api:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '123456';
const EVOLUTION_API_INSTANCE = process.env.EVOLUTION_API_INSTANCE || 'Teste';

module.exports = {
    EVOLUTION_API_URL,
    EVOLUTION_API_KEY,
    EVOLUTION_API_INSTANCE
}; 