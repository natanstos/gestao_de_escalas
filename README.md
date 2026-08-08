# Gestão de Escalas

MVP web responsivo para planejar, validar, publicar e compartilhar escalas de obreiros.

## Recursos desta versão

- painel mensal responsivo;
- visão dos cultos e postos;
- cadastro e ativação de regras configuráveis;
- gerador de escala com validações obrigatórias e preferenciais;
- confirmação, alertas e substituições modelados no banco;
- arte vertical pronta para compartilhamento no WhatsApp;
- API REST, PostgreSQL e Docker Compose;
- isolamento dos dados por congregação.

## Executar com Docker no Ubuntu

```bash
cp .env.example .env
# edite as senhas no .env
docker compose up -d --build
```

Acesse `http://IP_DO_SERVIDOR`. O PostgreSQL não publica porta para a internet.
Na primeira inicialização, a API aplica as migrações e inclui dados demonstrativos idempotentes para a validação do MVP.

## Desenvolvimento local

Requisitos: Node.js 22+ e PostgreSQL.

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

- interface: `http://localhost:5173`
- API: `http://localhost:3000/api/health`

## Estrutura

- `apps/web`: React, TypeScript e Vite;
- `apps/api`: Express, Prisma e PostgreSQL;
- `docs`: contratos e decisões do MVP.

## Produção

Antes de expor o serviço, configure HTTPS em um proxy reverso, use segredos fortes e mantenha backups externos testados. Consulte [docs/DEPLOY.md](docs/DEPLOY.md).
