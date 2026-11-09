/**
 * Signatários do documento (`signers` da sessão): leitura defensiva do campo,
 * quando o bloco aparece, resumo e data no fuso de São Paulo.
 */

import { describe, expect, it } from 'vitest';
import {
  diaEHora,
  lerSignatarios,
  mostrarSignatarios,
  resumoSignatarios,
  textoAssinou,
} from '../../app/(assinatura)/assinar/signatarios';

const MARIA = {
  name: 'Maria de Souza',
  role: 'Contratante',
  me: false,
  signed: true,
  signed_at: '2026-11-09T10:12:00-03:00',
  status: 'Assinado',
};
const JOAO = { name: 'João da Silva', role: 'Testemunha', me: true, signed: false, signed_at: null, status: 'Pendente' };

describe('signatários', () => {
  it('sem o campo (Lara antiga) ou fora do formato: lista vazia, bloco não aparece', () => {
    for (const valor of [undefined, null, 'x', {}, 3]) {
      const lista = lerSignatarios(valor);
      expect(lista).toEqual([]);
      expect(mostrarSignatarios(lista)).toBe(false);
    }
  });

  it('um signatário só: bloco não aparece', () => {
    expect(mostrarSignatarios(lerSignatarios([JOAO]))).toBe(false);
  });

  it('dois signatários, um assinado: "1 de 2" e data formatada', () => {
    const lista = lerSignatarios([MARIA, JOAO]);
    expect(mostrarSignatarios(lista)).toBe(true);
    expect(resumoSignatarios(lista)).toBe('1 de 2 já assinaram');
    expect(textoAssinou(lista[0])).toBe('assinou em 09/11 às 10:12');
  });

  it('itens sem nome são descartados; campos ausentes ganham padrão', () => {
    const lista = lerSignatarios([{ name: '  ' }, null, { name: 'Ana' }]);
    expect(lista).toEqual([{ name: 'Ana', role: null, me: false, signed: false, signed_at: null, status: '' }]);
  });

  it('data no fuso de São Paulo, qualquer que seja o fuso do instante', () => {
    expect(diaEHora('2026-11-09T13:12:00Z')).toBe('09/11 às 10:12');
    expect(diaEHora('2026-12-31T23:30:00-03:00')).toBe('31/12 às 23:30');
    expect(diaEHora('2026-11-09T03:05:00Z')).toBe('09/11 às 00:05');
    expect(diaEHora(null)).toBeNull();
    expect(diaEHora('ontem')).toBeNull();
    expect(textoAssinou({ ...MARIA, signed_at: null })).toBe('assinou');
  });
});
