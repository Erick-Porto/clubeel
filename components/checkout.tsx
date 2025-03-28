import style from '@/styles/checkout.module.css'
import { table } from 'console'
import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import Card from '@/components/card'

const CheckoutView = () => {
    const [paymentMethod, setPaymentMethod] = useState('')
    const[cardNumber, setCardNumber] = useState('0000 0000 0000 0000')
    const[cvc, setCvc] = useState('000')
    const[valid, setValid] = useState('00/00')
    const[cardName, setCardName] = useState('Nome conforme no cartão')
    const[type, setType] = useState('')
    const [cardPostion, setCardPosition] = useState('front')

    const user = JSON.parse(localStorage.getItem('___cfcsn-user-data'))

    const userDocuments = () =>{
        return(
            <table>
                <thead>
                    <tr>
                        <th colSpan={3}>Dados pessoais</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td colSpan={1}>Nome completo:</td>
                        <td colSpan={2}>{user.name}</td>
                    </tr>
                    <tr>
                        <td colSpan={1}>CPF:</td>
                        <td colSpan={2}>{user.cpf}</td>
                    </tr>
                    <tr>
                        <td colSpan={1}>Matricula:</td>
                        <td colSpan={2}>{user.barcode}</td>
                    </tr>
                </tbody>
            </table>
    )}

    const userContact = () =>{
        return(
            <table>
                <thead>
                    <tr>
                        <th colSpan={3}>Dados de contato</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td colSpan={1}>E-mail</td>
                        <td colSpan={2}>{user.email}</td>
                    </tr>
                    <tr>
                        <td colSpan={1}>Whatsapp</td>
                        <td colSpan={2}>{user.telephone}</td>
                    </tr>
                </tbody>
            </table>
    
    )}

    const cartItens = () =>{
        const cartData = JSON.parse(localStorage.getItem('___cfcsn-cart'))

        return(
            <table>
                <thead>
                    <tr>
                        <th colSpan={3}>Agendamentos</th>
                    </tr>
                </thead>
                <tbody>
                    {cartData.map((item, index) => {
                        const hour = `${item.hour}:00 - ${item.hour + 1}:00`
                        return(
                        <>
                            <tr>
                                <td colSpan={1}>Quadra:</td>
                                <td colSpan={2}>{item.place}</td>
                            </tr>
                            <tr>
                                <td colSpan={1}>Horário agendado:</td>
                                <td colSpan={2}>{hour}</td>
                            </tr>
                        </>
                        )}
                    )}
                </tbody>
            </table>
        )}

    const methodCard = () => {
        return(
            <div className={style.cardContainer}>
                <input
                    type="text"
                    placeholder="Número do cartão"
                    maxLength={19}
                    value={cardNumber}
                    onChange={(e) => handleCardNumberChange(e)}
                />
                <input
                    type="text"
                    placeholder="Nome do titular"
                    onChange={(e) => setCardName(e.target.value)}
                    />
                <input
                    type="text"
                    maxLength={3}
                    placeholder="CVV"
                    onFocus={()=>setCardPosition('back')}
                    onBlur={()=>setCardPosition('front')}
                    onChange={(e) => setCvc(e.target.value)}
                    />
                <input
                    type="text"
                    placeholder="MM/AA"
                    maxLength={5}
                    onFocus={() => setCardPosition('back')}
                    onBlur={() => setCardPosition('front')}
                    onChange={(e) => handleValidChange(e)}
                    value={valid}
                />

                <Card cardNumber={cardNumber} name={cardName} cvc={cvc} valid={valid} cardPosition={cardPostion}/>
            </div>
    )}

    const methodPix = () => {
        return(
            <div>PIX</div>
    )}

    function handleCardNumberChange(event: React.ChangeEvent<HTMLInputElement>) {
        const value = event.target.value.replace(/\D/g, '');
        const limitedValue = value.slice(0, 16);
        const formattedValue = limitedValue
            .replace(/(\d{4})(?=\d)/g, '$1 ')
            .trim();
        setCardNumber(formattedValue);
    }

function handleValidChange(event: React.ChangeEvent<HTMLInputElement>) {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length >= 3) {
        value = `${value.slice(0, 2)}/${value.slice(2)}`;
    }
    setValid(value);
}

    function selectPaymentMethod({paymentMethod}: {paymentMethod: string}) {
        setPaymentMethod(paymentMethod)
        toast.success(`Metodo de pagamento alterado com sucesso.\n Método atual: ${paymentMethod}`)
    }

    return (
        <div className={style.checkout}>
            <div className={style.checkoutContainer}>
                <div className={style.checkoutLeft}>
                    <h2 className={style.checkoutTitle}>Your shopping Basket</h2>
                    <ul>
                        <li onClick={()=>selectPaymentMethod({paymentMethod: 'Pix'})}>Pix</li>
                        <li onClick={()=>selectPaymentMethod({paymentMethod: 'Cartão'})}>Cartão</li>
                    </ul>

                    {paymentMethod === 'Pix' ? methodPix() : methodCard()}
                </div>
                <div className={style.checkoutRight}>
                    {userDocuments()}
                    {userContact()}
                    {cartItens()}
                </div>
            </div>
        </div>
    )
}

export default CheckoutView