'use client';
import Image from 'next/image';
import Link from 'next/link';
import Style from '../../../styles/itens-grid.module.css';
import type { CarouselItem } from './sportive-square';

export default function ItensGrid({ data }: { data: CarouselItem[] }) {
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
            {data.map((item) => {
                const href = item.href ?? `/places/${item.name.replace(/\s+/g, '-').toLowerCase()}-${item.id}`;
                return (
                    <Link key={href} referrerPolicy='no-referrer' rel='noopener noreferrer' href={href}>
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
                                {item.tag && <span className={Style.gridItemTag}>{item.tag}</span>}
                                <h3 className={Style.gridItemTitle}>{item.name}</h3>
                            </div>
                        </div>
                    </Link>
                );
            })}
        </div>
    );
}
