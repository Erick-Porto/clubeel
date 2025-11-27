"use client"

import { useState, useEffect } from 'react'; // 1. Importar hooks
import styles from '@/styles/horizontal-nav-bar.module.css'

interface Option {
    text: string;
    to: number;   // Vertical scroll offset
    page: string; // Não usado aqui, mas mantido para consistência da interface
}

interface HNBProps{
    options: Array<Option>;
}

export default function HorizontalNavBar({options}:HNBProps){
    const [scrollY, setScrollY] = useState(0); // 2. Estado para rastrear a posição de rolagem

    // 3. Efeito para ouvir eventos de rolagem
    useEffect(() => {
        const handleScroll = () => {
            setScrollY(window.scrollY);
        };

        // Adiciona o ouvinte de evento quando o componente é montado
        window.addEventListener('scroll', handleScroll);

        // Limpa o ouvinte de evento quando o componente é desmontado
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, []); // O array de dependências vazio significa que este efeito é executado uma vez na montagem

    // 4. Função para determinar se um item de navegação está ativo
    const isActive = (itemTo: number, index: number) => {
        // O valor 'to' do próximo item, ou Infinity se for o último item
        const nextItemTo = options[index + 1]?.to || Infinity;
        // Verifica se a posição de rolagem está entre o 'to' do item atual e o do próximo
        // O deslocamento (ex: 100) pode ser ajustado com base na altura do cabeçalho ou preferência
        return scrollY + 100 >= itemTo && scrollY + 100 < nextItemTo;
    };

    // 5. Adicionar uma verificação para garantir que 'options' seja um array
    if (!Array.isArray(options)) {
        return null; // Não renderiza nada se as opções não forem fornecidas corretamente
    }

    return(
        <nav className={styles.horizontalNavigation}>
            <ul className={styles.horizontalItemList}>
                {options.map((item, index) => (
                    // 6. Aplicar uma classe condicional para o item ativo
                    <li key={index} className={`${styles.horizontalItem} ${isActive(item.to, index) ? styles.active : ''}`}>
                        {/* 7. Usar <button> para melhor semântica e acessibilidade */}
                        <button
                            onClick={() => window.scrollTo({ top: item.to, behavior: 'smooth' })}
                        >
                            {item.text}
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    )}