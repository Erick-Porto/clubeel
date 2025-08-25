"use client";

import { useEffect, useState } from 'react';
import styles from "@/styles/carousel.module.css";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faChevronLeft } from '@fortawesome/free-solid-svg-icons';

interface CarouselProps{
  controllers: boolean;
  height: number;
}

export default function Carousel({height, controllers}: CarouselProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [activeItem, setActiveItem] = useState(0);

  useEffect(() => {
    async function fetchFiles() {
      const response = await fetch('/api/carousel'); // Corrigido o caminho da API
      const data = await response.json();
      setFiles(data);
    }
    fetchFiles();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveItem((prevActiveItem) => (prevActiveItem + 1) % files.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [files.length]);

  const handlePrevClick = () => {
    setActiveItem((prevActiveItem) => (prevActiveItem - 1 + files.length) % files.length);
  };

  const handleNextClick = () => {
    setActiveItem((prevActiveItem) => (prevActiveItem + 1) % files.length);
  };

  return (
      <div className={styles.carousel} style={{ height: `${height}vh` }}>
      {controllers && (
        <>
          <div className={styles.coverLogo}></div>
          {/* <Image className={styles.coverLogo} alt="Logo do Clube dos Funcionários" src={Logo} width={400} height={133}/> */}
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
          style={{ backgroundImage: `url(/images/carousel/${file})` }} // Corrigido o caminho das imagens
        >
        </div>
      ))}
    </div>
  );
}