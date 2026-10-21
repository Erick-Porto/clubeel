'use client';

/**
 * Fluxo da assinatura remota — conduz as etapas na ordem da Lara:
 *
 *   entrada → CPF → perguntas* → anexos* → leitura → aceite → assinatura →
 *   visto* → foto → envio → sucesso            (* só quando a API pede)
 *
 * O front não decide nada: quais etapas existem vem de `form`, `attachments`,
 * `rules` e `requirements`; prazos, tentativas e validações são da Lara, e as
 * recusas mostram o `error` que ela mandou. As recusas que mudam de tela
 * (link encerrado, sessão caída, CPF pendente, anexo faltando) passam todas por
 * `tratar`.
 *
 * Nada fica no aparelho: o estado vive só na memória desta aba (sem
 * localStorage, sessionStorage, IndexedDB ou cache), e os dados sensíveis
 * (assinatura, visto, foto, respostas do envio) são descartados ao terminar.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faClock,
  faRotateRight,
  faSpinner,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import styles from '../../../../styles/assinatura.module.css';
import { Note } from '../../../components/UI/ui';
import { api } from '../cliente';
import { minutosSegundos } from '../formato';
import type { Desenho, LinkInfo, ListaAnexos, Recusa, ResultadoAssinatura, Sessao } from '../tipos';
import EtapaAceite, { type Aceite } from './etapa-aceite';
import EtapaAnexos from './etapa-anexos';
import EtapaCpf from './etapa-cpf';
import EtapaEntrada, { exigeFoto, type EstadoCamera } from './etapa-entrada';
import EtapaFoto from './etapa-foto';
import EtapaLeitura, { type Leitura } from './etapa-leitura';
import EtapaPerguntas from './etapa-perguntas';
import QuadroAssinatura from './quadro-assinatura';
import RecusarDocumento from './recusar-documento';
import { encerraFluxo, TelaRecusado, TelaRecusaFinal, TelaSucesso } from './telas-finais';

type Etapa =
  | 'carregando'
  | 'falha'
  | 'entrada'
  | 'cpf'
  | 'perguntas'
  | 'anexos'
  | 'leitura'
  | 'aceite'
  | 'assinatura'
  | 'visto'
  | 'foto'
  | 'envio'
  | 'sucesso'
  | 'recusado'
  | 'final';

type EtapaDoDocumento = Extract<
  Etapa,
  'cpf' | 'perguntas' | 'anexos' | 'leitura' | 'aceite' | 'assinatura' | 'visto' | 'foto'
>;

/** Etapas com sessão aberta (consulta `sessao` a cada ~15 s). */
const COM_SESSAO = new Set<Etapa>(['cpf', 'perguntas', 'anexos', 'leitura', 'aceite', 'assinatura', 'visto', 'foto']);
/** A partir da leitura, recusar fica disponível em qualquer etapa. */
const PODE_RECUSAR = new Set<Etapa>(['leitura', 'aceite', 'assinatura', 'visto', 'foto']);

const INTERVALO_SESSAO_MS = 15_000;

type Envio =
  | { fase: 'enviando' }
  | { fase: 'verificando' }
  | { fase: 'naoEntrou' }
  | { fase: 'semConexao' }
  | { fase: 'erro'; mensagem: string };

/** Recusas em que a requisição pode ter chegado à Lara sem a resposta voltar. */
function respostaPerdida(recusa: Recusa): boolean {
  return recusa.reason === 'network' || recusa.reason === 'unavailable';
}

/**
 * Quais etapas este documento tem, a partir do que a API mandou. Antes da
 * sessão vale o `requirements` do link; com sessão, o que a sessão diz.
 */
function planejar(link: LinkInfo | null, sessao: Sessao | null, anexos: ListaAnexos | null): EtapaDoDocumento[] {
  const temPerguntas = sessao ? sessao.form !== null && sessao.form.fields.length > 0 : Boolean(link?.requirements.form);
  const qtdAnexos = anexos
    ? anexos.items.length
    : sessao?.attachments
      ? sessao.attachments.items.length
      : (link?.requirements.attachments ?? 0);
  const pedeVisto = sessao ? sessao.rules.requires_initials : Boolean(link?.requirements.initials);
  const pedeFoto = sessao ? sessao.rules.requires_photo !== false : link ? exigeFoto(link) : true;

  const etapas: EtapaDoDocumento[] = ['cpf'];
  if (temPerguntas) etapas.push('perguntas');
  if (qtdAnexos > 0) etapas.push('anexos');
  etapas.push('leitura', 'aceite', 'assinatura');
  if (pedeVisto) etapas.push('visto');
  if (pedeFoto) etapas.push('foto');
  return etapas;
}

async function verificarCamera(): Promise<boolean> {
  const dispositivos = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
  if (!dispositivos || typeof dispositivos.getUserMedia !== 'function') return false;
  if (typeof dispositivos.enumerateDevices !== 'function') return true;
  try {
    const lista = await dispositivos.enumerateDevices();
    // Lista vazia = o navegador não informa antes da permissão: não dá para afirmar que falta.
    return lista.length === 0 || lista.some((d) => d.kind === 'videoinput');
  } catch {
    return true;
  }
}

const ACEITE_VAZIO: Aceite = { accepted: false, photo_consent: false, wants_copy: false };
const LEITURA_VAZIA: Leitura = { segundos: 0, fim: false };

export default function FluxoAssinatura({ temSessao }: { temSessao: boolean }) {
  const [etapa, setEtapa] = useState<Etapa>('carregando');
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [anexos, setAnexos] = useState<ListaAnexos | null>(null);
  const [camera, setCamera] = useState<EstadoCamera>('verificando');

  const [avisoEntrada, setAvisoEntrada] = useState<string | null>(null);
  const [avisoAnexos, setAvisoAnexos] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [leitura, setLeitura] = useState<Leitura>(LEITURA_VAZIA);
  const [aceite, setAceite] = useState<Aceite>(ACEITE_VAZIO);
  const [assinatura, setAssinatura] = useState<Desenho | null>(null);
  const [visto, setVisto] = useState<Desenho | null>(null);
  const [foto, setFoto] = useState<string | null>(null);

  const [envio, setEnvio] = useState<Envio>({ fase: 'enviando' });
  const [recusaFinal, setRecusaFinal] = useState<Recusa | null>(null);
  const [resultado, setResultado] = useState<ResultadoAssinatura | null>(null);
  const [pediuVia, setPediuVia] = useState(false);
  const [mensagemRecusa, setMensagemRecusa] = useState<string | null>(null);
  const [recusando, setRecusando] = useState(false);

  /** Tempo da sessão: o que a Lara disse e quando (relógio monotônico da aba). */
  const [tempo, setTempo] = useState<{ restante: number; aviso: number; em: number } | null>(null);
  const [agora, setAgora] = useState(0);

  /** A última requisição do `assinar`, para reenviar igual se a resposta se perder. */
  const corpoEnvioRef = useRef<Record<string, unknown> | null>(null);
  const etapaRef = useRef<Etapa>(etapa);
  etapaRef.current = etapa;

  const plano = useMemo(() => planejar(link, sessao, anexos), [link, sessao, anexos]);

  /* ------------------------------------------------------------------ apoio */

  const registrarSessao = useCallback((s: Sessao) => {
    setSessao(s);
    if (s.session && typeof s.session.remaining_seconds === 'number') {
      setTempo({
        restante: s.session.remaining_seconds,
        aviso: s.session.warning_seconds ?? 60,
        em: performance.now(),
      });
    }
  }, []);

  /** Descarta da memória tudo o que a pessoa produziu nesta tentativa. */
  const descartarDados = useCallback(() => {
    setLeitura(LEITURA_VAZIA);
    setAceite(ACEITE_VAZIO);
    setAssinatura(null);
    setVisto(null);
    setFoto(null);
    setAnexos(null);
    setSessao(null);
    setTempo(null);
    corpoEnvioRef.current = null;
  }, []);

  const carregarLink = useCallback(async () => {
    setEtapa('carregando');
    setErro(null);
    const resposta = await api<LinkInfo>('link', { method: 'POST' });
    if (resposta.ok) {
      setLink(resposta.data);
      setEtapa('entrada');
      return;
    }
    if (encerraFluxo(resposta.recusa.reason)) {
      descartarDados();
      setRecusaFinal(resposta.recusa);
      setEtapa('final');
      return;
    }
    setErro(resposta.recusa.error);
    setEtapa('falha');
  }, [descartarDados]);

  /** Recusas que mudam de tela. Devolve true quando tratou. */
  const tratar = useCallback(
    (recusa: Recusa): boolean => {
      if (encerraFluxo(recusa.reason)) {
        descartarDados();
        setRecusando(false);
        setRecusaFinal(recusa);
        setEtapa('final');
        return true;
      }
      if (recusa.reason === 'session_ended') {
        // Volta à entrada: se o link ainda valer, a pessoa começa de novo (as
        // tentativas de CPF continuam contando e os anexos continuam lá).
        descartarDados();
        setRecusando(false);
        setAvisoEntrada(recusa.error);
        void carregarLink();
        return true;
      }
      if (recusa.reason === 'identity_required') {
        setEtapa('cpf');
        return true;
      }
      if (recusa.reason === 'attachments_missing') {
        setAvisoAnexos(recusa.error);
        setEtapa('anexos');
        return true;
      }
      return false;
    },
    [carregarLink, descartarDados]
  );

  /**
   * Vai para a próxima etapa do plano depois de `atual`, com os dados mais
   * novos (o estado ainda pode não ter atualizado). Devolve false se `atual`
   * era a última — aí quem chamou envia.
   */
  const seguir = useCallback(
    (atual: EtapaDoDocumento, s: Sessao | null = sessao, a: ListaAnexos | null = anexos): boolean => {
      const etapas = planejar(link, s, a);
      const proxima = etapas[etapas.indexOf(atual) + 1];
      setErro(null);
      if (!proxima) return false;
      setEtapa(proxima);
      return true;
    },
    [link, sessao, anexos]
  );

  /** Depois do CPF: a sessão passa a trazer perguntas e anexos. */
  const aposIdentidade = useCallback(
    (s: Sessao) => {
      registrarSessao(s);
      const lista = s.attachments ?? null;
      setAnexos(lista);
      seguir('cpf', s, lista);
    },
    [registrarSessao, seguir]
  );

  /* ------------------------------------------------------------- início */

  useEffect(() => {
    let ativo = true;
    void verificarCamera().then((ok) => {
      if (ativo) setCamera(ok ? 'ok' : 'ausente');
    });

    (async () => {
      // Página recarregada com a sessão ainda aberta: retoma em vez de abrir outra.
      if (temSessao) {
        const resposta = await api<Sessao>('sessao');
        if (!ativo) return;
        if (resposta.ok) {
          const s = resposta.data;
          registrarSessao(s);
          if (s.rules.identity_confirmed) aposIdentidade(s);
          else setEtapa('cpf');
          return;
        }
        if (resposta.recusa.reason !== 'session_ended' && tratar(resposta.recusa)) return;
      }
      if (ativo) await carregarLink();
    })();

    return () => {
      ativo = false;
    };
    // Só na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cada etapa começa do topo.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [etapa]);

  // A lista de anexos é relida ao entrar na etapa (o clube pode ter enviado algo).
  useEffect(() => {
    if (etapa !== 'anexos') return;
    let ativo = true;
    void api<ListaAnexos>('anexos').then((resposta) => {
      if (!ativo) return;
      if (resposta.ok) setAnexos(resposta.data);
      else tratar(resposta.recusa);
    });
    return () => {
      ativo = false;
    };
  }, [etapa, tratar]);

  /* ------------------------------------------------------- sessão viva */

  useEffect(() => {
    if (!COM_SESSAO.has(etapa)) return;

    const consultar = async () => {
      if (document.visibilityState !== 'visible') return;
      const resposta = await api<Sessao>('sessao');
      if (!COM_SESSAO.has(etapaRef.current)) return; // a tela mudou enquanto esperava
      if (resposta.ok) registrarSessao(resposta.data);
      else if (resposta.recusa.reason === 'session_ended' || encerraFluxo(resposta.recusa.reason)) {
        tratar(resposta.recusa);
      }
      // Rede ou limite: tenta de novo no próximo ciclo.
    };

    const relogio = window.setInterval(consultar, INTERVALO_SESSAO_MS);
    const aoVoltarParaAba = () => {
      if (document.visibilityState === 'visible') void consultar();
    };
    document.addEventListener('visibilitychange', aoVoltarParaAba);
    return () => {
      window.clearInterval(relogio);
      document.removeEventListener('visibilitychange', aoVoltarParaAba);
    };
  }, [etapa, registrarSessao, tratar]);

  // Relógio do aviso: segundos desde a última resposta da Lara (não o relógio do aparelho).
  useEffect(() => {
    if (!tempo || !COM_SESSAO.has(etapa)) return;
    setAgora(performance.now());
    const t = window.setInterval(() => setAgora(performance.now()), 1000);
    return () => window.clearInterval(t);
  }, [tempo, etapa]);

  const restante = tempo ? tempo.restante - Math.max(0, agora - tempo.em) / 1000 : null;
  const mostrarAvisoSessao =
    COM_SESSAO.has(etapa) && tempo !== null && restante !== null && restante < tempo.aviso;

  /* ----------------------------------------------------------- ações */

  async function comecar() {
    setOcupado(true);
    setErro(null);
    setAvisoEntrada(null);
    const resposta = await api<Sessao>('abrir', { method: 'POST' });
    setOcupado(false);
    if (!resposta.ok) {
      if (!tratar(resposta.recusa)) setErro(resposta.recusa.error);
      return;
    }
    const s = resposta.data;
    registrarSessao(s);
    if (s.rules.identity_confirmed) aposIdentidade(s);
    else setEtapa('cpf');
  }

  async function cpfConfirmado() {
    setOcupado(true);
    const resposta = await api<Sessao>('sessao');
    setOcupado(false);
    if (resposta.ok) {
      aposIdentidade(resposta.data);
      return;
    }
    if (!tratar(resposta.recusa)) setErro(resposta.recusa.error);
  }

  async function sairDaLeitura(l: Leitura) {
    setLeitura(l);
    setErro(null);
    setOcupado(true);
    const resposta = await api<{ ok: boolean }>('visualizado', {
      json: { read_seconds: l.segundos, scrolled_to_end: l.fim },
    });
    setOcupado(false);
    if (resposta.ok) {
      seguir('leitura');
      return;
    }
    if (!tratar(resposta.recusa)) setErro(resposta.recusa.error);
  }

  async function sair() {
    setOcupado(true);
    await api('encerrar', { method: 'POST' });
    setOcupado(false);
    descartarDados();
    setAvisoEntrada('Você saiu sem assinar. O link continua valendo: pode voltar quando quiser.');
    await carregarLink();
  }

  /**
   * Corpo do `assinar`. `novos` traz o que acabou de ser produzido na etapa que
   * chamou (o estado do React ainda não atualizou nesse instante).
   */
  function montarCorpo(novos: { assinatura?: Desenho; visto?: Desenho; foto?: string } = {}): Record<string, unknown> | null {
    const traco = novos.assinatura ?? assinatura;
    const rubrica = novos.visto ?? visto;
    const retratoAtual = novos.foto ?? foto;
    if (!sessao || !traco) return null;
    const retrato = window.matchMedia?.('(orientation: portrait)').matches ?? window.innerHeight >= window.innerWidth;
    return {
      signature: traco.png,
      strokes: traco.tracos,
      ...(sessao.rules.requires_initials && rubrica
        ? { initials: rubrica.png, initials_strokes: rubrica.tracos }
        : {}),
      ...(retratoAtual ? { photo: retratoAtual } : {}),
      photo_consent: aceite.photo_consent,
      accepted: aceite.accepted,
      wants_copy: sessao.signer.has_email ? aceite.wants_copy : false,
      read_seconds: leitura.segundos,
      scrolled_to_end: leitura.fim,
      viewport: { w: window.innerWidth, h: window.innerHeight, orientation: retrato ? 'portrait' : 'landscape' },
    };
  }

  function concluir(dados: ResultadoAssinatura | null) {
    setPediuVia(Boolean(sessao?.signer.has_email && aceite.wants_copy));
    setResultado(dados);
    descartarDados();
    setEtapa('sucesso');
  }

  /**
   * Falha de rede no `assinar`: a assinatura pode ter entrado sem a resposta
   * chegar. Pergunta ao `link`: `link_used` = entrou; link válido = não entrou.
   */
  async function verificarEnvio() {
    setEnvio({ fase: 'verificando' });
    const resposta = await api<LinkInfo>('link', { method: 'POST' });
    if (resposta.ok) {
      setEnvio({ fase: 'naoEntrou' });
      return;
    }
    if (resposta.recusa.reason === 'link_used') {
      concluir(null);
      return;
    }
    if (respostaPerdida(resposta.recusa)) {
      setEnvio({ fase: 'semConexao' });
      return;
    }
    if (!tratar(resposta.recusa)) setEnvio({ fase: 'erro', mensagem: resposta.recusa.error });
  }

  async function enviar(corpo: Record<string, unknown> | null) {
    if (!corpo) {
      setEtapa('assinatura');
      return;
    }
    corpoEnvioRef.current = corpo;
    setEtapa('envio');
    setEnvio({ fase: 'enviando' });
    const resposta = await api<ResultadoAssinatura>('assinar', { json: corpo });
    if (resposta.ok) {
      concluir(resposta.data);
      return;
    }
    if (respostaPerdida(resposta.recusa)) {
      await verificarEnvio();
      return;
    }
    if (tratar(resposta.recusa)) return;
    setEnvio({ fase: 'erro', mensagem: resposta.recusa.error });
  }

  /** Voltar entre etapas do documento (o CPF, uma vez confirmado, não volta). */
  function voltar() {
    const anterior = plano[plano.indexOf(etapa as EtapaDoDocumento) - 1];
    if (anterior && anterior !== 'cpf') {
      setErro(null);
      setEtapa(anterior);
    }
  }

  /* ----------------------------------------------------------- tela */

  if (etapa === 'carregando') {
    return (
      <div className={styles.carregando} role="status">
        <FontAwesomeIcon icon={faSpinner} spin /> Carregando…
      </div>
    );
  }

  if (etapa === 'falha') {
    return (
      <section className={styles.cartao}>
        <div className={styles.aviso} role="alert">
          <Note tone="danger" icon={faTriangleExclamation}>{erro}</Note>
        </div>
        <button type="button" className={`${styles.botao} ${styles.botaoSecundario}`} onClick={() => void carregarLink()}>
          <FontAwesomeIcon icon={faRotateRight} /> Tentar de novo
        </button>
      </section>
    );
  }

  if (etapa === 'final' && recusaFinal) return <TelaRecusaFinal recusa={recusaFinal} />;
  if (etapa === 'sucesso') return <TelaSucesso resultado={resultado} pediuVia={pediuVia} />;
  if (etapa === 'recusado') return <TelaRecusado mensagem={mensagemRecusa} />;

  if (etapa === 'entrada' && link) {
    return (
      <EtapaEntrada
        link={link}
        camera={camera}
        aviso={avisoEntrada}
        erro={erro}
        ocupado={ocupado}
        aoComecar={() => void comecar()}
      />
    );
  }

  const indice = plano.indexOf(etapa as EtapaDoDocumento);
  const anterior = indice > 0 ? plano[indice - 1] : null;
  const podeVoltar = COM_SESSAO.has(etapa) && anterior !== null && anterior !== 'cpf';
  const titulo = sessao?.document.title ?? link?.document.title ?? '';

  return (
    <>
      {indice >= 0 && (
        <div className={styles.progresso}>
          <div className={styles.progressoTexto}>
            <span className={styles.progressoDocumento}>{titulo}</span>
            <span data-testid="progresso">Etapa {indice + 1} de {plano.length}</span>
          </div>
          <div
            className={styles.progressoBarra}
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={plano.length}
            aria-valuenow={indice + 1}
            aria-label="Andamento da assinatura"
          >
            <div className={styles.progressoPreenchido} style={{ width: `${((indice + 1) / plano.length) * 100}%` }} />
          </div>
        </div>
      )}

      {mostrarAvisoSessao && restante !== null && (
        <div className={`${styles.aviso} ${styles.avisoSessao}`} role="status" data-testid="aviso-sessao">
          <Note tone="warn" icon={faClock}>
            Sua sessão termina em <strong className={styles.mono}>{minutosSegundos(restante)}</strong>. Conclua esta
            etapa; se ela terminar, é só abrir o link de novo.
          </Note>
        </div>
      )}

      {erro && etapa !== 'leitura' && (
        <div className={styles.aviso} role="alert">
          <Note tone="danger" icon={faTriangleExclamation}>{erro}</Note>
        </div>
      )}

      {etapa === 'cpf' && (
        <EtapaCpf
          tentativas={sessao?.link?.identity_attempts_left ?? link?.identity_attempts_left ?? null}
          tratar={tratar}
          aoConfirmar={() => void cpfConfirmado()}
        />
      )}

      {etapa === 'perguntas' && sessao?.form && (
        <EtapaPerguntas
          campos={sessao.form.fields}
          tratar={tratar}
          aoResponder={(s) => {
            registrarSessao(s);
            const lista = anexos ?? s.attachments ?? null;
            if (!anexos && lista) setAnexos(lista);
            seguir('perguntas', s, lista);
          }}
        />
      )}

      {etapa === 'anexos' && anexos && (
        <EtapaAnexos
          lista={anexos}
          aviso={avisoAnexos}
          tratar={tratar}
          aoAtualizar={setAnexos}
          aoContinuar={() => {
            setAvisoAnexos(null);
            seguir('anexos');
          }}
        />
      )}
      {etapa === 'anexos' && !anexos && (
        <div className={styles.carregando} role="status">
          <FontAwesomeIcon icon={faSpinner} spin /> Carregando os anexos…
        </div>
      )}

      {etapa === 'leitura' && (
        <EtapaLeitura
          versao={sessao?.document.pdf_version ?? null}
          inicial={leitura}
          tratar={tratar}
          aoContinuar={sairDaLeitura}
          ocupado={ocupado}
          erroAoContinuar={erro}
        />
      )}

      {etapa === 'aceite' && sessao && (
        <EtapaAceite
          valor={aceite}
          textoFoto={sessao.photo_consent_text ?? null}
          pedeFoto={sessao.rules.requires_photo !== false}
          temEmail={sessao.signer.has_email}
          aoMudar={setAceite}
          aoContinuar={() => seguir('aceite')}
        />
      )}

      {etapa === 'assinatura' && (
        <QuadroAssinatura
          key="assinatura"
          titulo="Sua assinatura"
          instrucao="Assine dentro do quadro com o dedo (ou com o mouse), como você assina no papel."
          minimo={30}
          inicial={assinatura}
          aoContinuar={(d) => {
            setAssinatura(d);
            if (!seguir('assinatura')) void enviar(montarCorpo({ assinatura: d }));
          }}
        />
      )}

      {etapa === 'visto' && (
        <QuadroAssinatura
          key="visto"
          titulo="Seu visto"
          instrucao="Agora faça o seu visto (rubrica) dentro do quadro."
          minimo={8}
          visto
          inicial={visto}
          aoContinuar={(d) => {
            setVisto(d);
            if (!seguir('visto')) void enviar(montarCorpo({ visto: d }));
          }}
        />
      )}

      {etapa === 'foto' && (
        <EtapaFoto
          inicial={foto}
          aoContinuar={(f) => {
            setFoto(f);
            void enviar(montarCorpo({ foto: f }));
          }}
        />
      )}

      {etapa === 'envio' && (
        <TelaEnvio
          envio={envio}
          aoReenviar={() => void enviar(corpoEnvioRef.current)}
          aoVerificar={() => void verificarEnvio()}
          aoRefazer={() => setEtapa('assinatura')}
        />
      )}

      {COM_SESSAO.has(etapa) && (
        <div className={styles.rodapeEtapa}>
          {podeVoltar ? (
            <button type="button" className={styles.botaoTexto} onClick={voltar}>
              <FontAwesomeIcon icon={faArrowLeft} /> Voltar
            </button>
          ) : (
            <span />
          )}
          {PODE_RECUSAR.has(etapa) ? (
            <button type="button" className={styles.botaoTexto} onClick={() => setRecusando(true)}>
              Recusar documento
            </button>
          ) : null}
          <button type="button" className={styles.botaoTexto} onClick={() => void sair()} disabled={ocupado}>
            Sair sem assinar
          </button>
        </div>
      )}

      {recusando && (
        <RecusarDocumento
          aoFechar={() => setRecusando(false)}
          tratar={tratar}
          aoRecusar={(mensagem) => {
            setRecusando(false);
            descartarDados();
            setMensagemRecusa(mensagem);
            setEtapa('recusado');
          }}
        />
      )}
    </>
  );
}

function TelaEnvio({
  envio,
  aoReenviar,
  aoVerificar,
  aoRefazer,
}: {
  envio: Envio;
  aoReenviar: () => void;
  aoVerificar: () => void;
  aoRefazer: () => void;
}) {
  return (
    <section className={styles.cartao} aria-live="polite" data-testid="envio">
      <h1 className={styles.titulo}>Enviando sua assinatura</h1>

      {envio.fase === 'enviando' && (
        <div className={styles.carregando} role="status">
          <FontAwesomeIcon icon={faSpinner} spin /> Enviando… não feche esta página.
        </div>
      )}

      {envio.fase === 'verificando' && (
        <div className={styles.carregando} role="status">
          <FontAwesomeIcon icon={faSpinner} spin /> A conexão falhou. Conferindo se a assinatura chegou ao clube…
        </div>
      )}

      {envio.fase === 'naoEntrou' && (
        <>
          <div className={styles.aviso}>
            <Note tone="warn" icon={faTriangleExclamation}>
              A assinatura não chegou ao clube. Confira a sua internet e envie de novo.
            </Note>
          </div>
          <button type="button" className={`${styles.botao} ${styles.botaoPrincipal}`} onClick={aoReenviar}>
            <FontAwesomeIcon icon={faRotateRight} /> Enviar de novo
          </button>
        </>
      )}

      {envio.fase === 'semConexao' && (
        <>
          <div className={styles.aviso}>
            <Note tone="danger" icon={faTriangleExclamation}>
              Sem conexão para confirmar se a assinatura chegou. Confira a sua internet e toque em
              &quot;Conferir de novo&quot; — não assine de novo antes disso.
            </Note>
          </div>
          <button type="button" className={`${styles.botao} ${styles.botaoPrincipal}`} onClick={aoVerificar}>
            <FontAwesomeIcon icon={faRotateRight} /> Conferir de novo
          </button>
        </>
      )}

      {envio.fase === 'erro' && (
        <>
          <div className={styles.aviso} role="alert">
            <Note tone="danger" icon={faTriangleExclamation}>{envio.mensagem}</Note>
          </div>
          <button type="button" className={`${styles.botao} ${styles.botaoSecundario}`} onClick={aoRefazer}>
            Refazer a assinatura
          </button>
        </>
      )}
    </section>
  );
}
