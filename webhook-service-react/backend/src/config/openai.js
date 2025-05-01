/**
 * Configurações da OpenAI
 */

// Obter variáveis de ambiente
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY não está definida nas variáveis de ambiente');
}

module.exports = {
    OPENAI_API_KEY,
    OPENAI_MODEL
}; 