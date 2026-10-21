'use client';

/**
 * Etapa 4 — anexos. Um cartão por item da lista da Lara, com o rótulo,
 * obrigatório/opcional, o que já foi enviado e o botão de enviar/trocar.
 *
 *  - Um arquivo por vez, sempre para um `key` da lista.
 *  - O tamanho é conferido contra `max_kb` só para avisar cedo; quem decide
 *    (inclusive o tipo, pelo conteúdo) é a Lara.
 *  - `mine: false` = enviado pelo clube: "já recebido", sem apagar.
 *  - Trocar = apagar o dela e enviar outro.
 *  - Continuar só com `missing_required` vazia (senão o `assinar` volta 409
 *    `attachments_missing`).
 *
 * Não há download de anexo: só tipo, tamanho e data. O arquivo escolhido não
 * fica guardado em lugar nenhum além do envio.
 */

import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCamera,
  faCheck,
  faCircleInfo,
  faFileImage,
  faFilePdf,
  faFolderOpen,
  faSpinner,
  faTrashCan,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import styles from '../../../../styles/assinatura.module.css';
import { Note, Pill } from '../../../components/UI/ui';
import { api } from '../cliente';
import { dataCurta, tamanhoLegivel } from '../formato';
import type { ArquivoAnexo, ItemAnexo, ListaAnexos, Recusa } from '../tipos';

const ACEITOS = 'application/pdf,image/jpeg,image/png';
const ACEITOS_CAMERA = 'image/jpeg,image/png';

interface Props {
  lista: ListaAnexos;
  aviso: string | null;
  tratar: (recusa: Recusa) => boolean;
  aoAtualizar: (lista: ListaAnexos) => void;
  aoContinuar: () => void;
}

export default function EtapaAnexos({ lista, aviso, tratar, aoAtualizar, aoContinuar }: Props) {
  const [toque, setToque] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  // No celular/tablet oferecemos "tirar foto do documento" além de escolher arquivo.
  useEffect(() => {
    setToque(window.matchMedia?.('(pointer: coarse)').matches ?? false);
  }, []);

  const faltando = lista.missing_required ?? [];

  return (
    <section className={styles.cartao} aria-labelledby="titulo-anexos">
      <h1 id="titulo-anexos" className={styles.titulo}>Anexe os documentos</h1>
      <p className={styles.lead}>
        Envie um arquivo por item: PDF ou foto (JPG ou PNG), de até {tamanhoLegivel(lista.max_kb * 1024)}.
      </p>

      {aviso && (
        <div className={styles.aviso}>
          <Note tone="warn" icon={faCircleInfo}>{aviso}</Note>
        </div>
      )}

      {lista.items.map((item) => (
        <CartaoAnexo
          key={item.key}
          item={item}
          maxKb={lista.max_kb}
          toque={toque}
          ocupado={ocupado}
          setOcupado={setOcupado}
          tratar={tratar}
          aoAtualizar={aoAtualizar}
        />
      ))}

      {faltando.length > 0 && (
        <div className={styles.aviso} data-testid="anexos-faltando">
          <Note tone="warn" icon={faCircleInfo}>
            Para continuar, falta enviar: <strong>{faltando.join(', ')}</strong>.
          </Note>
        </div>
      )}

      <button
        type="button"
        className={`${styles.botao} ${styles.botaoPrincipal}`}
        disabled={faltando.length > 0 || ocupado !== null}
        onClick={aoContinuar}
      >
        Continuar
      </button>
    </section>
  );
}

function CartaoAnexo({
  item,
  maxKb,
  toque,
  ocupado,
  setOcupado,
  tratar,
  aoAtualizar,
}: {
  item: ItemAnexo;
  maxKb: number;
  toque: boolean;
  ocupado: string | null;
  setOcupado: (chave: string | null) => void;
  tratar: (recusa: Recusa) => boolean;
  aoAtualizar: (lista: ListaAnexos) => void;
}) {
  const arquivoRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);

  const meus = item.files.filter((f) => f.mine && f.can_remove);
  const temArquivo = item.files.length > 0;
  const estaOcupado = ocupado === item.key;
  const idTitulo = `anexo-${item.key}`;

  async function apagar(arquivo: ArquivoAnexo): Promise<boolean> {
    const resposta = await api<ListaAnexos>(`anexos/${arquivo.id}`, { method: 'DELETE' });
    if (resposta.ok) {
      aoAtualizar(resposta.data);
      return true;
    }
    if (!tratar(resposta.recusa)) setErro(resposta.recusa.error);
    return false;
  }

  async function aoEscolher(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = ''; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    setErro(null);

    if (maxKb > 0 && arquivo.size > maxKb * 1024) {
      setErro(
        `Este arquivo tem ${tamanhoLegivel(arquivo.size)}; o limite é ${tamanhoLegivel(maxKb * 1024)}. ` +
          'Escolha um arquivo menor ou tire a foto com menos zoom.'
      );
      return;
    }

    setOcupado(item.key);
    try {
      // Trocar: primeiro sai o que ela tinha enviado neste item.
      for (const antigo of meus) {
        if (!(await apagar(antigo))) return;
      }
      const form = new FormData();
      form.append('key', item.key);
      form.append('file', arquivo, arquivo.name);
      const resposta = await api<ListaAnexos>('anexos', { form });
      if (resposta.ok) aoAtualizar(resposta.data);
      else if (!tratar(resposta.recusa)) setErro(resposta.recusa.error);
    } finally {
      setOcupado(null);
    }
  }

  async function aoRemover(arquivo: ArquivoAnexo) {
    setErro(null);
    setOcupado(item.key);
    try {
      await apagar(arquivo);
    } finally {
      setOcupado(null);
    }
  }

  const verbo = meus.length > 0 ? 'Trocar' : 'Enviar';

  return (
    <div className={styles.anexo} aria-labelledby={idTitulo} data-testid={`anexo-${item.key}`}>
      <div className={styles.anexoTopo}>
        <span id={idTitulo} className={styles.anexoNome}>{item.label}</span>
        {item.required ? (
          <Pill kind={temArquivo ? 'ok' : 'warn'} icon={temArquivo ? faCheck : undefined}>Obrigatório</Pill>
        ) : (
          <Pill kind={temArquivo ? 'ok' : 'off'} icon={temArquivo ? faCheck : undefined}>Opcional</Pill>
        )}
      </div>

      {item.files.map((arquivo) => (
        <div key={arquivo.id} className={styles.arquivo}>
          <FontAwesomeIcon
            className={styles.arquivoIcone}
            icon={arquivo.type === 'pdf' ? faFilePdf : faFileImage}
          />
          <div className={styles.arquivoTexto}>
            <span>{arquivo.mine ? arquivo.size_label : 'Já recebido pelo clube'}</span>
            <span className={styles.arquivoMeta}>
              {arquivo.mine ? `Enviado em ${dataCurta(arquivo.sent_at)}` : arquivo.size_label}
            </span>
          </div>
          {arquivo.mine && arquivo.can_remove && (
            <button
              type="button"
              className={styles.botaoTexto}
              onClick={() => aoRemover(arquivo)}
              disabled={ocupado !== null}
              aria-label={`Remover o arquivo de ${item.label}`}
            >
              <FontAwesomeIcon icon={faTrashCan} /> Remover
            </button>
          )}
        </div>
      ))}

      {erro && (
        <div className={styles.aviso} role="alert">
          <Note tone="danger" icon={faTriangleExclamation}>{erro}</Note>
        </div>
      )}

      {estaOcupado ? (
        <div className={styles.carregando} role="status">
          <FontAwesomeIcon icon={faSpinner} spin /> Enviando…
        </div>
      ) : (
        <div className={styles.acoesLinha}>
          {toque && (
            <button
              type="button"
              className={`${styles.botao} ${styles.botaoSecundario}`}
              onClick={() => cameraRef.current?.click()}
              disabled={ocupado !== null}
            >
              <FontAwesomeIcon icon={faCamera} /> {verbo === 'Trocar' ? 'Trocar por foto' : 'Tirar foto'}
            </button>
          )}
          <button
            type="button"
            className={`${styles.botao} ${styles.botaoSecundario}`}
            onClick={() => arquivoRef.current?.click()}
            disabled={ocupado !== null}
          >
            <FontAwesomeIcon icon={faFolderOpen} /> {verbo === 'Trocar' ? 'Trocar arquivo' : 'Escolher arquivo'}
          </button>
        </div>
      )}

      <input
        ref={arquivoRef}
        className={styles.escondido}
        type="file"
        accept={ACEITOS}
        onChange={aoEscolher}
        tabIndex={-1}
        aria-hidden="true"
        data-testid={`arquivo-${item.key}`}
      />
      <input
        ref={cameraRef}
        className={styles.escondido}
        type="file"
        accept={ACEITOS_CAMERA}
        capture="environment"
        onChange={aoEscolher}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
