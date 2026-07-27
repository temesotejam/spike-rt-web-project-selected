# SPIKE-RT Selected Build & Web Flasher

SPIKE-RTアプリを複数保存し、GitHub Actionsのプルダウンで選択した**1個だけ**をコンパイルし、そのファームウェアをGitHub PagesからSPIKE Prime Hubへ書き込む公開リポジトリです。

全アプリを一括ビルドしてPages上で選ぶ版は、`temesotejam/spike-rt-web-project`にあります。

## 使い方

1. `Settings` → `Pages` → `Build and deployment`で、`Source`を`GitHub Actions`に設定する
2. GitHubの`Actions`を開く
3. `Build selected SPIKE-RT app and deploy flasher`を選ぶ
4. `Run workflow`を押す
5. `app`からプログラムを1つ選ぶ
6. もう一度`Run workflow`を押す
7. ビルドとPagesデプロイが完了したら、次のURLを開く

```text
https://temesotejam.github.io/spike-rt-web-project-selected/
```

ページには、最後に成功した手動ビルドの1個だけが表示されます。別のアプリを選んでWorkflowを実行すると、公開中のファームウェアもそのアプリへ置き換わります。

## 書き込み手順

```text
Actionsでアプリを1個選択
→ SPIKE-RTカーネルと選択アプリをコンパイル
→ asp.binをArtifactへ保存
→ 同じasp.binをPagesへ公開
→ PagesでHubに接続
→ 消去・書き込み・全バイト読み戻し検証・再起動
```

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

## 収録アプリ

| ID | 内容 |
|---|---|
| `myapp` | 起動ログ後に待機する最小構成 |
| `button` | Hubボタン入力をログ表示 |
| `led` | a〜zを5×5表示へ順番に表示 |
| `led_fast` | 0〜9を0.25秒ごとに表示 |
| `led_countdown` | 9〜0を1秒ごとに表示 |
| `motor` | ポートAのモーターを回転・停止 |

`motor`は実機でポートAのモーターが自動的に動くため注意してください。

## アプリの編集

例えば`myapp`は次の場所です。

```text
apps/myapp/myapp.c
```

`github.dev`で編集してCommit & Pushした後、Actionsから対象アプリを選んでビルドします。Pushだけではビルドせず、手動実行したときだけコンパイルします。

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

## ビルド・書き込み仕様

- SPIKE-RT: `v0.2.0`
- ターゲット: `primehub_gcc`
- カーネル: 実行ごとに1回コンパイル
- アプリ: 選択した1個だけコンパイル
- 出力: `asp.bin`
- USB: WebUSB / DfuSe
- Hub VID/PID: `0x0694` / `0x0008`
- 書き込み先: `0x08008000`
- 最大サイズ: 992 KiB
- 検証: 全バイト読み戻し比較

WebUSB部分は実装済みですが、SPIKE Hub実機による最終確認はまだです。

## 安全対策

- SPIKE-RT公式リポジトリは一時チェックアウトのみ
- `persist-credentials: false`
- SPIKE-RTのPush URLを`DISABLED`へ変更
- PAT、SSH秘密鍵、Deploy Keyを使用しない
- ビルドジョブは`contents: read`のみ
- Pagesデプロイジョブだけに`pages: write`と`id-token: write`
- SPIKE-RT公式リポジトリへPushする処理を持たない
- `0x08008000`以外と992 KiB超過をコード上で拒否

## ライセンス

このリポジトリはMIT Licenseです。公式サンプル由来のコードについては各ファイルの著作権表示と`THIRD_PARTY_NOTICES.md`も参照してください。
