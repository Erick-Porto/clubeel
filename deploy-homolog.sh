#!/bin/bash

# Deploy da HOMOLOGAÇÃO (/homolog). Roda numa pasta SEPARADA da produção
# (ex.: /home/administrator/clubeel-homolog), com .env próprio contendo
# NEXT_PUBLIC_BASE_PATH=/homolog. O `next start` dela é o serviço systemd
# `espacos-homolog` (modelo em deploy/espacos-homolog.service), atrás do mesmo
# nginx da produção. Ver docs/resumo-modulos/01-infraestrutura-config.md.

set -e

SERVICO="${SERVICO:-espacos-homolog}"

echo "🧪 Iniciando Deploy da HOMOLOGAÇÃO..."

# Trava: este script nunca pode rodar na pasta da produção — trocaria a branch
# dela para homolog e geraria um build com o prefixo errado.
if ! grep -qE '^NEXT_PUBLIC_BASE_PATH=/homolog\s*$' .env 2>/dev/null; then
  echo "❌  .env sem NEXT_PUBLIC_BASE_PATH=/homolog — esta não é a pasta da homologação. Abortando."
  exit 1
fi

if ! systemctl cat "$SERVICO" >/dev/null 2>&1; then
  echo "❌  Serviço systemd '$SERVICO' não encontrado. Instale deploy/espacos-homolog.service (ver doc 01)."
  exit 1
fi

echo "🧹 Limpando alterações locais..."
git reset --hard
git clean -df

echo "⬇️  Baixando código da branch homolog..."
git fetch origin homolog
git checkout homolog
git reset --hard origin/homolog

echo "📦  Instalando dependências..."
npm ci --include=dev

echo "🏗️  Gerando Build..."
# O basePath é fixado no build (lido do .env pelo next build).
npm run build

echo "🔄  Reiniciando o serviço $SERVICO..."
sudo systemctl restart "$SERVICO"
systemctl is-active --quiet "$SERVICO" || { echo "❌  $SERVICO não subiu. Veja: journalctl -u $SERVICO -n 50"; exit 1; }

echo "🔒  Aplicando permissões mínimas (Linux)..."
find . -type d -not -path './.git/*' -exec chmod 755 {} \;
find . -type f -not -path './.git/*' -exec chmod 644 {} \;
chmod +x deploy.sh deploy-homolog.sh
[ -f .env ] && chmod 600 .env

echo "✅  Homologação atualizada!"
