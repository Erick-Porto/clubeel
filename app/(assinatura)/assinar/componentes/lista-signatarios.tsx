'use client';

/**
 * Quem assina este documento e quem já assinou (`signers` da sessão), acima do
 * PDF na etapa de leitura. Só aparece com mais de um signatário; sem o campo
 * (Lara anterior a 09/11/2026), não aparece e a tela segue igual.
 *
 * A lista é atualizada sozinha pela consulta à `sessao` a cada ~15 s: se outra
 * pessoa assinar enquanto esta lê, o item muda. O PDF não muda junto (só é
 * buscado de novo ao voltar para a leitura).
 *
 * Privacidade: os nomes são de outras pessoas. Só vão para a tela, nunca para
 * console, analytics, título da página ou meta tag.
 */

import { faCheck, faUserPen } from '@fortawesome/free-solid-svg-icons';
import styles from '../../../../styles/assinatura.module.css';
import { Pill } from '../../../components/UI/ui';
import { lerSignatarios, mostrarSignatarios, resumoSignatarios, textoAssinou } from '../signatarios';

export default function ListaSignatarios({ signers }: { signers: unknown }) {
  const lista = lerSignatarios(signers);
  if (!mostrarSignatarios(lista)) return null;

  return (
    <section className={styles.signatarios} aria-labelledby="titulo-signatarios" data-testid="signatarios">
      <h2 id="titulo-signatarios" className={styles.signatariosResumo}>
        {resumoSignatarios(lista)}
      </h2>
      <ul className={styles.signatariosLista}>
        {lista.map((s, i) => (
          <li
            key={i}
            className={`${styles.signatario} ${s.signed ? styles.signatarioAssinou : ''} ${s.me ? styles.signatarioEu : ''}`}
            data-testid="signatario"
          >
            <span className={styles.signatarioNome}>
              {s.name}
              {s.role && <span className={styles.signatarioPapel}> — {s.role}</span>}
            </span>
            <span className={styles.signatarioSelos}>
              {s.signed && (
                <Pill kind="ok" icon={faCheck}>
                  {textoAssinou(s)}
                </Pill>
              )}
              {s.me && (
                <Pill kind="info" icon={faUserPen}>
                  você
                </Pill>
              )}
              {!s.signed && !s.me && s.status && <Pill kind="off">{s.status.toLocaleLowerCase('pt-BR')}</Pill>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
