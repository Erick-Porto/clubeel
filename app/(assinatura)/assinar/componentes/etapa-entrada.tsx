'use client';

/**
 * Etapa 1 — entrada. Mostra o que é o documento, para quem, quem enviou, até
 * quando vale e o que vai ser pedido, tudo como a Lara mandou em `link`.
 *
 * A câmera é conferida ANTES de abrir a sessão: a foto é obrigatória, e sem
 * câmera a pessoa só descobriria no fim, depois de gastar uma sessão e
 * tentativas de CPF. Sem câmera, o botão Começar não aparece habilitado.
 */

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCamera,
  faCircleInfo,
  faFileSignature,
  faIdCard,
  faListCheck,
  faPaperclip,
  faPenNib,
  faSignature,
  faSpinner,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import styles from '../../../../styles/assinatura.module.css';
import { Note } from '../../../components/UI/ui';
import { dataHora, plural } from '../formato';
import type { LinkInfo } from '../tipos';

export type EstadoCamera = 'verificando' | 'ok' | 'ausente';

interface Props {
  link: LinkInfo;
  camera: EstadoCamera;
  aviso: string | null;
  erro: string | null;
  ocupado: boolean;
  aoComecar: () => void;
}

/** A foto é pedida a menos que a Lara diga explicitamente que não. */
export function exigeFoto(link: LinkInfo): boolean {
  return link.requirements.photo !== false;
}

export default function EtapaEntrada({ link, camera, aviso, erro, ocupado, aoComecar }: Props) {
  const r = link.requirements;
  const anexos = r.attachments ?? 0;
  const obrigatorios = r.attachments_required ?? 0;
  const precisaCamera = exigeFoto(link);
  const bloqueado = precisaCamera && camera !== 'ok';

  return (
    <>
      {aviso && (
        <div className={styles.aviso}>
          <Note tone="warn" icon={faCircleInfo}>{aviso}</Note>
        </div>
      )}

      <section className={styles.cartao} aria-labelledby="titulo-documento">
        <span className={styles.rotulo}>Documento para assinar</span>
        <h1 id="titulo-documento" className={styles.titulo}>{link.document.title}</h1>

        <div className={styles.dados}>
          <div className={styles.dado}>
            <span className={styles.rotulo}>Para</span>
            <span className={styles.dadoValor}>
              {link.signer.name}
              {link.signer.role ? ` — ${link.signer.role}` : ''}
            </span>
          </div>
          {link.sent_by && (
            <div className={styles.dado}>
              <span className={styles.rotulo}>Enviado por</span>
              <span className={styles.dadoValor}>
                {link.sent_by}
                {link.sent_at ? `, em ${dataHora(link.sent_at)}` : ''}
              </span>
            </div>
          )}
          {link.expires_at && (
            <div className={styles.dado}>
              <span className={styles.rotulo}>Link válido até</span>
              <span className={styles.dadoValor}>{dataHora(link.expires_at)}</span>
            </div>
          )}
        </div>
      </section>

      <section className={styles.cartao} aria-labelledby="titulo-pedidos">
        <h2 id="titulo-pedidos" className={styles.subtitulo}>O que vai ser pedido</h2>
        <ul className={styles.pedidos}>
          <li className={styles.pedido}>
            <span className={styles.pedidoIcone}><FontAwesomeIcon icon={faIdCard} /></span>
            <span>
              {r.identity === 'cpf_full'
                ? 'Seu CPF completo, para confirmar que é você.'
                : 'A confirmação do seu CPF.'}
              {typeof link.identity_attempts_left === 'number' &&
                ` Você tem ${plural(link.identity_attempts_left, 'tentativa', 'tentativas')}.`}
            </span>
          </li>
          {r.form && (
            <li className={styles.pedido}>
              <span className={styles.pedidoIcone}><FontAwesomeIcon icon={faListCheck} /></span>
              <span>Algumas perguntas para completar o documento.</span>
            </li>
          )}
          {anexos > 0 && (
            <li className={styles.pedido}>
              <span className={styles.pedidoIcone}><FontAwesomeIcon icon={faPaperclip} /></span>
              <span>
                {plural(anexos, 'documento para anexar', 'documentos para anexar')}
                {obrigatorios > 0
                  ? ` (${plural(obrigatorios, 'obrigatório', 'obrigatórios')}).`
                  : ' (opcional).'}{' '}
                Pode ser foto tirada na hora ou arquivo PDF.
              </span>
            </li>
          )}
          <li className={styles.pedido}>
            <span className={styles.pedidoIcone}><FontAwesomeIcon icon={faFileSignature} /></span>
            <span>A leitura do documento.</span>
          </li>
          <li className={styles.pedido}>
            <span className={styles.pedidoIcone}><FontAwesomeIcon icon={faSignature} /></span>
            <span>Sua assinatura, feita com o dedo na tela (ou com o mouse).</span>
          </li>
          {r.initials && (
            <li className={styles.pedido}>
              <span className={styles.pedidoIcone}><FontAwesomeIcon icon={faPenNib} /></span>
              <span>Seu visto (rubrica), além da assinatura.</span>
            </li>
          )}
          {precisaCamera && (
            <li className={styles.pedido}>
              <span className={styles.pedidoIcone}><FontAwesomeIcon icon={faCamera} /></span>
              <span>Uma foto sua, tirada na hora pela câmera do aparelho.</span>
            </li>
          )}
        </ul>
      </section>

      {precisaCamera && camera === 'ausente' && (
        <div className={styles.aviso} data-testid="sem-camera">
          <Note tone="danger" icon={faTriangleExclamation}>
            <strong>Este aparelho não tem câmera disponível.</strong> Para assinar, abra o link
            do e-mail num celular, tablet ou computador com câmera: o clube pede uma foto sua no
            momento da assinatura.
          </Note>
        </div>
      )}

      {erro && (
        <div className={styles.aviso} role="alert">
          <Note tone="danger" icon={faTriangleExclamation}>{erro}</Note>
        </div>
      )}

      <div className={styles.acoes}>
        <button
          type="button"
          className={`${styles.botao} ${styles.botaoPrincipal}`}
          onClick={aoComecar}
          disabled={bloqueado || ocupado}
        >
          {ocupado || (precisaCamera && camera === 'verificando') ? (
            <FontAwesomeIcon icon={faSpinner} spin />
          ) : null}
          Começar
        </button>
      </div>
    </>
  );
}
