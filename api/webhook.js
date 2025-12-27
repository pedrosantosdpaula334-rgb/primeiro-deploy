const crypto = require('crypto');
const axios = require('axios');

// Função auxiliar da documentação da Axis para validar a segurança
function sortObjectKeys(obj) {
    if (obj === null || typeof obj !== 'object' || obj instanceof Date) {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map((item) => sortObjectKeys(item));
    }
    const sortedObj = {};
    Object.keys(obj).sort().forEach((key) => {
        sortedObj[key] = sortObjectKeys(obj[key]);
    });
    return sortedObj;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const signature = req.headers['x-signature'];
    const secret = process.env.AXIS_WEBHOOK_SECRET; // Chave de assinatura da Axis

    // 1. Validar a assinatura (Segurança Obrigatória)
    const sortedPayload = sortObjectKeys(req.body);
    const payloadString = JSON.stringify(sortedPayload);
    const calculatedSignature = crypto
        .createHmac("sha256", secret)
        .update(payloadString)
        .digest("hex");

    if (calculatedSignature !== signature) {
        console.error("Assinatura inválida detectada!");
        return res.status(401).json({ error: 'Invalid signature' });
    }

    // 2. Processar o evento (Considerando Webhook V2 da Axis)
    const { event, payload } = req.body;

    // Se o evento for de pagamento de Pix aprovado
    if (event === 'cashin.paid') {
        try {
            const orderId = payload.external_id; // O ID que você gerou na criação
            const approvedDate = new Date().toISOString().replace('T', ' ').split('.')[0];

            // 3. Avisar a Utmify que o Pix foi PAGO
            await axios.post('https://api.utmify.com.br/api-credentials/orders', {
                orderId: orderId,
                status: 'paid', // Status exigido pela Utmify pág 9
                approvedDate: approvedDate,
                paymentMethod: 'pix',
                platform: "Vercel_Axis",
                customer: {
                    document: payload.payer.document.replace(/\D/g, ''),
                    email: payload.payer.email || "" // E-mail se disponível
                },
                commission: {
                    totalPriceInCents: payload.amount,
                    gatewayFeeInCents: 0,
                    userCommissionInCents: payload.amount
                }
            }, {
                headers: { 'x-api-token': process.env.UTMIFY_TOKEN }
            });

            console.log(`Pedido ${orderId} atualizado para PAGO na Utmify.`);
            
        } catch (error) {
            console.error("Erro ao enviar para Utmify:", error.response?.data || error.message);
            // Retornamos 200 mesmo com erro na Utmify para a Axis não ficar tentando reenviar
        }
    }

    // Responde 200 para a Axis saber que você recebeu o aviso
    return res.status(200).send('OK');
}