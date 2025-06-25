// notify.js
// Telegram'a birden fazla kullanıcıya mesaj göndermek için fonksiyon
const axios = require('axios');
require('dotenv').config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_IDS = process.env.TELEGRAM_CHAT_IDS
  ? process.env.TELEGRAM_CHAT_IDS.split(',').map(id => id.trim())
  : [];

/**
 * Telegram'a mesaj gönderir
 * @param {string} text - Gönderilecek mesaj
 */
async function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_CHAT_IDS.length === 0) {
    console.error('❌ Telegram bot token veya chat ID(ler) eksik!');
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  for (const chatId of TELEGRAM_CHAT_IDS) {
    try {
      await axios.post(url, {
        chat_id: chatId,
        text: text
      });
    } catch (error) {
      console.error(`❌ Mesaj gönderilemedi (chat_id: ${chatId}):`, error.response?.data || error.message);
    }
  }
}

module.exports = { sendTelegramMessage };
