#!/bin/bash

echo "🚀 Iniciando Deploy..."

# O `next start` roda como serviço do systemd, atrás do nginx (o nginx só faz
# o proxy reverso; quem executa o Next é o serviço). Ajuste o nome se o da
# máquina for outro, ou rode `SERVICO=<nome> ./deploy.sh`.
SERVICO="${SERVICO:-espacos}"

# Confere ANTES de mexer no código: sem o serviço certo, o build novo ficaria
# em disco sem nunca ser carregado.
if ! systemctl cat "$SERVICO" >/dev/null 2>&1; then
  echo "❌  Serviço systemd '$SERVICO' não encontrado. Rode 'systemctl list-units --type=service' e use SERVICO=<nome> ./deploy.sh."
  exit 1
fi

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

echo "🔄  Reiniciando o serviço $SERVICO..."
# Precisa de sudo (ou de uma regra no sudoers liberando só este restart).
sudo systemctl restart "$SERVICO"
systemctl is-active --quiet "$SERVICO" || { echo "❌  $SERVICO não subiu. Veja: journalctl -u $SERVICO -n 50"; exit 1; }

echo "🔒  Aplicando permissões mínimas (Linux)..."
# NUNCA usar 777: tornaria todo o diretório (código, build, .env) gravável por
# qualquer processo do host — vetor de persistência de build adulterado.
find . -type d -not -path './.git/*' -exec chmod 755 {} \;
find . -type f -not -path './.git/*' -exec chmod 644 {} \;
chmod +x deploy.sh
# .env com segredos: somente o dono lê/escreve.
[ -f .env ] && chmod 600 .env

echo "✅  Atualização concluída!"