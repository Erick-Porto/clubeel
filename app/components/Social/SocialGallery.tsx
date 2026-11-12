"use client";

/**
 * Carrossel de fotos de um espaço social: primeiro a capa (quando houver),
 * depois a galeria na ordem que a Lara mandou — a ordem é da equipe, o front
 * não reordena.
 *
 * - Setas, bolinhas, arrastar no celular e ← → com o carrossel em foco.
 * - Foto grande (`path`) no slide; miniatura (`thumb_path`) na faixa.
 * - Só a capa e o primeiro slide carregam de imediato; os demais recebem o
 *   `src` quando o sócio chega perto deles (o slide atual e os vizinhos). Não
 *   dá para confiar só no `loading="lazy"`: os slides fora da tela estão
 *   escondidos pelo `overflow`, e o navegador pode nunca carregá-los.
 * - O quadro tem a proporção da primeira foto com medidas (limitada a uma
 *   faixa razoável), para não haver pulo de layout; cada foto aparece inteira
 *   dentro dele.
 * - Sem tela cheia: o projeto não tem um componente de lightbox.
 *
 * Endereços sempre pela rota de fotos do site (utils/social-fotos.ts): o
 * navegador não alcança a Lara.
 */

import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import style from "../../../styles/social-gallery.module.css";
import type { SocialPhoto } from "../../../utils/social-fotos";
import { fotoSrc } from "../../../utils/social-fotos";

interface Slide {
    key: string;
    src: string;
    thumb: string;
    alt: string;
    caption: string | null;
    width: number | null;
    height: number | null;
}

/** Proporção do quadro: nem retrato estreito, nem faixa fina. */
const MIN_RATIO = 4 / 3;
const MAX_RATIO = 2.2;
const DEFAULT_RATIO = 16 / 9;
/** Distância mínima (px) do arraste para trocar de foto. */
const SWIPE_THRESHOLD = 40;

function frameRatio(slides: Slide[]): number {
    const measured = slides.find((slide) => slide.width && slide.height);
    if (!measured || !measured.width || !measured.height) return DEFAULT_RATIO;
    return Math.min(MAX_RATIO, Math.max(MIN_RATIO, measured.width / measured.height));
}

interface SocialGalleryProps {
    placeName: string;
    /** Capa já resolvida para um endereço que o navegador alcança (`capaSrc`). */
    cover: string | null;
    photos: SocialPhoto[];
    className?: string;
}

export default function SocialGallery({ placeName, cover, photos, className }: SocialGalleryProps) {
    const slides = useMemo<Slide[]>(() => {
        const list: Slide[] = [];
        if (cover) {
            list.push({
                key: "capa",
                src: cover,
                thumb: cover,
                alt: `Foto de ${placeName}`,
                caption: null,
                width: null,
                height: null,
            });
        }
        for (const photo of photos) {
            const src = fotoSrc(photo.path);
            if (!src) continue;
            const number = list.length + 1;
            list.push({
                key: `foto-${photo.id}-${photo.path}`,
                src,
                thumb: fotoSrc(photo.thumb_path) ?? src,
                alt: photo.caption ?? `Foto ${number} de ${placeName}`,
                caption: photo.caption,
                width: photo.width,
                height: photo.height,
            });
        }
        return list;
    }, [cover, photos, placeName]);

    const [index, setIndex] = useState(0);
    // Slides que já podem ter `src`: a capa e o primeiro de cara; os outros
    // conforme o sócio navega (o atual e os vizinhos).
    const [loaded, setLoaded] = useState<Set<number>>(() => new Set([0, 1]));
    const dragStart = useRef<{ x: number; y: number } | null>(null);

    const total = slides.length;
    const current = Math.min(index, Math.max(total - 1, 0));

    const goTo = useCallback(
        (next: number) => {
            if (total === 0) return;
            const target = ((next % total) + total) % total;
            setIndex(target);
            setLoaded((prev) => {
                const neighbours = [target, (target + 1) % total, (target - 1 + total) % total];
                if (neighbours.every((i) => prev.has(i))) return prev;
                const nextSet = new Set(prev);
                neighbours.forEach((i) => nextSet.add(i));
                return nextSet;
            });
        },
        [total]
    );

    if (total === 0) return null;

    const multiple = total > 1;

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!multiple) return;
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            goTo(current - 1);
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            goTo(current + 1);
        }
    };

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (!multiple || event.pointerType === "mouse") return;
        dragStart.current = { x: event.clientX, y: event.clientY };
    };

    const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
        const start = dragStart.current;
        dragStart.current = null;
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        // Gesto mais vertical que horizontal é rolagem da página, não troca de foto.
        if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
        goTo(dx < 0 ? current + 1 : current - 1);
    };

    const active = slides[current];

    return (
        <section
            className={`${style.gallery} ${className ?? ""}`}
            aria-roledescription="carrossel"
            aria-label={`Fotos de ${placeName}`}
        >
            <div
                className={style.frame}
                style={{ aspectRatio: String(frameRatio(slides)) }}
                tabIndex={multiple ? 0 : undefined}
                onKeyDown={onKeyDown}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerCancel={() => (dragStart.current = null)}
            >
                <div className={style.track} style={{ transform: `translateX(-${current * 100}%)` }}>
                    {slides.map((slide, i) => (
                        <figure
                            key={slide.key}
                            className={style.slide}
                            role="group"
                            aria-roledescription="slide"
                            aria-label={`${i + 1} de ${total}`}
                            aria-hidden={i !== current}
                        >
                            {loaded.has(i) && (
                                // eslint-disable-next-line @next/next/no-img-element -- `next/image` está com `unoptimized`; a foto já vem da rota do site.
                                <img
                                    src={slide.src}
                                    alt={slide.alt}
                                    width={slide.width ?? undefined}
                                    height={slide.height ?? undefined}
                                    loading={i <= 1 ? "eager" : "lazy"}
                                    decoding="async"
                                    draggable={false}
                                    className={style.image}
                                />
                            )}
                        </figure>
                    ))}
                </div>

                {multiple && (
                    <>
                        <button
                            type="button"
                            className={`${style.arrow} ${style.arrowPrev}`}
                            onClick={() => goTo(current - 1)}
                            aria-label="Foto anterior"
                        >
                            <FontAwesomeIcon icon={faChevronLeft} />
                        </button>
                        <button
                            type="button"
                            className={`${style.arrow} ${style.arrowNext}`}
                            onClick={() => goTo(current + 1)}
                            aria-label="Próxima foto"
                        >
                            <FontAwesomeIcon icon={faChevronRight} />
                        </button>
                        <span className={style.counter} aria-live="polite">
                            {current + 1} / {total}
                        </span>
                        <div className={style.dots} role="tablist" aria-label="Escolher foto">
                            {slides.map((slide, i) => (
                                <button
                                    key={slide.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={i === current}
                                    aria-label={`Ver foto ${i + 1}`}
                                    className={`${style.dot} ${i === current ? style.dotActive : ""}`}
                                    onClick={() => goTo(i)}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {active.caption && <p className={style.caption}>{active.caption}</p>}

            {multiple && (
                <div className={style.thumbs} aria-label="Miniaturas">
                    {slides.map((slide, i) => (
                        <button
                            key={slide.key}
                            type="button"
                            className={`${style.thumb} ${i === current ? style.thumbActive : ""}`}
                            onClick={() => goTo(i)}
                            aria-label={`Ver foto ${i + 1}`}
                            aria-current={i === current ? "true" : undefined}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element -- miniatura pela rota do site. */}
                            <img src={slide.thumb} alt="" loading="lazy" decoding="async" draggable={false} />
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
}
