"use client";

import styles from "@/styles/login-side-bar.module.css";
import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { signIn } from "next-auth/react";
import { toast } from "react-toastify";
import CryptoJS from "crypto-js";
import Image from "next/image";

export default function AuthSidebar({ useInterface }: { useInterface: string }) {
    const [cpf, setCPF] = useState("");
    const [password, setPassword] = useState("");
    const [repeatPassword, setRepeatPassword] = useState("");
    const [matricula, setMatricula] = useState("");
    const [bornAs, setBornAs] = useState("");
    const [authInterface, setAuthInterface] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

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

    useEffect(() => {
        setAuthInterface(useInterface);
    }, [useInterface]);

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

            if (result?.error) {
                toast.error(result.error);
            } else if (result?.ok) {
                toast.success("Bem-vindo de volta!");
                router.push('/');
                router.refresh();
            }
        } catch (error) {
            toast.error("Erro inesperado ao tentar fazer login.");
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
            const response = await fetch(`/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: matricula,
                    cpf: documentValue,
                    birthDate: bornAs,
                    password: encryptedPassword,
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Falha ao registrar.');

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
        } catch (error: any) {
            toast.error(error.message || "Erro inesperado.");
        } finally {
            setIsLoading(false);
        }
    }

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
                        
                        {/* LINK ESQUECI MINHA SENHA */}
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
                            <input type="date" value={bornAs} onChange={(e) => setBornAs(e.target.value)} placeholder="Data de nascimento" required />
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
        </aside>
    );
}