'use client';

/**
 * Busca na fila do aprovador. Só filtra o que o servidor já renderizou: os
 * cartões chegam prontos (Server Component) e nenhum dado é buscado aqui —
 * a regra da área continua valendo (nada de fetch no cliente).
 */

import { useState, type ReactNode } from 'react';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { SearchBar, matchesSearch } from '../../components/UI/ui';
import styles from '../../../styles/aprovacao.module.css';

export interface ItemFiltravel {
  chave: string;
  /** Texto em que a busca procura (número, fornecedor, departamento…). */
  busca: string;
  conteudo: ReactNode;
}

export default function FiltroOrdens({ itens }: { itens: ItemFiltravel[] }) {
  const [busca, setBusca] = useState('');
  const visiveis = itens.filter((item) => matchesSearch(busca, item.busca));

  return (
    <>
      <div className={styles.busca}>
        <SearchBar
          id="busca-ordens"
          value={busca}
          onChange={setBusca}
          placeholder="Buscar ordem, fornecedor ou departamento"
        />
      </div>

      {visiveis.length === 0 ? (
        <div className={styles.estado}>
          <div className={styles.estadoIcone}>
            <FontAwesomeIcon icon={faMagnifyingGlass} />
          </div>
          <h2 className={styles.estadoTitulo}>Nada encontrado para “{busca}”</h2>
          <p className={styles.estadoTexto}>Confira a grafia ou limpe a busca.</p>
        </div>
      ) : (
        <div className={styles.lista}>
          {visiveis.map((item) => (
            <div key={item.chave} style={{ display: 'contents' }}>
              {item.conteudo}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
