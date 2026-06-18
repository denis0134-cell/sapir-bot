const axios = require('axios');

const BASE = 'https://graph.facebook.com/v18.0';

// Normalize phone: 05X → 9725X, strip spaces/dashes
function normalizePhone(phone) {
  if (!phone) return phone;
  const digits = String(phone).replace(/[^0-9]/g, '');
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  if (digits.length === 9) return '972' + digits; // 5XXXXXXXX
  return digits;
}

async function sendMessage(to, text) {
  const normalized = normalizePhone(to);
  try {
    await axios.post(
      `${BASE}/${process.env.META_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: normalized,
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
    console.log(`[WhatsApp] Sent to ${normalized}: ${text.substring(0,40)}`);
  } catch (err) {
    const detail = err?.response?.data?.error?.message || err.message;
    console.error('[WhatsApp] SEND ERROR to', normalized, ':', detail);
    throw new Error(detail || 'WhatsApp send failed');
  }
}

async function notifyDenis(message) {
  return sendMessage(process.env.DENIS_PHONE, message);
}

module.exports = { sendMessage, notifyDenis, normalizePhone };
