import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import API_CONSUME from "@/services/api-consume";
import MercadoPagoConfig, { Payment } from "mercadopago";
import { toast } from "react-toastify";

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { payment_id, status } = req.query;
    
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.accessToken) {
        return res.redirect("/login?error=session_expired");
    }

    if (status && status !== 'approved') {
        return res.redirect("/checkout?status=success");
    }

    try {
        const paymentClient = new Payment(client);
        const paymentData = await paymentClient.get({ id: String(payment_id) });

        if (paymentData.status !== 'approved') return res.redirect("/checkout?status=failure");
        
        const metadataSchedules = paymentData.metadata?.schedules;
        if (!metadataSchedules) return res.redirect("/checkout?status=failure");

        const scheduleIdsToUpdate: number[] = String(metadataSchedules)
            .split(',')
            .map(id => Number(id.trim()))
            .filter(id => !isNaN(id));

        const updatePayload = {
            schedule_ids: scheduleIdsToUpdate,
            status_id: 1,
            payment_integration_id: String(payment_id), 
            payment_method: paymentData.payment_method_id,
            paid_amount: paymentData.transaction_amount,
            paid_at: paymentData.date_approved
        };

        const response = await API_CONSUME("POST", `schedule/payment`, {}, updatePayload);
        
        if (response.status === 409) {
            await fetch(`https://api.mercadopago.com/v1/payments/${String(payment_id)}/refunds`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Idempotency-Key": `refund-${payment_id}-${new Date().getTime()}`,
                    "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}`
                }
            });

            return res.redirect("/checkout?status=expired");
        }

        if (!response.ok) {
            toast.error("❌ Erro ao salvar confirmação no banco: " + (response.message || response.data));
            return res.redirect("/checkout?status=failure");
        }

        return res.redirect("/checkout?status=success");

    } catch (error) {
        toast.error("❌ Erro não tratado no processamento do sucesso: " + (error instanceof Error ? error.message : String(error)));
        return res.redirect("/checkout?status=failure");
    }
}