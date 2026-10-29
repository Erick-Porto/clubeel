/**
 * Faixa de homologação.
 *
 * Só aparece na instância compilada com `NEXT_PUBLIC_BASE_PATH` (ver
 * utils/base-path.ts). Existe para ninguém confundir a homologação com a
 * produção — lembrando que as duas falam com a MESMA Lara e a MESMA eRede:
 * reserva, pagamento, luz e aprovação feitos aqui são reais.
 *
 * Não é fixa: rola junto com a página para não brigar com o cabeçalho
 * sticky nem com a barra inferior de módulos do celular.
 */

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFlask } from "@fortawesome/free-solid-svg-icons";
import styles from "../../../styles/homolog-banner.module.css";
import { EM_HOMOLOGACAO } from "../../../utils/base-path";

export default function HomologBanner() {
    if (!EM_HOMOLOGACAO) return null;

    return (
        <div className={styles.faixa} role="note">
            <FontAwesomeIcon icon={faFlask} />
            <span>
                <strong>Homologação</strong> — versão em teste. Reservas, pagamentos e demais ações são reais.
            </span>
        </div>
    );
}
