"use client"
import Style from '@/styles/sportive-square.module.css';
import Link from 'next/link';
import Image from 'next/image'; 

interface Place {
    id: number;
    name: string;
    image_vertical: string;
}

interface SportiveSquareProps {
    places: Place[];
}

const SportiveSquare: React.FC<SportiveSquareProps> = ({ places }) => {
    
    const formatPlaceNameForUrl = (name: string) => {
        return name.replace(/\s+/g, '-').toLowerCase();
    };

    if (!places || places.length === 0) {
        return (
            <div className={Style.squareContainer}>
                <p style={{ width: '100%', textAlign: 'center' }}>
                    Nenhum local esportivo para exibir.
                </p>
            </div>
        );
    }

    let fillList = [...places];
    const MIN_ITEMS_ON_SCREEN = 8;
    
    while (fillList.length < MIN_ITEMS_ON_SCREEN) {
        fillList = [...fillList, ...places];
    }

    const finalCarouselList = [...fillList, ...fillList];

    return (
        <div className={Style.squareContainer}>
            <div className={Style.carousel}>
                {finalCarouselList.map((place, index) => (
                    <div
                        key={`${place.id}-clone-${index}`} 
                        className={Style.square}
                    >
                        <Image
                            src={place.image_vertical}
                            alt={`Imagem de ${place.name}`}
                            fill
                            sizes="(max-width: 768px) 600px, 1000px"
                            className={Style.squareImage}
                            priority={index < 4}
                            quality={100}
                        />
                        
                         <Link referrerPolicy='no-referrer' rel='noopener noreferrer' href={`/places/${formatPlaceNameForUrl(place.name)}-${place.id}`} className={Style.squareInfo}>
                            <span className={Style.title}>{place.name}</span>
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SportiveSquare;