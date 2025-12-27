export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Apenas POST' });

    const { personalData, amountBase, extras, utms } = req.body;
    const orderId = `${Date.now()}`; 

    let totalCents = Math.round(parseFloat(amountBase.replace('.', '').replace(',', '.')) * 100);
    if (extras.luck) totalCents += 1099;
    if (extras.heart) totalCents += 2490;
    if (extras.cause) totalCents += 5890;

    // Pega a chave e garante que ela existe
    const apiKey = process.env.AXIS_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ success: false, error: "Chave AXIS_API_KEY não configurada na Vercel" });
    }

    try {
        // Criando a autenticação sem usar crases para evitar erro de digitação
        const authAxis = Buffer.from(apiKey + ":").toString('base64');

        const axisRes = await fetch('https://api.axisbanking.com.br/transactions/v2/purchase', {
            method: 'POST',
            headers: { 
                'Authorization': 'Basic ' + authAxis,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: personalData.nome || "Doador",
                email: personalData.email || "doador@email.com",
                cpf: personalData.cpf.replace(/\D/g, ''),
                amount: totalCents,
                paymentMethod: "PIX",
                external_id: orderId 
            })
        });

        const pixData = await axisRes.json();

        // Se a Axis retornar erro, o status não será 200
        if (!axisRes.ok) {
            return res.status(axisRes.status).json({ success: false, error: "Erro na Axis", details: pixData });
        }

        return res.status(200).json({
            success: true,
            qrcode: pixData.pix_qrcode || pixData.qrcode_url,
            copyPaste: pixData.pix_copy_and_paste || pixData.copy_paste,
            orderId: orderId,
            totalAmount: totalCents
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: "Erro interno: " + error.message });
    }
}