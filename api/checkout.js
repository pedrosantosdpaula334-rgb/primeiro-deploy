export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Apenas POST' });

    try {
        const { personalData, amountBase, extras, utms } = req.body;
        const pData = personalData || {};
        const orderId = `${Date.now()}`; 

        let amountStr = (amountBase || "30,00").replace('.', '').replace(',', '.');
        let totalCents = Math.round(parseFloat(amountStr) * 100);
        
        const ext = extras || {};
        if (ext.luck) totalCents += 1099;
        if (ext.heart) totalCents += 2490;
        if (ext.cause) totalCents += 5890;

        const apiKey = process.env.AXIS_API_KEY;

        // Autenticação oficial Axis Banking (UUID:Vazio convertido para Base64)
        const authBase64 = Buffer.from(apiKey + ":").toString('base64');

        const axisRes = await fetch('https://api.axisbanking.com.br/transactions/v2/purchase', {
            method: 'POST',
            headers: { 
                'Authorization': 'Basic ' + authBase64,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: pData.nome || "Doador",
                email: pData.email || "doador@email.com",
                cpf: (pData.cpf || "").replace(/\D/g, ''),
                amount: totalCents,
                paymentMethod: "PIX",
                external_id: orderId 
            })
        });

        const pixData = await axisRes.json();

        if (!axisRes.ok) {
            console.error("LOG DE ERRO DO BANCO:", pixData);
            return res.status(axisRes.status).json({ success: false, error: "Acesso Negado (401)", msg: pixData.message });
        }

        return res.status(200).json({
            success: true,
            qrcode: pixData.pix_qrcode || pixData.qrcode_url,
            copyPaste: pixData.pix_copy_and_paste || pixData.copy_paste,
            orderId: orderId,
            totalAmount: totalCents
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}