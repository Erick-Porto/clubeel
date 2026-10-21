/**
 * Login da aprovação de compras.
 *
 * Sessão própria, sem relação nenhuma com a de sócio: entrar aqui não loga
 * ninguém no agendamento, e um sócio logado não chega autenticado aqui.
 */

import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import FormularioLogin from '../components/formulario-login';
import { lerToken } from '../sessao';
import styles from '../../../styles/aprovacao.module.css';

export const metadata: Metadata = {
  title: 'Entrar | Aprovação de Compras',
};

export default async function LoginAprovacaoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const bruto = params?.motivo;
  const motivo = Array.isArray(bruto) ? bruto[0] : bruto;

  const token = await lerToken();

  // Quem já tem sessão vai direto para a fila. A exceção de motivo=expirada é o
  // freio de laço: se o cookie tiver sobrevivido à limpeza, não devolvemos o
  // usuário para /aprovacao, que o mandaria de volta para cá indefinidamente.
  if (token && motivo !== 'expirada') {
    redirect('/aprovacao');
  }

  return (
    <div className={styles.paginaLogin}>
      <div className={styles.cartaoLogin}>
        <div className={styles.loginTopo}>
          <Image
            src="/images/logo-cfcsn-horiz.png"
            alt="Clube dos Funcionários"
            width={200}
            height={80}
            quality={100}
            className={styles.logoImagem}
            priority
          />
        </div>

        <h1 className={styles.loginTitulo}>Aprovação de Compras</h1>
        <p className={styles.loginMensagem}>
          Acesso restrito à diretoria. Informe sua matrícula e senha de aprovação.
        </p>

        {motivo === 'expirada' && (
          <p className={styles.aviso} role="status">
            Sua sessão expirou. Entre novamente para continuar.
          </p>
        )}

        <FormularioLogin />
      </div>
    </div>
  );
}
