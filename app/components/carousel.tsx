"use client";

import { useEffect, useState } from 'react';
import styles from "@/styles/carousel.module.css";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';

interface CarouselProps{
  controllers: boolean;
  height: number;
}

export default function Carousel({height, controllers}: CarouselProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [activeItem, setActiveItem] = useState(0);
  const [isLoading, setIsLoading] = useState(true); // 1. Adicionar estado de carregamento

  useEffect(() => {
    async function fetchFiles() {
      try {
        const response = await fetch('/api/carousel');
        if (!response.ok) {
          throw new Error('Falha ao buscar imagens do carrossel');
        }
        const data = await response.json();
        setFiles(data);
      } catch (error) {
        toast.error("Erro ao buscar imagens do carrossel: " + (error instanceof Error ? error.message : String(error)));
        setFiles([]); // Garante que a lista esteja vazia em caso de erro
      } finally {
        setIsLoading(false); // Finaliza o carregamento, com sucesso ou erro
      }
    }
    fetchFiles();
  }, []);

  useEffect(() => {
    // 2. Garante que o intervalo só seja criado se houver imagens
    if (files.length === 0) {
      return;
    }

    const interval = setInterval(() => {
      setActiveItem((prevActiveItem) => (prevActiveItem + 1) % files.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [files]); // A dependência agora é o array de 'files'

  const handlePrevClick = () => {
    if (files.length === 0) return;
    setActiveItem((prevActiveItem) => (prevActiveItem - 1 + files.length) % files.length);
  };

  const handleNextClick = () => {
    if (files.length === 0) return;
    setActiveItem((prevActiveItem) => (prevActiveItem + 1) % files.length);
  };

  // 3. Renderiza um estado de carregamento ou mensagem de erro
  if (isLoading) {
    return <div className={styles.carousel} style={{ height: `${height}vh`, backgroundColor: '#f0f0f0' }}><span className={styles.loadingText}>Carregando...</span></div>;
  }

  if (!isLoading && files.length === 0) {
    return <div className={styles.carousel} style={{ height: `${height}vh`, backgroundColor: '#f0f0f0' }}><span className={styles.loadingText}>Nenhuma imagem encontrada.</span></div>;
  }

  return (
      <div className={styles.carousel} style={{ height: `${height}vh` }}>
      {controllers && (
        <>
          <div className={styles.coverLogo}></div>
          <div className={styles.carouselButtons}>
            <FontAwesomeIcon icon={faChevronLeft} className={styles.carouselButton} onClick={handlePrevClick} />
            <FontAwesomeIcon icon={faChevronRight} className={styles.carouselButton} onClick={handleNextClick} />
          </div>
        </>
      )}
      {files.map((file, index) => (
        <div
          key={index}
          className={`
            ${styles.carouselItem}
            ${index === activeItem ? styles.active : ''}
          `}
          style={{ backgroundImage: `url(/images/carousel/${file})` }}
        >
        </div>
      ))}
    </div>
  );
}