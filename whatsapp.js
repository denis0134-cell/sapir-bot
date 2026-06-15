const axios = require('axios');

const BASE = 'https://graph.facebook.com/v18.0';

async function sendMessage(to, text) {
  try {
    await axios.post(
      `${BASE}/${process.env.META_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    console.error('[WhatsApp] Error:', err?.response?.data || err.message);
  }
}

async function notifyDenis(message) {
  return sendMessage(process.env.DENIS_PHONE, message);
}

module.exports = { sendMessage, notifyDenis };
