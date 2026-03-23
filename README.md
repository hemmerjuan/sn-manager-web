# SN Manager — 結構型商品辨識管理系統

台灣市場境外結構型商品（Structured Notes）PDF 自動辨識、條款提取、配息試算系統。

## 功能

- **PDF 自動辨識** — 上傳 PDF 自動判斷發行機構（本地辨識優先，省 API 費用）
- **條款精確提取** — 各家機構專屬引擎，30+ 欄位提取
- **商品結構分類** — FCN / StepDown / DAC / Snowball / Phoenix / ELN / Range Accrual / 保本型
- **配息試算** — 中途觸發 Autocall 的配息計算（m/M 參數）
- **學習回饋** — 從已辨識商品累積模式，提高準確率
- **用量統計** — Token 消耗、每日走勢圖、每小時鑽取
- **16 家發行機構** — Citi 已就緒，其餘 15 家框架已建好

## 技術架構

| 層級 | 技術 | 說明 |
|------|------|------|
| 前端 | Next.js + React | 五行配色（補金水）主題 |
| 後端 | Next.js API Routes | 保護 Anthropic API Key |
| AI | Claude Sonnet 4 | PDF 辨識 + 條款提取 |
| 儲存 | localStorage | 商品資料 / 學習檔案 / Token 用量 |

## 快速開始

### 1. 安裝

```bash
npm install
```

### 2. 設定環境變數

```bash
cp .env.local.example .env.local
```

編輯 `.env.local`：

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
ACCESS_PIN=你的密碼（選填）
```

### 3. 本機執行

```bash
npm run dev
```

打開 http://localhost:3000

### 4. 部署到 Vercel

```bash
# 安裝 Vercel CLI
npm i -g vercel

# 部署
vercel

# 設定環境變數（在 Vercel Dashboard）
# Settings → Environment Variables → 加入 ANTHROPIC_API_KEY
```

## 環境變數說明

| 變數 | 必填 | 說明 |
|------|------|------|
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API Key，到 console.anthropic.com 取得 |
| `ACCESS_PIN` | ❌ | 簡易密碼保護，防止他人使用你的 API |

## 費用預估

| 用量 | API 呼叫 | 月費 |
|------|----------|------|
| 50 份/月 | ~50 次 | ~$3-5 |
| 200 份/月 | ~200 次 | ~$10-15 |
| 500 份/月 | ~500 次 | ~$25-35 |

（本地辨識成功可省下第一階段 API，實際費用可能更低）

## 新增發行機構

1. 取得該機構的範例 PDF
2. 在 `components/SNManager.tsx` 的 `ISSUER_DB` 中填入完整辨識特徵
3. 建立專屬提取 Prompt（參考 `buildCitiPrompt`）
4. 加入 `PROMPTS` 對照表
5. 設 `ready: true`

## 未來 APP 串接

Vercel API Routes 可直接當 REST API：

```bash
POST /api/claude
Content-Type: application/json

{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 4096,
  "messages": [...]
}
```
