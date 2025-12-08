'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import style from '@/styles/forgot-password.module.css';
import API_CONSUME from '@/services/api-consume';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes, faSpinner, faArrowLeft, faLock, faUserCheck } from '@fortawesome/free-solid-svg-icons';
import CryptoJs from 'crypto-js';

interface UserData {
    cpf: string;
    matricula: string;
    birthDate: string;
}

// --- COMPONENTE 1: Identificação do Usuário ---
const UserCheckStep = ({ onSuccess }: { onSuccess: (data: UserData) => void }) => {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        cpf: '',
        matricula: '',
        birthDate: ''
    });

    const formatCPF = (value: string) => {
        return value
            .replace(/\D/g, '')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})/, '$1-$2')
            .replace(/(-\d{2})\d+?$/, '$1');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'cpf' ? formatCPF(value) : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // Envia dados para checar existência
            const response = await API_CONSUME('POST', 'check-member', {
                Session: null,
            }, {
                cpf: formData.cpf.replace(/\D/g, ''), // Envia CPF limpo
                title: formData.matricula,
                birth_date: formData.birthDate
            });

            // Verifica a resposta do backend
            // Ajuste a lógica conforme o retorno real da sua API (ex: response.exists ou status 200)
            if (response?.error || response?.status === 404 || response === false) {
                toast.error("Usuário não encontrado. Verifique os dados.");
                
                // setTimeout(() => router.push('/login'), 3000); 
            } else {
                console.log(response);
                toast.success("Dados confirmados! Prossiga para a nova senha.");
                onSuccess({ 
                    cpf: response.cpf || formData.cpf, // Garante que tenha um CPF
                    matricula: formData.matricula,
                    birthDate: formData.birthDate
                }); 
            }

        } catch (error) {
            console.error(error);
            toast.error("Erro ao verificar usuário.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={style.card}>
            <div className={style.header}>
                <div style={{color: 'var(--grena)', fontSize: '2.5rem', marginBottom: 10}}>
                    <FontAwesomeIcon icon={faUserCheck} />
                </div>
                <h1 className={style.title}>Recuperar Senha</h1>
                <p className={style.subtitle}>Informe seus dados para confirmarmos sua identidade.</p>
            </div>

            <form onSubmit={handleSubmit} className={style.form}>
                <div className={style.inputGroup}>
                    <label className={style.label}>CPF</label>
                    <input 
                        className={style.input} 
                        name="cpf" 
                        value={formData.cpf} 
                        onChange={handleChange} 
                        placeholder="000.000.000-00"
                        required 
                    />
                </div>
                <div className={style.inputGroup}>
                    <label className={style.label}>Matrícula</label>
                    <input 
                        className={style.input} 
                        name="matricula" 
                        value={formData.matricula} 
                        onChange={handleChange} 
                        placeholder="Digite sua matrícula"
                        required 
                    />
                </div>
                <div className={style.inputGroup}>
                    <label className={style.label}>Data de Nascimento</label>
                    <input 
                        className={style.input} 
                        name="birthDate" 
                        type="date"
                        value={formData.birthDate} 
                        onChange={handleChange} 
                        required 
                    />
                </div>

                <button type="submit" className={style.button} disabled={isLoading}>
                    {isLoading ? <FontAwesomeIcon icon={faSpinner} spin /> : "Confirmar Dados"}
                </button>

                <div className={style.backLink} onClick={() => router.push('/')}>
                    <FontAwesomeIcon icon={faArrowLeft} /> Voltar para Login
                </div>
            </form>
        </div>
    );
};

// --- COMPONENTE 2: Nova Senha ---
const PasswordResetStep = ({ userData }: { userData: UserData }) => {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [passwords, setPasswords] = useState({ new1: "", new2: "" });
    const [rules, setRules] = useState({ length: false, uppercase: false, lowercase: false, number: false, special: false });

    const passwordsMatch = passwords.new1 !== "" && passwords.new1 === passwords.new2;
    const allRulesMet = Object.values(rules).every(Boolean);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setPasswords(prev => ({ ...prev, [e.target.name]: val }));

        if (e.target.name === 'new1') {
            setRules({
                length: val.length >= 8,
                uppercase: /[A-Z]/.test(val),
                lowercase: /[a-z]/.test(val),
                number: /[0-9]/.test(val),
                special: /[!@#$%¨&*\-_=+§£¢¬]/.test(val),
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!allRulesMet || !passwordsMatch) return;
        
        setIsLoading(true);

        try {
            const encryptedPassword = CryptoJs.SHA256(passwords.new1).toString();
            
            // Envia nova senha + dados identificadores
            await API_CONSUME('PUT', 'change-password', {
                Session: null,
            }, {
                cpf: userData.cpf, // ID retornado do passo 1
                new_password: encryptedPassword
            });

            toast.success("Senha alterada com sucesso! Faça login.");
            router.push('/');

        } catch (error) {
            console.error(error);
            toast.error("Erro ao alterar senha. Tente novamente.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={style.card}>
            <div className={style.header}>
                <div style={{color: 'var(--grena)', fontSize: '2.5rem', marginBottom: 10}}>
                    <FontAwesomeIcon icon={faLock} />
                </div>
                <h1 className={style.title}>Nova Senha</h1>
                <p className={style.subtitle}>Crie uma senha segura para acessar sua conta.</p>
            </div>

            <form onSubmit={handleSubmit} className={style.form}>
                
                <div className={style.rulesContainer}>
                    <ul className={style.rulesList}>
                        <li className={`${style.ruleItem} ${rules.length ? style.ruleMet : ''}`}>
                            <FontAwesomeIcon icon={rules.length ? faCheck : faTimes} /> Mín. 8 caracteres
                        </li>
                        <li className={`${style.ruleItem} ${rules.uppercase ? style.ruleMet : ''}`}>
                            <FontAwesomeIcon icon={rules.uppercase ? faCheck : faTimes} /> Maiúscula
                        </li>
                        <li className={`${style.ruleItem} ${rules.lowercase ? style.ruleMet : ''}`}>
                            <FontAwesomeIcon icon={rules.lowercase ? faCheck : faTimes} /> Minúscula
                        </li>
                        <li className={`${style.ruleItem} ${rules.number ? style.ruleMet : ''}`}>
                            <FontAwesomeIcon icon={rules.number ? faCheck : faTimes} /> Número
                        </li>
                        <li className={`${style.ruleItem} ${rules.special ? style.ruleMet : ''}`}>
                            <FontAwesomeIcon icon={rules.special ? faCheck : faTimes} /> Especial
                        </li>
                    </ul>
                </div>

                <div className={style.inputGroup}>
                    <label className={style.label}>Nova Senha</label>
                    <input 
                        type="password"
                        className={style.input} 
                        name="new1" 
                        value={passwords.new1} 
                        onChange={handleChange} 
                        placeholder="Digite a nova senha"
                        required 
                    />
                </div>
                <div className={style.inputGroup}>
                    <label className={style.label}>Confirmar Senha</label>
                    <input 
                        type="password"
                        className={style.input} 
                        name="new2" 
                        value={passwords.new2} 
                        onChange={handleChange} 
                        placeholder="Repita a nova senha"
                        disabled={!allRulesMet}
                        required 
                    />
                </div>
                
                {passwordsMatch && passwords.new2 !== "" && (
                    <div style={{color: 'green', fontSize: '0.85rem', textAlign:'center'}}>
                        <FontAwesomeIcon icon={faCheck} /> As senhas coincidem
                    </div>
                )}

                <button type="submit" className={style.button} disabled={isLoading || !allRulesMet || !passwordsMatch}>
                    {isLoading ? <FontAwesomeIcon icon={faSpinner} spin /> : "Alterar Senha"}
                </button>
            </form>
        </div>
    );
};

// --- PÁGINA PRINCIPAL ---
const ForgotPasswordPage = () => {
    const [step, setStep] = useState<1 | 2>(1);
    const [userData, setUserData] = useState<UserData | null>(null);

    const handleUserConfirmed = (data: UserData) => {
        setUserData(data);
        setStep(2);
    };

    return (
        <div className={style.container}>
            {step === 1 ? (
                <UserCheckStep onSuccess={handleUserConfirmed} />
            ) : (
                // Garantimos que userData existe se o step é 2
                userData && <PasswordResetStep userData={userData} />
            )}
        </div>
    );
};

export default ForgotPasswordPage;