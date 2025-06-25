# 📈 TradeBot - EMA + RSI Based Telegram Signal Bot

TradeBot is a real-time cryptocurrency trading signal generator built with Node.js.  
It uses **Binance WebSocket API** to monitor live BTC/USDT price updates and applies **EMA crossover + RSI** strategy to detect potential **buy (📈)** or **sell (📉)** signals. When conditions match, it sends alerts directly to your **Telegram** via a bot.

---

## 🚀 Features

- Live price tracking from Binance via WebSocket
- Technical analysis using:
  - EMA (10, 21 periods)
  - RSI (14 period)
- Smart signal filtering:
  - Cooldown between alerts
  - Threshold control to avoid noise
- Telegram alert integration via Bot API
- Easy to configure with `.env`

---

## ⚙️ Requirements

- Node.js >= 14
- Telegram Bot Token & Chat ID
- Binance WebSocket (no API key needed)

---

## 📦 Installation

```bash
git clone https://github.com/YOUR_USERNAME/tradebot.git
cd tradebot
npm install
```

---

## 🧪 Setup

1. Create a `.env` file in the root:
```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_user_chat_id
```

2. Run the bot:
```bash
npm start
```

---

## 🔔 Example Alert

```
📈 BUY signal!
Price: 107845.22
EMA10: 107800.12 | EMA21: 107780.33
RSI: 52.6
```

---

## 🛡 Disclaimer

This bot does **not place real trades**. It only provides signals based on indicator conditions.  
Use at your own risk — this is for educational and experimental purposes.

---

## 🧠 Future Improvements

- Multi-pair support (ETH/USDT, SOL/USDT, etc.)
- Backtesting engine
- Web dashboard or mobile app