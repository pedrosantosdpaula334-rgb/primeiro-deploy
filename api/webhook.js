const crypto = require('crypto');
const axios = require('axios');

// ===== Função exigida pela Axis (ordenação do payload) =====
function sortObjectKeys(obj) {
  if (obj === null || typeof obj !== 'object' || obj instanceof Date) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  const sorted = {};
  Object.keys(obj).sort().forEach(key => {
    sorted[key] = sortObjectKeys(obj[key]);
  });
  return sorted;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const signature = req.headers['x-signature'];
  const secret = process.env.AXIS_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return res.status(401).send('Unauthorized');
  }

  // ===== 1. VALIDAR ASSINATURA =====
  const sortedPayload = sortObjectKeys(req.body);
  const payloadString = JSON.stringify(sortedPayload);

  const calculatedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');

  if (calculatedSignature !== signature) {
    console.error('Webhook Axis: assinatura inválida');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // ===== 2. PROCESSAR EVENTO =====
  const { event, payload } = req.body;

  if (event === 'cashin.paid' && payload?.external_id) {
    const orderId = payload.external_id;
    const approvedDate = new Date()
      .toISOString()
      .replace('T', ' ')
      .split('.')[0];

    try {
      // ===== 3. ATUALIZAR STATUS NA UTMIFY =====
      await axios.post(
        'https://api.utmify.com.br/api-credentials/orders',
        {
          orderId,
          status: 'paid',
          approvedDate,
          paymentMethod: 'pix',
          platform: 'Checkout_Axis',
          customer: {
            document: payload?.payer?.document
              ? payload.payer.document.replace(/\D/g, '')
              : '',
            email: payload?.payer?.email || ''
          },
          commission: {
            totalPriceInCents: payload.amount,
            gatewayFeeInCents: 0,
            userCommissionInCents: payload.amount
          }
        },
        {
          headers: {
            'x-api-token': process.env.UTMIFY_TOKEN
          }
        }
      );

      console.log(`✔ Pedido ${orderId} marcado como PAGO na Utmify`);
    } catch (err) {
      console.error(
        'Erro ao atualizar Utmify:',
        err.response?.data || err.message
      );
      // ⚠️ Retorna 200 mesmo assim (boa prática de webhook)
    }
  }

  // ===== SEMPRE RESPONDER 200 PARA A AXIS =====
  return res.status(200).send('OK');
}
