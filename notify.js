// notify.js
// Telegram'a mesaj göndermek için fonksiyon
const axios = require('axios');
require('dotenv').config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
/**
 * Telegram'a mesaj gönderir
 * @param {string} text - Gönderilecek mesaj
 */
async function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Telegram bot token veya chat ID eksik!');
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: text
    });
  } catch (error) {
    console.error('Telegram mesajı gönderilemedi:', error.response ? error.response.data : error.message);
  }
}

module.exports = { sendTelegramMessage }; 