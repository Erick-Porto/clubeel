'use client';

/**
 * Etapa 6 — aceite. Três caixas:
 *  - "Li e aceito os termos" (`accepted`);
 *  - a autorização da foto, com o `photo_consent_text` EXATAMENTE como a Lara
 *    mandou (o texto é parte da evidência; não resumir nem reescrever);
 *  - a via por e-mail, só se `signer.has_email` (o endereço não aparece).
 *
 * Os dois aceites são condição do `assinar` na própria API (sem eles, 422); a
 * tela só não deixa a pessoa seguir sem eles para não falhar lá no fim.
 */

import styles from '../../../../styles/assinatura.module.css';

export interface Aceite {
  accepted: boolean;
  photo_consent: boolean;
  wants_copy: boolean;
}

interface Props {
  valor: Aceite;
  textoFoto: string | null;
  pedeFoto: boolean;
  temEmail: boolean;
  aoMudar: (valor: Aceite) => void;
  aoContinuar: () => void;
}

export default function EtapaAceite({ valor, textoFoto, pedeFoto, temEmail, aoMudar, aoContinuar }: Props) {
  const pronto = valor.accepted && (!pedeFoto || valor.photo_consent);

  return (
    <section className={styles.cartao} aria-labelledby="titulo-aceite">
      <h1 id="titulo-aceite" className={styles.titulo}>Confirme</h1>

      <label className={styles.caixa}>
        <input
          type="checkbox"
          checked={valor.accepted}
          onChange={(e) => aoMudar({ ...valor, accepted: e.target.checked })}
        />
        <span>Li e aceito os termos do documento.</span>
      </label>

      {pedeFoto && textoFoto && (
        <label className={styles.caixa}>
          <input
            type="checkbox"
            checked={valor.photo_consent}
            onChange={(e) => aoMudar({ ...valor, photo_consent: e.target.checked })}
          />
          <span className={styles.caixaTexto}>{textoFoto}</span>
        </label>
      )}

      {temEmail && (
        <label className={styles.caixa}>
          <input
            type="checkbox"
            checked={valor.wants_copy}
            onChange={(e) => aoMudar({ ...valor, wants_copy: e.target.checked })}
          />
          <span>Quero receber a via assinada por e-mail.</span>
        </label>
      )}

      <button
        type="button"
        className={`${styles.botao} ${styles.botaoPrincipal}`}
        disabled={!pronto}
        onClick={aoContinuar}
      >
        Continuar para a assinatura
      </button>
    </section>
  );
}
