"use client";

import styles from "@/styles/login-side-bar.module.css";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from "next-auth/react";
import { toast } from "react-toastify";
import CryptoJS from "crypto-js";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlugCircleXmark, faRotateRight } from "@fortawesome/free-solid-svg-icons";
import API_CONSUME from "@/services/api-consume";
import Link from "next/link";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";

export default function AuthSidebar({ useInterface }: { useInterface: string }) {
    const [cpf, setCPF] = useState("");
    const [password, setPassword] = useState("");
    const [repeatPassword, setRepeatPassword] = useState("");
    const [matricula, setMatricula] = useState("");
    const [bornAs, setBornAs] = useState("");
    const [authInterface, setAuthInterface] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isMaintenance, setIsMaintenance] = useState(false);
    const validateBirthDate = (dateStr: string) => {
        if (dateStr.length < 10) return "Data incompleta.";

        const [day, month, year] = dateStr.split('/').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Verifica se a data é real (Ex: 31/02 vira 03/03 no JS, aqui pegamos isso)
        const isValidDate = 
            dateObj.getFullYear() === year &&
            dateObj.getMonth() === month - 1 &&
            dateObj.getDate() === day;

        if (!isValidDate) return "Esta data não existe no calendário (ex: 31/02).";

        // 2. Verifica se é maior que hoje
        if (dateObj > today) return "A data de nascimento não pode ser no futuro.";

        // 3. Verifica idade mínima razoável (opcional)
        if (year < 1900) return "Ano inválido.";

        return null; // Data válida
    };

    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const maintenanceMode = searchParams?.get('maintenance');
        if (maintenanceMode === 'true') {
            setIsMaintenance(true);
            window.history.replaceState(null, '', '/');
        }
        setAuthInterface(useInterface);
    }, [useInterface, searchParams]);

    function verifyCode({ code }: { code: string }) {
        let value = code.toUpperCase().replace(/[^0-9FCNESC]/g, '');
        value = value.slice(0, 8);
        setMatricula(value);
    }
    function finalizeCode(e: React.FocusEvent<HTMLInputElement>) {
        let value = matricula.toUpperCase();
        const isAssociado = /^\d{5}$/.test(value);
        const isFuncionario = /^\d{4}[FCN]{3}$/.test(value);
        const isEscolinha = /^\d{5}[ESC]{3}$/.test(value);

        if (isFuncionario) value = value.slice(0, 4) + "FCN";
        else if (isEscolinha) value = value.slice(0, 5) + "ESC";
        else if (!isAssociado) {
            toast.error("Matrícula inválida!");
            setMatricula("");
            if(e.target.value !== "") e.target.focus();
            return;
        }
        setMatricula(value);
    }
    
    function verifyDocument({ cpf }: { cpf: string }) {
        let documentValue = cpf.replace(/\D/g, '');
        if (documentValue.length > 11) documentValue = documentValue.slice(0, 11);
        documentValue = documentValue.replace(/(\d{3})(\d)/, "$1.$2");
        documentValue = documentValue.replace(/(\d{3})(\d)/, "$1.$2");
        documentValue = documentValue.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
        setCPF(documentValue);
    }

    async function login(event: React.FormEvent) {
        event.preventDefault();
        setIsLoading(true);
        
        try {
            const documentValue = cpf.replace(/\D/g, '');
            const encryptedPassword = CryptoJS.SHA256(password).toString();
            
            const result = await signIn('credentials', {
                redirect: false,
                login: documentValue,
                password: encryptedPassword,
            });

            if (result?.status === 500 || (result?.error && result.error.toLowerCase().includes('fetch'))) {
                setIsMaintenance(true);
                return;
            }

            if (result?.error) {
                toast.error("Falha ao entrar: " + result.error);
            } else if (result?.ok) {
                toast.success("Bem-vindo de volta!");
                router.push('/');
                router.refresh();
            }
        } catch (error) {
            toast.error("Login error: " + (error instanceof Error ? error.message : String(error)));
            setIsMaintenance(true);
        } finally {
            setIsLoading(false);
        }
    }

    async function register(event: React.FormEvent) {
        event.preventDefault();
        if (password !== repeatPassword) {
            toast.error("As senhas não coincidem.");
            return;
        }

        const dateError = validateBirthDate(bornAs);
        if (dateError) {
            toast.error(dateError);
            return;
        }

        setIsLoading(true);
        
        try {
            const documentValue = cpf.replace(/\D/g, '');
            const encryptedPassword = CryptoJS.SHA256(password).toString();
            
            const [d, m, y] = bornAs.split('/');
            const formattedBirthDate = `${y}-${m}-${d}`;

            const response = await API_CONSUME("POST", "register", {}, {
                title: matricula,
                cpf: documentValue,
                birthDate: formattedBirthDate,
                password: encryptedPassword,
            });

            if (!response.ok) {
                if (response.status >= 500) {
                    setIsMaintenance(true);
                } else {
                    toast.error(response.message || "Falha ao registrar.");
                }
                return;
            }

            toast.success("Cadastro realizado! Entrando...");
            
            const loginResult = await signIn('credentials', {
                redirect: false,
                login: documentValue,
                password: encryptedPassword,
            });

            if (loginResult?.ok) {
                router.push('/');
                router.refresh();
            }
        } catch (error) {
            toast.error("Erro inesperado ao processar cadastro: " + (error instanceof Error ? error.message : String(error)));
        } finally {
            setIsLoading(false);
        }
    }

    const handleRetry = () => {
        setIsMaintenance(false);
        setIsLoading(false);
        window.location.reload(); 
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
                <Image 
                    src="/images/logo-cfcsn-horiz.png" 
                    alt="Logo CFCSN" 
                    width={200} 
                    height={80} 
                    quality={100}
                    className={styles.logoImage}
                    priority
                />
            </div>

            {isMaintenance ? (
                <div className={styles.maintenanceContainer}>
                    <div className={styles.maintenanceIcon}>
                        <FontAwesomeIcon icon={faPlugCircleXmark} />
                    </div>
                    <h2 className={styles.maintenanceTitle}>Sistema Indisponível</h2>
                    <p className={styles.maintenanceText}>
                        Houve uma falha ao tentar se comunicar com nosso sistema. Tente novamente.
                        Se o problema persistir, entre em contato com a secretaria.
                    </p>
                    <button className={styles.button} onClick={handleRetry}>
                        <FontAwesomeIcon icon={faRotateRight} style={{marginRight: 8}}/> Tentar Novamente
                    </button>
                     <Link style={{display:'Flex', justifyContent:'center', alignItems:'center', fontWeight: 'bold'}} href="https://wa.me/5524992510959?text=Olá,%20poderia%20me%20ajudar%20com%20a%20locação%20de%20espaços?." className={styles.button} target="_blank" referrerPolicy='no-referrer' rel='noopener noreferrer' >
                        <FontAwesomeIcon icon={faWhatsapp} style={{marginRight: 8}} size="2x"/> Contatar Secretaria
                    </Link>
                </div>
            ) : (
                <>
                    {authInterface === "login" ? (
                        <>
                            <h1 className={styles.welcomeTitle}>Bem-vindo!</h1>
                            <p className={styles.loginMessage}>Acesse sua conta para realizar agendamentos.</p>
                            <form className={styles.sidebarBody} onSubmit={login}>
                                <div className={styles.inputGroup}>
                                    <input type="text" value={cpf} onChange={(e) => verifyDocument({ cpf: e.target.value })} placeholder="CPF" required />
                                </div>
                                <div className={styles.inputGroup}>
                                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" required />
                                </div>
                                
                                <span 
                                    className={styles.forgotPasswordLink} 
                                    onClick={() => router.push('/forgot-password')}
                                >
                                    Esqueceu a senha?
                                </span>
                                
                                <input type="submit" value={isLoading ? "Acessando..." : "Entrar"} className={styles.button} disabled={isLoading} />
                                
                                <div className={styles.actionTextContainer}>
                                    <p className={styles.actionText} onClick={() => setAuthInterface("register")}>
                                        Não tem conta? <span>Cadastre-se</span>
                                    </p>
                                </div>
                            </form>
                        </>
                    ) : authInterface === "register" ? (
                        <>
                            <h1 className={styles.welcomeTitle}>Criar Conta</h1>
                            <form className={styles.sidebarBody} onSubmit={register}>
                                <div className={styles.inputGroup}>
                                    <label htmlFor="cpf">CPF</label>
                                    <input type="text" id="cpf" value={cpf} onChange={(e) => verifyDocument({ cpf: e.target.value })} placeholder="CPF" required />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label htmlFor="matricula">Matrícula</label>
                                    <input type="text" id="matricula" value={matricula} onChange={(e) => verifyCode({ code: e.target.value })} onBlur={finalizeCode} placeholder="Matrícula (Ex: 00000)" required />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label htmlFor="bornAs">Data de Nascimento</label>
                                    <input 
                                        type="text" 
                                        id="bornAs" 
                                        value={bornAs} 
                                        placeholder="DD/MM/AAAA" 
                                        inputMode="numeric"
                                        maxLength={10}
                                        onChange={(e) => {
                                            let val = e.target.value.replace(/\D/g, '');
                                            
                                            // Validação básica de dígitos iniciais
                                            if (val.length >= 2 && parseInt(val.slice(0, 2)) > 31) val = '31';
                                            if (val.length >= 4 && parseInt(val.slice(2, 4)) > 12) val = val.slice(0, 2) + '12';
                                            if (val.length > 8) val = val.slice(0, 8);
                                            
                                            // Máscara
                                            if (val.length >= 5) {
                                                val = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4)}`;
                                            } else if (val.length >= 3) {
                                                val = `${val.slice(0, 2)}/${val.slice(2)}`;
                                            }
                                            setBornAs(val);
                                        }}
                                        onBlur={(e) => {
                                        const error = validateBirthDate(e.target.value);
                                        if (error && e.target.value !== "") {
                                            toast.error(error);
                                            
                                        }
                                    }}
                                        required 
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label htmlFor="password">Senha</label>
                                    <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" required />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label htmlFor="repeatPassword">Confirmar senha</label>
                                    <input type="password" id="repeatPassword" value={repeatPassword} onChange={(e) => setRepeatPassword(e.target.value)} placeholder="Confirmar senha" required />
                                </div>
                                
                                <input type="submit" value={isLoading ? "Criando..." : "Cadastrar"} className={styles.button} disabled={isLoading} />
                                
                                <div className={styles.actionTextContainer}>
                                    <p className={styles.actionText} onClick={() => setAuthInterface("login")}>
                                        Já tem conta? <span>Faça Login</span>
                                    </p>
                                </div>
                            </form>
                        </>
                    ) : null}
                </>
            )}
        </aside>
    );
}