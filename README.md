# SPIKE-RT Selected App Builder

SPIKE-RTアプリを複数保存し、GitHub Actionsのプルダウンで選択した**1個だけ**をコンパイルする公開リポジトリです。

全アプリを一括ビルドしてGitHub Pagesから選択する版は、`temesotejam/spike-rt-web-project`にあります。このリポジトリはPagesを更新せず、選択したファームウェアをActionsのArtifactとして出力します。

## 使い方

1. GitHubの`Actions`を開く
2. `Build selected SPIKE-RT app`を選ぶ
3. `Run workflow`を押す
4. `app`からプログラムを1つ選ぶ
5. もう一度`Run workflow`を押す
6. 完了後、実行画面下部のArtifactをダウンロードする

Artifact名は次の形式です。

```text
spike-rt-<アプリID>-<実行番号>
```

ZIPには以下が入ります。

```text
asp.bin
asp.bin.sha256
size.txt
manifest.json
project.json
build.log
```

取得した`asp.bin`は、全件版Pagesの「ローカルのasp.binを選択」から読み込めます。

## 収録アプリ

| ID | 内容 |
|---|---|
| `myapp` | 起動ログ後に待機する最小構成 |
| `button` | Hubボタン入力をログ表示 |
| `led` | a〜zを5×5表示へ順番に表示 |
| `led_fast` | 0〜9を0.25秒ごとに表示 |
| `led_countdown` | 9〜0を1秒ごとに表示 |
| `motor` | ポートAのモーターを回転・停止 |

`motor`は実機でモーターが自動的に動くため注意してください。

## アプリの編集

例えば`myapp`は次の場所です。

```text
apps/myapp/myapp.c
```

`github.dev`で編集してCommit & Pushした後、Actionsから対象アプリを選んでビルドします。

## アプリの追加

最低限、次の2ファイルを追加します。

```text
apps/new_app/
├─ new_app.c
└─ project.json
```

フォルダ名、Cファイル名、`project.json`の`id`は同じにします。IDは英字で始め、英数字とアンダースコアだけを使用します。

```json
{
  "id": "new_app",
  "name": "New App",
  "description": "説明",
  "warning": "",
  "origin": "自作"
}
```

`new_app.h`、`new_app.cfg`、`new_app.cdl`がない場合はWorkflowが標準構成を一時生成します。アプリ追加後は`.github/workflows/build-selected.yml`の`options`にもIDを1行追加してください。

## ビルド方式

- SPIKE-RT: `v0.2.0`
- ターゲット: `primehub_gcc`
- カーネル: 実行ごとに1回コンパイル
- アプリ: 選択した1個だけコンパイル
- 出力: `asp.bin`
- 書き込み先: `0x08008000`
- 最大サイズ: 992 KiB

## 安全対策

- SPIKE-RT公式リポジトリは一時チェックアウトのみ
- `persist-credentials: false`
- SPIKE-RTのPush URLを`DISABLED`へ変更
- PAT、SSH秘密鍵、Deploy Keyを使用しない
- Workflow権限は`contents: read`のみ
- SPIKE-RT公式リポジトリへPushする処理を持たない

## ライセンス

このリポジトリはMIT Licenseです。公式サンプル由来のコードについては各ファイルの著作権表示と`THIRD_PARTY_NOTICES.md`も参照してください。
