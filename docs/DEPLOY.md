# Implantação no Ubuntu

1. Instale Docker Engine e o plugin Docker Compose.
2. Clone o repositório e copie `.env.example` para `.env`.
3. Defina senhas únicas e um `JWT_SECRET` longo.
4. Execute `docker compose up -d --build`.
5. Configure HTTPS com Caddy, Traefik ou Nginx no host.

## Backup

O volume `postgres_data` mantém os dados entre recriações, mas não é backup. Agende `pg_dump` diário, criptografe e copie os arquivos para outro equipamento ou armazenamento. Faça testes de restauração.

## Atualização

```bash
git pull
docker compose up -d --build
```

O contêiner da API executa `prisma migrate deploy` antes de iniciar.
