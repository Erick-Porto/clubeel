import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import API_CONSUME from "@/services/api-consume";
import MercadoPagoConfig, { Payment } from "mercadopago";

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { payment_id, status } = req.query;
    
    const session = await getServerSession(req, res, authOptions);

    if (!session || !session.accessToken)
        return res.redirect("/login?error=session_expired");
    

    if (status !== 'approved') 
         return res.redirect("/checkout?status=error_payment_status");
    

    try {
        const paymentClient = new Payment(client);
        const paymentData = await paymentClient.get({ id: String(payment_id) });

        if (paymentData.status !== 'approved') {
             console.error("Tentativa de validação falhou: Pagamento não aprovado na API.");
             return res.redirect("/checkout?status=failure");
        }
        
        const metadataSchedules = paymentData.metadata?.schedules;
        
        if (!metadataSchedules) {
            console.error("Metadados de agendamento não encontrados no pagamento.");
            return res.redirect("/checkout?status=failure");
        }

        const scheduleIdsToUpdate = String(metadataSchedules).split(',').map(id => Number(id));

        console.log(`✅ Pagamento ${payment_id} confirmado. Valor: ${paymentData.transaction_amount} | Data: ${paymentData.date_approved}`);

        const headers = {
            'Session': session.accessToken as string
        };

        const updatePayload = {
            id: scheduleIdsToUpdate,
            status_id: 1, // Pago
            payment_integration_id: String(payment_id), 
            payment_method: paymentData.payment_method_id,
            paid_amount: paymentData.transaction_amount,
            paid_at: paymentData.date_approved
        };

        await API_CONSUME("POST", `payments`, headers, updatePayload);

        scheduleIdsToUpdate.map(async (id) =>{    
            await API_CONSUME("PUT", `schedule/update-status`, headers, {
                id: id,
                status_id: 1,
            });
        });

        return res.redirect("/checkout?status=success");

    } catch (error) {
        console.error("❌ Erro no processamento do sucesso:", error);
        return res.redirect("/checkout?status=error_processing");
    }
}