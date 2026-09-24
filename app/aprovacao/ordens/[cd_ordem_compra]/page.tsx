/**
 * Detalhe da ordem: cabeçalho, fornecedor, itens com centro de custo, andamento
 * e as ações de decidir.
 *
 * Server Component — a chamada à Lara sai do servidor da DMZ. O componente de
 * cliente das ações recebe só número, valor e nome do fornecedor: nenhum token.
 */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import {
  ConfiguracaoAusenteError,
  nomeFornecedor,
  obterOrdem,
  type OrdemDetalhe,
} from '../../../../services/aprovacao-api';
import AcoesDecisao from '../../components/acoes-decisao';
import Andamento from '../../components/andamento';
import BotaoRecarregar from '../../components/botao-recarregar';
import Cabecalho from '../../components/cabecalho';
import {
  cnpj,
  dataHoraSimples,
  moeda,
  moedaPrecisa,
  numero,
  ouTraco,
  plural,
} from '../../formato';
import { lerToken } from '../../sessao';
import styles from '../../../../styles/aprovacao.module.css';

type Estado =
  | { tipo: 'ok'; ordem: OrdemDetalhe }
  | { tipo: 'expirada' }
  | { tipo: 'fora-da-fila' }
  | { tipo: 'temporario' }
  | { tipo: 'configuracao' };

async function carregar(token: string, cd: number): Promise<Estado> {
  let resultado;
  try {
    resultado = await obterOrdem(token, cd);
  } catch (erro) {
    if (erro instanceof ConfiguracaoAusenteError) {
      console.error('[aprovacao]', erro.message);
      return { tipo: 'configuracao' };
    }
    throw erro;
  }

  if (resultado.ok && resultado.data) {
    return { tipo: 'ok', ordem: resultado.data };
  }

  if (resultado.ok) return { tipo: 'temporario' };

  if (resultado.status === 401 || resultado.status === 403) return { tipo: 'expirada' };

  // 404 = a ordem não está na fila DESTE aprovador. É "não encontrada", não
  // erro de sistema e não sessão inválida.
  if (resultado.status === 404) return { tipo: 'fora-da-fila' };

  // 503: a Lara não conseguiu falar com o ERP. Temporário, com recarregar.
  return { tipo: 'temporario' };
}

export default async function DetalheOrdemPage({
  params,
}: {
  params: Promise<{ cd_ordem_compra: string }>;
}) {
  const { cd_ordem_compra: bruto } = await params;
  const cd = Number(bruto);

  // Rota com algo que não é número de ordem nunca chega à API.
  if (!Number.isInteger(cd) || cd <= 0) {
    notFound();
  }

  const token = await lerToken();
  if (!token) {
    redirect('/aprovacao/login');
  }

  const estado = await carregar(token, cd);

  if (estado.tipo === 'expirada') {
    redirect('/aprovacao/sessao-expirada');
  }

  return (
    <>
      <Cabecalho />

      <main className={styles.conteudo}>
        <Link href="/aprovacao" className={styles.voltar}>
          <FontAwesomeIcon icon={faArrowLeft} /> Voltar para a fila
        </Link>

        {estado.tipo === 'configuracao' && (
          <div className={styles.estado}>
            <div className={`${styles.estadoIcone} ${styles.estadoIconeAtencao}`}>
              <FontAwesomeIcon icon={faTriangleExclamation} />
            </div>
            <h2 className={styles.estadoTitulo}>Configuração do servidor incompleta</h2>
            <p className={styles.estadoTexto}>
              A variável <strong>INTERNAL_LARA_API_URL</strong> não está definida neste ambiente.
              Avise a TI.
            </p>
          </div>
        )}

        {estado.tipo === 'fora-da-fila' && (
          <div className={styles.estado}>
            <div className={styles.estadoIcone}>
              <FontAwesomeIcon icon={faTriangleExclamation} />
            </div>
            <h2 className={styles.estadoTitulo}>Esta ordem não está na sua fila</h2>
            <p className={styles.estadoTexto}>
              A ordem nº {cd} não está aguardando decisão sua. Pode já ter sido decidida, ou nunca
              ter passado pelo seu nível de aprovação.
            </p>
            <Link href="/aprovacao" className={styles.botaoSecundario}>
              Ver minha fila
            </Link>
          </div>
        )}

        {estado.tipo === 'temporario' && (
          <div className={styles.estado}>
            <div className={`${styles.estadoIcone} ${styles.estadoIconeAtencao}`}>
              <FontAwesomeIcon icon={faTriangleExclamation} />
            </div>
            <h2 className={styles.estadoTitulo}>
              Não foi possível carregar os dados da ordem
            </h2>
            <p className={styles.estadoTexto}>
              A falha é temporária e sua sessão continua válida. Tente novamente.
            </p>
            <BotaoRecarregar />
          </div>
        )}

        {estado.tipo === 'ok' && <Detalhe ordem={estado.ordem} />}
      </main>
    </>
  );
}

function Detalhe({ ordem }: { ordem: OrdemDetalhe }) {
  const fornecedorObj = typeof ordem.fornecedor === 'object' ? ordem.fornecedor : null;
  const fornecedor = ouTraco(nomeFornecedor(ordem.fornecedor));
  const itens = Array.isArray(ordem.itens) ? ordem.itens : [];

  return (
    <>
      <header className={styles.detalheTopo}>
        <div>
          <div className={styles.ordemNumero}>Ordem nº {ordem.cd_ordem_compra}</div>
          <h1 className={styles.detalheFornecedor}>{fornecedor}</h1>
          {fornecedorObj?.razao_social &&
            fornecedorObj.razao_social.trim() !== fornecedor && (
              <div className={styles.detalheRazao}>{fornecedorObj.razao_social}</div>
            )}
        </div>
        <div>
          <div className={styles.detalheValor}>{moeda(ordem.vl_total)}</div>
          <div className={styles.ordemItens}>{plural(ordem.nr_itens, 'item', 'itens')}</div>
        </div>
      </header>

      <section className={styles.bloco}>
        <h2 className={styles.blocoTitulo}>Dados da ordem</h2>
        <div className={styles.ordemCampos}>
          <div>
            <span className={styles.campoRotulo}>CNPJ do fornecedor</span>
            <span className={styles.campoValor}>{cnpj(fornecedorObj?.cnpj)}</span>
          </div>
          <div>
            <span className={styles.campoRotulo}>Departamento</span>
            <span className={styles.campoValor}>{ouTraco(ordem.departamento)}</span>
          </div>
          <div>
            <span className={styles.campoRotulo}>Solicitante</span>
            <span className={styles.campoValor}>{ouTraco(ordem.solicitante)}</span>
          </div>
          <div>
            <span className={styles.campoRotulo}>Referente</span>
            <span className={styles.campoValor}>{ouTraco(ordem.referente)}</span>
          </div>
          <div>
            <span className={styles.campoRotulo}>Filial</span>
            <span className={styles.campoValor}>
              {ordem.filial === null || ordem.filial === undefined ? '—' : String(ordem.filial)}
            </span>
          </div>
          <div>
            <span className={styles.campoRotulo}>Cadastrada em</span>
            <span className={styles.campoValor}>{dataHoraSimples(ordem.dt_cadastro)}</span>
          </div>
          <div>
            <span className={styles.campoRotulo}>Processo</span>
            <span className={styles.campoValor}>{ordem.processo_id}</span>
          </div>
        </div>
      </section>

      <section className={styles.bloco}>
        <h2 className={styles.blocoTitulo}>Itens</h2>
        {itens.length === 0 ? (
          <p className={styles.textoVazio}>Nenhum item retornado para esta ordem.</p>
        ) : (
          <div className={styles.tabelaRolagem}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Material</th>
                  <th>Un.</th>
                  <th className={styles.colunaNumero}>Qtd.</th>
                  <th className={styles.colunaNumero}>Vl. unitário</th>
                  <th className={styles.colunaNumero}>Vl. total</th>
                  <th className={styles.colunaNumero}>Centro de custo</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item, i) => (
                  <tr key={`${item.item}-${i}`}>
                    <td>{item.item}</td>
                    <td className={styles.celulaMaterial}>{ouTraco(item.material)}</td>
                    <td>{ouTraco(item.unidade)}</td>
                    <td className={styles.colunaNumero}>{numero(item.quantidade)}</td>
                    <td className={styles.colunaNumero}>{moedaPrecisa(item.vl_unitario)}</td>
                    <td className={styles.colunaNumero}>{moeda(item.vl_total)}</td>
                    <td className={styles.colunaNumero}>
                      {item.centro_custo === null || item.centro_custo === undefined
                        ? '—'
                        : item.centro_custo}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>Total da ordem</td>
                  <td className={styles.colunaNumero}>{moeda(ordem.vl_total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <Andamento aprovacao={ordem.aprovacao} />

      <AcoesDecisao
        cdOrdemCompra={ordem.cd_ordem_compra}
        valorTotal={ordem.vl_total}
        fornecedor={fornecedor}
      />
    </>
  );
}
