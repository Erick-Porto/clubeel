'use client';

/**
 * Etapa 3 — perguntas do documento (`form.fields`). Um campo por item, com a
 * `question` como título e o `value` que a Lara mandou já preenchido.
 *
 * Quem valida é a Lara: obrigatoriedade, formato e opções. Os erros voltam por
 * campo (`errors[key]`) e aparecem embaixo de cada um. As máscaras daqui são só
 * ajuda visual; a Lara normaliza o que chegar.
 *
 * Respondido, o PDF muda (`document.pdf_version` muda junto): a leitura busca de
 * novo sozinha.
 */

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import styles from '../../../../styles/assinatura.module.css';
import { Note } from '../../../components/UI/ui';
import { api, errosPorCampo } from '../cliente';
import { mascaraCep, mascaraCnpj, mascaraCpf, mascaraTelefone } from '../formato';
import type { CampoFormulario, Recusa, Sessao } from '../tipos';

type Valor = string | string[];

interface Props {
  campos: CampoFormulario[];
  tratar: (recusa: Recusa) => boolean;
  aoResponder: (sessao: Sessao) => void;
}

/** Converte o `value` da Lara no que o campo da tela espera. */
function valorInicial(campo: CampoFormulario): Valor {
  const v = campo.value;
  if (campo.type === 'checkbox') {
    if (Array.isArray(v)) return v.map(String);
    return typeof v === 'string' && v ? [v] : [];
  }
  if (v === null || v === undefined) return '';
  const texto = String(v);
  if (campo.type === 'date' || campo.type === 'date_long') {
    return /^\d{4}-\d{2}-\d{2}/.test(texto) ? texto.slice(0, 10) : '';
  }
  if (campo.type === 'time') return /^\d{2}:\d{2}/.test(texto) ? texto.slice(0, 5) : '';
  if (campo.type === 'yes_no') {
    const normal = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return normal === 'sim' || normal === 'nao' ? normal : '';
  }
  return texto;
}

const MASCARAS: Record<string, (v: string) => string> = {
  cpf: mascaraCpf,
  cnpj: mascaraCnpj,
  cep: mascaraCep,
  phone: mascaraTelefone,
};

export default function EtapaPerguntas({ campos, tratar, aoResponder }: Props) {
  const [valores, setValores] = useState<Record<string, Valor>>(() =>
    Object.fromEntries(campos.map((c) => [c.key, valorInicial(c)]))
  );
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function mudar(chave: string, valor: Valor) {
    setValores((atual) => ({ ...atual, [chave]: valor }));
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setOcupado(true);
    setErros({});
    setErroGeral(null);
    const resposta = await api<Sessao>('respostas', { json: { answers: valores } });
    setOcupado(false);

    if (resposta.ok) {
      aoResponder(resposta.data);
      return;
    }
    if (tratar(resposta.recusa)) return;
    const porCampo = errosPorCampo(resposta.recusa);
    setErros(porCampo);
    setErroGeral(resposta.recusa.error);
    const primeiro = campos.find((c) => porCampo[c.key]);
    if (primeiro) document.getElementById(`campo-${primeiro.key}`)?.focus();
  }

  return (
    <form className={styles.cartao} onSubmit={enviar} noValidate>
      <h1 className={styles.titulo}>Complete o documento</h1>
      <p className={styles.lead}>Responda às perguntas abaixo. As respostas entram no documento.</p>

      {campos.map((campo) => (
        <Campo
          key={campo.key}
          campo={campo}
          valor={valores[campo.key] ?? ''}
          erro={erros[campo.key] ?? null}
          aoMudar={(v) => mudar(campo.key, v)}
        />
      ))}

      {erroGeral && (
        <div className={styles.aviso} role="alert">
          <Note tone="danger" icon={faTriangleExclamation}>{erroGeral}</Note>
        </div>
      )}

      <button type="submit" className={`${styles.botao} ${styles.botaoPrincipal}`} disabled={ocupado}>
        {ocupado && <FontAwesomeIcon icon={faSpinner} spin />}
        Continuar
      </button>
    </form>
  );
}

function Campo({
  campo,
  valor,
  erro,
  aoMudar,
}: {
  campo: CampoFormulario;
  valor: Valor;
  erro: string | null;
  aoMudar: (v: Valor) => void;
}) {
  const id = `campo-${campo.key}`;
  const idErro = `${id}-erro`;
  const comuns = {
    id,
    name: campo.key,
    'aria-invalid': erro ? true : undefined,
    'aria-describedby': erro ? idErro : undefined,
  } as const;

  const titulo = (
    <>
      {campo.question}{' '}
      <span className={styles.campoObrigatorio}>{campo.required ? '(obrigatória)' : '(opcional)'}</span>
    </>
  );
  const textoErro = erro ? <span id={idErro} className={styles.campoErro}>{erro}</span> : null;
  const texto = typeof valor === 'string' ? valor : '';

  // Escolhas: um grupo com legenda, não um <label> único.
  if (campo.type === 'radio' || campo.type === 'yes_no' || campo.type === 'checkbox') {
    const opcoes =
      campo.type === 'yes_no'
        ? [
            { valor: 'sim', rotulo: 'Sim' },
            { valor: 'nao', rotulo: 'Não' },
          ]
        : campo.options.map((o) => ({ valor: o, rotulo: o }));
    const marcados = Array.isArray(valor) ? valor : [];

    return (
      <fieldset className={styles.campo} aria-describedby={erro ? idErro : undefined}>
        <legend className={styles.campoTitulo}>{titulo}</legend>
        <div className={styles.opcoes} id={id} tabIndex={-1}>
          {opcoes.map((opcao) => (
            <label key={opcao.valor} className={styles.opcao}>
              {campo.type === 'checkbox' ? (
                <input
                  type="checkbox"
                  name={campo.key}
                  checked={marcados.includes(opcao.valor)}
                  onChange={(e) =>
                    aoMudar(
                      e.target.checked
                        ? [...marcados, opcao.valor]
                        : marcados.filter((m) => m !== opcao.valor)
                    )
                  }
                />
              ) : (
                <input
                  type="radio"
                  name={campo.key}
                  checked={texto === opcao.valor}
                  onChange={() => aoMudar(opcao.valor)}
                />
              )}
              <span>{opcao.rotulo}</span>
            </label>
          ))}
        </div>
        {textoErro}
      </fieldset>
    );
  }

  let controle: React.ReactNode;
  switch (campo.type) {
    case 'textarea':
      controle = <textarea {...comuns} rows={4} value={texto} onChange={(e) => aoMudar(e.target.value)} />;
      break;
    case 'email':
      controle = (
        <input {...comuns} type="email" inputMode="email" autoComplete="email" value={texto} onChange={(e) => aoMudar(e.target.value)} />
      );
      break;
    case 'number':
      controle = <input {...comuns} type="text" inputMode="decimal" value={texto} onChange={(e) => aoMudar(e.target.value)} />;
      break;
    case 'money':
      controle = (
        <input {...comuns} type="text" inputMode="decimal" placeholder="0,00" value={texto} onChange={(e) => aoMudar(e.target.value)} />
      );
      break;
    case 'date':
    case 'date_long':
      controle = <input {...comuns} type="date" value={texto} onChange={(e) => aoMudar(e.target.value)} />;
      break;
    case 'time':
      controle = <input {...comuns} type="time" value={texto} onChange={(e) => aoMudar(e.target.value)} />;
      break;
    case 'cpf':
    case 'cnpj':
    case 'cep':
    case 'phone': {
      const mascara = MASCARAS[campo.type];
      controle = (
        <input
          {...comuns}
          type={campo.type === 'phone' ? 'tel' : 'text'}
          inputMode={campo.type === 'phone' ? 'tel' : 'numeric'}
          value={texto}
          onChange={(e) => aoMudar(mascara(e.target.value))}
        />
      );
      break;
    }
    default:
      controle = <input {...comuns} type="text" value={texto} onChange={(e) => aoMudar(e.target.value)} />;
  }

  return (
    <div className={styles.campo}>
      <label htmlFor={id} className={styles.campoTitulo}>{titulo}</label>
      {controle}
      {textoErro}
    </div>
  );
}
