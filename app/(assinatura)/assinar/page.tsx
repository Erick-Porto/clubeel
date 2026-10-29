/**
 * /assinar — a única página da área.
 *
 * Sem o cookie do link (quem digitou o endereço, ou abriu um link quebrado),
 * mostra só "abra o link que você recebeu por e-mail". Com ele, entrega o fluxo
 * ao componente de cliente, que conversa com as rotas /assinar/api/*.
 *
 * Os cookies são httpOnly: o servidor só diz ao cliente SE existem (para
 * retomar uma sessão aberta depois de recarregar a página), nunca o valor.
 */

import { cookies } from 'next/headers';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelopeOpenText } from '@fortawesome/free-solid-svg-icons';
import styles from '../../../styles/assinatura.module.css';
import FluxoAssinatura from './componentes/fluxo-assinatura';
import { COOKIE_LINK, COOKIE_SESSAO, FORMATO_TOKEN } from './servidor';

export const dynamic = 'force-dynamic';

export default async function AssinarPage() {
  const cookieStore = await cookies();
  const temLink = FORMATO_TOKEN.test(cookieStore.get(COOKIE_LINK)?.value ?? '');
  const temSessao = Boolean(cookieStore.get(COOKIE_SESSAO)?.value);

  if (!temLink) {
    return (
      <section className={`${styles.cartao} ${styles.final}`}>
        <div className={`${styles.finalIcone} ${styles.finalIconeNeutro}`}>
          <FontAwesomeIcon icon={faEnvelopeOpenText} />
        </div>
        <h1 className={styles.titulo}>Abra o link que você recebeu por e-mail</h1>
        <p className={styles.lead}>
          Para assinar um documento do clube, use o link enviado para o seu e-mail.
        </p>
      </section>
    );
  }

  return <FluxoAssinatura temSessao={temSessao} />;
}
