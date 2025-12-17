import React, { useState, useEffect, useRef } from 'react';
import styles from '@/styles/map-banner.module.css';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  TransformWrapper,
  TransformComponent,
  useTransformContext,
} from 'react-zoom-pan-pinch';

interface Point { x: number; y: number; }
interface Hotspot {
  id: string;
  name: string;
  icon: string;
  image_vertical: string;
  image_horizontal: string;
  vertices: Point[];
  category: string;
}

const ICON_SIZE = 50;
const MAX_SCALE = 4;
const FALLBACK_MIN_SCALE = 0.5;

// --- Funções Auxiliares ---
const getHotspotBounds = (vertices: Point[]) => {
  if (vertices.length === 0) return { centerX: 0, centerY: 0 };
  const allX = vertices.map((v) => v.x);
  const allY = vertices.map((v) => v.y);
  return {
    centerX: Math.min(...allX) + (Math.max(...allX) - Math.min(...allX)) / 2,
    centerY: Math.min(...allY) + (Math.max(...allY) - Math.min(...allY)) / 2,
  };
};

const getPolygonVertices = (vertices: Point[]): Point[] => {
  if (vertices.length === 2) {
    const [p1, p2] = vertices;
    return [p1, { x: p2.x, y: p1.y }, p2, { x: p1.x, y: p2.y }];
  }
  return vertices;
};

const formatPolygonPoints = (vertices: Point[]): string => {
  return vertices.map((p) => `${p.x},${p.y}`).join(' ');
};

// --- COMPONENTE HOTSPOT ---
const HotspotsOverlay: React.FC<{
  places: Hotspot[];
  onIconClick: (hotspot: Hotspot, e: React.MouseEvent | React.TouchEvent) => void;
}> = ({ places, onIconClick }) => {
  const { transformState: { scale } } = useTransformContext();

  // Mantém o ícone visível mesmo com zoom out
  const iconScale = scale < 0.5 ? 1 / 0.5 : 1 / scale;

  return (
    <svg
      className={styles.hotspotOverlay}
      viewBox="0 0 2000 1200"
      preserveAspectRatio="xMidYMid meet"
    >
      {places.map((spot,index) => {
        const { centerX, centerY } = getHotspotBounds(spot.vertices);
        const polygonPoints = formatPolygonPoints(getPolygonVertices(spot.vertices));

        return (
          <React.Fragment key={spot.id}>
            {/* Polígono clicável */}
            <polygon 
                points={polygonPoints} 
                className={styles.hotspotArea}
                onMouseUp={(e) => onIconClick(spot, e)}
                onTouchEnd={(e) => onIconClick(spot, e)}
            />
            
            {/* Ícone Flutuante */}
            <foreignObject
              x={centerX - ICON_SIZE / 2}
              y={centerY - ICON_SIZE / 2}
              width={ICON_SIZE}
              height={ICON_SIZE}
              style={{ overflow: 'visible' }}
            >
              <div
                id={`hotspot-${index}`}
                className={styles.hotspotIconContainer}
                style={{ transform: `scale(${iconScale})` }}
                onMouseUp={(e) => onIconClick(spot, e)}
                onTouchEnd={(e) => onIconClick(spot, e)}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                {/* Efeito de onda/pulse atrás do ícone */}
                <div className={styles.pulseRing} />
                <Image src={spot.icon} alt={spot.name} className={styles.hotspotIcon} draggable={false} height={50} width={50}/>
              </div>
            </foreignObject>
          </React.Fragment>
        );
      })}
    </svg>
  );
};

// --- COMPONENTE PRINCIPAL ---
const MapBanner: React.FC<{ places: Hotspot[] }> = ({ places }) => {
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);
  const [popupPosition, setPopupPosition] = useState<Point>({ x: 0, y: 0 });
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [initialScale, setInitialScale] = useState(FALLBACK_MIN_SCALE);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateScale = () => {
      const { clientWidth, clientHeight } = containerRef.current!;
      if (clientWidth === 0) return;
      const scale = Math.min(clientWidth / 2000, clientHeight / 1200);
      setInitialScale(scale);
      setIsReady(true);
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const handleIconClick = (hotspot: Hotspot, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setActiveHotspot(hotspot);
    
    // Lógica para posicionar o popup
    let clientX, clientY;
    if ('changedTouches' in e) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    // Ajuste simples para Desktop: Se clicar muito à direita, move o popup para esquerda
    const isRightEdge = typeof window !== 'undefined' && clientX > window.innerWidth - 320;
    const finalX = isRightEdge ? clientX - 310 : clientX;

    setPopupPosition({ x: finalX, y: clientY });
  };

  const closePopup = () => setActiveHotspot(null);

  if (!isReady) return <div ref={containerRef} className={styles.bannerContainer} />;

  return (
    <>
      <div ref={containerRef} className={styles.bannerContainer}>
        <TransformWrapper
          key={`map-${initialScale}`}
          initialScale={initialScale}
          minScale={initialScale * 0.8}
          maxScale={MAX_SCALE}
          limitToBounds={true}
          centerOnInit={true}
          wheel={{ step: 0.2 }}
        >
          <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
            {/* Ao clicar na área vazia do mapa, fecha o popup */}
            <div className={styles.mapScene} onMouseUp={closePopup} onTouchEnd={closePopup}>
              <div className={styles.mapContent} />
              <HotspotsOverlay places={places} onIconClick={handleIconClick} />
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>

      {/* POPUP ESTILIZADO */}
      {activeHotspot && (
        <div
          className={styles.popup}
          id='popup-places'
          // No mobile, o CSS ignora esses estilos inline e fixa no bottom
          style={{ left: popupPosition.x, top: popupPosition.y }}
          onMouseDown={(e) => e.stopPropagation()} 
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className={styles.popupImageContainer}>
             <button className={styles.closeButton} onClick={closePopup} aria-label="Fechar">✕</button>
             {activeHotspot.image_horizontal ? (
                <Image
                src={activeHotspot.image_horizontal}
                alt={activeHotspot.name}
                className={styles.popupImage}
                width={1920}
                height={1080}
                priority={true}
                quality={100} />
             ) : (
                // Fallback visual caso não tenha imagem
                <div style={{width:'100%', height:'100%', background: '#ddd', display:'flex', alignItems:'center', justifyContent:'center', color:'#888'}}>
                    Sem Imagem
                </div>
             )}
          </div>
          
          <div className={styles.popupContent}>
            <h4>{activeHotspot.name}</h4>
            <button 
              id="reserve-button"
              className={styles.actionButton}
              onClick={() => router.push(`/places/${activeHotspot.name.replace(/\s+/g, '-').toLowerCase()}-${activeHotspot.id}`)}
            >
              Ver Detalhes e Reservar
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default MapBanner;