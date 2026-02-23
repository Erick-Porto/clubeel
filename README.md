<div align="center">
<!-- Substitua pelo caminho real da sua imagem no repositório, ex: /public/images/logo-cfcsn-horiz.png -->
<img src="public/images/logo-cfcsn-horiz.png" alt="Logo Clubeel" width="350"/>

<h1>Clubeel Web</h1>

<p>
<b>Conectando Gerações através do Esporte.</b>




Uma plataforma moderna de gestão, agendamento de quadras e pagamentos digitais.
</p>

<!-- Badges de Tecnologias estilizados -->

<p>
<img src="https://www.google.com/search?q=https://img.shields.io/badge/Next.js-000000%3Fstyle%3Dfor-the-badge%26logo%3Dnextdotjs%26logoColor%3Dwhite" alt="Next.js"/>
<img src="https://www.google.com/search?q=https://img.shields.io/badge/React-20232A%3Fstyle%3Dfor-the-badge%26logo%3Dreact%26logoColor%3D61DAFB" alt="React"/>
<img src="https://www.google.com/search?q=https://img.shields.io/badge/TypeScript-007ACC%3Fstyle%3Dfor-the-badge%26logo%3Dtypescript%26logoColor%3Dwhite" alt="TypeScript"/>
<img src="https://www.google.com/search?q=https://img.shields.io/badge/CSS_Modules-7d0400%3Fstyle%3Dfor-the-badge%26logo%3Dcss3%26logoColor%3Dwhite" alt="CSS Modules"/>
<img src="https://www.google.com/search?q=https://img.shields.io/badge/NextAuth-5B2C6F%3Fstyle%3Dfor-the-badge%26logo%3Dauth0%26logoColor%3Dwhite" alt="NextAuth"/>
<img src="https://www.google.com/search?q=https://img.shields.io/badge/Mercado_Pago-009EE3%3Fstyle%3Dfor-the-badge%26logo%3Dmercadopago%26logoColor%3Dwhite" alt="Mercado Pago"/>
</p>

<p align="center">
<a rel="noopener noreferrer" href="#-funcionalidades">Funcionalidades</a> •
<a rel="noopener noreferrer" href="#-arquitetura-e-paginas">Arquitetura</a> •
<a rel="noopener noreferrer" href="#-instalação">Instalação</a> •
<a rel="noopener noreferrer" href="#-segurança">Segurança</a>
</p>
</div>

<!-- AREA DE SUGESTÃO PARA GIF HERO -->

<div align="center">
<h3>📱 Experiência Completa de Reserva</h3>
<!-- SUGESTÃO: Coloque aqui um GIF gravado da tela do celular mostrando: Login -> Seleção no Mapa -> Pagamento -->
<!-- <img src="docs/demo-mobile.gif" alt="Demonstração Mobile" width="300" style="border-radius: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);"/> -->
<p><i>(Insira aqui um GIF demonstrando o fluxo de ponta a ponta)</i></p>
</div>

🚀 Sobre o Projeto

O Clubeel Web não é apenas um sistema de agendamento; é uma Engine de Regras de Negócio completa para clubes esportivos. O sistema resolve conflitos de horários em tempo real, gerencia cotas de associados e processa pagamentos de forma segura, tudo envelopado em uma interface visual rica que utiliza a identidade visual Grená (#7d0400) do clube.

Principais Diferenciais

Mapa Interativo (Zoom & Pan): Navegação vetorial pela planta do clube.

Segurança Híbrida: Criptografia Client-Side antes mesmo dos dados tocarem a rede.

Onboarding Guiado: Sistema de tutoriais (TutorialOverlay) que ensina o usuário a usar a ferramenta.

📸 Galeria & Funcionalidades

1. Descoberta e Mapa

A Home serve como Hub central. O usuário pode explorar o clube visualmente ou navegar por categorias.

<!-- SUGESTÃO DE LAYOUT: Duas imagens lado a lado -->

<div align="center">
<!-- Coloque um print do Mapa no Desktop e um print do Menu no Mobile -->
<!-- <img src="docs/map-desktop.png" width="48%" /> <img src="docs/home-mobile.png" width="25%" /> -->
</div>

2. Agendamento Inteligente (Schedule)

Nossa grade de horários não permite erros.

✅ Validação de horários consecutivos.

✅ Bloqueio visual de horários ocupados.

✅ Polling automático (atualização a cada 30s).

3. Checkout & Pagamento

Integração transparente com a Wallet do Mercado Pago.

O resumo do pedido é responsivo (vira um Accordion no mobile).

Tratamento de callback de pagamento (success, failure) direto na URL.

<!-- SUGESTÃO: Print da tela de Checkout com o modal do Mercado Pago aberto -->

<!-- <img src="docs/checkout-flow.png" width="80%" style="border-radius: 8px;" /> -->

🗺️ Arquitetura do Sistema

O fluxo do usuário é distribuído em 7 rotas estratégicas, otimizadas para conversão e usabilidade:

Página

Rota

Descrição Técnica

Login / Registro

/auth

Layout Split-Screen. Validação de matrícula (FCN/ESC) e Hash SHA256 no cliente.

Recuperar Senha

/forgot-password

Wizard em 2 etapas com feedback visual de força de senha em tempo real.

Home

/

Implementa Scroll Spy para navegação e Mapa vetorial com react-zoom-pan-pinch.

Perfil

/profile

Smart Banner: A capa muda baseada na última quadra que o usuário jogou.

Grupos

/places/[category]

Listagem filtrada com engine de disponibilidade (regras de antecedência).

Reserva

/place/[id]

Página de alta conversão. Seleção de slots e cálculo de preço dinâmico.

Checkout

/checkout

Gestão de estado global (CartContext) e finalização financeira.

🛠️ Instalação e Configuração

Siga os passos abaixo para rodar o projeto localmente.

Pré-requisitos: Node.js 18+ e NPM/Yarn.

# 1. Clone o repositório
git clone https://seu-repositorio/clubeel.git

# 2. Instale as dependências
cd clubeel
npm install

# 3. Configure as variáveis de ambiente (.env.local)
cp .env.example .env.local


Variáveis Necessárias (.env.local)

# Backend (Laravel API)
NEXT_PUBLIC_LARA_API=[https://api.clubeel.com.br](https://api.clubeel.com.br)
NEXT_PUBLIC_LARA_API_TOKEN=seu_token_integracao

# Autenticação (NextAuth)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=hash_secreto_para_cookies


4. Execute o projeto:

npm run dev
# Acesse http://localhost:3000


🔐 Segurança & Performance

Destaques técnicos implementados no projeto:

Criptografia Front-end: Utilizamos crypto-js para aplicar hash SHA256 nas senhas no momento do submit. A senha real nunca trafega em texto plano na rede.

Otimização de Imagens: Uso intensivo do next/image com tratamento de layout shift.

Code Splitting: Carregamento dinâmico de componentes pesados (como o Mapa e o Checkout).

<div align="center">
<p>Desenvolvido com ❤️ e ☕ pela equipe <b>Clubeel</b>.</p>
<p style="color: #7d0400;">Connectando Gerações.</p>
</div>
