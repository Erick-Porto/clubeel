'use client';
import Image from 'next/image'; 
import Link from 'next/link';
import Style from '@/styles/itens-grid.module.css';

interface dataType {
    id: number;
    name: string;
    image_vertical: string;
}

export default function ItensGrid({ data }: { data: dataType[] }) {
    if (!data || data.length === 0) {
        return (
            <div className={Style.gridContainer}>
                <p style={{ width: '100%', textAlign: 'center' }}>
                    Nenhum local esportivo para exibir.
                </p>
            </div>
        );
    }

    return (
        <div className={Style.gridContainer}>
            {data.map((item) => (
                <Link key={item.id} referrerPolicy='no-referrer' rel='noopener noreferrer' href={`/places/${item.name.replace(/\s+/g, '-').toLowerCase()}-${item.id}`}>
                    <div className={Style.gridItem}>
                        <Image
                            src={item.image_vertical}
                            alt={`Imagem de ${item.name}`}
                            className={Style.gridItemImage}
                            width={1280}
                            height={720}
                            quality={100}
                        />
                        <div className={Style.gridItemOverlay}>
                            <h3 className={Style.gridItemTitle}>{item.name}</h3>
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    );
}