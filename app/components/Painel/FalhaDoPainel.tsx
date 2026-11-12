/**
 * O que a tela mostra para cada erro da Lara (tabela de erros do contrato dos
 * dashboards; ver docs/resumo-modulos/18-painel.md). Server Component.
 */

import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faHouse } from "@fortawesome/free-solid-svg-icons";
import ui from "../../../styles/ui.module.css";
import style from "../../../styles/painel.module.css";
import type { Falha } from "../../../services/dashboard-api";
import SessaoVencida from "./SessaoVencida";
import BotaoAtualizar from "./BotaoAtualizar";

export default function FalhaDoPainel({ falha }: { falha: Falha }) {
    switch (falha.tipo) {
        case "login":
            return <SessaoVencida />;

        case "sem-acesso":
            return (
                <div className={style.aviso} role="alert">
                    <strong>Você não tem acesso aos dashboards</strong>
                    <p>O painel é só para contas de administrador.</p>
                    <Link href="/" className={`${ui.btn} ${ui.btnPrimary}`}>
                        <FontAwesomeIcon icon={faHouse} /> Ir para o início
                    </Link>
                </div>
            );

        case "nao-encontrado":
            return (
                <div className={style.aviso} role="alert">
                    <strong>Evento não encontrado</strong>
                    <p>Escolha outro evento na lista.</p>
                    <Link href="/painel/ingressos" className={`${ui.btn} ${ui.btnSecondary}`}>
                        <FontAwesomeIcon icon={faArrowLeft} /> Voltar aos eventos
                    </Link>
                </div>
            );

        case "invalido":
            // Normalmente o 422 aparece junto do filtro (FiltroDeVendas); isto é
            // só a rede de segurança para uma tela sem filtro.
            return (
                <div className={style.aviso} role="alert">
                    <strong>Filtro inválido</strong>
                    {falha.mensagem && <p>{falha.mensagem}</p>}
                </div>
            );

        case "limite":
            return (
                <div className={style.aviso} role="alert">
                    <strong>Muitas atualizações; tente em instantes</strong>
                    <BotaoAtualizar rotulo="Tentar de novo" />
                </div>
            );

        default:
            return (
                <div className={style.aviso} role="alert">
                    <strong>Não conseguimos carregar o painel</strong>
                    {falha.mensagem && <p>{falha.mensagem}</p>}
                    <BotaoAtualizar rotulo="Tentar de novo" />
                </div>
            );
    }
}
