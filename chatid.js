const axios = require('axios');

const BOT_TOKEN = '8192725820:AAESx_RYTCO67zBvoL2GsdN-Ck1YqD2dUCA';

axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`)
  .then(res => {
    const updates = res.data.result;

    updates.forEach(update => {
      if (update.message) {
        const chat = update.message.chat;
        console.log(`👤 Kullanıcı: ${chat.first_name || chat.title}`);
        console.log(`🆔 Chat ID: ${chat.id}`);
        console.log('---');
      }
    });
  })
  .catch(err => {
    console.error('Hata:', err.response?.data || err.message);
  });
