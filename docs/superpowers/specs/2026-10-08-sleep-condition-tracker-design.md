# 睡眠・コンディション記録アプリ 設計仕様書

## 概要

1日の終わりに、前日の睡眠時間・その日の主観的コンディション・生活行動（カフェイン、運動、アルコール）を記録し、睡眠時間とコンディションの関係や行動有無によるコンディションへの影響を分析できるiOSアプリ。将来的にApp Storeでの配布を想定する。

## 要件

- 1日1回、以下を記録する
  - 睡眠時間（前日分）: HealthKit連携で自動取得、取得できない場合は手入力
  - コンディション: 1〜5の5段階評価 + 自由記述メモ
  - カフェイン摂取: 朝 / 昼 / 夕 / なし
  - 運動: 朝 / 昼 / 夕 / なし
  - アルコール摂取: 適量 / 多量 / なし
- 分析機能
  - 睡眠時間 × コンディションの散布図
  - カフェイン/運動/アルコールそれぞれの「あり群」と「なし群」でのコンディション平均値比較
- 1日の終わりにリマインドのローカル通知
- データは端末内ローカル保存のみ（iCloud同期なし）
- 日本語のみ対応、iOS 17以降・iPhone専用
- 将来的なApp Store配布を見据えるが、初期スコープは上記機能のみ

## 技術スタック

- Expo（Development Build / EAS Build前提。HealthKit連携のためExpo Goは使用不可）
- React Native + TypeScript
- `expo-router`（ファイルベースルーティング、3タブ構成）
- `expo-sqlite` + `drizzle-orm`（型安全なスキーマ定義・クエリ）
- `@kingstinct/react-native-healthkit`（HealthKit連携、Expo Config Plugin対応）
- `victory-native`（Skiaベース、散布図・バーグラフ描画）
- `expo-notifications`（ローカル通知によるリマインド）

## ディレクトリ構成

```
app/
  (tabs)/
    index.tsx             # 記録入力画面（今日の記録）
    history.tsx           # 過去の記録一覧
    analysis.tsx          # 分析（散布図・比較グラフ）
  _layout.tsx
src/
  db/
    schema.ts             # drizzle スキーマ定義
    client.ts             # expo-sqlite + drizzle クライアント初期化
    migrations/
  healthkit/
    sleep.ts              # HealthKit睡眠データ取得ラッパー
  notifications/
    reminder.ts           # ローカル通知スケジューリング
  features/
    record/               # 記録入力のロジック・コンポーネント
    analysis/              # 分析ロジック・グラフコンポーネント
```

## データモデル

テーブル: `daily_records`（1日1レコード、`date`にユニーク制約）

| カラム | 型 | 説明 |
|---|---|---|
| `id` | integer, PK | |
| `date` | text (YYYY-MM-DD), unique | 対象の日付 |
| `sleepMinutes` | integer, nullable | 睡眠時間（分）。HealthKit取得値 or 手入力値 |
| `sleepSource` | text enum: `'healthkit' \| 'manual'` | 取得元の記録 |
| `condition` | integer (1〜5) | 主観的コンディション5段階評価 |
| `conditionNote` | text, nullable | 自由記述メモ |
| `caffeine` | text enum: `'morning' \| 'afternoon' \| 'evening' \| 'none'` | |
| `exercise` | text enum: `'morning' \| 'afternoon' \| 'evening' \| 'none'` | |
| `alcohol` | text enum: `'moderate' \| 'heavy' \| 'none'` | |
| `createdAt` / `updatedAt` | text (ISO datetime) | |

入力時は「同日のレコードがあれば更新、なければ新規作成」のupsert的な扱いとする。分析画面の集計はこのテーブルに対する`drizzle-orm`のクエリ（例: `caffeine != 'none'`でグループ化し`condition`の平均を算出）で実現する。

## 画面構成・データフロー

### 記録入力画面
1. 画面を開くとHealthKitから前日の睡眠時間取得を試みる（権限未許可なら許可ダイアログ、拒否・取得失敗時は手入力欄を表示）
2. 取得できた場合は値を表示しつつ「手入力に変更」も可能（`sleepSource`を切り替え）
3. コンディション（1〜5セレクタ）、自由記述メモ、カフェイン/運動（朝・昼・夕・なし）、アルコール（適量・多量・なし）を入力
4. 保存ボタンで当日分のレコードをupsert

### 履歴画面
1. `daily_records`を日付降順で一覧表示（日付、コンディション、行動有無のアイコン表示）
2. タップで記録入力画面と同じフォームを開き編集可能

### 分析画面
1. 散布図: 全レコードの`sleepMinutes`(X軸) × `condition`(Y軸)
2. 比較グラフ: カフェイン/運動/アルコールそれぞれの「あり群」「なし群」での`condition`平均値をバーグラフで比較
3. データが少ない場合（5件未満）は「もう少しデータを集めましょう」の案内を表示

### リマインド通知
1. 設定画面（または初回起動時）で通知時刻を設定（デフォルト21:00）
2. `expo-notifications`で毎日その時刻にローカル通知をスケジュール
3. 通知タップで記録入力画面を開く

## エラーハンドリング

- HealthKit権限拒否・取得失敗 → 手入力モードにフォールバック。常に手入力で完結できることを保証する
- DB書き込み失敗 → 保存ボタンでエラーメッセージ表示、入力内容は画面上に保持し再試行可能にする
- 通知スケジュール失敗（権限拒否時）→ アプリ内で通知無効を示すバナー表示。記録機能自体は影響を受けない
- 分析画面でデータ0件 → 空状態（グラフの代わりに案内メッセージ）を表示

## テスト方針

- DBアクセス層（`drizzle-orm`のクエリ、upsertロジック、平均値集計クエリ）はユニットテストを書く
- HealthKit連携部分はラッパー関数をモック化してユニットテスト（実機依存の統合テストはスコープ外）
- UI/コンポーネントは主要なフォーム入力・保存フローのみ軽くテスト
- E2E的な動作確認は実機/シミュレータでの手動確認が中心（Detox等の導入は見送り）

## スコープ外（将来検討）

- iCloud同期・複数デバイス対応
- 英語などの多言語対応
- App Store配布に向けたアイコン・スクリーンショット・審査対応等のリリース作業
