'use server';

/**
 * Server Actions da área de aprovação. Toda decisão de negócio é da Lara: aqui
 * só repassamos a resposta dela. Não calculamos se o usuário pode aprovar, não
 * distinguimos matrícula errada de senha errada, não reescrevemos recusa.
 */

import { redirect } from 'next/navigation';
import { ConfiguracaoAusenteError, decidirOrdem, login } from '../../services/aprovacao-api';
import { gravarSessao, lerToken, limparSessao } from './sessao';
import type { EstadoDecisao, EstadoLogin } from './tipos';

/**
 * Textos usados SÓ quando a API não mandou mensagem alguma. Quando ela manda, é
 * a dela que aparece. O texto de 401 preserva de propósito a ambiguidade da API:
 * ela não distingue matrícula inexistente de senha errada, e inventar uma
 * mensagem mais específica entregaria quais matrículas existem.
 */
function mensagemPadrao(status: number): string {
  switch (status) {
    case 401:
      return 'Matrícula ou senha inválida.';
    case 403:
      return 'Este usuário não tem acesso à aprovação de compras.';
    case 422:
      return 'Verifique a matrícula e a senha informadas.';
    case 429:
      return 'Muitas tentativas para esta matrícula. Aguarde um minuto e tente novamente.';
    default:
      return 'Não foi possível falar com o servidor agora. Tente novamente em instantes.';
  }
}

export async function entrar(_anterior: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const matricula = String(formData.get('matricula') ?? '').trim();
  const senha = String(formData.get('senha') ?? '');

  // Único juízo local, e não é regra de negócio: não vale gastar uma tentativa
  // do throttle por matrícula com um formulário vazio.
  if (!matricula || !senha) {
    return { erro: 'Informe a matrícula e a senha.' };
  }

  let resultado;
  try {
    resultado = await login(matricula, senha);
  } catch (erro) {
    if (erro instanceof ConfiguracaoAusenteError) {
      console.error('[aprovacao]', erro.message);
      return {
        erro: 'Configuração do servidor incompleta (LARA_API_URL). Avise a TI.',
      };
    }
    console.error('[aprovacao] erro inesperado no login:', erro);
    return { erro: 'Erro inesperado ao entrar. Tente novamente.' };
  }

  if (!resultado.ok) {
    return { erro: resultado.mensagem ?? mensagemPadrao(resultado.status) };
  }

  const { token, expira_em, usuario } = resultado.data ?? {};
  if (!token || !usuario) {
    console.error('[aprovacao] login 200 sem token ou usuário no corpo.');
    return { erro: 'Resposta inesperada do servidor. Avise a TI.' };
  }

  await gravarSessao(token, expira_em, usuario);

  // Fora de qualquer try: redirect() sinaliza por exceção.
  redirect('/aprovacao');
}

export async function sair(): Promise<void> {
  await limparSessao();
  redirect('/aprovacao/login');
}

/**
 * Registra aprovação ou reprovação de uma ordem.
 *
 * O front não avalia nada: não checa se é a vez do usuário, se ele já decidiu,
 * nem se a ordem ainda existe no ERP. Manda a decisão e mostra a resposta.
 * Recusa de negócio vem como 422 e a mensagem da API vai para a tela.
 */
export async function decidir(
  _anterior: EstadoDecisao,
  formData: FormData
): Promise<EstadoDecisao> {
  const cd = Number(formData.get('cd_ordem_compra'));
  const bruta = String(formData.get('decisao') ?? '');
  const observacao = String(formData.get('observacao') ?? '').trim();

  // Guardas de formulário malformado, não regras de negócio.
  if (!Number.isInteger(cd) || cd <= 0) {
    return { erro: 'Ordem inválida.', decidido: null };
  }
  if (bruta !== 'aprovar' && bruta !== 'reprovar') {
    return { erro: 'Decisão inválida.', decidido: null };
  }
  if (observacao.length > 1000) {
    return { erro: 'A observação não pode passar de 1000 caracteres.', decidido: null };
  }

  const token = await lerToken();
  if (!token) {
    redirect('/aprovacao/login');
  }

  let resultado;
  try {
    resultado = await decidirOrdem(token, cd, bruta, observacao || undefined);
  } catch (erro) {
    if (erro instanceof ConfiguracaoAusenteError) {
      console.error('[aprovacao]', erro.message);
      return {
        erro: 'Configuração do servidor incompleta (INTERNAL_LARA_API_URL). Avise a TI.',
        decidido: null,
      };
    }
    console.error('[aprovacao] erro inesperado ao decidir:', erro);
    return { erro: 'Erro inesperado ao registrar a decisão. Tente novamente.', decidido: null };
  }

  if (!resultado.ok) {
    if (resultado.status === 401 || resultado.status === 403) {
      redirect('/aprovacao/sessao-expirada');
    }
    if (resultado.status === 404) {
      return {
        erro: resultado.mensagem ?? 'Esta ordem não está mais na sua fila.',
        decidido: null,
      };
    }
    // 422: não é a sua vez, já decidiu, a ordem mudou no ERP. É a mensagem da
    // Lara que vai para a tela — é ela quem sabe o motivo.
    return {
      erro:
        resultado.mensagem ??
        'Não foi possível registrar a decisão agora. Tente novamente em instantes.',
      decidido: null,
    };
  }

  /*
   * NÃO chamar revalidatePath aqui.
   *
   * Decidida, a ordem sai da fila do aprovador e o GET do detalhe passa a
   * responder 404. Revalidar faz o Next re-renderizar a página atual e devolver
   * a árvore nova junto com a resposta desta action — árvore que, por causa do
   * 404, é a tela "esta ordem não está na sua fila". Ela substitui o componente
   * que ia exibir o resultado, e o aprovador perde justamente a informação mais
   * importante da tela: se a compra foi liberada ou se ainda falta gente.
   *
   * Não é preciso revalidar nada: as duas rotas são dinâmicas (leem cookie), não
   * entram no Full Route Cache, e o Router Cache do cliente não retém rota
   * dinâmica por padrão no Next 15 — a fila é buscada de novo na volta.
   */
  return {
    erro: null,
    decidido: {
      resultado: String(resultado.data?.resultado ?? ''),
      gravado_no_questor: resultado.data?.gravado_no_questor === true,
      aprovacao: resultado.data?.aprovacao ?? null,
    },
  };
}
