const crypto = require('crypto');

function sortObjectKeys(obj) {
    if (obj === null || typeof obj !== 'object' || obj instanceof Date) return obj;
    if (Array.isArray(obj)) return obj.map((item) => sortObjectKeys(item));
    const sortedObj = {};
    Object.keys(obj).sort().forEach((key) => { sortedObj[key] = sortObjectKeys(obj[key]); });
    return sortedObj;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Apenas POST');

    const signature = req.headers['x-signature'];
    const secret = process.env.AXIS_WEBHOOK_SECRET;

    const sortedPayload = sortObjectKeys(req.body);
    const calculatedSignature = crypto.createHmac("sha256", secret).update(JSON.stringify(sortedPayload)).digest("hex");

    if (calculatedSignature !== signature) return res.status(401).json({ error: 'Invalid signature' });

    const { event, payload } = req.body;

    if (event === 'cashin.paid') {
        try {
            // USANDO FETCH NO LUGAR DE AXIS
            await fetch('https://api.utmify.com.br/api-credentials/orders', {
                method: 'POST',
                headers: { 
                    'x-api-token': process.env.UTMIFY_TOKEN,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    orderId: payload.external_id,
                    status: 'paid',
                    paymentMethod: 'pix',
                    customer: { document: payload.payer.document.replace(/\D/g, '') }
                })
            });
        } catch (e) {
            console.error("Erro Utmify Webhook:", e);
        }
    }

    return res.status(200).send('OK');
}