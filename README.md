# finance-web

Interface web de um app pessoal de finanças: painel com a evolução do patrimônio, dos gastos, das dívidas e das metas, e telas para lançamentos (inclusive parcelados), investimentos, metas e dívidas. Tema claro e escuro, responsiva a partir de 360 px.

A API fica em um repositório separado: [finance-api](https://github.com/Leonardoongaratto/finance-api) (Go + SQLite).

![Painel com patrimônio, gastos, dívidas e metas](docs/screenshots/dashboard.png)

| Tema claro                                                    | Dívidas no celular                                              |
| :------------------------------------------------------------ | :-------------------------------------------------------------- |
| ![Painel no tema claro](docs/screenshots/dashboard-light.png) | ![Tela de dívidas em 360 px](docs/screenshots/debts-mobile.png) |

- React 19, Vite, TypeScript estrito, React Router, Recharts.
- Testes com Vitest e Testing Library; cobertura mínima de 80% imposta em `vite.config.ts`.
- Dinheiro chega e sai da API em centavos inteiros e só vira texto (BRL) na hora de exibir.

## Arquitetura

```
src/lib         cliente HTTP da API (API_BASE_URL), formatação, validação, tema, dados dos gráficos
src/components  gráficos, formulários, lista de lançamentos, diálogo de confirmação, error boundary
src/pages       Painel, Lançamentos, Investimentos, Metas, Dívidas (rotas carregadas sob demanda)
src/test        mock da API (fetch) e setup dos testes
```

O navegador chama a API direto, pela URL de `VITE_API_URL` (definida **no build**, padrão `http://127.0.0.1:8080`). A API precisa liberar a origem do front em `FINANCE_CORS_ORIGINS`; o padrão dela já inclui `vite dev` (5173) e `vite preview` (4173).

## Rodar

Sem Docker (precisa da API rodando em `127.0.0.1:8080`, veja o [finance-api](https://github.com/Leonardoongaratto/finance-api)):

```powershell
npm ci
npm run dev                  # http://127.0.0.1:5173
# ou, a versão de produção:
npm run build
npm run preview              # http://127.0.0.1:4173
```

Para apontar para outra API: `$env:VITE_API_URL = "https://minha-api.example.com"` antes do `npm run dev`/`build` (veja `.env.example`).

Com Docker Compose, o arquivo fica no `finance-api` e espera os dois repositórios lado a lado (`finance-api/` e `finance-web/`):

```powershell
cd ..\finance-api
docker compose up --build    # interface em http://127.0.0.1:5173, API em 127.0.0.1:8080
```

A imagem do front (`Dockerfile`) compila com Node e serve com nginx sem privilégios: fallback de SPA, `/assets/` com cache longo e `index.html` sem cache. `VITE_API_URL` é um build arg.

## Testes e gates

| Gate                       | Comando                |
| :------------------------- | :--------------------- |
| Formatação                 | `npm run format:check` |
| Lint                       | `npm run lint`         |
| Tipos                      | `npm run typecheck`    |
| Testes + cobertura (≥ 80%) | `npm test`             |
| Build                      | `npm run build`        |

O CI (`.github/workflows/ci.yml`) roda todos em Linux.

## Decisões técnicas

- **Cliente HTTP único** (`src/lib/api.ts`): toda chamada passa por ele; erros viram `ApiError` com `status` e `code`, e falha de rede vira `network`. Os testes de página usam um mock de `fetch` por rota.
- **Dinheiro em centavos**: a API entrega `int64`; a interface nunca faz conta com `float` sobre valores.
- **Estados explícitos**: cada tela trata carregando, vazio, erro com nova tentativa e sucesso; rotas têm error boundary.
- **Acessibilidade e tema**: tema claro/escuro persistido (com o script inline do `index.html` evitando o "flash"), gráficos com paleta validada para os dois temas.
- **Sem segredos**: o front é público por natureza; `VITE_API_URL` é só um endereço.
