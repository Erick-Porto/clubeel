'use client';

/**
 * Telas que encerram o fluxo: sucesso, recusa registrada e as recusas da Lara
 * que tornam o link inutilizável.
 *
 * O texto principal de cada recusa é o `error` que a Lara mandou (escrito para
 * quem assina). O título e a dica de "o que fazer agora" são só a moldura da
 * tela, por `reason` (tabela do contrato).
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBan,
  faCircleCheck,
  faClock,
  faLink,
  faLock,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import styles from '../../../../styles/assinatura.module.css';
import { dataHora } from '../formato';
import type { Recusa, ResultadoAssinatura } from '../tipos';

type Tom = 'ok' | 'aviso' | 'perigo' | 'neutro';

interface Moldura {
  titulo: string;
  dica: string | null;
  icone: IconDefinition;
  tom: Tom;
}

/** `reason`s que terminam o fluxo nesta tela. */
export const MOLDURAS: Record<string, Moldura> = {
  invalid_link: {
    titulo: 'Link inválido',
    dica: null, // a mensagem da Lara já orienta
    icone: faLink,
    tom: 'perigo',
  },
  link_expired: { titulo: 'Link vencido', dica: 'Peça um novo link ao clube.', icone: faClock, tom: 'aviso' },
  link_superseded: {
    titulo: 'Existe um link mais recente',
    dica: null, // a mensagem da Lara já orienta
    icone: faLink,
    tom: 'aviso',
  },
  link_revoked: { titulo: 'Link cancelado pelo clube', dica: null, icone: faBan, tom: 'aviso' },
  link_used: { titulo: 'Você já respondeu a este documento', dica: null, icone: faCircleCheck, tom: 'neutro' },
  link_locked: {
    titulo: 'O CPF não conferiu',
    dica: 'Por segurança, este link foi bloqueado. Peça um novo link ao clube.',
    icone: faLock,
    tom: 'perigo',
  },
  document_unavailable: { titulo: 'Documento indisponível', dica: null, icone: faBan, tom: 'aviso' },
  no_link: {
    titulo: 'Abra o link que você recebeu',
    dica: null,
    icone: faLink,
    tom: 'neutro',
  },
};

export function encerraFluxo(reason: string): boolean {
  return reason in MOLDURAS;
}

const CLASSE_TOM: Record<Tom, string> = {
  ok: styles.finalIconeOk,
  aviso: styles.finalIconeAviso,
  perigo: styles.finalIconePerigo,
  neutro: styles.finalIconeNeutro,
};

function Casca({ icone, tom, children }: { icone: IconDefinition; tom: Tom; children: React.ReactNode }) {
  return (
    <section className={`${styles.cartao} ${styles.final}`} data-testid="tela-final">
      <div className={`${styles.finalIcone} ${CLASSE_TOM[tom]}`}>
        <FontAwesomeIcon icon={icone} />
      </div>
      {children}
    </section>
  );
}

export function TelaRecusaFinal({ recusa }: { recusa: Recusa }) {
  const moldura = MOLDURAS[recusa.reason] ?? {
    titulo: 'Não foi possível continuar',
    dica: null,
    icone: faTriangleExclamation,
    tom: 'aviso' as Tom,
  };
  return (
    <Casca icone={moldura.icone} tom={moldura.tom}>
      <h1 className={styles.titulo}>{moldura.titulo}</h1>
      <p className={styles.lead}>{recusa.error}</p>
      {moldura.dica && <p>{moldura.dica}</p>}
    </Casca>
  );
}

export function TelaSucesso({
  resultado,
  pediuVia,
}: {
  /** `null` quando a confirmação veio pelo `link_used` (resposta perdida na rede). */
  resultado: ResultadoAssinatura | null;
  pediuVia: boolean;
}) {
  return (
    <Casca icone={faCircleCheck} tom="ok">
      <h1 className={styles.titulo}>
        {resultado?.signed_at
          ? `Assinatura registrada em ${dataHora(resultado.signed_at)}`
          : 'Assinatura registrada'}
      </h1>
      {resultado?.message && <p className={styles.lead}>{resultado.message}</p>}
      {resultado?.validation_code && (
        <>
          <span className={styles.rotulo}>Código de validação</span>
          <span className={styles.codigo} data-testid="codigo-validacao">{resultado.validation_code}</span>
        </>
      )}
      {pediuVia && <p>A via assinada chega por e-mail quando o documento for finalizado.</p>}
      <p className={styles.lead}>Você já pode fechar esta página.</p>
    </Casca>
  );
}

export function TelaRecusado({ mensagem }: { mensagem: string | null }) {
  return (
    <Casca icone={faBan} tom="neutro">
      <h1 className={styles.titulo}>Documento recusado</h1>
      {mensagem && <p className={styles.lead}>{mensagem}</p>}
      <p className={styles.lead}>Você já pode fechar esta página.</p>
    </Casca>
  );
}
