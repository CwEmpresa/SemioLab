# Imagens reais de exame — guia de cadastro manual

A infraestrutura do piloto já está pronta (bucket privado, tabela protegida,
entrega por URL assinada só após o exame ser solicitado). Nenhuma imagem foi
enviada ainda. Este guia é para cadastrar imagens manualmente pelo painel do
Supabase — sem depender de nenhum código novo.

## 1. Selecionar uma imagem com licença comercial válida

- Comece pelo [Wikimedia Commons](https://commons.wikimedia.org).
- Abra a **página do arquivo individual** (nunca uma página de categoria) e
  confira a licença exata mostrada ali, uma por uma:
  - ✅ Aceitas: **Public Domain** / **PD Mark**, **CC0**, **CC BY** (qualquer versão).
  - ❌ Nunca usar: **CC BY-NC** (não comercial), licença ausente/"todos os
    direitos reservados", imagens achadas no Google Imagens sem checar a
    fonte original, datasets do Kaggle sem licença explícita, ou imagens
    copiadas da Radiopaedia.
- Se a licença exigir atribuição (CC BY), anote o nome do autor exatamente
  como aparece na página.
- Baixe o arquivo original (não uma miniatura).

## 2. Remover metadados antes de enviar

- Antes do upload, remova EXIF e qualquer metadado identificável (a maioria
  dos editores de imagem tem uma opção "exportar sem metadados"/"remover
  informações pessoais"). Nunca envie o arquivo original de câmera sem essa
  limpeza.
- Formatos aceitos pelo bucket: JPEG, PNG ou WebP. Limite: 5 MB por arquivo.

## 3. Enviar pelo painel do Supabase

1. Acesse **Storage → exam-images** no painel do projeto.
2. Crie (se ainda não existir) uma pasta com o **slug do caso**, e dentro
   dela uma subpasta com o **id canônico do exame** — o `storage_path`
   final deve seguir este padrão:

   ```
   {slug-do-caso}/{exam_id-canônico}/{arquivo}.jpg
   ```

   Exemplo real do piloto:

   ```
   avc-isquemico-01/ct_head_noncontrast/tc-cranio-sem-contraste.jpg
   avc-isquemico-01/cta_head_neck/angio-tc-cranio-pescoco.jpg
   ```

   Os `exam_id` canônicos válidos estão em `lib/exam-catalog.ts` (ex.:
   `ct_head_noncontrast`, `cta_head_neck`, `rx_torax`, `ecocardiograma`,
   `gasometria_arterial` etc.) — use exatamente o mesmo id já usado no
   `examIds` do exame no caso (`data/patient-cases/pilot-20.json`).
3. Faça o upload do arquivo já sem metadados nessa pasta.

## 4. Cadastrar autor, fonte, licença e atribuição

Depois do upload, insira uma linha em `patient_exam_assets` (pelo SQL Editor
do painel, ou peça pra eu gerar o `insert` — nunca faço isso sem você
confirmar a licença antes). Campos obrigatórios:

| Campo | O que colocar |
|---|---|
| `case_id` | `(select id from patient_cases where slug = '...')` |
| `exam_id` | o id canônico usado no caminho da pasta (passo 3) |
| `storage_path` | o caminho completo dentro do bucket (passo 3) |
| `modality` | ex.: `CT`, `CTA`, `XR`, `US`, `MRI` |
| `caption` | legenda curta e educacional (ex.: "Corte axial ao nível dos núcleos da base") |
| `alt_text` | descrição para leitor de tela |
| `source_url` | URL da página **individual** do arquivo (não a categoria) |
| `author` | autor exatamente como aparece na página de origem |
| `license` | ex.: `CC0`, `CC BY 4.0`, `Public Domain` |
| `license_url` | link para o texto da licença |
| `attribution` | texto pronto pra exibir (ex.: "Autor, CC BY 4.0") |
| `sort_order` | `0`, `1`, `2`... se cadastrar mais de uma imagem pro mesmo exame |

Exemplo:

```sql
insert into public.patient_exam_assets
  (case_id, exam_id, storage_path, modality, caption, alt_text,
   source_url, author, license, license_url, attribution, sort_order)
select id, 'ct_head_noncontrast',
  'avc-isquemico-01/ct_head_noncontrast/tc-cranio-sem-contraste.jpg',
  'CT', 'Corte axial de TC de crânio sem contraste',
  'TC de crânio sem contraste em corte axial',
  'https://commons.wikimedia.org/wiki/File:NOME_DO_ARQUIVO',
  'Nome do Autor', 'CC0',
  'https://creativecommons.org/publicdomain/zero/1.0/',
  'Nome do Autor, CC0', 0
from public.patient_cases where slug = 'avc-isquemico-01';
```

## 5. Vincular ao caso e ao exame certos

- `case_id` + `exam_id` juntos definem a qual atendimento e a qual exame a
  imagem pertence. Se dois casos usam o mesmo `exam_id` (ex.: `ecocardiograma`
  aparece em mais de um caso), cada um pode ter sua própria imagem — o
  vínculo é sempre pela combinação `case_id + exam_id`, nunca só pelo
  `exam_id` sozinho.
- Uma imagem errada de caso (achado que não bate com o laudo daquele caso
  específico) não deve ser cadastrada — o achado da imagem precisa
  corresponder ao laudo em texto já existente para aquele `exam_id` naquele
  caso.

## 6. Testar no atendimento

1. Inicie um atendimento com o caso correspondente (ex.: caso de AVC).
2. No chat, peça o exame com o mesmo nome/alias já reconhecido pelo sistema
   (ex.: "Tomografia computadorizada de crânio sem contraste").
3. A imagem deve aparecer no card do resultado (até 3 por exame), com o
   selo "Imagem educacional representativa" e o link "Fonte e licença".
4. Clique na imagem para abrir o modal de ampliação e confirme que a
   atribuição aparece corretamente.
5. Peça o **mesmo exame de novo**: deve aparecer "Este exame já foi
   solicitado", sem duplicar a imagem nem conceder pontuação de novo.
6. Se nada estiver cadastrado para aquele `exam_id`/caso, o resultado deve
   continuar mostrando só o laudo em texto normalmente — sem erro, sem
   espaço vazio.
