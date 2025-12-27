export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Apenas POST' });

    const { personalData, amountBase, extras, utms } = req.body;
    const orderId = `VAK-${Date.now()}`;

    // Valor em centavos
    let totalCents = Math.round(parseFloat(amountBase.replace('.', '').replace(',', '.')) * 100);
    if (extras.luck) totalCents += 1099;
    if (extras.heart) totalCents += 2490;
    if (extras.cause) totalCents += 5890;

    try {
        const authAxis = Buffer.from(`${process.env.AXIS_API_KEY}:`).toString('base64');

        // 1. GERAR PIX NA AXIS (Usando Fetch nativo)
        const axisRes = await fetch('https://api.axisbanking.com.br/transactions/v2/purchase', {
            method: 'POST',
            headers: { 
                'Authorization': `Basic ${authAxis}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: personalData.nome,
                email: personalData.email,
                cpf: personalData.cpf.replace(/\D/g, ''),
                amount: totalCents,
                paymentMethod: "PIX",
                externalId: orderId
            })
        });

        const pixData = await axisRes.json();

        // 2. ENVIAR PARA UTMIFY
        await fetch('https://api.utmify.com.br/api-credentials/orders', {
            method: 'POST',
            headers: { 
                'x-api-token': process.env.UTMIFY_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                orderId: orderId,
                status: 'waiting_payment',
                customer: {
                    name: personalData.nome,
                    email: personalData.email,
                    phone: personalData.whatsapp.replace(/\D/g, ''),
                    document: personalData.cpf.replace(/\D/g, '')
                },
                products: [{ id: "doacao", name: "Doacao Angola", quantity: 1, priceInCents: totalCents }],
                trackingParameters: utms || {}
            })
        });

        res.status(200).json({
            success: true,
            qrcode: pixData.pix_qrcode,
            copyPaste: pixData.pix_copy_and_paste,
            orderId: orderId,
            totalAmount: totalCents
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro interno' });
    }
}