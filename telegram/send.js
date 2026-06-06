// telegram/send.js
import axios from "axios";

export async function sendTelegram({
  bot = "",
  symbol = "",
  timeframe = "",
  signalType = "",
  color = "",
  entry = "",
  tp = "",
  sl = ""
}) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`;

  let message = "";
  if (bot) message += `Bot: <b>${bot}</b>\n`;
  if (symbol) message += `<b>${symbol} ${timeframe}</b>\n`;
  if (signalType) message += `Tipus: <b>${signalType}</b>\n`;
  if (color) message += `Color: <b>${color}</b>\n`;
  if (entry) message += `Entrada: <b>${entry}</b>\n`;
  if (tp) message += `TP: <b>${tp}</b>\n`;
  if (sl) message += `SL: <b>${sl}</b>\n`;
  //console.log(message);
  const payload = {
    chat_id: process.env.TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: "HTML"
  };

  try {
    const res = await axios.post(url, payload);
    return res.status === 200;
  } catch (e) {
    console.error("Error enviant Telegram:", e.message);
    return false;
  }
}
