export default async function handler(req, res) {
    // Garante que é um POST
    if (req.method !== 'POST') return res.status(405).json({ error: 'Apenas POST' });

    try {
        const { personalData, amountBase, extras, utms } = req.body;
        
        // Proteção contra dados nulos
        const pData = personalData || {};
        const pNome = pData.nome || "Doador";
        const pEmail = pData.email || "doador@email.com";
        const pCpf = (pData.cpf || "00000000000").replace(/\D/g, '');
        const pZap = (pData.whatsapp || "").replace(/\D/g, '');

        // ID numérico
        const orderId = `${Date.now()}`; 

        // Tratamento do valor
        let amountStr = (amountBase || "0,00").replace('.', '').replace(',', '.');
        let totalCents = Math.round(parseFloat(amountStr) * 100);
        
        // Soma extras
        const ext = extras || {};
        if (ext.luck) totalCents += 1099;
        if (ext.heart) totalCents += 2490;
        if (ext.cause) totalCents += 5890;

        const apiKey = process.env.AXIS_API_KEY;
        if (!apiKey) {
            console.error("ERRO: AXIS_API_KEY não encontrada nas variáveis da Vercel");
            return res.status(500).json({ error: "Configuração ausente na Vercel" });
        }

        const authAxis = Buffer.from(apiKey + ":").toString('base64');

        // CHAMADA AXIS
        const axisRes = await fetch('https://api.axisbanking.com.br/transactions/v2/purchase', {
            method: 'POST',
            headers: { 
                'Authorization': 'Basic ' + authAxis,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: pNome,
                email: pEmail,
                cpf: pCpf,
                amount: totalCents,
                paymentMethod: "PIX",
                external_id: orderId 
            })
        });

        const pixData = await axisRes.json();
        console.log("Resposta da Axis:", pixData);

        if (!axisRes.ok) {
            return res.status(400).json({ success: false, message: "Banco recusou", details: pixData });
        }

        return res.status(200).json({
            success: true,
            qrcode: pixData.pix_qrcode || pixData.qrcode_url,
            copyPaste: pixData.pix_copy_and_paste || pixData.copy_paste,
            orderId: orderId,
            totalAmount: totalCents
        });

    } catch (error) {
        console.error("CRASH NO CODIGO:", error.message);
        return res.status(500).json({ success: false, error: "Erro interno", msg: error.message });
    }
}