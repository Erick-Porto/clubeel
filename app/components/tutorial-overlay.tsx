'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from '@/styles/tutorial-overlay.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faCheck, faHandPointer } from '@fortawesome/free-solid-svg-icons';

export interface TutorialStep {
    targetId?: string;
    title: string;
    description: React.ReactNode;
    waitForAction?: boolean; 
    offset?: number;
    mOffset?: number;
}

interface TutorialOverlayProps {
    steps: TutorialStep[];
    pageKey?: string;
    onComplete?: () => void;
}

export default function TutorialOverlay({ steps, pageKey, onComplete}: TutorialOverlayProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    // Fix: Initialize useRef with 0 to satisfy TS argument requirement
    const requestRef = useRef<number>(0);

    useEffect(() => {
        setIsMounted(true);
        const status = localStorage.getItem('app_tutorial_status');
        
        if (status !== 'completed' && status !== 'skipped') {
            if (!status) localStorage.setItem('app_tutorial_status', 'in_progress');
            setTimeout(() => setIsVisible(true), 500);
        }
    }, []);

    const updateSpotlight = useCallback(() => {
        const step = steps[currentStep];
        if (step?.targetId) {
            const el = document.getElementById(step.targetId);
            if (el) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    // Evita scroll desnecessário se já estiver visível
                    const isVisible = (
                        rect.top >= 0 &&
                        rect.left >= 0 &&
                        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
                    );

                    if (!isVisible) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                    }
                    setTargetRect(rect);
                    return;
                }
            }
        }
        setTargetRect(null);
    }, [currentStep, steps]);

    const animate = useCallback(() => {
        updateSpotlight();
        requestRef.current = requestAnimationFrame(animate);
    }, [updateSpotlight]);

    useEffect(() => {
        if (isVisible) {
            requestRef.current = requestAnimationFrame(animate);
            const retryInterval = setInterval(updateSpotlight, 500); 
            const timeout = setTimeout(() => clearInterval(retryInterval), 5000);

            window.addEventListener('resize', updateSpotlight);
            window.addEventListener('scroll', updateSpotlight, { passive: true });
            
            return () => {
                if (requestRef.current) cancelAnimationFrame(requestRef.current);
                clearInterval(retryInterval);
                clearTimeout(timeout);
                window.removeEventListener('resize', updateSpotlight);
                window.removeEventListener('scroll', updateSpotlight);
            };
        }
    }, [isVisible, animate, updateSpotlight]);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            if (onComplete) {
                localStorage.setItem('app_tutorial_status', 'completed');
                onComplete();
            }
            else setIsVisible(false); 
        }
    };

    const handleSkip = () => {
        setIsVisible(false);
        localStorage.setItem('app_tutorial_status', 'skipped');
    };

    const handleStepAction = (e: React.MouseEvent) => {
        // 1. Bloqueia a propagação padrão
        e.stopPropagation();
        
        const overlayDiv = e.currentTarget as HTMLDivElement;
        
        try {
            // 2. TÉCNICA DO "GHOST CLICK":
            // Em vez de 'display: none', usamos 'pointerEvents: none'.
            // Isso faz o document.elementFromPoint ignorar o overlay e pegar o botão real embaixo,
            // sem causar re-layout ou piscar a tela.
            overlayDiv.style.pointerEvents = 'none';
            
            const realTarget = document.elementFromPoint(e.clientX, e.clientY);
            
            if (realTarget && realTarget instanceof HTMLElement) {
                const eventOptions = {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: e.clientX,
                    clientY: e.clientY
                };
                
                // Dispara sequência completa de clique no elemento real
                realTarget.dispatchEvent(new MouseEvent('mousedown', eventOptions));
                realTarget.dispatchEvent(new MouseEvent('mouseup', eventOptions));
                realTarget.click();
            }
        } catch (error) {
            console.error("Erro ao simular clique:", error);
        } finally {
            // 3. RESTAURAÇÃO E AVANÇO:
            // Restaura o bloqueio imediatamente para evitar cliques acidentais duplos
            overlayDiv.style.pointerEvents = 'auto'; 
            
            // Força o avanço do tutorial independente do sucesso do clique
            setTimeout(() => {
                handleNext();
            }, 500); // Mantém o delay para dar tempo do modal abrir
        }
    };

    if (!isMounted || !isVisible) return null;

    const stepData = steps[currentStep];
    const isLast = currentStep === steps.length - 1;
    const isWaitingAction = stepData.waitForAction;

    let cardStyle: React.CSSProperties = {
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)', position: 'fixed'
    };
    let pulseStyle: React.CSSProperties = { display: 'none' };

    if (targetRect) {
        const isTopHalf = targetRect.top < window.innerHeight / 2;
        const offsetVal = window.innerWidth < 1024 ? stepData.mOffset ? stepData.mOffset : 0 : stepData.offset ? stepData.offset : 0;
        
        cardStyle = {
            top: isTopHalf ? targetRect.bottom + offsetVal : 'auto',
            bottom: !isTopHalf ? (window.innerHeight - targetRect.top) + offsetVal : 'auto',
            left: '50%',
            transform: 'translateX(-50%)',
            position: 'absolute'
        };

        pulseStyle = {
            display: 'block',
            top: targetRect.top - 5,
            left: targetRect.left - 5,
            width: targetRect.width + 10,
            height: targetRect.height + 10
        };
    }

    return createPortal(
        <div className={styles.overlay}>
            <svg className={styles.mask} width="100%" height="100%">
                <defs>
                    <mask id="spotlight-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        {targetRect && (
                            <rect
                                x={targetRect.left - 5}
                                y={targetRect.top - 5}
                                width={targetRect.width + 10}
                                height={targetRect.height + 10}
                                rx="12"
                                fill="black"
                                style={{ pointerEvents: 'auto' }} 
                            />
                        )}
                    </mask>
                </defs>
                <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.75)" mask="url(#spotlight-mask)" />
            </svg>

            <div className={styles.pulseRing} style={pulseStyle}></div>

            {/* INTERAÇÃO CORRIGIDA AQUI */}
            {isWaitingAction && targetRect && (
                <div
                    style={{
                        position: 'absolute',
                        top: targetRect.top,
                        left: targetRect.left,
                        width: targetRect.width,
                        height: targetRect.height,
                        cursor: 'pointer',
                        zIndex: 1, 
                        pointerEvents: 'auto' // ESSENCIAL: Sobrescreve o CSS .overlay
                    }}
                    onClick={handleStepAction} 
                />
            )}

            <div className={styles.card} style={{...cardStyle, zIndex: 2}}>
                <div className={styles.stepCounter}>
                    {pageKey} • Passo {currentStep + 1} de {steps.length}
                </div>
                <h3 className={styles.title}>{stepData.title}</h3>
                <div className={styles.description}>{stepData.description}</div>

                <div className={styles.footer}>
                    <button className={styles.skipBtn} onClick={handleSkip}>
                        Pular Tutorial
                    </button>
                    
                    {!isWaitingAction && (
                        <button className={styles.nextBtn} onClick={handleNext}>
                            {isLast ? 'Entendi' : 'Próximo'}
                            <FontAwesomeIcon icon={isLast ? faCheck : faArrowRight} />
                        </button>
                    )}
                </div>
            </div>

            {isWaitingAction && targetRect && (
                <div
                    className={styles.gestureIcon}
                    style={{ 
                        top: targetRect.top + (targetRect.height/2), 
                        left: targetRect.left + (targetRect.width/2),
                        pointerEvents: 'none'
                    }}
                >
                    <FontAwesomeIcon icon={faHandPointer} />
                </div>
            )}
        </div>,
        document.body
    );
}