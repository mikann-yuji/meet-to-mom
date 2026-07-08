# Meet To Mom

Next.js + TypeScript + Phaser.js で作った、状態変化ねこの 2D ブラウザゲームプロトタイプです。

## ゲーム内容

- 主人公はねこ
- `1` / `2` / `3` キーで「固体」「液体」「気体」に変化
- 固体: 通常移動、ジャンプ可能、重い
- 液体: 背が低くなり、狭い通路を通れる
- 気体: Space 長押しでゆっくり上昇、横移動は遅い
- 障害物を避けて、右上のゴールに触れるとクリア

## 操作方法

- 移動: `A` / `D` または `←` / `→`
- ジャンプ、上昇: `Space`
- 状態変更: `1` 固体 / `2` 液体 / `3` 気体

## 起動方法

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開いてください。

## Vercel へのデプロイ

Vercel でこのリポジトリを Import すると、Next.js プロジェクトとして自動検出されます。

- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`
