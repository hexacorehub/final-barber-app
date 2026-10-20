# Final Barber — app da barbearia + painel do dono

MVP feito para a **Mister Bigode**: o cliente agenda, assina o Mister Club, reserva produtos e
guarda o antes/depois; o dono acompanha faturamento por barbeiro, o clube e a vitrine.
Interface em pt-BR; código em inglês. Mesmo stack do Final Finance, para a integração futura.

## Stack

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind 4 · Supabase
(Postgres, acessado só pelo servidor com a chave secreta) · Vercel · Vitest.

## Áreas

**App do cliente** (mobile-first)

- `/inicio` — lembrete do próximo corte pelo ritmo do cliente, próximo horário, economia com o
  clube, resultados da semana, mais vendidos e as duas unidades (como chegar, WhatsApp).
- `/agendar` — começa por serviço, profissional **ou** horário; qualquer unidade ou uma
  específica; agenda **para mais de uma pessoa** (pai e filho lado a lado, cada um com seu clube).
- `/clube` — os 6 planos reais do Mister Club, calculadora "quanto você economiza", vantagens,
  termos e assinatura (gera um pedido para a equipe confirmar).
- `/produtos` — vitrine com filtro, mais vendidos, estoque baixo e reserva para retirar na visita.
- `/conta` e `/galeria` — assinatura, dependentes, forma de pagamento, pausa, lembrete,
  histórico e antes/depois de cada corte.

**Painel do dono** (`/painel`, protegido por `PAINEL_PASSCODE`)

- **Visão geral** — faturamento, receita recorrente, assinantes, ticket médio, ocupação,
  faturamento por barbeiro ativo, clube por plano e **indicações automáticas**.
- **Barbeiros** — atendimentos, avulso, parte do clube (rateio pelo valor dos serviços),
  produtos, ocupação e planos vendidos; desligados à parte.
- **Mister Club** — indicadores por plano, evolução, clientes que economizariam no clube
  (com convite pronto no WhatsApp), pedidos do app, quem vendeu e assinantes em risco.
- **Produtos** — vitrine, estoque, margem e reservas.
- **Financeiro** — origem da receita, comissões e recebíveis do clube. Fluxo de caixa,
  impostos, notas e contador ficam no **Final Finance** (a página apresenta o complemento em vez
  de duplicar essas funções).

Todos os números são calculados dos registros em `src/domain/metrics.ts` (com testes).

## Rodar localmente

```bash
pnpm install
pnpm dev            # sem Supabase: usa dados de demonstração em memória
pnpm test           # testes de domínio
pnpm typecheck
```

## Supabase + Vercel

1. Crie o projeto no Supabase e rode [`supabase/schema.sql`](./supabase/schema.sql) no SQL Editor.
2. Em `.env` (veja `.env.example`), coloque `SUPABASE_URL` e `SUPABASE_SECRET_KEY` (chave secreta).
3. Carregue os dados:
   - `pnpm db:seed` — catálogo (unidades, barbeiros, serviços, planos, produtos) + o cliente de
     demonstração usado pelo app enquanto não há login.
   - `pnpm db:seed --demo` — também o histórico simulado (clientes, assinaturas, atendimentos,
     vendas), para apresentar o painel cheio.
4. Na Vercel: importe o repositório e defina `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
   `PAINEL_PASSCODE` e, se quiser, `FINAL_FINANCE_URL`. Node 22.

Sem as variáveis do Supabase o app roda inteiro com dados de demonstração (o que for criado
some quando o servidor reinicia).

## O que é real e o que é estimativa

Vem do site da Mister Bigode: unidades, endereços, horários, os 9 profissionais, a lista de
serviços e os planos com preços. **Trocar pelos reais** (em `src/server/data/catalog.ts` ou nas
tabelas): preços e durações avulsos, unidade de cada barbeiro, comissões (40% serviços / 10%
produtos), produtos da vitrine, vantagens completas e termos de cada plano. O selo "Mais
vendido" está no Premium Corte e Barba, como na página atual.

## Ainda não integrado (próximas etapas)

- Pagamento (cobrança recorrente com conta no CNPJ da barbearia e split da plataforma).
- Login do cliente (hoje o app abre como o cliente de demonstração Rafael) e contas de equipe.
- Fotos da galeria e do feed (Supabase Storage); hoje a galeria mostra a foto só no aparelho.
- Lembretes e mensagens automáticas no WhatsApp; hoje o painel abre a conversa com o texto pronto.
- Integração com o Final Finance.
