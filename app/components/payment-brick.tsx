'use client'
import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

const PaymentDyn: any = dynamic(
  () => import('@mercadopago/sdk-react').then(mod => mod.Payment),
  { ssr: false, loading: () => <div>Carregando componente de pagamento...</div> }
)

class LocalErrorBoundary extends React.Component<any, { hasError: boolean; error?: any }> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: undefined }
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }
  componentDidCatch(error: any, info: any) {
    console.error('PaymentBrick ErrorBoundary caught error:', error, info)
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

const PaymentBrick = React.memo(function PaymentBrick({ initialization, customization, onError, onSubmit }: any) {
  // capture initialization once to avoid prop identity changes
  const [stableInit] = useState(() => initialization)

  useEffect(() => {
    console.debug('PaymentBrick mounted with stableInit:', stableInit)
  }, [stableInit])

  if (!stableInit) return null

  return (
    <LocalErrorBoundary onError={onError}>
      <PaymentDyn initialization={stableInit} customization={customization} onSubmit={onSubmit} />
    </LocalErrorBoundary>
  )
})

export default PaymentBrick
