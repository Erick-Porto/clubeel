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

// Componente de Mensagem de Status
const PaymentStatusMessage: React.FC<{ type: 'success' | 'error' | 'expired'; message: string; onRetry: () => void; }> = ({ type, message, onRetry }) => {
    const router = useRouter();
    return (
        <div className={style.statusWrapper}>
            <div className={`${style.statusIcon} ${type === 'success' ? style.statusSuccess : style.statusError}`}>
                {type === 'success' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                ) : type === 'expired' ? (
                    /* Ícone de Relógio para Expirado */
                    <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                )}
            </div>
            
            <h2>{type === 'success' ? 'Sucesso!' : type === 'expired' ? 'Tempo Excedido' : 'Ops!'}</h2>
            <p>{message}</p>
            
            {type === 'success' ? (
                <button className={style.statusButton} onClick={() => router.push('/profile')}>Meus Agendamentos</button>
            ) : (
                <button className={style.statusButton} onClick={onRetry}>
                    {type === 'expired' ? 'Voltar ao Início' : 'Tentar Novamente'}
                </button>
            )}
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
    const [paymentResult, setPaymentResult] = useState<'success' | 'error' | 'expired' | null>(null);
    const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

    // Cálculo do total memoizado
    const total = useMemo(() => {
        if (!cart || cart.length === 0) return 0;
        return cart.reduce((acc, item) => acc + (parseFloat(String(item.price)) || 0), 0);
    }, [cart]);

    // Efeito para verificar retorno do Mercado Pago
    useEffect(() => {
        if (validatingPayment || paymentResult) return;

        const status = searchParams?.get('status');
        if (!status) return;

        const isSuccess = status === 'success' || status === 'approved';
        const isFailure = status === 'failure' || status === 'rejected' || status === 'null';
        const isExpired = status === 'expired';

        if (isSuccess || isFailure || isExpired) {
            setValidatingPayment(true);
            
            const processPaymentResult = async () => {
                try {
                    // Atualiza o carrinho (pode limpar itens pagos ou cancelados)
                    await refreshCart(); 

                    if (isSuccess) {
                        setPaymentResult('success');
                    } else if (isExpired) {
                        setPaymentResult('expired');
                    } else {
                        setPaymentResult('error');
                    }
                } catch (error) {
                    console.error("Erro ao processar retorno:", error);
                    setPaymentResult('error');
                } finally {
                    setValidatingPayment(false);
                    // Limpa a URL para evitar reprocessamento ao atualizar a página
                    window.history.replaceState(null, '', '/checkout'); 
                }
            };

            processPaymentResult();
        }
    }, [searchParams, refreshCart, validatingPayment, paymentResult]);

    if (validatingPayment) return <LoadingScreen />;

    // Handler para o botão de ação nas mensagens de erro/expiração
    const handleRetryOrExit = () => {
        if (paymentResult === 'expired') {
            router.push('/'); // Volta para home para recomeçar
        } else {
            setPaymentResult(null); // Fecha o modal de erro e permite tentar pagar de novo
        }
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
        ]

    const finishedTutorial = () => {
        if(cart.length === 0){
            router.push('/'); // Se o carrinho estiver vazio, volta para a home
        }
            else {
            let i = cart.length;
            cart.forEach(async item => {
                try {
                    await API_CONSUME("DELETE", `schedule/delete-pending`, {
                        'Session': session?.accessToken
                    },{
                        id: item.id
                    });
                } catch (error) {
                    console.error("Erro ao remover item do carrinho após tutorial:", error);
                }
                i--;
                if (i === 0) {
                    refreshCart();
                    router.push('/');
                }
            });
            
            
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
                        message={
                            paymentResult === 'success' ? "Pagamento confirmado. Sua quadra está reservada!" :
                            paymentResult === 'expired' ? "O horário do agendamento expirou antes da confirmação. O valor pago será estornado automaticamente." :
                            "Não foi possível processar o pagamento. Tente outra forma de pagamento."
                        }
                        onRetry={handleRetryOrExit}
                    />
                ) : (
                    <>
                        <h1 className={style.checkoutTitle}>Finalizar Pedido</h1>
                        
                        <div className={style.checkoutLayout}>
                            
                            {/* --- MOBILE TOGGLE --- */}
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

                            {/* --- COLUNA ESQUERDA (ITENS) --- */}
                            <div className={`${style.cartSection} ${isSummaryExpanded ? style.cartSectionExpanded : ''}`}>
                                <CheckoutContent />
                            </div>

                            {/* --- COLUNA DIREITA (PAGAMENTO) --- */}
                            {/* Só exibe se tiver carrinho ou se estiver carregando */}
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