export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Apenas POST' });

    const { personalData, amountBase, extras, utms } = req.body;
    
    // ID APENAS COM NÚMEROS (Sem o VAK-)
    const orderId = `${Date.now()}`; 

    let totalCents = Math.round(parseFloat(amountBase.replace('.', '').replace(',', '.')) * 100);
    if (extras.luck) totalCents += 1099;
    if (extras.heart) totalCents += 2490;
    if (extras.cause) totalCents += 5890;

    try {
        const authAxis = Buffer.from(`${process.env.AXIS_API_KEY}:`).toString('base64');

        const axisRes = await fetch('https://api.axisbanking.com.br/transactions/v2/purchase', {
            method: 'POST',
            headers: { 
                'Authorization': `Basic ${authAxis}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: personalData.nome || "Doador",
                email: personalData.email || "doador@email.com",
                cpf: personalData.cpf.replace(/\D/g, ''),
                amount: totalCents,
                paymentMethod: "PIX",
                external_id: orderId // Aqui ele enviará apenas os números
            })
        });

        const pixData = await axisRes.json();

        // RESPOSTA PARA O SITE
        return res.status(200).json({
            success: true,
            qrcode: pixData.pix_qrcode || pixData.qrcode_url,
            copyPaste: pixData.pix_copy_and_paste || pixData.copy_paste,
            axisId: pixData.id,
            orderId: orderId, // Retorna o ID numérico para a tela
            totalAmount: totalCents
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: "Erro interno" });
    }
}