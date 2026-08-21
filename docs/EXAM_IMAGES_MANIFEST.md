# Manifest — imagens reais de radiografia (piloto)

**Nenhum arquivo foi baixado nem enviado.** Este ambiente não tem acesso de
rede a `upload.wikimedia.org`, `commons.wikimedia.org` nem ao endpoint de
Storage do projeto (`*.supabase.co/storage/v1/*`) — confirmado (`403
host_not_allowed`) antes de escrever este manifest. Nenhuma linha foi
inserida em `patient_exam_assets`; nenhum caminho aponta para um arquivo
inexistente.

## Candidatos verificados (licença confirmada, uso comercial permitido)

### 1. Insuficiência cardíaca / congestão pulmonar — `ic-descompensada-01`
- Arquivo: `Chest radiograph with signs of congestive heart failure - annotated.jpg`
- Fonte: https://commons.wikimedia.org/wiki/File:Chest_radiograph_with_signs_of_congestive_heart_failure_-_annotated.jpg
- Autor: Mikael Häggström, M.D.
- Licença: CC0 1.0 (Public Domain Dedication) — confirmada via tag "Hidden categories: CC-Zero" na página do arquivo.
- Uso comercial: permitido.
- `case_id`: `(select id from patient_cases where slug = 'ic-descompensada-01')`
- `exam_id`: `rx_torax`
- Achado correspondente ao laudo do caso ("Cardiomegalia, redistribuição vascular para ápices, pequeno derrame pleural bilateral"): **sim** — a imagem mostra sinais radiográficos clássicos de congestão/ICC, coerente com o laudo.
- `storage_path` planejado: `ic-descompensada-01/rx_torax/congestao-pulmonar.webp`

### 2. DPOC — `dpoc-exacerbado-01`
- Arquivo: `X-ray of COPD exacerbation - anteroposterior view.jpg`
- Fonte: https://commons.wikimedia.org/wiki/File:X-ray_of_COPD_exacerbation_-_anteroposterior_view.jpg
- Autor: Mikael Häggström, M.D.
- Licença: CC0 1.0 — confirmada via "Hidden categories: CC-Zero".
- Uso comercial: permitido.
- `case_id`: `(select id from patient_cases where slug = 'dpoc-exacerbado-01')`
- `exam_id`: `rx_torax`
- Achado correspondente ao laudo do caso ("Hiperinsuflação pulmonar crônica, sem consolidação ou derrame"): **sim**.
- `storage_path` planejado: `dpoc-exacerbado-01/rx_torax/dpoc-exacerbacao.webp`

### 3. Radiografia próxima do normal — `iam-supra-01`
- Arquivo: `Normal posteroanterior (PA) chest radiograph (X-ray).jpg`
- Fonte: https://commons.wikimedia.org/wiki/File:Normal_posteroanterior_(PA)_chest_radiograph_(X-ray).jpg
- Autor: Mikael Häggström, M.D.
- Licença: CC0 1.0 — confirmada via "Hidden categories: CC-Zero".
- Uso comercial: permitido.
- `case_id`: `(select id from patient_cases where slug = 'iam-supra-01')`
- `exam_id`: `rx_torax`
- Achado correspondente ao laudo do caso ("Sem alterações agudas, área cardíaca normal"): **sim**.
- `storage_path` planejado: `iam-supra-01/rx_torax/rx-torax-normal.webp`

## Candidato REJEITADO — não vincular sem decisão

### Pneumonia — `pneumonia-adquirida-01`
- Arquivo: `X-ray of lobar pneumonia.jpg`
- Fonte: https://commons.wikimedia.org/wiki/File:X-ray_of_lobar_pneumonia.jpg
- Autor: Mikael Häggström, M.D. — Licença CC0 1.0, uso comercial permitido (licença OK).
- **Problema real encontrado:** verifiquei o conteúdo da imagem em fonte clínica independente (mypanotes.co.uk, que cita exatamente este arquivo do Wikimedia) — ela mostra pneumonia lobar do **lobo médio direito**. O laudo atual do caso `pneumonia-adquirida-01` diz **"Consolidação em lobo inferior direito"** (lobo diferente).
- Não vinculei esse candidato a este caso porque o achado não corresponde ao laudo, conforme exigido. Duas opções, nenhuma executada sem sua decisão:
  1. Corrigir o laudo do caso para "lobo médio direito" (mudança cosmética, não altera diagnóstico/diferenciais/conduta/dificuldade) e então usar esta imagem já verificada; ou
  2. Manter o laudo como está e procurar uma imagem específica de consolidação em lobo inferior direito com licença igualmente verificável.

## Instruções de upload manual (ver também `docs/EXAM_IMAGES.md`)

Para cada um dos 3 candidatos aprovados:
1. Baixar o arquivo original da página do Wikimedia Commons listada acima.
2. Remover metadados/EXIF (qualquer editor de imagem com opção "exportar sem metadados").
3. Converter para WebP (ou PNG otimizado), mantendo qualidade diagnóstica.
4. Enviar pelo painel do Supabase → Storage → bucket `exam-images`, no caminho `storage_path` indicado acima.
5. Rodar o INSERT correspondente (fornecido abaixo) no SQL Editor do painel.

```sql
insert into public.patient_exam_assets
  (case_id, exam_id, storage_path, modality, caption, alt_text,
   source_url, author, license, license_url, attribution, sort_order)
select id, 'rx_torax',
  'ic-descompensada-01/rx_torax/congestao-pulmonar.webp',
  'XR', 'Radiografia de tórax com sinais de congestão pulmonar',
  'Radiografia de tórax mostrando sinais radiográficos de insuficiência cardíaca congestiva',
  'https://commons.wikimedia.org/wiki/File:Chest_radiograph_with_signs_of_congestive_heart_failure_-_annotated.jpg',
  'Mikael Häggström, M.D.', 'CC0 1.0',
  'https://creativecommons.org/publicdomain/zero/1.0/',
  'Mikael Häggström, M.D., CC0', 0
from public.patient_cases where slug = 'ic-descompensada-01';

insert into public.patient_exam_assets
  (case_id, exam_id, storage_path, modality, caption, alt_text,
   source_url, author, license, license_url, attribution, sort_order)
select id, 'rx_torax',
  'dpoc-exacerbado-01/rx_torax/dpoc-exacerbacao.webp',
  'XR', 'Radiografia de tórax em exacerbação de DPOC',
  'Radiografia de tórax anteroposterior mostrando hiperinsuflação pulmonar crônica',
  'https://commons.wikimedia.org/wiki/File:X-ray_of_COPD_exacerbation_-_anteroposterior_view.jpg',
  'Mikael Häggström, M.D.', 'CC0 1.0',
  'https://creativecommons.org/publicdomain/zero/1.0/',
  'Mikael Häggström, M.D., CC0', 0
from public.patient_cases where slug = 'dpoc-exacerbado-01';

insert into public.patient_exam_assets
  (case_id, exam_id, storage_path, modality, caption, alt_text,
   source_url, author, license, license_url, attribution, sort_order)
select id, 'rx_torax',
  'iam-supra-01/rx_torax/rx-torax-normal.webp',
  'XR', 'Radiografia de tórax sem alterações agudas',
  'Radiografia de tórax posteroanterior normal, sem consolidações ou derrame',
  'https://commons.wikimedia.org/wiki/File:Normal_posteroanterior_(PA)_chest_radiograph_(X-ray).jpg',
  'Mikael Häggström, M.D.', 'CC0 1.0',
  'https://creativecommons.org/publicdomain/zero/1.0/',
  'Mikael Häggström, M.D., CC0', 0
from public.patient_cases where slug = 'iam-supra-01';
```

Depois de rodar o INSERT correspondente, teste conforme `docs/EXAM_IMAGES.md` (pedir o exame na consulta, confirmar imagem + atribuição, confirmar bloqueio antes da solicitação).
