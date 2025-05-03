require('dotenv').config();

// Altere esta URL quando iniciar um novo túnel ngrok
const NGROK_URL = process.env.NGROK_URL || 'https://613c-2804-d55-44a7-2800-2188-bf2f-333-7ca1.ngrok-free.app';

module.exports = {
  NGROK_URL,
  KOMMO_CLIENT_ID: process.env.KOMMO_CLIENT_ID || 'cc3d1fc9-71d6-478c-bf9b-ef6fa002080d',
  KOMMO_CLIENT_SECRET: process.env.KOMMO_CLIENT_SECRET || 'hdhCMay0IaUMgiq3MYhGADbRlpeFvfWwbllUzqA7YQOXGzDKgMWnXXwDzpppE6As',
  KOMMO_REDIRECT_URI: process.env.KOMMO_REDIRECT_URI || `${NGROK_URL}/kommo/callback`,
  MAKE_WEBHOOK_URL: process.env.MAKE_WEBHOOK_URL || 'https://hook.us2.make.com/cig25e7rx3x5xdf85vlyx35xx8xa931j',
  FB_ACCESS_TOKEN: process.env.FB_ACCESS_TOKEN
}; 