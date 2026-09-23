/**
 * Layout da área de aprovação de compras.
 *
 * Área separada, visual compartilhado: rotas, sessão e casca próprios, mas os
 * componentes, cores, espaçamentos e tipografia são os que o projeto já usa.
 *
 * Deliberadamente sem `useSession`, sem `CartProvider` e sem qualquer coisa da
 * sessão de sócio — o que vem do layout raiz é só a fonte, os tokens de cor e o
 * container de toast.
 *
 * O cabeçalho não vive aqui porque a tela de login compartilha este layout e
 * não deve exibir usuário nem botão de sair; quem monta o cabeçalho são as
 * páginas autenticadas.
 */

import type { Metadata } from 'next';
import styles from '../../styles/aprovacao.module.css';

export const metadata: Metadata = {
  title: 'Aprovação de Compras | Clube dos Funcionários',
  description: 'Aprovação de ordens de compra pela diretoria.',
  robots: { index: false, follow: false },
};

export default function AprovacaoLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.area}>{children}</div>;
}
