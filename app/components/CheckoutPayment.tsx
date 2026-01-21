"use client";

import React, { useState, useEffect } from "react";
import styles from "@/styles/payment-selector.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCreditCard, faBarcode, faQrcode, faWifi, faCheckCircle, faTimesCircle, faArrowLeft, faCopy, faClock } from "@fortawesome/free-solid-svg-icons";
import { identifyBank } from "@/utils/bank-identifier";
// import { CreditCardBrand } from "./CreditCardBrand";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { toast } from "react-toastify";
import Image from "next/image";
import API_CONSUME from "@/services/api-consume";
import { useSession } from 'next-auth/react';

type PaymentMethod = "credit" | "debit" | "pix";
type TimeOption = [string, string, number | null, number | null];
interface CPParams {
  amount: number;
}

interface PixResponse {
  qrcode: string;
  qrcodeBase64: string;
  expirationDate?: string;
}

interface CustomSession {
    user?: {
        id?: string | number;
        name?: string | null;
        email?: string | null;
        image?: string | null;
    };
    accessToken?: string;
}

export default function CheckoutPayment({ amount }: CPParams) {
    const { data: sessionData } = useSession();
    const session = sessionData as CustomSession | null;
  // 2. Instanciar o router  
    const router = useRouter();
    const { cart } = useCart(); 
    const [method, setMethod] = useState<PaymentMethod>("credit");
    const [isFlipped, setIsFlipped] = useState(false);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    const [pixResult, setPixResult] = useState<PixResponse | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [cardData, setCardData] = useState({
    number: "",
    holder: "",
    expiry: "",
    cvv: "",
    cpf: ""
    });

    // Estado Visual do Cartão
    const [cardTheme, setCardTheme] = useState({
    name: "CFCSN",
    styleClass: "",
    scheme: ""
    });

    useEffect(() => {
        if (timeLeft > 0 && pixResult) {
        const timerId = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);
        return () => clearInterval(timerId);
        } else if (timeLeft === 0 && pixResult) {
        setStatus({ type: 'error', msg: 'O tempo sugerido para pagamento expirou.' });
        }
    }, [timeLeft, pixResult]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const copyPixCode = () => {
    if (pixResult?.qrcode) {
      navigator.clipboard.writeText(pixResult.qrcode);
      toast.success("Código Pix copiado!"); 
    }
  };
    
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === "number") {
      formattedValue = value.replace(/\D/g, "").slice(0, 16);
      setCardTheme(identifyBank(formattedValue));
    }
    
    if (name === "expiry") {
      formattedValue = value
        .replace(/\D/g, "")
        .replace(/^(\d{2})(\d)/, "$1/$2")
        .slice(0, 5);
    }
    
    if (name === "cvv") {
      formattedValue = value.replace(/\D/g, "").slice(0, 4);
    }

    if (name === "holder") {
        formattedValue = value.toUpperCase();
    }

    setCardData(prev => ({ ...prev, [name]: formattedValue }));
  };

const handlePayment = async () => {
    setLoading(true);
    setStatus(null);

try {
        await Promise.all(cart.map(
            async (item) => {
                if (!item.start_schedule || !item.place) return;

                const parts = item.start_schedule.split(/[\sT]+/);
                const datePart = parts[0];
                const timePart = parts[1]; 

                const response = await API_CONSUME("POST", `schedule/time-options`, {
                    Session: `${session?.accessToken}`
                }, {
                    date: datePart,
                    place_id: item.place_id
                });
                
                const optionsArray = response.data.options;
                
                const availableTimes = optionsArray.filter((option: TimeOption) => {
                    const resourceOwner = Number(option[2]); 
                    const currentUserId = Number(session?.user?.id);

                    return resourceOwner === 0 || resourceOwner === currentUserId;
                });
                const availableTimeStrings = availableTimes.map((t: TimeOption) => String(t[0]).substring(0, 5));
                const timeToCheck = String(timePart).substring(0, 5);
                if (availableTimeStrings.includes(timeToCheck)) {
                    return true;
                }
                
                throw new Error(`O horário ${timeToCheck} em ${item.place.name} não está mais disponível.`);
            }
        ));
    } catch (updateError: unknown) {
        const message = updateError instanceof Error ? updateError.message : "Erro ao verificar disponibilidade.";
        setStatus({ type: 'error', msg: message });
        router.push('/checkout?status=expired');
        setLoading(false);
        return; 
    }

    try {
      const amountInCents = Math.round(amount * 100);
      const response = await fetch('/api/erede/payment_methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          cardData: {
             ...cardData,
             number: cardData.number.replace(/\s/g, ''),
          },
          amount: amountInCents
        })
      });

      const transactionData = await response.json();

      if (response.ok) {
        if (method === 'pix') {
             const qrData = transactionData.pix || transactionData; 
             setPixResult({ 
                qrcode: qrData.qrcode || qrData.qrCodeData,
                qrcodeBase64: qrData.qrcodeBase64 || qrData.qrCodeImage
              });
             setTimeLeft(180);
             setStatus({ type: 'success', msg: 'QR Code gerado!' });
             setLoading(false);
             return;
        } 
        
        try {
            const scheduleIds = cart.map(item => item.id); 
            const saveOrderRes = await fetch('/api/success', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transactionData: transactionData,
                    scheduleIds: scheduleIds,
                    method: method
                })
            });

            const saveResult = await saveOrderRes.json();

            if (saveOrderRes.ok) {
                setStatus({ type: 'success', msg: 'Pagamento confirmado!' });
                router.push('/checkout?status=success');
            } 
            else if (saveOrderRes.status === 409 || saveResult.error === 'expired') {
                setStatus({ type: 'error', msg: 'Reserva expirada. O valor foi estornado.' });
                router.push('/checkout?status=expired');
            } 
            else {
                throw new Error(saveResult.message || "Erro ao salvar pedido.");
            }

        } catch (saveError: unknown) {
            console.error(saveError);
            const message = saveError instanceof Error ? saveError.message : "Erro desconhecido";
            setStatus({ type: 'error', msg: `Atenção: ${message}. Contate o suporte.` });
            router.push('/checkout?status=error');
        }

      } else {
        setStatus({ type: 'error', msg: transactionData.error || transactionData.returnMessage || 'Erro na transação.' });
      }
    } catch (error) {
      console.error("Erro no checkout:", error);
      setStatus({ type: 'error', msg: 'Erro de comunicação.' });
    } finally {
      if (method !== 'pix') setLoading(false);
    }
  };

  if (pixResult && method === 'pix') {
    const percentage = (timeLeft / 180) * 100;
    const barColor = timeLeft < 30 ? '#dc3545' : '#1e8e3e';

    return (
        <div className={styles.container} style={{textAlign: 'center'}}>
            <h3 style={{color: '#444', marginBottom: 15}}>Pagamento via Pix</h3>
            
            <div style={{marginBottom: 20, padding: '0 10px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: 5, color: '#666'}}>
                    <span>Tempo restante</span>
                    <span style={{fontWeight: 'bold', color: barColor}}>
                        <FontAwesomeIcon icon={faClock} style={{marginRight: 5}}/>
                        {formatTime(timeLeft)}
                    </span>
                </div>
                <div style={{width: '100%', backgroundColor: '#eee', height: 8, borderRadius: 4, overflow: 'hidden'}}>
                    <div style={{
                        width: `${percentage}%`,
                        backgroundColor: barColor,
                        height: '100%',
                        transition: 'width 1s linear, background-color 0.5s ease'
                    }} />
                </div>
            </div>

            <div style={{
                border: '2px solid #eee', 
                borderRadius: 12, 
                padding: 20, 
                display: 'inline-block',
                marginBottom: 20,
                background: 'white'
            }}>
                <Image 
                    src={`data:image/png;base64,${pixResult.qrcodeBase64}`} 
                    alt="QR Code Pix" 
                    width={200}
                    height={200}
                />
            </div>

            <div style={{marginBottom: 20, textAlign: 'left'}}>
                <label className={styles.inputLabel}>Pix Copia e Cola</label>
                <div style={{display: 'flex', gap: 10}}>
                    <input 
                        type="text" 
                        readOnly 
                        value={pixResult.qrcode} 
                        className={styles.input}
                        style={{background: '#f9f9f9', color: '#666', fontSize: '0.8rem'}}
                    />
                    <button 
                        onClick={copyPixCode}
                        className={styles.confirmButton}
                        style={{width: 'auto', padding: '0 20px', margin: 0}}
                        title="Copiar código"
                    >
                        <FontAwesomeIcon icon={faCopy} />
                    </button>
                </div>
            </div>

            <p style={{fontSize: '0.9rem', color: '#666', marginBottom: 20}}>
                Abra o app do seu banco, escolha Pix e escaneie o QR Code ou use o Copia e Cola.
            </p>

            <button 
                className={styles.tab} 
                onClick={() => setPixResult(null)}
                style={{margin: '0 auto', border: '1px solid #ddd'}}
            >
                <FontAwesomeIcon icon={faArrowLeft} /> Voltar
            </button>
        </div>
    );
  }

  return (
    <div>
      <div className={styles.tabsContainer}>
        <button 
            className={`${styles.tab} ${method === 'credit' ? styles.tabActive : ''}`}
            onClick={() => setMethod('credit')}
        >
            <FontAwesomeIcon icon={faCreditCard} /> Crédito
        </button>
        <button 
            className={`${styles.tab} ${method === 'debit' ? styles.tabActive : ''}`}
            onClick={() => setMethod('debit')}
        >
            <FontAwesomeIcon icon={faBarcode} /> Débito
        </button>
        {/* <button 
            className={`${styles.tab} ${method === 'pix' ? styles.tabActive : ''}`}
            onClick={() => setMethod('pix')}
        >
            <FontAwesomeIcon icon={faQrcode} /> Pix
        </button> */}
      </div>

      {method === 'pix' ? (
          <div className={styles.pixContainer} style={{textAlign:'center', padding: 20}}>
              <FontAwesomeIcon icon={faQrcode} style={{fontSize: 60, color: '#1e8e3e', marginBottom: 20}} />
              <h3 style={{color: '#333', marginBottom: 10}}>Pagamento Instantâneo</h3>
              <p style={{color: '#666', fontSize: '0.9rem', lineHeight: 1.5}}>
                  Ao confirmar, geraremos um QR Code (Copia e Cola).<br/>
                  A aprovação é imediata.
              </p>
          </div>
      ) : (
        <>
            <div className={styles.cardWrapper}>
                <div className={`${styles.cardBody} ${isFlipped ? styles.cardFlipped : ''} ${cardTheme.styleClass}`}>
                    
                    {/* FRENTE */}
                    <div className={styles.cardFront}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'start'}}>
                            <div className={styles.chip}></div>
                            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end'}}>
                                <span className={styles.bankLogo}>{cardTheme.name}</span>
                                <FontAwesomeIcon icon={faWifi} className={styles.contactlessIcon} />
                            </div>
                        </div>
    
                        <div className={styles.cardNumber}>
                            {cardData.number ? cardData.number.replace(/(\d{4})/g, '$1 ').trim() : '•••• •••• •••• ••••'}
                        </div>
                        
                        <div className={styles.cardInfo}>
                            <div style={{flex: 1, paddingRight: 10}}>
                                <div className={styles.cardLabels}>Titular</div>
                                <div className={styles.holderName}>{cardData.holder || 'NOME DO TITULAR'}</div>
                            </div>
                            <div>
                                <div className={styles.cardLabels}>Validade</div>
                                <div className={styles.expiry}>{cardData.expiry || 'MM/AA'}</div>
                            </div>
                        </div>
                        
                        {/*cardTheme.scheme && (
                            <div style={{
                                position: 'absolute', 
                                top: 23, 
                                left: 80, 
                                width: 60,
                                height: 40,
                                opacity: 0.9
                            }}>
                                <CreditCardBrand brand={cardTheme.scheme} />
                            </div>
                        )*/}
                    </div>

                    <div className={styles.cardBack}>
                        <div className={styles.magneticStrip}></div>
                        <div className={styles.cvvContainer}>
                            <span className={styles.cardLabels} style={{marginRight: 10}}>CVV</span>
                            <div className={styles.cvvStrip}>{cardData.cvv || '•••'}</div>
                            <div style={{fontSize: '0.7rem', marginTop: 8, textAlign:'left', opacity: 0.8}}>
                                {method === 'credit' ? 'CRÉDITO À VISTA' : 'DÉBITO'}
                            </div>
                        </div>
                        <div style={{padding: '0 20px 20px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'}}>
                             <span style={{fontSize: '0.6rem', width: '70%', opacity: 0.7}}>
                                Este cartão é intransferível e de propriedade do banco emissor.
                             </span>
                             <span style={{fontWeight: 'bold', fontSize: '1.2rem'}}>{cardTheme.name}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.formGrid}>
                <div className={styles.fullWidth}>
                    <label className={styles.inputLabel}>Número do Cartão</label>
                    <input 
                        type="text" 
                        name="number" 
                        className={styles.input} 
                        placeholder="0000 0000 0000 0000"
                        value={cardData.number}
                        onChange={handleInputChange}
                        onFocus={() => setIsFlipped(false)}
                        maxLength={19}
                        inputMode="numeric"
                    />
                </div>
                
                <div className={styles.fullWidth}>
                    <label className={styles.inputLabel}>Nome impresso no cartão</label>
                    <input
                        type="text" 
                        name="holder" 
                        className={styles.input} 
                        placeholder="NOME COMO NO CARTÃO"
                        value={cardData.holder}
                        onChange={handleInputChange}
                        onFocus={() => setIsFlipped(false)}
                    />
                </div>

                <div>
                    <label className={styles.inputLabel}>Validade</label>
                    <input 
                        type="text" 
                        name="expiry" 
                        className={styles.input} 
                        placeholder="MM/AA"
                        value={cardData.expiry}
                        onChange={handleInputChange}
                        onFocus={() => setIsFlipped(false)}
                        maxLength={5}
                        inputMode="numeric"
                    />
                </div>

                <div>
                    <label className={styles.inputLabel}>CVV</label>
                    <input 
                        type="text" 
                        name="cvv" 
                        className={styles.input} 
                        placeholder="123"
                        value={cardData.cvv}
                        onChange={handleInputChange}
                        onFocus={() => setIsFlipped(true)}
                        onBlur={() => setIsFlipped(false)}
                        maxLength={4}
                        inputMode="numeric"
                    />
                </div>

                <div className={styles.fullWidth}>
                    <label className={styles.inputLabel}>CPF do Titular</label>
                    <input
                        type="text"
                        name="cpf"
                        className={styles.input}
                        placeholder="000.000.000-00"
                        value={cardData.cpf}
                        onChange={(e) => setCardData({...cardData, cpf: e.target.value})}
                    />
                </div>
            </div>
        </>
      )}

      <div style={{ marginTop: '25px' }}>
        {status && (
            <div style={{ 
                padding: '12px', 
                borderRadius: '8px', 
                marginBottom: '15px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: status.type === 'success' ? '#d1e7dd' : '#f8d7da',
                color: status.type === 'success' ? '#0f5132' : '#842029'
            }}>
                <FontAwesomeIcon icon={status.type === 'success' ? faCheckCircle : faTimesCircle} />
                <span>{status.msg}</span>
            </div>
        )}

        <button 
            className={styles.confirmButton} 
            onClick={handlePayment}
            disabled={loading}
        >
            {loading ? 'Processando...' : method == 'pix' ? `Gerar QR Code` : 'Pagar'}
        </button>
      </div>
    </div>
  );
}