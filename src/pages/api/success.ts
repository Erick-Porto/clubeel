import type { NextApiRequest, NextApiResponse } from "next";
import API_CONSUME from "@/services/api-consume";

// Definição da interface básica de um agendamento vindo do seu backend
interface Schedule {
    id: number;
    start_schedule: string; // Formato: "YYYY-MM-DD HH:mm:ss"
    status_id: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { payment_id, status, collection_status } = req.query;

    // 1. Validação básica: Se não houver pagamento ou não for aprovado, redireciona para erro
    if (!payment_id || (status !== 'approved' && collection_status !== 'approved')) {
        console.error("❌ Pagamento não aprovado ou ID ausente.");
        return res.redirect("/checkout?status=failure");
    }

    try {
        // =====================================================================
        // PASSO 1: Buscar os agendamentos atrelados a este pagamento no seu Backend
        // =====================================================================
        // Precisamos saber QUAIS horários foram pagos para verificar a data.
        // Assumindo que seu backend tenha uma rota que busca pelo ID do pagamento.
        
        const headers = {
            'Authorization': 'Bearer ' + process.env.NEXT_PUBLIC_LARA_API_TOKEN,
            'Content-Type': 'application/json'
        };

        // Exemplo: GET /payment/{id}/schedules
        const response = await API_CONSUME("GET", `payment/${payment_id}/schedules`, headers);
        
        // Normaliza a resposta (Array de agendamentos)
        let schedules: Schedule[] = [];
        if (Array.isArray(response)) schedules = response;
        else if (response?.data) schedules = response.data;
        else if (response?.schedules) schedules = response.schedules;

        if (schedules.length === 0) {
            console.warn("⚠️ Nenhum agendamento encontrado para este pagamento.");
            // Redireciona para sucesso para não travar o usuário, mas loga o erro
            return res.redirect("/checkout?status=success"); 
        }

        // =====================================================================
        // PASSO 2: Verificar se algum agendamento já expirou (Data Passada)
        // =====================================================================
        const now = new Date();
        
        // Verifica se existe ALGUM item cuja data de início seja menor que AGORA
        const hasExpiredItem = schedules.some((item) => {
            // Converte "2025-11-24 17:00:00" para Date. 
            // O replace substitui espaço por T para garantir compatibilidade do Date()
            const scheduleDate = new Date(item.start_schedule.replace(" ", "T"));
            return scheduleDate < now;
        });

        // =====================================================================
        // PASSO 3: Tomada de Decisão (Confirmar ou Estornar)
        // =====================================================================

        if (hasExpiredItem) {
            console.log("⏳ Agendamento expirado detectado. Iniciando estorno...");

            // A. Dispara o estorno no seu Backend (que deve chamar o MP)
            await API_CONSUME("POST", `payment/${payment_id}/refund`, headers, {
                reason: "Agendamento expirado no momento do pagamento"
            });

            // B. Libera os horários no banco de dados (opcional, se o refund não fizer isso automatico)
            // await API_CONSUME("POST", "schedule/cancel", headers, { payment_id });

            // C. Redireciona o usuário com status de expirado
            return res.redirect("/checkout?status=expired");

        } else {
            console.log("✅ Agendamentos válidos. Confirmando...");

            // A. Dispara a confirmação no banco de dados (Muda status de 'Pendente' para 'Pago')
            await API_CONSUME("PUT", `payment/${payment_id}/confirm`, headers, {
                schedules: schedules.map(s => s.id)
            });

            // B. Redireciona para sucesso
            return res.redirect("/checkout?status=success");
        }

    } catch (error) {
        console.error("❌ Erro crítico no processamento do sucesso:", error);
        // Em caso de erro no servidor, redireciona para uma tela de "verifique seu email" ou erro genérico
        // Não queremos dar "Sucesso" falso se o banco não atualizou
        return res.redirect("/checkout?status=error_processing");
    }
}