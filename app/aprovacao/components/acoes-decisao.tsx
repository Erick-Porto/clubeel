'use client';

/**
 * Aprovar / reprovar, com confirmação e leitura do resultado.
 *
 * A parte mais fácil de virar bug de interface é o que a resposta significa. Ver
 * `mensagemResultado`: `resultado` é o estado do PROCESSO depois da decisão, não
 * da decisão isolada. "open" quer dizer que a pessoa fez a parte dela e a compra
 * NÃO está liberada — dizer "ordem aprovada" ali levaria alguém a agir errado.
 */

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { decidir } from '../actions';
import type { EstadoDecisao } from '../tipos';
import { moeda } from '../formato';
import Andamento from './andamento';
import styles from '../../../styles/aprovacao.module.css';

const ESTADO_INICIAL: EstadoDecisao = { erro: null, decidido: null };
const LIMITE_OBSERVACAO = 1000;

interface Resultado {
  tom: 'registrada' | 'aprovada' | 'anomala' | 'reprovada';
  titulo: string;
  texto: string;
}

function mensagemResultado(resultado: string, gravadoNoQuestor: boolean): Resultado {
  if (resultado === 'open') {
    return {
      tom: 'registrada',
      titulo: 'Sua aprovação foi registrada.',
      texto: 'A ordem aguarda os demais diretores. A compra ainda não está liberada.',
    };
  }

  if (resultado === 'approved') {
    if (gravadoNoQuestor) {
      return {
        tom: 'aprovada',
        titulo: 'Ordem aprovada e autorizada no Questor.',
        texto: 'Todos os aprovadores decidiram e a autorização foi gravada no ERP.',
      };
    }
    // Aprovada, mas sem confirmação de gravação: não é sucesso limpo nem falha.
    return {
      tom: 'anomala',
      titulo: 'Ordem aprovada, mas a gravação no Questor não foi registrada.',
      texto:
        'Todos aprovaram e ainda assim o ERP não confirmou a autorização. Procure a TI antes de considerar a compra liberada.',
    };
  }

  if (resultado === 'rejected') {
    return {
      tom: 'reprovada',
      titulo: 'Ordem reprovada.',
      texto: 'O processo foi encerrado.',
    };
  }

  // Valor não previsto: não se inventa significado para ele.
  return {
    tom: 'anomala',
    titulo: 'Decisão registrada, com resposta inesperada.',
    texto: `A API respondeu "${resultado}". Confirme a situação da ordem com a TI antes de agir.`,
  };
}

const CLASSE_TOM: Record<Resultado['tom'], string> = {
  registrada: styles.resultadoRegistrada,
  aprovada: styles.resultadoAprovada,
  anomala: styles.resultadoAnomala,
  reprovada: styles.resultadoReprovada,
};

export default function AcoesDecisao({
  cdOrdemCompra,
  valorTotal,
  fornecedor,
}: {
  cdOrdemCompra: number;
  valorTotal: number;
  fornecedor: string;
}) {
  const [estado, acao, pendente] = useActionState(decidir, ESTADO_INICIAL);
  const [confirmando, setConfirmando] = useState<'aprovar' | 'reprovar' | null>(null);
  const [observacao, setObservacao] = useState('');

  // Decisão aceita: a ordem saiu da fila, então não há mais o que decidir aqui.
  if (estado.decidido) {
    const { resultado, gravado_no_questor, aprovacao } = estado.decidido;
    const msg = mensagemResultado(resultado, gravado_no_questor);

    return (
      <>
        <section className={`${styles.resultado} ${CLASSE_TOM[msg.tom]}`} role="status">
          <h2 className={styles.resultadoTitulo}>{msg.titulo}</h2>
          <p className={styles.resultadoTexto}>{msg.texto}</p>
          <Link href="/aprovacao" className={styles.botaoSecundario}>
            Voltar para a fila
          </Link>
        </section>
        <Andamento aprovacao={aprovacao} />
      </>
    );
  }

  return (
    <section className={styles.bloco}>
      <h2 className={styles.blocoTitulo}>Sua decisão</h2>

      {estado.erro && (
        <p className={styles.erro} role="alert">
          {estado.erro}
        </p>
      )}

      <form action={acao} className={styles.formDecisao}>
        <input type="hidden" name="cd_ordem_compra" value={cdOrdemCompra} />
        <input type="hidden" name="decisao" value={confirmando ?? ''} />

        <div className={styles.campo}>
          <label className={styles.rotulo} htmlFor="observacao">
            Observação (opcional)
          </label>
          <textarea
            id="observacao"
            name="observacao"
            className={styles.textarea}
            rows={3}
            maxLength={LIMITE_OBSERVACAO}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            disabled={pendente}
          />
          <span className={styles.contador}>
            {observacao.length}/{LIMITE_OBSERVACAO}
          </span>
        </div>

        {!confirmando ? (
          <div className={styles.acoes}>
            <button
              type="button"
              className={styles.botaoAprovar}
              onClick={() => setConfirmando('aprovar')}
            >
              Aprovar
            </button>
            <button
              type="button"
              className={styles.botaoReprovar}
              onClick={() => setConfirmando('reprovar')}
            >
              Reprovar
            </button>
          </div>
        ) : (
          <div
            className={`${styles.confirmacao} ${
              confirmando === 'reprovar' ? styles.confirmacaoReprovar : ''
            }`}
          >
            <p className={styles.confirmacaoTexto}>
              Você vai <strong>{confirmando}</strong> a ordem nº{' '}
              <strong>{cdOrdemCompra}</strong> — {fornecedor} — no valor de{' '}
              <strong>{moeda(valorTotal)}</strong>.
            </p>

            <p className={styles.confirmacaoAviso}>
              {confirmando === 'aprovar'
                ? /*
                     Sem afirmar que ele É o último: quem sabe disso é a Lara. O
                     aviso cobre o caso sem fingir conhecê-lo.
                  */
                  'Se você for o último aprovador pendente, esta aprovação grava a autorização no Questor e não pode ser desfeita por aqui.'
                : 'Reprovar encerra o processo inteiro, em qualquer nível. Não é um voto contra: é o fim do processo.'}
            </p>

            <div className={styles.acoes}>
              <button
                type="submit"
                className={confirmando === 'aprovar' ? styles.botaoAprovar : styles.botaoReprovar}
                disabled={pendente}
              >
                {pendente
                  ? 'Registrando...'
                  : confirmando === 'aprovar'
                    ? 'Confirmar aprovação'
                    : 'Confirmar reprovação'}
              </button>
              <button
                type="button"
                className={styles.botaoCancelar}
                onClick={() => setConfirmando(null)}
                disabled={pendente}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </form>
    </section>
  );
}
