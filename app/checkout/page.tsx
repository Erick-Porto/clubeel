'use client';

import { useState, useMemo, useEffect, Suspense } from 'react'; 
import { useSearchParams, useRouter } from 'next/navigation';
import CheckoutView from "@/components/checkout";
import Footer from "@/components/footer";
import Header from "@/components/header";
import style from '@/styles/checkout.module.css';
import globalStyle from '@/styles/page.module.css';
import CheckoutContent from "../components/checkoutContent";
import { useCart } from '@/context/CartContext';
import { LoadingScreen } from '@/components/loading';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faShoppingCart } from '@fortawesome/free-solid-svg-icons';
import TutorialOverlay, { TutorialStep } from '../components/tutorial-overlay';
import API_CONSUME from '@/services/api-consume';
import { useSession } from 'next-auth/react';

const formatPrice = (p: number | string): string => {
    const n = parseFloat(String(p));
    if (isNaN(n)) return '0.00';
    return n.toFixed(2);
};

// Componente de Mensagem de Status Atualizado (Unificado)
const PaymentStatusMessage: React.FC<{ type: 'success' | 'error' | 'expired' | 'refunded_conflict'; message: string; onRetry: () => void; }> = ({ type, message, onRetry }) => {
    const router = useRouter();
    const [timeLeft, setTimeLeft] = useState(15);

    // Define o destino e a cor baseada no tipo
const config = {
        success: {
            destination: '/profile?tab=schedules',
            buttonText: 'Ver meus agendamentos',
            colorClass: style.statusSuccess, // Usa animação pulseIcon
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            ),
            title: 'Pagamento Aprovado!'
        },
        expired: {
            destination: '/',
            buttonText: 'Voltar ao Início',
            colorClass: style.statusExpired, // Usa animação fadePulse (amarelo)
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            ),
            title: 'Tempo Excedido'
        },
        refunded_conflict: {
            destination: '/',
            buttonText: 'Voltar ao Início',
            colorClass: style.statusError, // Usa animação shakeIcon (vermelho - erro crítico)
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
            ),
            title: 'Horário Indisponível'
        },
        error: {
            destination: '/checkout',
            buttonText: 'Tentar Novamente',
            colorClass: style.statusError, // Usa animação shakeIcon (vermelho)
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
            ),
            title: 'Ops! Algo deu errado.'
        }
    };

    const currentConfig = config[type] || config.error;

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    // Ação ao finalizar o timer
                    if (type === 'error') {
                        onRetry(); // Reseta o estado local para tentar de novo
                    } else {
                        router.push(currentConfig.destination);
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [type, router, onRetry, currentConfig.destination]);

    const handleButtonClick = () => {
        if (type === 'error') {
            onRetry();
        } else {
            router.push(currentConfig.destination);
        }
    };

    return (
        <div className={style.statusWrapper}>
            <div className={style.statusCard}>
                <div className={`${style.statusIcon} ${currentConfig.colorClass}`}>
                    {currentConfig.icon}
                </div>
                
                <h2>{currentConfig.title}</h2>
                <p>{message}</p>
                
                <button className={style.statusButton} onClick={handleButtonClick}>
                    {currentConfig.buttonText}
                </button>

                <div className={style.redirectTimer}>
                    Você será redirecionado automaticamente em <span>{timeLeft}s</span>
                </div>
            </div>
        </div>
    );
};

const CheckoutComponent = () => {
    const { cart, refreshCart} = useCart();
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const router = useRouter();
    
    // Estados
    const [validatingPayment, setValidatingPayment] = useState(false);
    // Adicionei 'refunded_conflict' aos tipos possíveis
    const [paymentResult, setPaymentResult] = useState<'success' | 'error' | 'expired' | 'refunded_conflict' | null>(null);
    const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

    const total = useMemo(() => {
        if (!cart || cart.length === 0) return 0;
        return cart.reduce((acc, item) => acc + (parseFloat(String(item.price)) || 0), 0);
    }, [cart]);

    useEffect(() => {
        if (validatingPayment || paymentResult) return;

        const status = searchParams?.get('status');
        if (!status) return;

        const isSuccess = status === 'success' || status === 'approved';
        const isFailure = status === 'failure' || status === 'rejected' || status === 'null';
        const isExpired = status === 'expired';
        const isConflict = status === 'refunded_conflict' || status === 'conflict_refunded'; // Aceita ambos

        if (isSuccess || isFailure || isExpired || isConflict) {
            setValidatingPayment(true);
            
            const processPaymentResult = async () => {
                try {
                    await refreshCart(); 

                    if (isSuccess) {
                        setPaymentResult('success');
                    } else if (isExpired) {
                        setPaymentResult('expired');
                    } else if (isConflict) {
                        setPaymentResult('refunded_conflict');
                    } else {
                        setPaymentResult('error');
                    }
                } catch (error) {
                    console.error("Erro ao processar retorno:", error);
                    setPaymentResult('error');
                } finally {
                    setValidatingPayment(false);
                    window.history.replaceState(null, '', '/checkout'); 
                }
            };

            processPaymentResult();
        }
    }, [searchParams, refreshCart, validatingPayment, paymentResult]);

    if (validatingPayment) return <LoadingScreen />;

    const handleRetryOrExit = () => {
        setPaymentResult(null); // Reseta para exibir o checkout novamente
    };

    const TUTORIAL_STEPS: TutorialStep[] = [
        {
            title: 'Parabéns por chegar até aqui!',
            description: (
                <>
                    <p>Agora que já entende o funcionamento, você está apto a realizar seus próprios agendamentos!</p>
                </>
            )
        },
    ];

    const finishedTutorial = () => {
        if(cart.length === 0){
            router.push('/');
        }
        else {
            let i = cart.length;
            cart.forEach(async item => {
                const response = await API_CONSUME("DELETE", `schedule/delete-pending`, {
                    'Session': session?.accessToken
                }, { id: item.id });

                if (!response.ok) {
                    console.error(`Erro tutorial (ID ${item.id}):`, response.message);
                }
                i--;
                if (i === 0) {
                    refreshCart();
                    router.push('/');
                }
            });
        }
    };

    // Gera a mensagem correta baseada no status
    const getStatusMessage = () => {
        switch(paymentResult) {
            case 'success': return "Pagamento confirmado. Sua quadra está reservada!";
            case 'expired': return "O tempo limite da reserva expirou. Se o valor foi cobrado, ele será estornado automaticamente.";
            case 'refunded_conflict': return "Infelizmente, outra pessoa reservou este horário enquanto você finalizava o pagamento. O valor foi estornado integralmente.";
            default: return "Não foi possível confirmar o pagamento. Verifique seus dados e tente novamente.";
        }
    };

    return (
        <div className={globalStyle.page}>
            <Header options={null} surgeIn={-1} onlyScroll={false} />
            <TutorialOverlay steps={TUTORIAL_STEPS} pageKey="Pagamento" onComplete={finishedTutorial}/>
            
            <section className={style.checkoutPageContainer}>
                {paymentResult ? (
                    <PaymentStatusMessage 
                        type={paymentResult} 
                        message={getStatusMessage()}
                        onRetry={handleRetryOrExit}
                    />
                ) : (
                    <>
                        <h1 className={style.checkoutTitle}>Finalizar Pedido</h1>
                        
                        <div className={style.checkoutLayout}>
                            <div 
                                className={style.mobileSummaryToggle} 
                                onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                            >
                                <div style={{display:'flex', alignItems:'center', gap: 8}}>
                                    <FontAwesomeIcon icon={faShoppingCart} style={{fontSize: 14}}/>
                                    <span>{isSummaryExpanded ? 'Ocultar detalhes' : 'Ver detalhes do pedido'}</span>
                                    <FontAwesomeIcon 
                                        icon={faChevronDown} 
                                        className={`${style.chevronIcon} ${isSummaryExpanded ? style.chevronRotated : ''}`}
                                        style={{fontSize: 12, marginLeft: 5}}
                                    />
                                </div>
                                <span className={style.summaryTotalLabel}>R$ {formatPrice(total)}</span>
                            </div>

                            <div className={`${style.cartSection} ${isSummaryExpanded ? style.cartSectionExpanded : ''}`}>
                                <CheckoutContent />
                            </div>

                            <div className={style.paymentSection}>
                                <CheckoutView total={total} formatPrice={formatPrice} />
                            </div>
                        </div>
                    </>
                )}
            </section>
            <Footer />
        </div>
    );
}

const CheckoutPage = () => (
    <Suspense fallback={<LoadingScreen />}>
        <CheckoutComponent />
    </Suspense>
);

export default CheckoutPage;