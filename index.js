const WebSocket = require('ws');
const { EMA, RSI } = require('technicalindicators');
const { sendTelegramMessage } = require('./notify');
require('dotenv').config();

// Başlangıç referans fiyat ve fiyat geçmişi
let lastRefPrice = null;
let lastSignalTime = 0;
const priceHistory = [];

const cooldownMS = 1 * 60 * 1000; // 1 dakika
const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');

ws.on('open', () => {
  console.log("📡 Binance WebSocket bağlantısı kuruldu.");
});

ws.on('message', (data) => {
  const parsed = JSON.parse(data);
  const price = parseFloat(parsed.c);
  if (isNaN(price)) return;

  priceHistory.push(price);
  if (priceHistory.length > 100) priceHistory.shift();

  if (!lastRefPrice) {
    lastRefPrice = price;
    console.log("🚀 Başlangıç fiyatı:", price);
    return;
  }

  if (priceHistory.length < 21) return;

  const ema10 = EMA.calculate({ period: 10, values: priceHistory });
  const ema21 = EMA.calculate({ period: 21, values: priceHistory });
  const rsi = RSI.calculate({ period: 14, values: priceHistory });

  const currentEMA10 = ema10.at(-1);
  const currentEMA21 = ema21.at(-1);
  const currentRSI = rsi.at(-1);
  const now = Date.now();

  if (!currentEMA10 || !currentEMA21 || !currentRSI) return;
  const emaDiff = Math.abs(currentEMA10 - currentEMA21);

  // Sadece cooldown süresi dolduysa sinyal gönder
  let signalSent = false;

  // AL sinyali
  if (
    currentEMA10 > currentEMA21 &&
    currentRSI < 65 &&
    price > lastRefPrice * 1.01 &&
    emaDiff > 2
  ) {
    if (now - lastSignalTime >= cooldownMS) {
      sendTelegramMessage(
        `📈 AL sinyali!\nFiyat: ${price}\nEMA10: ${currentEMA10.toFixed(2)} | EMA21: ${currentEMA21.toFixed(2)}\nRSI: ${currentRSI.toFixed(1)}`
      );
      lastRefPrice = price;
      lastSignalTime = now;
      signalSent = true;
    }
  }

  // SAT sinyali
  if (
    (currentEMA10 < currentEMA21 ||
      currentRSI > 75 ||
      price < lastRefPrice * 0.95) &&
    emaDiff > 10
  ) {
    if (now - lastSignalTime >= cooldownMS) {
      sendTelegramMessage(
        `📉 SAT sinyali!\nFiyat: ${price}\nEMA10: ${currentEMA10.toFixed(2)} | EMA21: ${currentEMA21.toFixed(2)}\nRSI: ${currentRSI.toFixed(1)}`
      );
      lastRefPrice = price;
      lastSignalTime = now;
      signalSent = true;
    }
  }

  if (!signalSent) {
    // console.log('Cooldown aktif veya sinyal koşulları sağlanmadı.');
  }

  console.log(
    `📊 Fiyat: ${price} | EMA10: ${currentEMA10.toFixed(2)} | EMA21: ${currentEMA21.toFixed(2)} | RSI: ${currentRSI.toFixed(1)}`
  );
});
