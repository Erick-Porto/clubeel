'use client'
import style from '@/styles/checkout.module.css'
import React, { useEffect, useMemo, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { initMercadoPago } from '@mercadopago/sdk-react'
import { useUser } from '@/context/UserContext'
import { useRouter } from 'next/navigation'

// lazy-load Payment (client only)
const Payment: any = dynamic(() => import('@mercadopago/sdk-react').then(m => m.Payment), { ssr: false, loading: () => <div>Carregando componente de pagamento...</div> })

const secondsToHHMMSS = (seconds: number) => {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0')
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return s !== '00' ? `${h}:${m}:${s}` : `${h}:${m}`
}
const HHMMSSToSeconds = (hms: string) => {
  const [h, m, s] = hms.split(':').map(Number)
  return h * 3600 + m * 60 + (s || 0)
}
const groupCartData = (cart: any[]) => {
  const grouped: { [key: string]: any } = {}
  cart.forEach(item => {
    const key = `${item.place}`
    if (!grouped[key]) {
      grouped[key] = {
        place_name: item.place_name,
        place: item.place,
        value: Number(item.value) || 0,
        total: Number(item.total) || 0,
        image: item.image || '/default-image.jpg',
        hours: []
      }
    }
    // defensively handle missing or malformed schedules
    try {
      const startPart = item?.start_schedule ? String(item.start_schedule).split(' ')[1] : undefined
      const endPart = item?.end_schedule ? String(item.end_schedule).split(' ')[1] : undefined
      const startSec = startPart ? HHMMSSToSeconds(startPart) : 0
      const endSec = endPart ? HHMMSSToSeconds(endPart) : 0
      grouped[key].hours.push(`${secondsToHHMMSS(startSec)} - ${secondsToHHMMSS(endSec)}`)
    } catch (e) {
      grouped[key].hours.push('Horário indisponível')
    }
    grouped[key].total += Number(item.total) || 0
  })
  return Object.values(grouped)
}

// Error boundary to catch Payment brick errors and avoid remount loops (module scope - stable identity)
class PaymentErrorBoundary extends React.Component<any, { hasError: boolean; error?: any }> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: undefined }
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }
  componentDidCatch(error: any, info: any) {
    console.error('PaymentErrorBoundary caught error:', error, info)
    if (this.props.onError) this.props.onError(error)
  }
  reset = () => this.setState({ hasError: false, error: undefined })
  render() {
    if (this.state.hasError) {
      return (
        <div>
          <p>Erro ao carregar o componente de pagamento.</p>
          <button onClick={this.reset}>Tentar novamente</button>
        </div>
      )
    }
    return this.props.children
  }
}

const CheckoutView: React.FC = () => {
  const { cart } = useUser()
  const router = useRouter()

  // init MercadoPago once on client
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MP_PUBLIC_TOKEN as string
    if (!token) {
      console.warn('NEXT_PUBLIC_MP_PUBLIC_TOKEN não definido')
      return
    }
    try {
      initMercadoPago(token)
      console.debug('MercadoPago inicializado')
    } catch (e) {
      console.error('Erro ao inicializar MercadoPago', e)
    }
  }, [])

  // Snapshot-based state (checkout built from a frozen cart snapshot)
  const [cartSnapshot, setCartSnapshot] = useState<any[] | null>(null)
  const [snapshotAmount, setSnapshotAmount] = useState<number>(0)
  const [groupedCartData, setGroupedCartData] = useState<any[]>([])

  const [initialization, setInitialization] = useState<any | null>(null) // stable init object passed to Payment
  const stableInitRef = useRef<any | null>(null)
  const [isLoadingPref, setIsLoadingPref] = useState(false)
  const [prefError, setPrefError] = useState<string | null>(null)
  const loadingTimer = useRef<number | null>(null)

  // memoize customization so prop identity stays stable
  const customization = useMemo(() => ({ visual: { style: { customVariables: { baseColor: 'var(--grena)' } } } }), [])

  // prevent multiple preference creations
  const initializedRef = useRef(false)
  const lastCartLength = useRef<number | null>(null)

  // compute current cart length only (so frequent content updates don't retrigger)
  const cartLength = useMemo(() => (cart ? cart.length : 0), [cart?.length])

  useEffect(() => {
    // only trigger when there's items and we didn't initialize yet
    if (initializedRef.current) return
    if (!cart || cartLength === 0) return

    // only trigger on changes to length (not content)
    if (lastCartLength.current === cartLength && !prefError) return
    lastCartLength.current = cartLength

    // capture a deep snapshot of the current cart immediately
    const snapshot = JSON.parse(JSON.stringify(cart))
    setCartSnapshot(snapshot)

    // calculate snapshot amount
    const sAmount = snapshot.reduce((sum: number, item: any) => sum + (Number(item.price) || 0), 0)
    setSnapshotAmount(sAmount)

    const createPreference = async () => {
      setIsLoadingPref(true)
      setPrefError(null)
      // mark as initializing to prevent concurrent attempts
      initializedRef.current = true
      loadingTimer.current = window.setTimeout(() => {}, 300)
      try {
        const items = snapshot.map((item: any) => ({
          title: item.place_name,
          quantity: 1,
          unit_price: Number(item.price),
          currency_id: 'BRL'
        }))

        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items })
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Resposta inválida' }))
          const msg = err?.error ?? err?.message ?? `Erro ${res.status}`
          setPrefError(String(msg))
          // allow retry on error
          initializedRef.current = false
          return
        }

        const data = await res.json()
        if (!data || !data.preferenceId) {
          setPrefError('Resposta inválida do servidor')
          initializedRef.current = false
          return
        }

        const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_TOKEN as string
        if (!publicKey) {
          setPrefError('Token público do MercadoPago não configurado')
          initializedRef.current = false
          return
        }

        const initObj = {
          preferenceId: data.preferenceId,
          mercadoPago: { publicKey }
        }

        // keep a stable reference and pass the same object to Payment
        stableInitRef.current = initObj
        setInitialization(stableInitRef.current)
        setGroupedCartData(groupCartData(snapshot))

      } catch (error: any) {
        const msg = (error as any)?.message ?? String(error ?? 'Erro ao criar preferência')
        setPrefError(String(msg))
        initializedRef.current = false
      } finally {
        setIsLoadingPref(false)
        if (loadingTimer.current) {
          clearTimeout(loadingTimer.current)
          loadingTimer.current = null
        }
      }
    }

    createPreference()

    return () => {
      if (loadingTimer.current) {
        clearTimeout(loadingTimer.current)
        loadingTimer.current = null
      }
    }
  }, [cartLength, prefError])

  // only show the empty state when we don't have a stable initialization
  if ((!cart || cart.length < 1 || snapshotAmount === 0) && !initialization) {
    return (
      <div className={style.checkoutEmpty}>
        <h2>Você não possuí agendamentos para finalizar.</h2>
        <button onClick={() => router.push('/')}>Realizar agendamento</button>
      </div>
    )
  }

  return (
    <div className={style.checkout}>
      <div className={style.checkoutContainer}>
        <div className={style.checkoutLeft}>
          {isLoadingPref && <div>Carregando checkout...</div>}
          {prefError && (
            <div>
              <p>Erro ao inicializar checkout: {prefError}</p>
              <button onClick={() => window.location.reload()}>Tentar novamente</button>
            </div>
          )}

          {stableInitRef.current && !prefError && (
            <PaymentErrorBoundary onError={(e: any) => setPrefError(String((e as any)?.message ?? e ?? 'Erro no Payment'))}>
              <Payment
                initialization={stableInitRef.current}
                customization={customization}
                onSubmit={async (status: any, additionalData: any) => {
                  console.log('Payment status:', status)
                  console.log('Additional data:', additionalData)
                  return Promise.resolve()
                }}
              />
            </PaymentErrorBoundary>
          )}
        </div>

        <div className={style.checkoutRight}>
          {groupedCartData.map((item, index) => (
            <div key={`${item.place}-${index}`} className={style.checkoutItem}>
              <div className={style.checkoutItemData}>
                <h2>{item.place_name}</h2>
                <p>Horário: {item.hours.join(', ')}</p>
                <p>Valor/Hora R${item.value.toFixed(2)}</p>
                <p>Total R${item.total.toFixed(2)}</p>
              </div>
            </div>
          ))}
          <h2>Total: R${Number(snapshotAmount).toFixed(2)}</h2>
        </div>
      </div>
    </div>
  )
}

export default CheckoutView
