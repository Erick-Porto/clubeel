"use client"; // Ensure this directive is correct

import styles from "@/styles/login-side-bar.module.css";
import Image from "next/image";
import Logo from "@/images/logo-grena.png";
import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation'; // Import useRouter from next/navigation
import {useUser} from '@/context/UserContext'
import CryptoJS from "crypto-js"; // Import CryptoJS
import { toast } from "react-toastify";
import API_CONSUME from "@/services/api-consume";

export default function AuthSidebar({ useInterface }: { useInterface: string }) {
    const [cpf, setCPF] = useState("");
    const [password, setPassword] = useState("");
    const [repeatPassword, setRepeatPassword] = useState("");
    const [matricula, setMatricula] = useState("");
    const [bornAs, setBornAs] = useState("");
    const [authInterface, setAuthInterface] = useState('');
    const [passwordVerified, setPasswordVerified] = useState(false);
    const router = useRouter(); // Initialize useRouter
    const { setUser, setAccessToken, setCart } = useUser();

    function verifyCode({ code }: { code: string }) {
        const codeValue = code.replace(/[^0-9ESCesc]/g, ''); // Permite apenas números e as letras E, S, C
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
            toast.error("As senhas não coincidem");
        }
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
                    login: documentValue,
                    password: encryptedPassword,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMessage = data.error || "Erro ao tentar fazer login. Por favor, tente novamente.";
                toast.error(errorMessage);
                console.error("Login error:", errorMessage);
            } else {

                const cart = await API_CONSUME("GET", `schedule/member/${data.user.id}`, {
                    'Authorization': 'Bearer ' + process.env.NEXT_PUBLIC_API_TOKEN,
                    'Session': data.token
                }, null);

                const schedule = cart?.schedules ?? [];
                const effectiveCart = Array.isArray(schedule)
                    ? schedule.filter((item: any) => String(item.status) === '3' || Number(item.status) === 3)
                    : [];

                const cartItem = await Promise.all(effectiveCart.map(async (item: any) => {
                    let placeInfo: any = {};
                    try {
                        placeInfo = await API_CONSUME("GET", `place/${item.place_id}`, {
                            'Authorization': 'Bearer ' + process.env.NEXT_PUBLIC_API_TOKEN,
                            'Session': data.token
                        }, null) || {};
                    } catch (e) {
                        console.warn('place fetch failed for', item.place_id, e);
                    }

                    return {
                        start_schedule: item.start_schedule,
                        end_schedule: item.end_schedule,
                        owner: item.member_id,
                        status: item.status,
                        price: item.price,
                        place_id: item.place_id,
                        place_name: placeInfo?.name ?? null,
                        place_image: placeInfo?.image ?? null
                    };
                }));


                const UserData = {
                    name: data.user.name,
                    email: data.user.email,
                    cpf: data.user.cpf,
                    title: data.user.title,
                    barcode: data.user.barcode,
                    birthdate: data.user.birthdate,
                    telephone: data.user.telephone,
                    id: data.user.id
                };
                setUser(UserData);
                const filteredCartItem = (cartItem || []).filter(Boolean);

                setAccessToken(data.token); // Atualiza o token no contexto
                localStorage.setItem('___cfcsn-user-data', JSON.stringify(UserData)); // Armazena o usuário no localStorage
                localStorage.setItem('___cfcsn-access-token', data.token); // Armazena o token no localStorage
                localStorage.setItem('___cfcsn-cart', JSON.stringify(filteredCartItem)); // Armazena o carrinho no localStorage
                try { setCart(filteredCartItem); } catch (e) { console.warn('setCart failed', e); }
                toast.success("Login realizado com sucesso!");
                router.push('/');
            }
        } catch (error) {
            toast.error("Erro inesperado ao tentar fazer login. Por favor, tente novamente.");
            console.error("Unexpected login error:", error);
        }
    }

    async function register(event: React.FormEvent) {
        event.preventDefault();
        try {
            let documentValue = cpf.replace(/\D/g, '');
            if (documentValue.length > 11) documentValue = documentValue.slice(0, 11);

            if (password !== repeatPassword) {
                toast.error("As senhas não coincidem");
                return;
            }
    
            const encryptedPassword = CryptoJS.SHA256(password).toString();

            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cpf: documentValue,
                    title: matricula,
                    birthDate: bornAs,
                    password: encryptedPassword,
                }),
            });
    
            const data = await response.json();
            console.log(data)
            if (!response.ok) {
                const errorMessage = `Erro: ${response.status} - ${data.error}`;
                toast.error(errorMessage);
                console.error("Register error:", errorMessage);
            } else {
                const UserData = {
                    name: data.user.Name,
                    email: data.user.Email,
                    cpf: data.user.cpf,
                    title: data.user.title,
                    barcode: data.user.Barcode,
                    birthdate: data.user.birth_date,
                    telephone: data.user.telephone,
                    id: data.user.id
                };
                setUser(UserData);
                localStorage.setItem('___cfcsn-access-token', data.token);
                router.push('/');
            }
        } catch (error) {
            toast.error("Erro inesperado ao tentar registrar. Por favor, tente novamente.");
            console.error("Unexpected register error:", error);
        }
    }
    return (
        <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
                {/* <Image alt="Logo" src={Logo} height={75} width={200} style={{ margin: "0 auto" }} /> */}
            </div>

            {authInterface === "login" ? (
                <>
                    <p className={styles.loginMessage}> Bem-vindo ao Locação de Espaços do Clube dos Funcionários.</p>
                    <form className={styles.sidebarBody} onSubmit={login}>
                        <div className={`${styles.gridRow} , ${styles.fullGridRow}`}>
                            <input
                                type="text"
                                value={cpf}
                                onChange={(e) => verifyDocument({ cpf: e.target.value })}
                                placeholder="CPF"
                            />
                        </div>
                        <div className={`${styles.gridRow} , ${styles.fullGridRow}`}>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Senha"
                            />
                        </div>
                        <div className={`${styles.gridRow} , ${styles.fullGridRow}`}>
                            <input type="submit" value="Acessar" className={styles.button} />
                        </div>
                        <div className={`${styles.gridRow} , ${styles.fullGridRow}`}>
                            <p className={styles.actionText} onClick={() => { setAuthInterface("register") }}>Ainda não tem um usuário? Cadastre-se!</p>
                        </div>
                    </form>
                </>
            ) : authInterface === "register" ? (
                <form className={styles.sidebarBody} onSubmit={register}>
                    <div className={`${styles.gridRow} , ${styles.fullGridRow}`}>
                        <input
                            type="text"
                            value={cpf}
                            onChange={(e) => verifyDocument({ cpf: e.target.value })}
                            placeholder="CPF"
                        />
                    </div>

                    <div className={styles.gridRow}>
                        <input
                            type="text"
                            value={matricula}
                            onChange={(e) => verifyCode({ code: e.target.value })}
                            placeholder="Matricula"
                        />
                    </div>
                    <div className={styles.gridRow}>

                        <input
                            type="date"
                            value={bornAs}
                            onChange={(e) => setBornAs(e.target.value)}
                            placeholder="Data de nascimento"
                        />
                    </div>

                    <div className={styles.gridRow}>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setPasswordVerified(false); // Reset password verification state
                            }}
                            placeholder="Senha"
                        />
                    </div>
                    <div className={styles.gridRow}>
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
                    <div className={`${styles.gridRow} , ${styles.fullGridRow}`}>
                        <input type="submit" value="Registrar" className={styles.button} />
                    </div>
                    <div className={`${styles.gridRow} , ${styles.fullGridRow}`}>
                        <p className={styles.actionText} onClick={() => { setAuthInterface("login") }}>Já possuí um usuário? Acesse aqui!</p>
                    </div>
                </form>
            ) : null}
        </aside>
    );
}