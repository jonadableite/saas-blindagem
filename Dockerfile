# Etapa 1: Build da aplicação Next.js
# Usamos uma imagem Node.js Alpine para um tamanho menor
FROM node:20-alpine AS builder

# Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copia os arquivos de configuração do pacote para aproveitar o cache do Docker
# Se você usa yarn.lock ou pnpm-lock.yaml, ajuste aqui
COPY package.json package-lock.json ./

# Instala as dependências do projeto
# `npm ci` é usado para instalações limpas em ambientes de CI/CD e Docker
RUN npm ci

# Copia o restante do código da aplicação
COPY . .

# Constrói a aplicação Next.js para produção
# Isso irá gerar a pasta `.next`
RUN npm run build

# Etapa 2: Execução da aplicação Next.js
# Usamos a mesma imagem Node.js Alpine para consistência e tamanho reduzido
FROM node:20-alpine AS runner

# Define o diretório de trabalho
WORKDIR /app

# Define o ambiente como produção
ENV NODE_ENV production

# Copia apenas o package.json para que o `npm start` funcione
COPY package.json ./

# Copia as dependências de produção do estágio de build
COPY --from=builder /app/node_modules ./node_modules

# Copia a aplicação Next.js construída e os arquivos públicos
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Se você tiver um arquivo next.config.js na raiz do seu projeto, copie-o
# Caso contrário, você pode remover esta linha
COPY --from=builder /app/next.config.js ./

# Expõe a porta padrão do Next.js
EXPOSE 3000

# Comando para iniciar a aplicação Next.js
CMD ["npm", "start"]
