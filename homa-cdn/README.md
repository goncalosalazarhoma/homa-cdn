# hôma CDN

Arquivo interno de activos digitais — imagens, vídeos e ficheiros — com organização por pastas, links directos e expiração automática (TTL).

## Stack

- **Frontend**: HTML/CSS/JS vanilla (sem dependências)
- **Backend**: Vercel Serverless Functions (Node.js)
- **Storage**: Vercel Blob (ficheiros)
- **Metadata**: Vercel KV (Redis — metadados + TTL)
- **Cron**: Vercel Cron Jobs (cleanup diário às 03:00)

---

## Deploy em 5 passos

### 1. Instalar dependências e Vercel CLI

```bash
npm install
npm install -g vercel
```

### 2. Fazer login e criar projecto

```bash
vercel login
vercel link   # liga ao teu projecto Vercel ou cria um novo
```

### 3. Activar Vercel Blob e Vercel KV

No dashboard Vercel do projecto:
- **Storage → Create → Blob** → dá um nome (ex: `homa-cdn-blob`)
- **Storage → Create → KV** → dá um nome (ex: `homa-cdn-kv`)

As variáveis de ambiente são adicionadas automaticamente ao projecto.

### 4. Configurar variáveis de ambiente

```bash
# Gera dois secrets fortes
openssl rand -hex 32   # para HOMA_CDN_SECRET
openssl rand -hex 32   # para CRON_SECRET

# Adiciona ao Vercel
vercel env add HOMA_CDN_SECRET
vercel env add CRON_SECRET
```

Para desenvolvimento local, copia `.env.example` para `.env.local` e preenche os valores.

### 5. Deploy

```bash
vercel --prod
```

A app fica disponível em `https://homa-cdn.vercel.app` (ou o domínio que configurares).

---

## Estrutura do projecto

```
homa-cdn/
├── public/
│   └── index.html          # Frontend — landing page + explorador
├── api/
│   ├── upload.js           # POST /api/upload — faz upload para Blob
│   ├── list.js             # GET  /api/list   — lista ficheiros e pastas
│   ├── delete.js           # DELETE /api/delete — elimina ficheiro
│   ├── folder.js           # POST /api/folder  — cria pasta
│   └── cleanup.js          # GET  /api/cleanup — cron: apaga expirados
├── vercel.json             # Config: cron job diário às 03:00
├── package.json
├── .env.example
└── README.md
```

---

## Autenticação

Todas as chamadas à API requerem o header:

```
Authorization: Bearer {HOMA_CDN_SECRET}
```

No frontend, o secret é pedido ao entrar e guardado em `sessionStorage` (dura a sessão do browser, não persiste após fechar o tab).

---

## TTL e cleanup automático

Quando fazes upload, podes definir um prazo de validade (1 dia a 1 ano, ou sem expiração). Os metadados ficam no Vercel KV com o campo `expiresAt` (timestamp Unix).

O cron job `/api/cleanup` corre todos os dias às 03:00 UTC e:
1. Lista todos os ficheiros no KV
2. Verifica quais têm `expiresAt < Date.now()`
3. Elimina-os do Vercel Blob
4. Remove os metadados do KV

---

## Segurança

- O secret nunca fica no código — vive em variáveis de ambiente
- O cron job tem um secret separado (`CRON_SECRET`) para evitar chamadas externas
- Todos os endpoints retornam 401 sem o header correcto
- CORS está configurado para aceitar chamadas cross-origin (ajusta `Access-Control-Allow-Origin` em `vercel.json` se quiseres restringir)

---

## Personalização

Para apontar para o teu domínio personalizado (ex: `cdn.homa.pt`):
1. No dashboard Vercel → Settings → Domains → adiciona o domínio
2. Configura o DNS conforme indicado

---

## Limites do free tier Vercel

| Serviço | Free |
|---|---|
| Blob storage | 500 MB |
| Blob bandwidth | 1 GB/mês |
| KV reads | 300.000/mês |
| KV writes | 50.000/mês |
| Cron jobs | 2 jobs |
| Functions | 100 GB-h/mês |

Para a utilização interna da hôma, o free tier deve ser mais que suficiente.
