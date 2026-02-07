### Executar projeto: 

```
npx tsc                               
node dist/index.js
```

### Criar migration: 

```
npx prisma migrate dev
```

### Aplicar migration: 

```
npx prisma db pull
```

### Gerar Prisma Client:

```
npx prisma generate
```

### Exemplo .env:

```
DATABASE_URL="postgresql://andrecristen:130217@localhost:5432/letstest?schema=public"
PORT=4000
bucketEndpoint=""
bucketRegion=""
bucketName=""
```

### Rodar teste

```
NODE_ENV=test npm test
```

### Obter coverage 

```
npx jest --coverage   
```

### Zerar seed:
```
SEED_RESET=1 npm run seed   
```

### Atualizar API docs:
```
npm run swagger:gen
```

### Billing (Stripe) - Configuracao

#### 1) Criar conta Stripe (modo test)
- Crie uma conta Stripe e ative o modo **Test** no painel.

#### 2) Criar produtos e precos (mensal)
- Crie um produto **Pro** com preco mensal (R$ 99,00).
- Crie um produto **Enterprise** com preco mensal (R$ 299,00).
- Copie os **Price IDs** gerados para o `.env` (abaixo).

#### 3) Configurar webhook
- Crie um endpoint de webhook apontando para:
  - `POST {BACKEND_URL}/api/billing/webhook`
- Se estiver local, use o Stripe CLI:
  - `stripe listen --forward-to http://localhost:4000/api/billing/webhook`
- Copie o **Webhook signing secret** para o `.env`.

#### 4) Variaveis de ambiente
Adicionar no `.env` do backend:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...
STRIPE_SUCCESS_URL=http://localhost:3000/billing/success
STRIPE_CANCEL_URL=http://localhost:3000/billing
```

#### 5) Migracao e client do Prisma
```
npx prisma migrate dev
npx prisma generate
```

#### 6) Fluxo esperado
- **Checkout** cria o `stripeCustomerId` (um customer por organizacao).
- O **Portal** usa esse customer para mostrar faturas e plano. Envie `returnUrl` no POST `/api/billing/portal` quando quiser controlar o retorno.
- Webhooks atualizam status/periodos da assinatura.

#### Observacoes
- Em **self-hosted** (SELF_HOSTED=true ou DISABLE_BILLING=true), o billing fica desabilitado.
- O endpoint do portal retorna erro se a organizacao ainda nao possui `stripeCustomerId`.
