/**
 * Fila do aprovador: só as ordens em que ele tem decisão pendente.
 *
 * Server Component. A chamada à Lara acontece aqui, no servidor da DMZ, e o
 * navegador recebe HTML pronto — nenhum fetch de dados sai do cliente, e nem a
 * URL da API nem o token chegam ao bundle.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInbox, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import {
  ConfiguracaoAusenteError,
  listarOrdens,
  nomeFornecedor,
  type OrdemNaFila,
} from '../../services/aprovacao-api';
import BotaoRecarregar from './components/botao-recarregar';
import Cabecalho from './components/cabecalho';
import { dataHora, moeda, ouTraco, plural, tempoDecorrido } from './formato';
import { lerToken } from './sessao';
import styles from '../../styles/aprovacao.module.css';

type Estado =
  | { tipo: 'ok'; ordens: OrdemNaFila[] }
  | { tipo: 'expirada' }
  | { tipo: 'temporario' }
  | { tipo: 'configuracao' };

async function carregarFila(token: string): Promise<Estado> {
  let resultado;
  try {
    resultado = await listarOrdens(token);
  } catch (erro) {
    if (erro instanceof ConfiguracaoAusenteError) {
      console.error('[aprovacao]', erro.message);
      return { tipo: 'configuracao' };
    }
    throw erro;
  }

  if (resultado.ok) {
    const ordens = resultado.data?.ordens;
    return { tipo: 'ok', ordens: Array.isArray(ordens) ? ordens : [] };
  }

  // Token recusado é sessão morta — não há refresh, expirou, loga de novo.
  if (resultado.status === 401 || resultado.status === 403) {
    return { tipo: 'expirada' };
  }

  // 503 (Lara sem falar com o ERP) e o resto: temporário, com recarregar.
  // Nunca tratado como sessão inválida.
  return { tipo: 'temporario' };
}

export default async function FilaAprovacaoPage() {
  const token = await lerToken();
  if (!token) {
    redirect('/aprovacao/login');
  }

  const estado = await carregarFila(token);

  // O handler apaga o cookie e manda para o login — é o que evita o laço.
  if (estado.tipo === 'expirada') {
    redirect('/aprovacao/sessao-expirada');
  }

  return (
    <>
      <Cabecalho />

      <main className={styles.conteudo}>
        <h1 className={styles.tituloPagina}>Ordens aguardando sua decisão</h1>
        <p className={styles.subtituloPagina}>
          {estado.tipo === 'ok' && estado.ordens.length > 0
            ? plural(estado.ordens.length, 'ordem na sua fila', 'ordens na sua fila')
            : 'Sua fila de aprovação.'}
        </p>

        {estado.tipo === 'configuracao' && (
          <div className={styles.estado}>
            <div className={`${styles.estadoIcone} ${styles.estadoIconeAtencao}`}>
              <FontAwesomeIcon icon={faTriangleExclamation} />
            </div>
            <h2 className={styles.estadoTitulo}>Configuração do servidor incompleta</h2>
            <p className={styles.estadoTexto}>
              A variável <strong>LARA_API_URL</strong> não está definida neste ambiente. Avise a TI:
              a área de aprovação não funciona sem ela.
            </p>
          </div>
        )}

        {estado.tipo === 'temporario' && (
          <div className={styles.estado}>
            <div className={`${styles.estadoIcone} ${styles.estadoIconeAtencao}`}>
              <FontAwesomeIcon icon={faTriangleExclamation} />
            </div>
            <h2 className={styles.estadoTitulo}>Não foi possível carregar sua fila</h2>
            <p className={styles.estadoTexto}>
              A falha é temporária e sua sessão continua válida. Tente novamente em instantes.
            </p>
            <BotaoRecarregar />
          </div>
        )}

        {/*
          Fila vazia é o estado normal e frequente de um aprovador, não uma
          falha — por isso o tom neutro, sem cor nem ícone de erro.
        */}
        {estado.tipo === 'ok' && estado.ordens.length === 0 && (
          <div className={styles.estado}>
            <div className={styles.estadoIcone}>
              <FontAwesomeIcon icon={faInbox} />
            </div>
            <h2 className={styles.estadoTitulo}>Nenhuma ordem aguardando você</h2>
            <p className={styles.estadoTexto}>
              Quando uma ordem de compra chegar ao seu nível de aprovação, ela aparece aqui.
            </p>
            <BotaoRecarregar rotulo="Atualizar" />
          </div>
        )}

        {estado.tipo === 'ok' && estado.ordens.length > 0 && (
          <div className={styles.lista}>
            {estado.ordens.map((ordem) => (
              <CartaoOrdem key={ordem.cd_ordem_compra} ordem={ordem} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function CartaoOrdem({ ordem }: { ordem: OrdemNaFila }) {
  const relativo = tempoDecorrido(ordem.aguardando_desde);

  return (
    <Link
      href={`/aprovacao/ordens/${ordem.cd_ordem_compra}`}
      className={styles.cartaoOrdem}
      aria-label={`Abrir a ordem nº ${ordem.cd_ordem_compra}`}
    >
      <div className={styles.ordemTopo}>
        <div className={styles.ordemIdentificacao}>
          <div className={styles.ordemNumero}>Ordem nº {ordem.cd_ordem_compra}</div>
          <div className={styles.ordemFornecedor}>{ouTraco(nomeFornecedor(ordem.fornecedor))}</div>
        </div>
        <div>
          <div className={styles.ordemValor}>{moeda(ordem.vl_total)}</div>
          <div className={styles.ordemItens}>{plural(ordem.nr_itens, 'item', 'itens')}</div>
        </div>
      </div>

      <div className={styles.ordemCampos}>
        <div>
          <span className={styles.campoRotulo}>Departamento</span>
          <span className={styles.campoValor}>{ouTraco(ordem.departamento)}</span>
        </div>
        <div>
          <span className={styles.campoRotulo}>Solicitante</span>
          <span className={styles.campoValor}>{ouTraco(ordem.solicitante)}</span>
        </div>
        <div>
          <span className={styles.campoRotulo}>Processo</span>
          <span className={styles.campoValor}>{ordem.processo_id}</span>
        </div>
      </div>

      <div className={styles.ordemRodape}>
        <span className={styles.espera}>
          {/*
            aguardando_desde é desde quando a ordem está NESTE nível, não desde
            que foi criada — daí "aguardando você desde".
          */}
          Aguardando você desde {dataHora(ordem.aguardando_desde)}
          {relativo && <span className={styles.esperaRelativo}> · {relativo}</span>}
        </span>

        <span className={styles.indicacao}>
          {ordem.sem_centro_custo && <span className={styles.selo}>sem centro de custo</span>}
          {ordem.sem_centro_custo ? ' ' : ''}
          Indicado por {ordem.escolhido_por}
        </span>
      </div>
    </Link>
  );
}
