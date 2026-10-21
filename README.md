# Final Barber — app da barbearia + painel do dono

MVP feito para a **Mister Bigode**: o cliente agenda, assina o Mister Club (para si e para a
família), indica amigos, reserva produtos e guarda o antes/depois; o dono acompanha
faturamento por barbeiro, o clube, as indicações e a vitrine.
Interface em pt-BR; código em inglês. Mesmo stack do Final Finance, para a integração futura.

## Stack

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind 4 · Supabase
(Postgres, acessado só pelo servidor com a chave secreta) · Vercel · Vitest.

## Áreas

**App do cliente** — mobile-first, com versão web (menu no topo e telas em colunas a partir de
768 px; no celular continua a barra inferior).

- `/inicio` — lembrete do próximo corte, economia com o clube, indicação, resultados (fotos),
  mais vendidos e as unidades.
- `/agendar` — começa por serviço, profissional ou horário; agenda **várias pessoas da conta**
  no mesmo horário, lado a lado. No desktop o resumo fica fixo ao lado.
- `/clube` — os 6 planos, calculadora, **comparativo de todos os planos** para os hábitos da
  pessoa (mensalidade + o que fica de fora = total, economia) e **sugestões para subir de
  plano** (quanto custa a mais e quando compensa).
- `/clube/assinar/[plano]` — escolhe **para quem** é o plano (titular ou alguém da conta),
  forma de pagamento e aplica o convite de indicação.
- `/conta` — assinatura, **família na conta** (adicionar filho, sogro, cônjuge…), pagamento,
  pausa, histórico.
- `/indique` — código, link e WhatsApp do **programa de indicação**; descontos ganhos.
- `/convite/[código]` — página pública que o cliente compartilha.
- `/produtos`, `/galeria` — vitrine com fotos e antes/depois.

**Painel do dono** (`/painel`) — visão geral, barbeiros, Mister Club (indicadores, pedidos de
plano e trocas, **programa de indicação**, clientes para indicar o clube, assinantes em risco),
produtos e financeiro (com os descontos de indicação; caixa, impostos e contador ficam no
Final Finance).

Todos os números vêm de `src/domain/metrics.ts`; regras de conta em `src/domain/household.ts`
(com testes em `tests/`).

## Regras de negócio

**Contas e planos da família**

- Cada conta tem um **titular** e pode ter pessoas gerenciadas por ele (filho menor, sogro,
  cônjuge…), com parentesco e marcação de menor de idade.
- **Um plano em vigor por pessoa** (garantido também no banco por índice único); vários planos
  na mesma conta, um para cada pessoa.
- Só o **titular** adiciona pessoas, agenda para elas e pede/troca planos; a cobrança de todos
  fica com ele. Uma pessoa gerenciada não contrata nada sozinha.
- Pedir o plano que a pessoa já tem é bloqueado; pedir outro vira **troca de plano**.

**Indicação**

- Cada cliente tem um código (ex.: `RAFAEL-7021`) e um link `/convite/<código>`.
- Quando o indicado assina, quem indicou ganha **50% em uma próxima mensalidade do próprio
  plano**: um desconto por amigo, aplicado nas cobranças seguintes, um por mês.
- Indicar alguém da própria conta não conta. O desconto já aparece nas cobranças, no
  financeiro e no painel.

## Acesso de demonstração

Com `DEMO_ACCESS_CODE` definido, o site fica fechado e o código libera as duas visões (cliente
e dono), com uma barra para alternar. Link direto: `https://<site>/acesso/entrar?codigo=<código>`.
A página `/convite/<código>` continua pública.

## Variáveis de ambiente

| Variável | Obrigatória | Para quê |
|---|---|---|
| `SUPABASE_URL` | para salvar dados | URL do projeto (Settings → API) |
| `SUPABASE_SECRET_KEY` | para salvar dados | chave **secreta** `sb_secret_…` (nunca a publishable) |
| `DEMO_ACCESS_CODE` | recomendada | fecha o site e libera as duas visões com um código |
| `PAINEL_PASSCODE` | opcional | código só do painel, quando não houver modo demonstração |
| `FINAL_FINANCE_URL` | opcional | link do botão do Final Finance no financeiro |
| `SEED_DEMO_HISTORY` | opcional | `false` para a carga automática trazer só catálogo e conta demo |

Sem as duas do Supabase, o app roda com dados de demonstração em memória.

## Supabase + Vercel

1. Supabase → SQL Editor: rode [`supabase/schema.sql`](./supabase/schema.sql). (Se já rodou
   uma versão anterior, descomente o `drop table` no topo uma vez.)
2. **Nada mais a fazer:** na primeira visita ao site com as variáveis do Supabase, o app vê as
   tabelas vazias e carrega sozinho o catálogo, a conta do Rafael e o histórico simulado
   (uns 20 segundos nessa primeira vez). Para não carregar o histórico, defina
   `SEED_DEMO_HISTORY=false`. No painel, o botão "Atualizar datas da demonstração" refaz o
   histórico com datas a partir de hoje (aparece quando `DEMO_ACCESS_CODE` está definido).
   **Alternativa manual:** no SQL Editor, rode `supabase/seed.sql` (catálogo + conta do Rafael) e,
   para o painel cheio, `supabase/seed-demo-1.sql` até o último, em ordem. Para atualizar as
   datas do histórico, gere de novo com `pnpm db:seed-sql` e rode as partes outra vez.
   **Ou pelo terminal:** `.env` local com `SUPABASE_URL` e `SUPABASE_SECRET_KEY`, depois:
   - `pnpm db:seed` — catálogo + a conta de demonstração (Rafael, Pedro e Antônio);
   - `pnpm db:seed --demo` — também o histórico simulado. **Apaga e recria** clientes, planos
     vendidos, atendimentos, vendas, pedidos e fotos: use só em ambiente de demonstração e
     rode de novo na véspera de apresentar, para as datas ficarem atuais.
3. Vercel: importe o repositório, Node 22, e defina as variáveis acima.

## Fotos

As fotos da demo vêm do Unsplash (licença livre), carregadas direto do CDN deles e listadas em
`src/server/data/photos.ts`. No banco são colunas de URL (`shop_settings.cover_photo_url`,
`portfolio`, `units.photo_url`, `products.photo_url`, `gallery_photos.url`): troque pelas
fotos reais da barbearia. Se uma foto não carregar, aparece um quadro neutro.

## O que é real e o que é estimativa

Do site da Mister Bigode: unidades, endereços, horários, os 9 profissionais, a lista de
serviços e os planos com preços. **Trocar pelos reais**: preços e durações avulsos, unidade de
cada barbeiro, comissões, produtos, vantagens e termos de cada plano, e as fotos.

## Ainda não integrado

Pagamento (conta no CNPJ da barbearia + split), login do cliente (o app abre como o Rafael),
upload de fotos (Supabase Storage), envio automático no WhatsApp e integração com o Final Finance.

## Rodar localmente

```bash
pnpm install
pnpm dev        # sem Supabase: dados de demonstração
pnpm test
pnpm typecheck
```
