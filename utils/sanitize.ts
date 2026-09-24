/**
 * Defesa de profundidade contra injecao em dados vindos do cliente ANTES de
 * repassa-los a API interna (Lara) ou de usa-los no servidor.
 *
 * Cobre os vetores aplicaveis a um servico Node/JSON:
 *  - Prototype pollution  (__proto__, constructor, prototype)
 *  - Injecao de operador   (chaves estilo NoSQL: $gt, $where, $ne, ...)
 *  - Bytes NUL / caracteres de controle (truncamento, header/log injection)
 *  - Payloads gigantes/profundos (DoS e ofuscacao de injecao)
 *
 * IMPORTANTE: isto NAO substitui consultas parametrizadas / validacao no
 * backend -- e uma barreira na borda que reduz a superficie de ataque.
 * A funcao valida e REJEITA (lanca InjectionError); nunca muta os valores,
 * para nao alterar dados legitimos (ex.: senhas).
 */

export class InjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InjectionError';
  }
}

export interface SanitizeOptions {
  maxDepth?: number;
  maxNodes?: number;
  maxStringLength?: number;
  maxKeys?: number;
}

const DEFAULTS: Required<SanitizeOptions> = {
  maxDepth: 12,
  maxNodes: 5000,
  maxStringLength: 50_000,
  maxKeys: 1000,
};

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

// RegExp que casa caracteres de controle C0 (0x00..0x1F), incluindo NUL,
// exceto TAB (0x09), LF (0x0A) e CR (0x0D), validos em texto legitimo.
// Construida via fromCharCode para nao inserir bytes de controle no fonte.
const CONTROL_CHARS: RegExp = (() => {
  let cls = '';
  for (let i = 0; i <= 0x1f; i++) {
    if (i === 0x09 || i === 0x0a || i === 0x0d) continue;
    cls += String.fromCharCode(i);
  }
  return new RegExp('[' + cls + ']');
})();

function checkKey(key: string): void {
  if (FORBIDDEN_KEYS.has(key)) {
    throw new InjectionError(`Chave proibida: ${key}`);
  }
  if (key.startsWith('$')) {
    throw new InjectionError(`Chave de operador nao permitida: ${key}`);
  }
  if (CONTROL_CHARS.test(key)) {
    throw new InjectionError('Chave com caractere de controle.');
  }
}

/**
 * Percorre recursivamente o valor validando-o. Lanca InjectionError na
 * primeira violacao; retorna o proprio valor (inalterado) se estiver ok.
 */
export function assertNoInjection<T>(value: T, options: SanitizeOptions = {}): T {
  const opts = { ...DEFAULTS, ...options };
  let nodes = 0;

  const walk = (val: unknown, depth: number): void => {
    if (++nodes > opts.maxNodes) {
      throw new InjectionError('Payload excede o numero maximo de campos.');
    }
    if (depth > opts.maxDepth) {
      throw new InjectionError('Payload excede a profundidade maxima.');
    }

    if (val === null || val === undefined) return;

    if (typeof val === 'string') {
      if (val.length > opts.maxStringLength) {
        throw new InjectionError('Valor de texto excede o tamanho maximo.');
      }
      if (CONTROL_CHARS.test(val)) {
        throw new InjectionError('Valor com caractere de controle/NUL.');
      }
      return;
    }

    if (typeof val === 'number') {
      if (!Number.isFinite(val)) throw new InjectionError('Numero invalido.');
      return;
    }

    if (typeof val === 'boolean') return;

    if (Array.isArray(val)) {
      if (val.length > opts.maxKeys) {
        throw new InjectionError('Array excede o tamanho maximo.');
      }
      for (const item of val) walk(item, depth + 1);
      return;
    }

    if (typeof val === 'object') {
      const keys = Object.keys(val as Record<string, unknown>);
      if (keys.length > opts.maxKeys) {
        throw new InjectionError('Objeto excede o numero maximo de chaves.');
      }
      for (const key of keys) {
        checkKey(key);
        walk((val as Record<string, unknown>)[key], depth + 1);
      }
      return;
    }

    // Funcoes, simbolos, bigint etc. nao existem em JSON legitimo de entrada.
    throw new InjectionError('Tipo de valor nao permitido.');
  };

  walk(value, 0);
  return value;
}

/**
 * Helper para rotas Pages API: valida req.body e req.query. Retorna true se
 * estiver limpo; caso contrario responde 400 e retorna false.
 */
export function guardRequest(
  req: { body?: unknown; query?: unknown },
  res: { status: (code: number) => { json: (body: unknown) => void } }
): boolean {
  try {
    if (req.body !== undefined) assertNoInjection(req.body);
    if (req.query !== undefined) assertNoInjection(req.query);
    return true;
  } catch (err) {
    if (err instanceof InjectionError) {
      res.status(400).json({ error: 'Entrada invalida.', message: 'Entrada invalida.' });
      return false;
    }
    throw err;
  }
}
