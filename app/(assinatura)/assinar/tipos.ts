/**
 * Contratos da API de assinatura remota, como o navegador os recebe das rotas
 * /assinar/api/* (iguais aos da Lara, menos o `session_token`, que nunca sai do
 * servidor).
 */

export interface LinkInfo {
  document: { title: string; validation_code?: string | null };
  signer: { name: string; role?: string | null };
  sent_by?: string | null;
  sent_at?: string | null;
  expires_at?: string | null;
  requirements: {
    identity?: string | null;
    photo?: boolean;
    initials?: boolean;
    form?: boolean;
    attachments?: number;
    attachments_required?: number;
  };
  identity_attempts_left?: number | null;
  server_time?: string | null;
}

/** Tipos de pergunta que a Lara manda em `form.fields[].type`. */
export type TipoCampo =
  | 'text'
  | 'textarea'
  | 'email'
  | 'number'
  | 'money'
  | 'cpf'
  | 'cnpj'
  | 'phone'
  | 'cep'
  | 'date'
  | 'date_long'
  | 'time'
  | 'radio'
  | 'checkbox'
  | 'yes_no';

export interface CampoFormulario {
  key: string;
  question: string;
  /** string, e não só `TipoCampo`: tipo desconhecido vira campo de texto. */
  type: TipoCampo | string;
  required: boolean;
  options: string[];
  value: unknown;
}

export interface ArquivoAnexo {
  id: number;
  type: string;
  size_label: string;
  sent_at: string | null;
  mine: boolean;
  can_remove: boolean;
}

export interface ItemAnexo {
  key: string;
  label: string;
  required: boolean;
  files: ArquivoAnexo[];
}

export interface ListaAnexos {
  items: ItemAnexo[];
  missing_required: string[];
  max_kb: number;
  accepted_types: string[];
}

export interface Sessao {
  document: { id: number; title: string; pdf_url: string | null; pdf_version: string | null };
  form: { answered: boolean; fields: CampoFormulario[] } | null;
  signer: { name: string; role?: string | null; has_email: boolean };
  rules: {
    identity_check?: string | null;
    requires_photo: boolean;
    requires_initials: boolean;
    identity_confirmed: boolean;
  };
  session: { remaining_seconds: number; warning_seconds: number };
  server_time?: string | null;
  photo_consent_text?: string | null;
  attachments: ListaAnexos | null;
  link?: { expires_at?: string | null; identity_attempts_left?: number | null };
}

export interface ResultadoAssinatura {
  ok: boolean;
  message?: string | null;
  signed_at?: string | null;
  validation_code?: string | null;
}

/** Toda recusa, venha da Lara ou das rotas da área. */
export interface Recusa {
  error: string;
  reason: string;
  attempts_left?: number;
  /** Erros por campo: `{ key: "mensagem" }` (respostas) ou `{ campo: ["..."] }` (Laravel). */
  errors?: Record<string, string | string[]>;
}

export interface Ponto {
  x: number;
  y: number;
  t: number;
}

export interface Traco {
  points: Ponto[];
}

/** O que sai do quadro de assinatura (assinatura ou visto). */
export interface Desenho {
  png: string;
  tracos: Traco[];
}
