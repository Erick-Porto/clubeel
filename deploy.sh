#!/bin/bash

echo "🚀 Iniciando Deploy..."

# Garante que estamos na pasta certa (ajuste se necessário)
# cd /home/administrator/clubeel 

echo "🧹 Limpando alterações locais..."
# Descarta edições feitas no servidor
git reset --hard
# Remove arquivos novos criados no servidor que conflitam com o git
git clean -df

echo "⬇️  Baixando código da branch master..."
git pull origin master

echo "📦  Instalando dependências..."
# npm ci é determinístico (usa exatamente o package-lock.json) e mais rápido
# que npm install para CI/CD. --include=dev garante que typescript e demais
# devDependencies sejam instaladas mesmo com NODE_ENV=production no ambiente
# (o next build precisa do typescript para carregar next.config.ts).
npm ci --include=dev

echo "🏗️  Gerando Build..."
npm run build

echo "🔄  Reiniciando PM2..."
pm2 restart espacos

echo "🔒  Aplicando permissões mínimas (Linux)..."
# NUNCA usar 777: tornaria todo o diretório (código, build, .env) gravável por
# qualquer processo do host — vetor de persistência de build adulterado.
find . -type d -not -path './.git/*' -exec chmod 755 {} \;
find . -type f -not -path './.git/*' -exec chmod 644 {} \;
chmod +x deploy.sh
# .env com segredos: somente o dono lê/escreve.
[ -f .env ] && chmod 600 .env

echo "✅  Atualização concluída!"