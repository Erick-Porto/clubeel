/**
 * Cabeçalho das telas autenticadas da aprovação.
 *
 * Server Component: lê o nome do aprovador do cookie httpOnly no servidor. O
 * navegador recebe só o texto já renderizado — nenhuma credencial atravessa.
 */

import Image from 'next/image';
import { sair } from '../actions';
import { lerUsuario } from '../sessao';
import styles from '../../../styles/aprovacao.module.css';

export default async function Cabecalho() {
  const usuario = await lerUsuario();

  return (
    <header className={styles.cabecalho}>
      <div className={styles.cabecalhoInterno}>
        <div className={styles.marca}>
          <Image
            src="/images/logo-cfcsn-horiz.png"
            alt="Clube dos Funcionários"
            width={200}
            height={80}
            quality={100}
            className={styles.logoImagem}
            priority
          />
          <div className={styles.marcaTexto}>
            <div className={styles.marcaTitulo}>Aprovação de Compras</div>
            <div className={styles.marcaSubtitulo}>Diretoria</div>
          </div>
        </div>

        <div className={styles.sessao}>
          {usuario && (
            <div className={styles.sessaoUsuario}>
              <span className={styles.sessaoNome}>{usuario.nome}</span>
              <span className={styles.sessaoMatricula}>Matrícula {usuario.matricula}</span>
            </div>
          )}
          {/* POST, não link: um <Link> seria alvo de prefetch e deslogaria sem clique. */}
          <form action={sair}>
            <button type="submit" className={styles.botaoSair}>
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
