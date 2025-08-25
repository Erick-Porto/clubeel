"use client"

import API_CONSUME from '@/services/api-consume';
import Style from '@/styles/sportive-square.module.css';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useUser } from '@/context/UserContext';

const SportiveSquare = () => {
    interface Place {
        id: string;
        name: string;
        image_vertical: string;
    }

    const { accessToken } = useUser();
    const [places, setPlaces] = useState<Place[]>([]);
    const carouselRef = useRef<HTMLDivElement>(null);
    const autoplayRef = useRef<NodeJS.Timeout | null>(null);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);
    const isHovered = useRef(false);

    useEffect(() => {
        const fetchPlaces = async () => {
            try {
                const response = await API_CONSUME("GET", "places/group/esportiva", {
                    'Authorization': 'Bearer ' + process.env.NEXT_PUBLIC_API_TOKEN,
                    'Session': accessToken
                }, null);
                const placesArray = Object.values(response) as Place[];
                setPlaces(placesArray);
            } catch (error) {
                console.error("Error fetching places:", error);
            }
        };

        fetchPlaces();
    }, [accessToken]);

    const formatPlaceName = (name: string) => name.split(' ').join('-').toLowerCase();

    useEffect(() => {
        const carousel = carouselRef.current;
        if (!carousel || places.length === 0) return;

        const handleScroll = () => {
            const totalScrollWidth = carousel.scrollWidth;
            const visibleWidth = carousel.offsetWidth;
            const maxScrollLeft = totalScrollWidth - visibleWidth;

            if (carousel.scrollLeft >= maxScrollLeft - 1) {
                carousel.scrollLeft = carousel.scrollLeft - (places.length * carousel.offsetWidth);
            }

            if (carousel.scrollLeft <= 0) {
                carousel.scrollLeft = carousel.scrollLeft + (places.length * carousel.offsetWidth);
            }
        };

        carousel.addEventListener('scroll', handleScroll);
        return () => carousel.removeEventListener('scroll', handleScroll);
    }, [places]);

    // Autoplay effect
    useEffect(() => {
        const startAutoplay = () => {
            stopAutoplay(); // evita múltiplos timers
            autoplayRef.current = setInterval(() => {
                if (carouselRef.current && !isHovered.current && !isDragging.current) {
                    carouselRef.current.scrollLeft += 1;
                }
            }, 16); // ~60fps
        };

        const stopAutoplay = () => {
            if (autoplayRef.current) {
                clearInterval(autoplayRef.current);
                autoplayRef.current = null;
            }
        };

        startAutoplay();
        return stopAutoplay;
    }, [places]);

    // Pause autoplay on hover/touch
    const handleMouseEnter = () => (isHovered.current = true);
    const handleMouseLeave = () => (isHovered.current = false);

    const handleTouchStart = (e: React.TouchEvent) => {
        const carousel = carouselRef.current;
        if (!carousel) return;
        isDragging.current = true;
        isHovered.current = true;
        startX.current = e.touches[0].pageX - carousel.offsetLeft;
        scrollLeft.current = carousel.scrollLeft;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging.current || !carouselRef.current) return;
        const x = e.touches[0].pageX - carouselRef.current.offsetLeft;
        const walk = (x - startX.current) * 2;
        carouselRef.current.scrollLeft = scrollLeft.current - walk;
    };

    const handleTouchEnd = () => {
        isDragging.current = false;
        isHovered.current = false;
    };

    // Mouse drag
    const handleMouseDown = (e: React.MouseEvent) => {
        const carousel = carouselRef.current;
        if (!carousel) return;
        isDragging.current = true;
        isHovered.current = true;
        startX.current = e.pageX - carousel.offsetLeft;
        scrollLeft.current = carousel.scrollLeft;
        carousel.classList.add(Style.grabbing);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current || !carouselRef.current) return;
        const x = e.pageX - carouselRef.current.offsetLeft;
        const walk = (x - startX.current) * 2;
        carouselRef.current.scrollLeft = scrollLeft.current - walk;
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        isHovered.current = false;
        carouselRef.current?.classList.remove(Style.grabbing);
    };

    return (
        <div className={Style.squareContainer}>
            <div
                className={Style.carousel}
                ref={carouselRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {[...places, ...places].map((place, index) => (
                    <div
                        key={`${place.id}-${index}`}
                        className={Style.square}
                        style={{ backgroundImage: `url(${place.image_vertical})` }}
                    >
                        <Link href={`/places/${formatPlaceName(place.name)}:${place.id}`} className={Style.squareInfo}>
                            <span className={Style.title}>{place.name}</span>
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SportiveSquare;
