require('dotenv').config();

// URL usando nip.io para mapear o IP
const BASE_URL = 'http://15.229.11.54.nip.io:5002';

module.exports = {
  KOMMO_CLIENT_ID: 'cc3d1fc9-71d6-478c-bf9b-ef6fa002080d',
  KOMMO_CLIENT_SECRET: 'hdhCMay0IaUMgiq3MYhGADbRlpeFvfWwbllUzqA7YQOXGzDKgMWnXXwDzpppE6As',
  KOMMO_REDIRECT_URI: `${BASE_URL}/kommo/callback`,
  NGROK_URL: BASE_URL,
  MAKE_WEBHOOK_URL: process.env.MAKE_WEBHOOK_URL || 'https://hook.us2.make.com/cig25e7rx3x5xdf85vlyx35xx8xa931j',
  FB_ACCESS_TOKEN: process.env.FB_ACCESS_TOKEN
}; 