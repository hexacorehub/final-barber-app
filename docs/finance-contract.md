# Contrato de dados Final Barber → Final Finance (versão 1)

O Final Finance lê os números da barbearia por um endpoint só de leitura. Nada é enviado
sozinho: o Finance busca quando quiser (por exemplo, todo dia de madrugada, os últimos 7 dias).

## Pedido

```
GET /api/finance/export?from=2026-10-01&to=2026-10-27&cnpj=12345678000195
Authorization: Bearer <FINANCE_EXPORT_TOKEN>
```

- `from` e `to`: dias no formato AAAA-MM-DD (fuso de São Paulo), no máximo 92 dias. Padrão: os últimos 7 dias.
- `cnpj` (opcional): 14 dígitos para uma unidade, 8 dígitos (raiz) para a empresa inteira.
- Sem `FINANCE_EXPORT_TOKEN` definido, o endpoint responde 503. Token errado: 401.

## Resposta

```json
{
  "version": 1,
  "source": "final-barber",
  "generatedAt": "2026-10-27T15:00:00.000Z",
  "from": "2026-10-01",
  "to": "2026-10-27",
  "companies": [
    {
      "cnpj": "12.345.678/0001-95",
      "cnpjRoot": "12345678",
      "legalName": "Mister Bigode Barbearia Ltda",
      "incomeCents": 7210110,
      "units": [
        {
          "unit": { "id": "unit-chacara", "name": "Chácara Santo Antônio", "cnpj": "12.345.678/0001-95" },
          "incomeCents": 7210110,
          "days": [
            {
              "date": "2026-10-27",
              "incomeCents": 412300,
              "paymentMethod": null,
              "lines": [
                { "externalId": "barber:unit-chacara:2026-10-27:services", "kind": "income", "category": "Faturamento (vendas e serviços)", "description": "Serviços avulsos · 23 atendimentos", "amountCents": 184000, "count": 23 },
                { "externalId": "barber:unit-chacara:2026-10-27:club", "kind": "income", "category": "Faturamento (vendas e serviços)", "description": "Mister Club · 12 mensalidades", "amountCents": 272500, "discountCents": 17500, "count": 12 },
                { "externalId": "barber:unit-chacara:2026-10-27:products", "kind": "income", "category": "Faturamento (vendas e serviços)", "description": "Produtos · 9 itens", "amountCents": 61000, "count": 9 }
              ]
            }
          ],
          "partners": {
            "externalId": "barber:unit-chacara:2026-10-01:2026-10-27:partners",
            "kind": "expense",
            "category": "Prestadores de serviço - Empresa",
            "description": "Repasse aos barbeiros · Chácara Santo Antônio",
            "from": "2026-10-01",
            "to": "2026-10-27",
            "payable": true,
            "amountCents": 2900000,
            "byBarber": [{ "id": "barber-markos", "name": "Markos Henrique", "serviceCents": 510000, "productCents": 9000, "amountCents": 519000 }]
          }
        }
      ]
    }
  ]
}
```

## Regras

- **Idempotente:** `externalId` é estável. Reenviar o mesmo dia atualiza o lançamento no Finance
  (mesma lógica de `source` + `external_id` do Open Finance), nunca duplica.
- **Receita por unidade e por dia:** serviços avulsos (valor cobrado na hora), mensalidades do
  clube cobradas naquele dia pela unidade que cobra o plano (já com o desconto de indicação, que
  vem em `discountCents`) e produtos.
- **Repasse aos barbeiros por período:** a parte do clube de cada barbeiro é rateada pelo período
  inteiro, por isso o repasse vem uma vez por `from`–`to`, como conta a pagar, por barbeiro.
- **Empresas:** unidades com a mesma raiz de CNPJ são filiais de uma empresa (um espaço de empresa
  no Finance, com a unidade em cada lançamento). Raízes diferentes são empresas separadas.
- **Categorias:** os nomes já existentes no Finance (`renda` → "Faturamento (vendas e serviços)",
  `empresa` → "Prestadores de serviço - Empresa").
- **A confirmar com o contador:** no modelo salão-parceiro (Lei 13.352/2016), a parte repassada ao
  barbeiro parceiro pode não entrar na receita bruta da barbearia para o Simples. O repasse vem
  separado justamente para o Finance tratar como o contador definir.
- `paymentMethod` é `null` até o pagamento ser integrado.
