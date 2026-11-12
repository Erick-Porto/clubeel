import PainelCasca from "../../components/Painel/PainelCasca";
import EsqueletoDoEvento from "../../components/Painel/Esqueleto";

/** Primeira abertura do painel: a casca sem abas e o esqueleto. */
export default function CarregandoPainelIngressos() {
    return (
        <PainelCasca>
            <EsqueletoDoEvento />
        </PainelCasca>
    );
}
