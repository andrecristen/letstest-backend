# Letstest Backend

Este repositório contém o código-fonte do projeto Letstest Backend, desenvolvido como parte do Trabalho de Conclusão de Curso (TCC) do curso de Engenharia de Software.

## Descrição

O Letstest é uma plataforma para gestão e execução de testes automatizados. O backend foi desenvolvido utilizando Node.js e Express.

## Tecnologias Utilizadas

- **Node.js**: Ambiente de execução JavaScript server-side.
- **Express**: Framework web para Node.js.
- **Jest**: Framework de testes para JavaScript.

## Swagger (Documentacao da API)

1. Instale as dependencias:
   - `npm install`
2. Gere o arquivo do Swagger:
   - `npm run swagger:gen`
3. Inicie o backend:
   - `npm run dev`
4. Acesse no navegador:
   - `http://localhost:4000/api/docs`

Se voce criar/alterar rotas, rode `npm run swagger:gen` novamente para atualizar a documentacao.

## Demonstração

[Youtube](https://youtu.be/QxlsbTeRnuY)


## @todo

Plano de Comercialização do Letstest
Visão Geral
Transformar o Letstest de um TCC em um SaaS + self-hosted de gestão de testes para o mercado LATAM/Brasil.
Foco: multi-tenancy, billing, integrações CI/CD, API pública, onboarding.

Fase 0: Fundação de Segurança
Pré-requisito para tudo. Sem dependências.

0.1 JWT Secret para variável de ambiente
Arquivo: letstest-backend/src/utils/token.server.ts
Substituir o secret hardcoded (linha 6) por process.env.JWT_SECRET com validação obrigatória
0.2 CORS restritivo
Arquivo: letstest-backend/src/index.ts (linha 59)
Trocar cors() por cors({ origin: process.env.CORS_ORIGINS.split(","), credentials: true })
Arquivo: letstest-backend/vercel.json - Remover "Access-Control-Allow-Origin": "*"
0.3 Rate limiting
Arquivo: letstest-backend/src/index.ts
Instalar express-rate-limit
3 limiters: geral (1000/15min), auth (20/15min), API pública (300/15min)
0.4 Dockerfiles
Criar: letstest-backend/Dockerfile (multi-stage: build TS + runtime Node)
Criar: letstest-frontend/Dockerfile (multi-stage: build React + serve nginx)
Criar: .env.example documentando todas as variáveis
Fase 1: Multi-Tenancy (PRIORIDADE MÁXIMA)
Depende da Fase 0. Toca TODOS os arquivos do backend.

1.1 Novos modelos Prisma
Arquivo: letstest-backend/prisma/schema.prisma


model Organization {
  id        Int      @id @default(autoincrement())
  name      String
  slug      String   @unique
  plan      String   @default("free")
  logo      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  memberships  OrganizationMember[]
  projects     Project[]
  invitations  OrganizationInvite[]
  subscription Subscription?
  apiKeys      ApiKey[]
  webhooks     Webhook[]
  auditLogs    AuditLog[]
}

model OrganizationMember {
  id             Int          @id @default(autoincrement())
  organizationId Int
  userId         Int
  role           String       @default("member") // "owner" | "admin" | "member"
  joinedAt       DateTime     @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id])
  user           User         @relation(fields: [userId], references: [id])
  @@unique([organizationId, userId])
}

model OrganizationInvite {
  id             Int          @id @default(autoincrement())
  organizationId Int
  email          String
  role           String       @default("member")
  token          String       @unique
  expiresAt      DateTime
  acceptedAt     DateTime?
  createdAt      DateTime     @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id])
}
1.2 Modificações em modelos existentes
Modelos que ganham organizationId (coluna direta):

Modelo	Motivo
Project	Fronteira principal do tenant
Template	Pode ser org-level (projectId nullable)
Tag / TagValue	Pode ser org-level
Notification	Escopo por org
File	Storage por org
Modelos que NÃO precisam (herdam via Project):
TestScenario, TestCase, TestCaseAssignment, TestExecution, Environment, Involvement, Report, NotificationRecipient, NotificationSettings

Modelos pessoais (sem org): User, Hability, Device

User ganha:


defaultOrgId   Int?
memberships    OrganizationMember[]
1.3 Migração de dados existentes
Estratégia em 3 deploys:

Adicionar organizationId como nullable em Project, Template, Tag, etc.
Rodar script de backfill: criar "Organização Padrão", associar todos os users como owner, atualizar todos os Projects
Tornar organizationId non-nullable em Project
1.4 Tenant middleware
Criar: letstest-backend/src/utils/tenant.middleware.ts

Extrair organizationId do JWT (adicionado no login)
Verificar membership via OrganizationMember
Setar req.organizationId e req.organizationRole
1.5 Modificar TODOS os services e routers
Padrão a aplicar em cada service:


// ANTES (project.service.ts):
export const findByPaged = async (params: any, pagination) => { ... }

// DEPOIS:
export const findByPaged = async (organizationId: number, params: any, pagination) => {
  const where = { ...params, organizationId };
  // ...
}
Arquivos backend que precisam de mudança:

Arquivo	Mudança
src/project/project.service.ts	Filtrar por organizationId em todas as queries
src/project/project.router.ts	Passar req.organizationId para o service
src/template/template.service.ts	Filtrar por organizationId
src/tag/tag.router.ts + service	Filtrar por organizationId
src/notification/notification.service.ts	Adicionar organizationId
src/file/file.router.ts	Adicionar organizationId
src/involvement/involvement.router.ts	Org context na cadeia
src/testCase/testCase.router.ts	Org context via project
src/testScenario/testScenario.router.ts	Org context via project
src/testExecution/testExecution.router.ts	Org context via project
src/user/user.router.ts	Modificar register (auto-criar org) e auth (retornar orgs)
src/user/user.service.ts	Queries org-aware
src/index.ts	Montar novos routers e middleware
src/utils/token.server.ts	Incluir orgId no JWT
Novos arquivos backend:

Arquivo	Propósito
src/organization/organization.router.ts	CRUD de organizações
src/organization/organization.service.ts	Lógica de negócio de orgs
src/utils/tenant.middleware.ts	Middleware de contexto tenant
src/utils/features.ts	Feature flags (SaaS vs self-hosted)
1.6 Frontend - Multi-tenancy
Modificar:

Arquivo	Mudança
src/infra/tokenProvider.ts	Armazenar organizationId, organizationSlug, organizationRole, lista de orgs
src/components/PainelNavbar.tsx	Adicionar seletor de organização no header
src/components/AppRoutes.tsx	Adicionar rotas de org e onboarding
src/pages/user/UserFormLogin.tsx	Lidar com seleção de org pós-login
src/pages/user/UserFormRegister.tsx	Redirecionar para onboarding
Criar:

Arquivo	Propósito
src/contexts/OrganizationContext.tsx	Context provider com org atual e switcher
src/pages/organization/OrganizationSettings.tsx	Configurações da org
src/pages/organization/OrganizationMembers.tsx	Gestão de membros
src/components/OrganizationSelector.tsx	Dropdown de troca de org
src/services/organizationService.ts	API calls de org
src/models/OrganizationData.ts	Tipos TypeScript
Fase 2: Docker e Self-Hosted
Depende da Fase 1. Pode rodar em paralelo com Fases 3-5.

2.1 Docker Compose completo
Criar: docker-compose.yml na raiz com:

db (postgres:16 com healthcheck)
backend (build do Dockerfile, env vars, depends_on db)
frontend (build do Dockerfile, serve via nginx)
2.2 Feature flags para self-hosted
Criar: letstest-backend/src/utils/features.ts


export const features = {
  isSelfHosted: process.env.SELF_HOSTED === "true",
  billingEnabled: process.env.DISABLE_BILLING !== "true",
};
Em modo self-hosted:

Billing desabilitado
Uma única organização
Todas as features são "Enterprise"
Sem limites de plano
Fase 3: Billing (Stripe)
Depende da Fase 1. Billing é por organização.

3.1 Novos modelos Prisma

model Subscription {
  id                   Int      @id @default(autoincrement())
  organizationId       Int      @unique
  stripeCustomerId     String?  @unique
  stripeSubscriptionId String?  @unique
  plan                 String   @default("free")
  status               String   @default("active")
  currentPeriodStart   DateTime?
  currentPeriodEnd     DateTime?
  cancelAtPeriodEnd    Boolean  @default(false)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  organization         Organization @relation(fields: [organizationId], references: [id])
  usageRecords         UsageRecord[]
}

model UsageRecord {
  id             Int          @id @default(autoincrement())
  subscriptionId Int
  metric         String       // "seats" | "projects" | "storage_bytes" | "test_executions"
  quantity       Int
  recordedAt     DateTime     @default(now())
  subscription   Subscription @relation(fields: [subscriptionId], references: [id])
  @@index([subscriptionId, metric, recordedAt])
}
3.2 Planos e limites
Feature	Free	Pro (R$99/mo)	Enterprise (R$299/mo)
Membros	3	15	Ilimitado
Projetos	2	20	Ilimitado
Cases/Projeto	50	500	Ilimitado
Storage	500 MB	10 GB	100 GB
Execuções/mês	200	5000	Ilimitado
API Access	Nao	Sim	Sim
Webhooks	Nao	5	Ilimitado
Audit Logs	Nao	30 dias	1 ano
3.3 Enforcement de limites
Criar: letstest-backend/src/billing/billing.service.ts

Pontos de enforcement nos routers existentes:

Métrica	Onde enforçar	Arquivo
seats	POST /involvement (invite)	involvement.router.ts
projects	POST /projects	project.router.ts
test_cases	POST /test-case/:projectId	testCase.router.ts
storage	POST /file/upload	file.router.ts
test_executions	POST /test-execution	testExecution.router.ts
API retorna 402 Payment Required com { code: "LIMIT_EXCEEDED", metric, current, limit }.

3.4 Novos arquivos backend
Arquivo	Propósito
src/billing/billing.router.ts	Checkout, portal, webhook, usage
src/billing/billing.service.ts	Limites, metering, subscription CRUD
src/billing/stripe.server.ts	Wrapper do Stripe SDK
src/billing/plans.config.ts	Definições de planos
Rotas:

GET /api/billing/subscription - Subscription atual
POST /api/billing/checkout - Criar sessão Stripe Checkout
POST /api/billing/portal - Criar sessão Customer Portal
POST /api/billing/webhook - Handler de webhook (sem auth, verificação por signature)
GET /api/billing/usage - Métricas de uso
GET /api/billing/plans - Planos disponíveis
3.5 Novos arquivos frontend
Arquivo	Propósito
src/pages/billing/BillingOverview.tsx	Plano atual, uso, faturas
src/pages/billing/PlanSelection.tsx	Comparação de planos
src/pages/billing/BillingSuccess.tsx	Pós-checkout
src/components/UpgradeModal.tsx	Modal de limite atingido
src/services/billingService.ts	API calls de billing
src/models/BillingData.ts	Tipos TypeScript
Modificar: src/infra/http-request/apiTokenProvider.ts - Interceptar respostas 402 e mostrar UpgradeModal

Fase 4: API Pública e Webhooks
Depende da Fase 1. API keys são por organização.

4.1 Novos modelos Prisma

model ApiKey {
  id             Int          @id @default(autoincrement())
  organizationId Int
  name           String
  keyHash        String       @unique  // SHA-256 do key real
  keyPrefix      String       // Primeiros 8 chars: "lt_abc12..."
  scopes         String[]
  lastUsedAt     DateTime?
  expiresAt      DateTime?
  createdAt      DateTime     @default(now())
  createdById    Int
  organization   Organization @relation(fields: [organizationId], references: [id])
  @@index([keyHash])
}

model Webhook {
  id             Int          @id @default(autoincrement())
  organizationId Int
  url            String
  secret         String
  events         String[]
  active         Boolean      @default(true)
  createdAt      DateTime     @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id])
  deliveries     WebhookDelivery[]
}

model WebhookDelivery {
  id             Int       @id @default(autoincrement())
  webhookId      Int
  event          String
  payload        Json
  responseStatus Int?
  responseBody   String?
  deliveredAt    DateTime?
  attempts       Int       @default(0)
  nextRetryAt    DateTime?
  createdAt      DateTime  @default(now())
  webhook        Webhook   @relation(fields: [webhookId], references: [id])
  @@index([webhookId, createdAt])
}
4.2 API versionada
Estrutura de rotas em src/index.ts:


// API interna (frontend web) - mantém como está
app.use("/api/projects", projectRouter);

// API pública v1 (autenticação via API key)
app.use("/api/v1/projects", apiKeyMiddleware, publicProjectRouter);
app.use("/api/v1/test-cases", apiKeyMiddleware, publicTestCaseRouter);
app.use("/api/v1/test-executions", apiKeyMiddleware, publicTestExecutionRouter);
4.3 Novos arquivos
Backend:

Arquivo	Propósito
src/apiKey/apiKey.router.ts	CRUD de API keys
src/apiKey/apiKey.service.ts	Geração, hash, validação
src/webhook/webhook.router.ts	CRUD de webhooks
src/webhook/webhook.service.ts	Delivery engine com retry
src/publicApi/v1/projects.router.ts	API pública - projetos
src/publicApi/v1/testCases.router.ts	API pública - test cases
src/publicApi/v1/testExecutions.router.ts	API pública - execuções
src/utils/apiKey.middleware.ts	Auth por API key
Frontend:

Arquivo	Propósito
src/pages/organization/ApiKeyManagement.tsx	Gestão de API keys
src/pages/organization/WebhookManagement.tsx	Gestão de webhooks
src/services/apiKeyService.ts	API calls
src/services/webhookService.ts	API calls
4.4 Eventos de webhook
test_execution.created, test_execution.reported, report.created, test_case.created, test_case.updated, test_scenario.created, involvement.accepted

Fase 5: Segurança Avançada e UX
Depende da Fase 1.

5.1 Refresh Tokens
Novo modelo:


model RefreshToken {
  id        Int       @id @default(autoincrement())
  userId    Int
  token     String    @unique
  family    String
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id])
  @@index([token])
}
Access token: 15 minutos (reduzir dos atuais 8h)
Refresh token: 7 dias com rotação
Token family para detecção de replay attack
5.2 Audit Log
Novo modelo:


model AuditLog {
  id             Int       @id @default(autoincrement())
  organizationId Int
  userId         Int?
  action         String
  resourceType   String
  resourceId     Int?
  metadata       Json?
  ipAddress      String?
  createdAt      DateTime  @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id])
  @@index([organizationId, createdAt])
}
Criar: src/utils/audit.middleware.ts - Utility function chamada nos routers após operações chave

5.3 Onboarding flow
Criar páginas:

Arquivo	Rota	Propósito
src/pages/onboarding/OnboardingOrgSetup.tsx	/onboarding/org-setup	Nome e slug da org
src/pages/onboarding/OnboardingInviteTeam.tsx	/onboarding/invite-team	Convidar membros
src/pages/onboarding/OnboardingFirstProject.tsx	/onboarding/first-project	Wizard do primeiro projeto
Fluxo: Register -> auto-criar org -> /onboarding/org-setup -> /onboarding/invite-team (opcional) -> /onboarding/first-project -> /dashboard

5.4 Password reset
Novos endpoints:

POST /api/users/auth/forgot-password - Enviar email de reset
POST /api/users/auth/reset-password - Executar reset
Novas páginas:

src/pages/auth/ForgotPassword.tsx
Grafo de Dependências

Fase 0 (Segurança) ──────────────────────────────────┐
         │                                            │
         v                                            │
Fase 1 (Multi-Tenancy) ──┬──> Fase 2 (Docker)        │
                          │                           │
                          ├──> Fase 3 (Billing)       │
                          │                           │
                          ├──> Fase 4 (API Pública)   │
                          │                           │
                          └──> Fase 5 (Segurança+UX)  │
                                                      │
Fases 2-5 podem ser paralelizadas após Fase 1 ────────┘
Ordem recomendada para time de 2-4: 0 -> 1 -> 3 -> 2 -> 4 -> 5

Verificação e Testes
Para cada fase:
Rodar testes existentes: cd letstest-backend && npm test
Verificar migração: npx prisma migrate dev
Testar manualmente os fluxos afetados
Verificar seed data: npm run seed
Testes específicos por fase:
Fase 0: Verificar que login funciona com JWT_SECRET via env, que CORS bloqueia origens não autorizadas
Fase 1: Criar 2 orgs, verificar que dados são isolados, testar switch de org, verificar que seed popula org padrão
Fase 2: docker-compose up e verificar que frontend + backend + DB funcionam
Fase 3: Usar Stripe test mode, verificar checkout, webhook handling, enforcement de limites
Fase 4: Gerar API key, fazer requests autenticadas, verificar delivery de webhooks
Fase 5: Testar refresh token rotation, verificar audit logs, testar onboarding completo
