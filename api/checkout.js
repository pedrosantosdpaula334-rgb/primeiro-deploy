const axios = require('axios');

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Apenas POST permitido');

    const { personalData, amountBase, extras, utms } = req.body;
    const orderId = `VAK-${Date.now()}`;

    // Cálculo do valor total em centavos
    let totalCents = Math.round(parseFloat(amountBase.replace(',', '.')) * 100);
    
    // Soma os extras (convertendo para centavos)
    if (extras.luck) totalCents += 1099;
    if (extras.heart) totalCents += 2490;
    if (extras.cause) totalCents += 5890;

    try {
        // 1. GERAR PIX NA AXIS BANKING
        const authAxis = Buffer.from(`${process.env.AXIS_API_KEY}:`).toString('base64');
        const axisResponse = await axios.post('https://api.axisbanking.com.br/transactions/v2/purchase', {
            name: personalData.nome,
            email: personalData.email,
            cpf: personalData.cpf.replace(/\D/g, ''),
            amount: totalCents,
            paymentMethod: "PIX",
            externalId: orderId
        }, { 
            headers: { 'Authorization': `Basic ${authAxis}` } 
        });

        const pixData = axisResponse.data;

        // 2. ENVIAR PARA UTMIFY (Aguardando Pagamento)
        await axios.post('https://api.utmify.com.br/api-credentials/orders', {
            orderId: orderId,
            platform: "Vakinha_Axis",
            paymentMethod: 'pix',
            status: 'waiting_payment',
            createdAt: new Date().toISOString().replace('T', ' ').split('.')[0],
            customer: {
                name: personalData.nome,
                email: personalData.email,
                phone: personalData.whatsapp.replace(/\D/g, ''),
                document: personalData.cpf.replace(/\D/g, '')
            },
            products: [{
                id: "produto_digital",
                name: "Mentoria 7K",
                quantity: 1,
                priceInCents: totalCents
            }],
            trackingParameters: utms || {},
            commission: {
                totalPriceInCents: totalCents,
                gatewayFeeInCents: 0,
                userCommissionInCents: totalCents
            }
        }, {
            headers: { 'x-api-token': process.env.UTMIFY_TOKEN }
        });

        // Retorna os dados do Pix para o Frontend
        res.status(200).json({
            success: true,
            qrcode: pixData.pix_qrcode,
            copyPaste: pixData.pix_copy_and_paste,
            orderId: orderId,
            totalAmount: totalCents // <-- ADICIONE ESTA LINHA
        });

    } catch (error) {
        console.error("Erro checkout:", error.response?.data || error.message);
        res.status(500).json({ error: 'Falha ao processar pagamento' });
    }
}