'use client';

/**
 * Formulário de login da aprovação.
 *
 * Componente de cliente que não conhece a API nem credencial alguma: ele só
 * coleta os dois campos e chama a Server Action. Não há fetch aqui — nem para a
 * Lara, nem para o Next.
 */

import { useActionState } from 'react';
import { entrar } from '../actions';
import type { EstadoLogin } from '../tipos';
import styles from '../../../styles/aprovacao.module.css';

const ESTADO_INICIAL: EstadoLogin = { erro: null };

export default function FormularioLogin() {
  const [estado, acao, pendente] = useActionState(entrar, ESTADO_INICIAL);

  return (
    <form className={styles.formulario} action={acao}>
      {estado.erro && (
        <p className={styles.erro} role="alert">
          {estado.erro}
        </p>
      )}

      <div className={styles.campo}>
        <label className={styles.rotulo} htmlFor="matricula">
          Matrícula
        </label>
        <input
          id="matricula"
          name="matricula"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          disabled={pendente}
          required
        />
      </div>

      <div className={styles.campo}>
        <label className={styles.rotulo} htmlFor="senha">
          Senha
        </label>
        {/*
          Senha alfanumérica, não PIN: sem inputMode="numeric", que abriria
          teclado numérico no celular e esconderia metade dos caracteres válidos.
        */}
        <input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          disabled={pendente}
          required
        />
      </div>

      <button type="submit" className={styles.botaoPrincipal} disabled={pendente}>
        {pendente ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  );
}
