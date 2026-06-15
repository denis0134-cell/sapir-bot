const axios = require('axios');

async function sendMessage(to, text) {
  try {
    await axios.post(
      'https://waba.360dialog.io/v1/messages',
      { to, type: 'text', text: { body: text } },
      {
        headers: {
          'D360-API-KEY': process.env.DIALOG360_API_KEY,
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
