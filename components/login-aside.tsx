"use client"; // Ensure this directive is correct

import styles from "@/styles/login-side-bar.module.css";
import Image from "next/image";
import Logo from "@/images/logo-grena.png";
import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation'; // Import useRouter from next/navigation
import {useUser} from '@/context/UserContext'
import AlertBox from "@/components/alert";
import CryptoJS from "crypto-js"; // Import CryptoJS

export default function AuthSidebar({ useInterface }: { useInterface: string }) {
    const [cpf, setCPF] = useState("");
    const [password, setPassword] = useState("");
    const [repeatPassword, setRepeatPassword] = useState("");
    const [matricula, setMatricula] = useState("");
    const [bornAs, setBornAs] = useState("");
    const [authInterface, setAuthInterface] = useState('');
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertMessage, setAlertMessage] = useState("");
    const [passwordVerified, setPasswordVerified] = useState(false);
    const router = useRouter(); // Initialize useRouter
    const { setUser } = useUser();

    function verifyCode({ code }: { code: string }) {
        let codeValue = code.replace(/[^0-9ESCesc]/g, ''); // Permite apenas números e as letras E, S, C
        let newValue = codeValue.split('');
        const escOrder = ['E', 'S', 'C'];

        // Ensure the first 5 characters are numbers
        for (let i = 0; i < 5; i++) {
            if (newValue[i] && isNaN(Number(newValue[i]))) {
                newValue[i] = '';
            }
        }

        // Ensure the last 3 characters form "ESC" only if the length is 8 and the 6th character is not a number
        if (newValue.length === 8 && isNaN(Number(newValue[5]))) {
            for (let i = 5; i <= 7; i++) {
                if (newValue[i] && !escOrder.includes(newValue[i].toUpperCase())) {
                    newValue[i] = '';
                }
            }
            for (let i = 0; i < escOrder.length; i++) {
                if (!newValue[5 + i]) {
                    newValue[5 + i] = escOrder[i];
                }
            }
        } else {
            newValue = newValue.slice(0, 8); // Limit to first 8 characters if not 8
        }

        setMatricula(newValue.join('').slice(0, 8)); // Ensure the final value has a maximum of 8 characters
    }

    function verifyDocument({ cpf }: { cpf: string }) {
        let documentValue = cpf.replace(/\D/g, '');
        if (documentValue.length > 11) {
            documentValue = documentValue.slice(0, 11);
        }
        documentValue = documentValue.replace(/(\d{3})(\d)/, "$1.$2");
        documentValue = documentValue.replace(/(\d{3})(\d)/, "$1.$2");
        documentValue = documentValue.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
        setCPF(documentValue);
    }

    function verifyPassword({ password, repeatPassword }: { password: string, repeatPassword: string }) {
        if (password !== repeatPassword) {
            setAlertMessage("As senhas não coincidem");
            setAlertVisible(true);
        } else {
            setAlertVisible(false);
        }
        setPasswordVerified(true);
    }

    
    useEffect(() => {
        setAuthInterface(useInterface);
    }, [useInterface]);

    async function login(event: React.FormEvent) {
        event.preventDefault();
        try {
            let documentValue = cpf.replace(/\D/g, '');
            if (documentValue.length > 11) documentValue = documentValue.slice(0, 11);

            
            const encryptedPassword = CryptoJS.SHA256(password).toString();
            
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    login:documentValue,
                    password:encryptedPassword,
                }),
            });
            const data = await response.json();

            if (response.status !== 200) {
                setAlertMessage(data.error);
                setAlertVisible(true);
            } else {
                const userData = {
                    name: data.user.name,
                    email: data.user.email,
                    cpf: data.user.cpf,
                    title: data.user.title,
                    barcode: data.user.barcode,
                    birthdate: data.user.birthdate,
                    telephone: data.user.telephone,
                }
                setUser(userData)
                localStorage.setItem('___cfcsn-access-token', data.token);
                router.push('/');
            }

        } catch (error) {
            setAlertMessage(`${error}`);
            setAlertVisible(true);
        }
    }

    async function register(event: React.FormEvent) {
        event.preventDefault();
        let documentValue = cpf.replace(/\D/g, '');
        if (documentValue.length > 11) documentValue = documentValue.slice(0, 11);

        try {
            if (password !== repeatPassword) {
                setAlertMessage("As senhas não coincidem");
                setAlertVisible(true);
                return;
            } else {
                const encryptedPassword = CryptoJS.SHA256(password).toString();
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        cpf: documentValue,
                        matricula,
                        bornAs,
                        password:encryptedPassword,
                    }),
                });

                const data = await response.json();

                if (response.status !== 200) {
                    setAlertMessage(data.error);
                    setAlertVisible(true);
                } else {
                    const userData = {
                        name: data.user.name,
                        email: data.user.email,
                        cpf: data.user.cpf,
                        title: data.user.title,
                        barcode: data.user.barcode,
                        birthdate: data.user.birthdate,
                        telephone: data.user.telephone,
                    }
                    setUser(userData)
                    setAlertVisible(false);
                }
            }
        } catch (error) {
            setAlertMessage(`${error}`);
            setAlertVisible(true);
            console.error('Registration failed:', error);
        }
    }

    return (
        <>
            {alertVisible && <AlertBox visible={true} width={50} title={`Falha no ${authInterface}`} message={alertMessage} />}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <Image alt="Logo" src={Logo} height={75} width={200} style={{ margin: "0 auto" }} />
                </div>

                {authInterface === "login" ? (
                    <>
                        <p> Bem-vindo ao Locação de Espaços do Clube dos Funcionários.</p>
                        <form className={styles.sidebarBody} onSubmit={login}>
                            <input
                                type="text"
                                value={cpf}
                                onChange={(e) => verifyDocument({ cpf: e.target.value })}
                                placeholder="CPF"
                            />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Senha"
                            />
                            <input type="submit" value="Acessar" className={styles.button} />
                            <p className={styles.actionText} onClick={() => { setAuthInterface("register") }}>Ainda não tem um usuário? Cadastre-se!</p>
                        </form>
                    </>
                ) : authInterface === "register" ? (
                    <form className={styles.sidebarBody} onSubmit={register}>
                        <input
                            type="text"
                            value={cpf}
                            onChange={(e) => verifyDocument({ cpf: e.target.value })}
                            placeholder="CPF"
                        />

                        <div className={styles.row}>
                            <input
                                type="text"
                                value={matricula}
                                onChange={(e) => verifyCode({ code: e.target.value })}
                                placeholder="Matricula"
                            />

                            <input
                                type="date"
                                value={bornAs}
                                onChange={(e) => setBornAs(e.target.value)}
                                placeholder="Data de nascimento"
                            />
                        </div>

                        <div className={styles.row}>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    setPasswordVerified(false); // Reset password verification state
                                }}
                                placeholder="Senha"
                            />
                            <input
                                type="password"
                                value={repeatPassword}
                                onBlur={() => {
                                    if (!passwordVerified) {
                                        verifyPassword({ password, repeatPassword });
                                    }
                                }}
                                onChange={(e) => {
                                    setRepeatPassword(e.target.value);
                                    setPasswordVerified(false); // Reset password verification state
                                }}
                                placeholder="Repita a senha"
                            />
                        </div>
                        <input type="submit" value="Registrar" className={styles.button} />
                        <p className={styles.actionText} onClick={() => { setAuthInterface("login") }}>Já possuí um usuário? Acesse aqui!</p>
                    </form>
                ) : null}
            </aside>
        </>
    );
}