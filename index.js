const WebSocket = require('ws');
const { EMA, RSI, ATR } = require('technicalindicators'); // ATR ekledik
const { sendTelegramMessage } = require('./notify');
require('dotenv').config();

// --- Yapılandırma Parametreleri ---
const SYMBOL = 'btcusdt';
const TIMEFRAME = '1m';
const WS_URL = `wss://stream.binance.com:9443/ws/${SYMBOL}@kline_${TIMEFRAME}`;

const EMA_SHORT_PERIOD = 10;
const EMA_LONG_PERIOD = 21;
const RSI_PERIOD = 14;
const ATR_PERIOD = 14; // Volatilite için ATR periyodu

// Cooldown süresi: Kısa vadeli trader için sinyal yoğunluğu önemli,
// ancak spam'ı engellemek için minimum bir süre gerekli.
// 15 saniye uygun bir başlangıç noktası olabilir.
const COOLDOWN_MS = 15 * 1000; // 15 saniye

// Sinyal Fİltreleri ve Eşikleri
const RSI_BUY_LOWER = 45; // Aşırı satılmış durumdan çıkış ve momentum başlangıcı
const RSI_BUY_UPPER = 70; // Aşırı alım bölgesine girmeden önce
const RSI_SELL_LOWER = 30; // Aşırı satılmış bölgesine girmeden önce
const RSI_SELL_UPPER = 65; // Aşırı alım durumundan çıkış ve momentum kaybı

// Fiyat değişimi için dinamik eşik (ATR tabanlı)
// Bir önceki referans fiyata göre yüzdesel değişim yerine ATR kullanacağız.
const PRICE_CHANGE_MULTIPLIER_BUY = 0.5; // Fiyat, önceki mum kapanışından 0.5 * ATR kadar artmalı
const PRICE_CHANGE_MULTIPLIER_SELL = 0.5; // Fiyat, önceki mum kapanışından 0.5 * ATR kadar düşmeli

// EMA Farkı için dinamik eşik (ATR tabanlı)
// EMA'ların birbirinden ayrılma derecesi için volatiliteye duyarlı eşik
const EMA_DIFF_MULTIPLIER = 0.05; // EMA farkı, ATR'nin %5'i kadar olmalı (trendin gücü için)

// --- Dahili Değişkenler ---
let lastSignalTime = 0;
let lastBuyPrice = null; // En son AL sinyali fiyatı
let lastSellPrice = null; // En son SAT sinyali fiyatı
let lastTradeType = null; // Son sinyalin tipi: 'BUY' veya 'SELL'

const priceHistory = []; // Kapanış fiyatları
const highHistory = [];   // Yüksek fiyatlar (ATR için)
const lowHistory = [];    // Düşük fiyatlar (ATR için)
const closeHistory = [];  // Kapanış fiyatları (ATR için)

// WebSocket Bağlantısı
const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log(`📡 Binance WebSocket bağlantısı kuruldu: ${SYMBOL}@${TIMEFRAME}`);
});

ws.on('message', (data) => {
  const parsed = JSON.parse(data);
  const candle = parsed.k;

  // Sadece mum kapanışında işlem yap
  if (!candle.x) return;

  const open = parseFloat(candle.o);
  const high = parseFloat(candle.h);
  const low = parseFloat(candle.l);
  const close = parseFloat(candle.c); // Kapanış fiyatı

  if (isNaN(close) || isNaN(high) || isNaN(low) || isNaN(open)) return;

  // Geçmiş verileri güncelle
  priceHistory.push(close);
  highHistory.push(high);
  lowHistory.push(low);
  closeHistory.push(close);

  // Gerekli veri uzunluğunu koru (örneğin 100 mum yeterli, daha azı da olabilir)
  const maxHistoryLength = Math.max(EMA_LONG_PERIOD, RSI_PERIOD, ATR_PERIOD) + 5; // Güvenli bir buffer
  if (priceHistory.length > maxHistoryLength) {
    priceHistory.shift();
    highHistory.shift();
    lowHistory.shift();
    closeHistory.shift();
  }

  // İlk veri toplama aşaması
  if (priceHistory.length < maxHistoryLength) {
    console.log(`⏳ Veri toplanıyor... (${priceHistory.length}/${maxHistoryLength})`);
    return;
  }

  // Göstergeleri hesapla
  const ema10 = EMA.calculate({ period: EMA_SHORT_PERIOD, values: priceHistory });
  const ema21 = EMA.calculate({ period: EMA_LONG_PERIOD, values: priceHistory });
  const rsi = RSI.calculate({ period: RSI_PERIOD, values: priceHistory });
  const atr = ATR.calculate({ high: highHistory, low: lowHistory, close: closeHistory, period: ATR_PERIOD });

  const currentEMA10 = ema10.at(-1);
  const currentEMA21 = ema21.at(-1);
  const currentRSI = rsi.at(-1);
  const currentATR = atr.at(-1);
  const previousClose = closeHistory.at(-2); // Bir önceki mumun kapanış fiyatı

  const now = Date.now();

  // Hesaplamaların geçerli olduğundan emin ol
  if (!currentEMA10 || !currentEMA21 || !currentRSI || !currentATR || !previousClose) {
      console.log("⚠️ Gösterge hesaplamaları tamamlanmadı, bekliyor...");
      return;
  }

  const emaDiff = Math.abs(currentEMA10 - currentEMA21);
  const atrEmaDiffThreshold = currentATR * EMA_DIFF_MULTIPLIER; // EMA farkı eşiği ATR'ye göre dinamikleşti

  // Sinyal cooldown süresi kontrolü
  if (now - lastSignalTime < COOLDOWN_MS) {
      // console.log("⏳ Cooldown aktif.");
      return;
  }

  // --- AL Sinyali Mantığı ---
  // Koşullar:
  // 1. Kısa EMA uzun EMA'nın üzerinde (Bullish crossover)
  // 2. RSI belirli bir aralıkta (momentum ve aşırı alım/satım olmaması)
  // 3. Fiyat bir önceki mum kapanışına göre yeterince yükselmiş (volatiliteye göre teyit)
  // 4. EMA'lar birbirinden yeterince açılmış (trendin gücü)
  if (
    currentEMA10 > currentEMA21 &&
    currentRSI >= RSI_BUY_LOWER && currentRSI <= RSI_BUY_UPPER &&
    close > previousClose + (currentATR * PRICE_CHANGE_MULTIPLIER_BUY) && // Önceki kapanışa göre ATR tabanlı artış
    emaDiff > atrEmaDiffThreshold &&
    lastTradeType !== 'BUY' // Bir AL sinyali zaten verilmişse tekrar vermemek (pozisyon açma mantığı için önemli)
  ) {
    sendTelegramMessage(
      `📈 AL SİNYALİ!\nFiyat: ${close.toFixed(2)}\nEMA10: ${currentEMA10.toFixed(2)} | EMA21: ${currentEMA21.toFixed(2)}\nRSI: ${currentRSI.toFixed(1)}\nATR: ${currentATR.toFixed(2)}`
    );
    lastBuyPrice = close; // AL sinyali verilen fiyatı kaydet
    lastSignalTime = now;
    lastTradeType = 'BUY';
    console.log('✅ AL sinyali gönderildi');
  }

  // --- SAT Sinyali Mantığı ---
  // Koşullar:
  // 1. Kısa EMA uzun EMA'nın altında (Bearish crossover) VEYA
  // 2. RSI aşırı alım bölgesine girmiş VEYA
  // 3. Fiyat, en son AL sinyal fiyatına göre belirli bir oranda düşmüş (stop-loss/kar alma gibi) VEYA
  // 4. Fiyat bir önceki mum kapanışına göre yeterince düşmüş (volatiliteye göre teyit)
  // 5. EMA'lar birbirinden yeterince açılmış (trendin gücü)
  // (Not: Gerçek bir trader, genellikle bir pozisyondayken satış yapar. Burada hem trend dönüşü hem de potansiyel kar al/zarar kes sinyalleri birleşiyor.)
  if (
    lastTradeType === 'BUY' && // Sadece bir AL pozisyonundaysak veya son sinyal AL ise SAT sinyali ara
    (
        currentEMA10 < currentEMA21 || // Bearish crossover
        currentRSI > RSI_SELL_UPPER || // Aşırı alım bölgesinden dönüş işareti
        currentRSI < RSI_SELL_LOWER || // Aşırı satım bölgesine giriş (potansiyel dip, kardan çıkış veya zarar kes)
        (lastBuyPrice && close < lastBuyPrice * 0.995) || // %0.5 Zarar Kes (Örn: Basit Stop Loss)
        close < previousClose - (currentATR * PRICE_CHANGE_MULTIPLIER_SELL) // Önceki kapanışa göre ATR tabanlı düşüş
    ) &&
    emaDiff > atrEmaDiffThreshold &&
    lastTradeType !== 'SELL' // Bir SAT sinyali zaten verilmişse tekrar vermemek
  ) {
    sendTelegramMessage(
      `📉 SAT SİNYALİ!\nFiyat: ${close.toFixed(2)}\nEMA10: ${currentEMA10.toFixed(2)} | EMA21: ${currentEMA21.toFixed(2)}\nRSI: ${currentRSI.toFixed(1)}\nATR: ${currentATR.toFixed(2)}`
    );
    lastSellPrice = close; // SAT sinyali verilen fiyatı kaydet
    lastSignalTime = now;
    lastTradeType = 'SELL';
    console.log('✅ SAT sinyali gönderildi');
  }

  // Konsol çıktısı her mum kapanışında
  console.log(
    `📊 ${new Date().toLocaleTimeString()} | Fiyat: ${close.toFixed(2)} | EMA10: ${currentEMA10.toFixed(2)} | EMA21: ${currentEMA21.toFixed(2)} | RSI: ${currentRSI.toFixed(1)} | ATR: ${currentATR.toFixed(2)} | EMA Diff: ${emaDiff.toFixed(2)} | Eşit: ${atrEmaDiffThreshold.toFixed(2)}`
  );
});

// WebSocket hata yönetimi
ws.on('error', (error) => {
    console.error('❌ WebSocket hatası:', error);
    // Burada otomatik yeniden bağlantı mekanizması eklenebilir.
});

ws.on('close', (code, reason) => {
    console.log(`🔌 WebSocket bağlantısı kapatıldı. Kod: ${code}, Neden: ${reason}`);
    // Bağlantı koparsa yeniden bağlanmayı deneyin
    setTimeout(() => {
        console.log("🔄 WebSocket yeniden bağlanmaya çalışıyor...");
        new WebSocket(WS_URL);
    }, 5000); // 5 saniye sonra yeniden deneme
});