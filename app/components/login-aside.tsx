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

    // --- Funções de Validação (Mantidas) ---
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
            e.target.focus();
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
            
            // CORREÇÃO: Login direto sem CSRF
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
                // Se der erro 419 aqui, é configuração do NextAuth, mas deve sumir com a mudança do api-consume
                toast.error("CPF ou Senha incorretos.");
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
        setIsLoading(true);
        
        try {
            const documentValue = cpf.replace(/\D/g, '');
            const encryptedPassword = CryptoJS.SHA256(password).toString();
            
            const response = await API_CONSUME("POST", "register", {}, {
                title: matricula,
                cpf: documentValue,
                birthDate: bornAs,
                password: encryptedPassword,
            });

            // CORREÇÃO AQUI: Usar !response.ok
            if (!response.ok) {
                if (response.status >= 500) {
                    setIsMaintenance(true);
                } else {
                    // response.message já vem populado pelo API_CONSUME novo
                    toast.error(response.message || "Falha ao registrar.");
                }
                return; // Impede que o código continue para o login
            }

            toast.success("Cadastro realizado! Entrando...");
            
            // Login automático...
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
                                    <input type="text" value={cpf} onChange={(e) => verifyDocument({ cpf: e.target.value })} placeholder="CPF" required />
                                </div>
                                <div className={styles.inputGroup}>
                                    <input type="text" value={matricula} onChange={(e) => verifyCode({ code: e.target.value })} onBlur={finalizeCode} placeholder="Matrícula (Ex: 00000)" required />
                                </div>
                                <div className={styles.inputGroup}>
                                    <input type="date" value={bornAs} placeholder="MM/DD/YYYY" onChange={(e) => setBornAs(e.target.value)} required />
                                </div>
                                <div className={styles.inputGroup}>
                                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" required />
                                </div>
                                <div className={styles.inputGroup}>
                                    <input type="password" value={repeatPassword} onChange={(e) => setRepeatPassword(e.target.value)} placeholder="Confirmar senha" required />
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