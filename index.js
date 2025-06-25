const WebSocket = require('ws');
const { EMA, RSI } = require('technicalindicators');
const { sendTelegramMessage } = require('./notify');
require('dotenv').config();

let lastRefPrice = null;
let lastSignalTime = 0;
const priceHistory = [];

const cooldownMS = 0.1 * 60 * 1000; // 30 saniye cooldown
const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1m');

ws.on('open', () => {
  console.log("📡 Binance WebSocket bağlantısı kuruldu.");
});

ws.on('message', (data) => {
  const parsed = JSON.parse(data);
  const candle = parsed.k;

  // Sadece mum kapanışında işlem yap
  if (!candle.x) return;

  const price = parseFloat(candle.c);
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

  if (now - lastSignalTime < cooldownMS) return;

  // AL sinyali
  if (
    currentEMA10 > currentEMA21 &&
    currentRSI > 40 && currentRSI < 70 &&
    price > lastRefPrice * 1.003 &&
    emaDiff > 1
  ) {
    sendTelegramMessage(
      `📈 AL sinyali!\nFiyat: ${price}\nEMA10: ${currentEMA10.toFixed(2)} | EMA21: ${currentEMA21.toFixed(2)}\nRSI: ${currentRSI.toFixed(1)}`
    );
    lastSignalTime = now;
    console.log('✅ AL sinyali gönderildi');
  }

  // SAT sinyali
  else if (
    (currentEMA10 < currentEMA21 ||
      currentRSI > 75 ||
      price < lastRefPrice * 0.995) &&
    emaDiff > 1
  ) {
    sendTelegramMessage(
      `📉 SAT sinyali!\nFiyat: ${price}\nEMA10: ${currentEMA10.toFixed(2)} | EMA21: ${currentEMA21.toFixed(2)}\nRSI: ${currentRSI.toFixed(1)}`
    );
    lastRefPrice = price;  // SAT'ta referans fiyat güncelleniyor
    lastSignalTime = now;
    console.log('✅ SAT sinyali gönderildi');
  }

  console.log(
    `📊 Fiyat: ${price} | EMA10: ${currentEMA10.toFixed(2)} | EMA21: ${currentEMA21.toFixed(2)} | RSI: ${currentRSI.toFixed(1)}`
  );
});
