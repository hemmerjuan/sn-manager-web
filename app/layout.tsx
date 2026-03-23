import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SN Manager — 結構型商品辨識系統",
  description: "16家發行機構 PDF 自動辨識、條款提取、配息試算",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
