export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Apenas POST' });

    try {
        const { personalData, amountBase, extras } = req.body;
        const pData = personalData || {};
        const orderId = `${Date.now()}`; 

        let amountStr = (amountBase || "30,00").replace('.', '').replace(',', '.');
        let totalCents = Math.round(parseFloat(amountStr) * 100);
        
        const ext = extras || {};
        if (ext.luck) totalCents += 1099;
        if (ext.heart) totalCents += 2490;
        if (ext.cause) totalCents += 5890;

        const apiKey = process.env.AXIS_API_KEY; // 0b006782-a736-42e6-8945-e89816e7d4de

        // CHAMADA COM FORMATO DE CHAVE DIRETA (Sem Basic, sem Base64)
        const axisRes = await fetch('https://api.axisbanking.com.br/transactions/v2/purchase', {
            method: 'POST',
            headers: { 
                'Authorization': apiKey,        // Algumas versões usam a chave pura
                'x-api-key': apiKey,            // Outras usam este header
                'api-key': apiKey,              // E outras este
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
            console.error("FALHA CRÍTICA AXIS:", pixData);
            return res.status(401).json({ 
                success: false, 
                message: "A Axis recusou a conexão. Chave ou Permissão inválida.",
                details: pixData 
            });
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