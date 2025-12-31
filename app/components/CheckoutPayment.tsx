"use client";

import React, { useState } from "react";
import styles from "@/styles/payment-selector.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCreditCard, faBarcode, faQrcode, faWifi, faCheckCircle, faTimesCircle, faArrowLeft, faCopy } from "@fortawesome/free-solid-svg-icons";
import { identifyBank } from "@/utils/bank-identifier";
import { CreditCardBrand } from "./CreditCardBrand";
// 1. Alterado: Importar useRouter ao invés de redirect
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import Image from "next/image";

// Tipos
type PaymentMethod = "credit" | "debit" | "pix";

interface CPParams {
  amount: number;
}

interface PixResponse {
  qrcode: string;
  qrcodeBase64: string;
  expirationDate?: string;
}

export default function CheckoutPayment({ amount }: CPParams) {
  // 2. Instanciar o router
  const router = useRouter();

  const [method, setMethod] = useState<PaymentMethod>("credit");
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const [pixResult, setPixResult] = useState<PixResponse | null>(null);

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

  const copyPixCode = () => {
    if (pixResult?.qrcode) {
      navigator.clipboard.writeText(pixResult.qrcode);
      toast.success("Código Pix copiado!"); 
    }
  };
    
  // Manipulador de Input com Formatação
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

      const data = await response.json();

      if (response.ok) {
        if (method === 'pix' && data.qrCodeResponse) { // Atenção: Verifique se a Rede retorna qrCodeResponse ou pix.qrcode
           // Ajuste conforme o retorno exato da sua API. Na versão anterior corrigida, era data.pix ou data.qrCode
            const qrData = data.pix || data; // Fallback de segurança
            setPixResult({
                qrcode: qrData.qrcode || data.qrCodeResponse?.qrCodeData,
                qrcodeBase64: qrData.qrcodeBase64 || data.qrCodeResponse?.qrCodeImage
            });
            setStatus({ type: 'success', msg: 'QR Code gerado com sucesso! Realize o pagamento.' });
        } else {
            setStatus({ type: 'success', msg: 'Pagamento aprovado com sucesso!' });
            
            // 3. Alterado: Usar router.push para navegar sem lançar exceção no try/catch
            router.push('/api/success');
        }
      } else {
        setStatus({ type: 'error', msg: data.error || data.returnMessage || 'Erro ao processar pagamento.' });
      }
    } catch (error) {
      console.error("Erro no checkout:", error);
      setStatus({ type: 'error', msg: 'Erro de comunicação com o servidor.' });
    } finally {
      setLoading(false);
    }
  };

  if (pixResult && method === 'pix') {
    return (
        <div className={styles.container} style={{textAlign: 'center'}}>
            <h3 style={{color: '#444', marginBottom: 20}}>Pagamento via Pix</h3>
            
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
                        style={{background: '#f9f9f9', color: '#666'}}
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
      {/* --- SELETOR DE MÉTODO --- */}
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

      {/* --- CONTEÚDO PIX --- */}
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
        /* --- CONTEÚDO CARTÃO --- */
        <>
            {/* O Cartão Interativo 3D */}
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
                        
                        {cardTheme.scheme && (
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
                        )}
                    </div>

                    {/* VERSO */}
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

            {/* Formulário de Dados */}
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