/**
 * /painel — leva ao primeiro painel que a Lara liberou (`panels`, na ordem
 * recebida, só os que o site sabe mostrar). Hoje: /painel/ingressos.
 */

import { redirect } from "next/navigation";
import PainelCasca from "../components/Painel/PainelCasca";
import FalhaDoPainel from "../components/Painel/FalhaDoPainel";
import style from "../../styles/painel.module.css";
import { lerAcesso } from "../../services/dashboard-api";
import { PAINEIS_CONHECIDOS } from "../../utils/painel";

export const dynamic = "force-dynamic";

export default async function PainelInicio() {
    const acesso = await lerAcesso();
    if (!acesso.ok) {
        return (
            <PainelCasca>
                <FalhaDoPainel falha={acesso} />
            </PainelCasca>
        );
    }

    const primeiro = (acesso.dados.panels ?? []).find((painel) => PAINEIS_CONHECIDOS[painel.key]);
    if (primeiro) redirect(PAINEIS_CONHECIDOS[primeiro.key].href);

    return (
        <PainelCasca acesso={acesso.dados}>
            <div className={style.aviso}>
                <strong>Nenhum painel disponível</strong>
                <p>Quando houver um painel liberado para a sua conta, ele aparece aqui.</p>
            </div>
        </PainelCasca>
    );
}
