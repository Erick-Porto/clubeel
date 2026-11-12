import PainelCasca from "../../components/Painel/PainelCasca";
import { EsqueletoDeVendas } from "../../components/Painel/Esqueleto";

/** Primeira abertura do painel Vendas (a troca de filtro usa o esqueleto do ContextoDeVendas). */
export default function CarregandoPainelVendas() {
    return (
        <PainelCasca>
            <EsqueletoDeVendas />
        </PainelCasca>
    );
}
