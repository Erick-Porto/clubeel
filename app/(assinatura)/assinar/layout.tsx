/**
 * Layout da área de assinatura remota de documentos (/assinar).
 *
 * Área separada do site de reservas: só a marca do clube e o conteúdo da
 * assinatura. Sem cabeçalho, menu, rodapé de navegação, links nem estado de
 * login do site — e sem os provedores de sessão de sócio, que o layout raiz
 * deixa de montar aqui (app/components/casca-do-site.tsx).
 *
 * Quem chega aqui chegou pelo link do e-mail. Nada no site aponta para cá, a
 * área fica fora dos buscadores (metadata abaixo + X-Robots-Tag no
 * next.config.ts + robots.txt) e não carrega analytics nem script de terceiro.
 */

import type { Metadata } from 'next';
import Image from 'next/image';
import styles from '../../../styles/assinatura.module.css';
import { comBase } from '../../../utils/base-path';

export const metadata: Metadata = {
  title: 'Assinatura de documentos | Clube dos Funcionários',
  description: 'Assinatura de documentos do Clube dos Funcionários.',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: 'no-referrer',
};

export default function AssinaturaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.area}>
      <header className={styles.cabecalho}>
        <div className={styles.cabecalhoInterno}>
          <Image
            src={comBase('/images/logo-cfcsn-horiz.png')}
            alt="Clube dos Funcionários"
            width={200}
            height={80}
            quality={100}
            className={`${styles.logoImagem} ${styles.logoClaro}`}
            priority
          />
          <Image
            src={comBase('/images/logo-cfcsn-w-horiz.png')}
            alt="Clube dos Funcionários"
            width={200}
            height={80}
            quality={100}
            className={`${styles.logoImagem} ${styles.logoEscuro}`}
            priority
          />
          <span className={styles.marcaTexto}>Assinatura de documentos</span>
        </div>
      </header>

      <main className={styles.conteudo}>{children}</main>

      <footer className={styles.rodape}>
        Clube dos Funcionários da CSN · Volta Redonda/RJ
      </footer>
    </div>
  );
}
