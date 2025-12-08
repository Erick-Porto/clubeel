import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]"; // Importa as opções de auth
import API_CONSUME from "@/services/api-consume";

// Definição da interface básica de um agendamento vindo do seu backend
interface Schedule {
    id: number;
    start_schedule: string; // Formato: "YYYY-MM-DD HH:mm:ss"
    status_id: number;
    createdAt?: string; // Adicionado como opcional para evitar erros se a API não retornar
    [key: string]: unknown;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { payment_id } = req.query;
    
    // CORREÇÃO: Usar getServerSession no servidor em vez de useSession
    const session = await getServerSession(req, res, authOptions);

    // Se não houver sessão, não podemos processar com a API que exige token
    if (!session || !session.accessToken) {
        console.warn("⚠️ Sessão não encontrada no callback de sucesso.");
        // Redireciona para login ou erro, já que precisamos do token para atualizar o backend
        return res.redirect("/login?error=session_expired");
    }

    try {
        // =====================================================================
        // PASSO 1: Buscar os agendamentos atrelados a este pagamento no seu Backend
        // =====================================================================
        
        const headers = {
            'Session': session.accessToken as string
        };

        // Busca agendamentos do usuário logado
        const dataSchedules = await API_CONSUME("GET", `schedule/member/${session.user?.id}`, headers);
        
        // Normaliza a resposta (Array de agendamentos)
        // Garante que estamos trabalhando com um array, mesmo que a API retorne { schedules: [...] }
        const list: Schedule[] = Array.isArray(dataSchedules) 
            ? dataSchedules 
            : (Array.isArray(dataSchedules?.schedules) ? dataSchedules.schedules : []);
        
        let schedules: Schedule[] = [];
        let expired: Schedule[] = [];

        // CORREÇÃO: Lógica para agendamentos expirados
        if (list.length > 0) {
            // 1. Define o ponto no tempo: 15 minutos atrás a partir de agora.
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000); 

            // 2. Filtra os agendamentos expirados
            expired = list.filter((s) => {
                if (!s.createdAt) return false;
                // Converte a string 'createdAt' para um objeto Date
                const createdAtDate = new Date(s.createdAt.replace(" ", "T")); 
                
                // Compara se o agendamento foi criado ANTES de 15 minutos atrás
                // e se o status é 'Pendente de Pagamento' (status_id = 4)
                return s.status_id === 4 && createdAtDate < fifteenMinutesAgo;
            });
            
            // Filtra agendamentos pendentes que NÃO expiraram para o fluxo normal
            // (status_id = 3 ou 4 dependendo da sua regra de negócio, mantive 3 conforme seu snippet original)
            schedules = list.filter((s) => s.status_id === 3); 
        }

        if (schedules.length === 0 && expired.length > 0) {
            console.warn("⚠️ Pagamento detectado para agendamentos expirados. Tentando reembolso...");

            if (process.env.MP_ACCESS_TOKEN && payment_id) {
                await fetch("https://api.mercadopago.com/v1/payments/" + payment_id + "/refunds", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Idempotency-Key": `${payment_id}-refund-${Date.now()}`,
                        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
                    },
                }).catch(err => console.error("Erro ao processar reembolso automático:", err));
            }
            return res.redirect("/checkout?status=expired");
        }

        console.log("✅ Agendamentos válidos. Confirmando...");

        // A. Dispara a confirmação no banco de dados (Muda status de 'Pendente' para 'Pago')
        if (schedules.length > 0) {
            await API_CONSUME("PUT", `schedule/update-status`, headers, 
                schedules.map(s => ({
                    id: s.id,
                    status_id: 1 // Pago
                }))
            );
        }

        // B. Redireciona para sucesso
        return res.redirect("/checkout?status=success");

    } catch (error) {
        console.error("❌ Erro crítico no processamento do sucesso:", error);
        return res.redirect("/checkout?status=error_processing");
    }
}