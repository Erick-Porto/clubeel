'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import CheckoutView from "../components/Checkout/checkout";
import Footer from "../components/Common/footer";
import Header from "../components/Common/header";
import style from '../../styles/checkout.module.css';
import globalStyle from '../../styles/page.module.css';
import ui from '../../styles/ui.module.css';
import CheckoutContent from "../components/Checkout/checkoutContent";
import { useCart } from '../../context/CartContext';
import { LoadingScreen } from '../components/Common/loading';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faBagShopping, faCalendarXmark, faCheck, faChevronDown, faClock, faXmark } from '@fortawesome/free-solid-svg-icons';
import TutorialOverlay, { TutorialStep } from '../components/Common/tutorial-overlay';
import { PageHeader } from '../components/UI/ui';
import API_CONSUME from '../../services/api-consume';
import { toast } from 'react-toastify';

const formatPrice = (p: number | string): string => {
    const n = parseFloat(String(p));
    if (isNaN(n)) return '0,00';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

type ResultType = 'success' | 'error' | 'expired' | 'refunded_conflict' | 'already_paid';

const PaymentStatusMessage: React.FC<{ type: ResultType; message: string; onRetry: () => void; }> = ({ type, message, onRetry }) => {
    const router = useRouter();
    const [timeLeft, setTimeLeft] = useState(15);

    const config: Record<ResultType, { destination: string; buttonText: string; colorClass: string; icon: IconDefinition; title: string }> = {
        success: {
            destination: '/profile?tab=schedules',
            buttonText: 'Ver meus agendamentos',
            colorClass: style.statusSuccess,
            icon: faCheck,
            title: 'Pagamento aprovado'
        },
        already_paid: {
            destination: '/profile?tab=schedules',
            buttonText: 'Ver meus agendamentos',
            colorClass: style.statusSuccess,
            icon: faCheck,
            title: 'Agendamento já confirmado'
        },
        expired: {
            destination: '/',
            buttonText: 'Voltar ao início',
            colorClass: style.statusExpired,
            icon: faClock,
            title: 'Tempo excedido'
        },
        refunded_conflict: {
            destination: '/',
            buttonText: 'Voltar ao início',
            colorClass: style.statusError,
            icon: faCalendarXmark,
            title: 'Horário indisponível'
        },
        error: {
            destination: '/checkout',
            buttonText: 'Tentar novamente',
            colorClass: style.statusError,
            icon: faXmark,
            title: 'O pagamento não foi concluído'
        }
    };

    const currentConfig = config[type] || config.error;

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    if (type === 'error') {
                        onRetry();
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
            <div className={style.statusCard} role="status">
                <div className={`${style.statusIcon} ${currentConfig.colorClass}`}>
                    <FontAwesomeIcon icon={currentConfig.icon} />
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
    const { cart, refreshCart, clearCart} = useCart();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [validatingPayment, setValidatingPayment] = useState(false);
    const [paymentResult, setPaymentResult] = useState<ResultType | null>(null);
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
        const isConflict = status === 'refunded_conflict' || status === 'conflict_refunded';
        // A secretaria confirmou (baixa manual) enquanto o sócio pagava.
        const isAlreadyPaid = status === 'already_paid';

        if (isSuccess || isFailure || isExpired || isConflict || isAlreadyPaid) {
            setValidatingPayment(true);

            const processPaymentResult = async () => {
                try {
                    await refreshCart();

                    if (isSuccess) {
                        setPaymentResult('success');
                        clearCart();
                        router.refresh();
                    } else if (isAlreadyPaid) {
                        // O refreshCart acima já tirou do carrinho o que foi confirmado.
                        setPaymentResult('already_paid');
                        router.refresh();
                    } else if (isExpired) {
                        setPaymentResult('expired');
                    } else if (isConflict) {
                        setPaymentResult('refunded_conflict');
                    } else {
                        setPaymentResult('error');
                    }
                } catch (error) {
                    toast.error("Erro ao processar retorno: " + (error instanceof Error ? error.message : String(error)));
                    setPaymentResult('error');
                } finally {
                    setValidatingPayment(false);
                    // window.history.replaceState(null, '', '/checkout');
                }
            };

            processPaymentResult();
        }
    }, [searchParams, refreshCart, validatingPayment, paymentResult]);

    if (validatingPayment) return <LoadingScreen />;

    const handleRetryOrExit = () => {
        setPaymentResult(null);
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
                const response = await API_CONSUME("DELETE", `schedule/delete-pending`, {}, { id: item.id });

                if (!response.ok) {
                    toast.error(`Erro tutorial (ID ${item.id}): ${response.message}`);
                }
                i--;
                if (i === 0) {
                    refreshCart();
                    router.push('/');
                }
            });
        }
    };

    const getStatusMessage = () => {
        switch(paymentResult) {
            case 'success': return "Pagamento confirmado. Sua quadra está reservada!";
            case 'already_paid': return "A secretaria já registrou o pagamento destes horários. Eles estão confirmados e nada foi cobrado no seu cartão (se chegou a ser cobrado, o valor foi estornado).";
            case 'expired': return "O tempo limite da reserva expirou. Se o valor foi cobrado, ele será estornado automaticamente.";
            case 'refunded_conflict': return "Infelizmente, outra pessoa reservou este horário enquanto você finalizava o pagamento. O valor foi estornado integralmente.";
            default: return "Não foi possível confirmar o pagamento. Verifique seus dados e tente novamente.";
        }
    };

    return (
        <div className={globalStyle.page}>
            <Header />
            <TutorialOverlay steps={TUTORIAL_STEPS} pageKey="Pagamento" onComplete={finishedTutorial}/>

            <main className={`${globalStyle.main} ${ui.page}`}>
                {paymentResult ? (
                    <PaymentStatusMessage
                        type={paymentResult}
                        message={getStatusMessage()}
                        onRetry={handleRetryOrExit}
                    />
                ) : (
                    <>
                        <PageHeader
                            back
                            kicker="Quadras"
                            title="Finalizar compra"
                            lead="Confira os horários e pague com cartão. A confirmação sai na hora."
                        />

                        <div className={style.checkoutLayout}>
                            <aside className={style.cartSection}>
                                <button
                                    type="button"
                                    className={style.mobileSummaryToggle}
                                    onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                                    aria-expanded={isSummaryExpanded}
                                >
                                    <span className={style.mobileSummaryLabel}>
                                        <FontAwesomeIcon icon={faBagShopping} />
                                        {isSummaryExpanded ? 'Ocultar pedido' : `Ver pedido (${cart.length} ${cart.length === 1 ? 'horário' : 'horários'})`}
                                        <FontAwesomeIcon
                                            icon={faChevronDown}
                                            className={`${style.chevronIcon} ${isSummaryExpanded ? style.chevronRotated : ''}`}
                                        />
                                    </span>
                                    <span className={style.summaryTotalLabel}>R$ {formatPrice(total)}</span>
                                </button>

                                <div className={`${style.cartContent} ${isSummaryExpanded ? style.cartSectionExpanded : ''}`}>
                                    <CheckoutContent total={total} formatPrice={formatPrice} />
                                </div>
                            </aside>

                            <section className={style.paymentSection}>
                                <CheckoutView total={total}/>
                            </section>
                        </div>
                    </>
                )}
            </main>
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
