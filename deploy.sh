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
# npm ci é mais rápido e seguro para CI/CD que npm install
npm install

echo "🏗️  Gerando Build..."
npm run build

echo "🔄  Reiniciando PM2..."
pm2 restart nextjs-espacos

echo "🚦  Definindo permissões do diretório local (Linux)..."
chmod -R 777 .

echo "✅  Atualização concluída!"