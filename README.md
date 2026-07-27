# SPIKE-RT Selected Build & Web Flasher

SPIKE-RTアプリを複数保存し、GitHub Actionsのプルダウンで選択した**1個だけ**をコンパイルし、そのファームウェアをGitHub PagesからSPIKE Prime Hubへ書き込む公開リポジトリです。

全アプリを一括ビルドしてPages上で選ぶ版は、別の`spike-rt-web-project`リポジトリにあります。

## github.devでこのリポジトリを開く方法

`github.dev`のトップページを直接開くだけでは、このリポジトリは読み込まれません。空のVS Code風画面が表示された場合は、いったん通常のGitHubへ戻ってください。

### 一番簡単な開き方

1. 通常のGitHubで、この選択ビルド版リポジトリのトップページを開く
2. ブランチが`main`になっていることを確認する
3. その画面で、キーボードの`.`（ピリオド）キーを押す
4. 同じリポジトリが`github.dev`の編集画面で開く

ユーザー名やリポジトリ名をURLへ手入力する必要はありません。

### 編集したいファイルを直接開く方法

1. 通常のGitHubで`apps`フォルダを開く
2. 編集するアプリのフォルダを開く
3. 同名の`.c`ファイルを開く
4. そのファイルを表示した状態で`.`キーを押す

例えば最初に試すファイルは次です。

```text
apps/myapp/myapp.c
```

この方法では、`github.dev`が開いたときに対象ファイルも一緒に表示されます。

### 左側の一覧から開く場合

`github.dev`が開いたら、左端のエクスプローラーで次の順に展開します。

```text
apps
└─ myapp
   └─ myapp.c
```

別のアプリを編集するときは、`myapp`の代わりに`button`、`led`、`motor`などを選びます。

### URLを使う場合

通常のGitHubで対象リポジトリまたは対象ファイルを開いたあと、アドレスバーのドメイン部分だけを`github.com`から`github.dev`へ変更する方法もあります。それより後ろの部分は変更しません。

URLを最初から手入力したり、ユーザー名部分を置き換えたりしないでください。`.`キーを使う方法の方が間違いが起きにくいです。

## 編集内容をGitHubへ保存する方法

1. `.c`ファイルを編集する
2. 左端の枝分かれしたアイコン「ソース管理」を開く
3. 上部の入力欄へ変更内容を書く
4. `Commit & Push`を押す
5. `Commit`だけが表示された場合は、Commit後に`Sync Changes`または`Push`を押す

この選択ビルド版は、Pushしただけではコンパイルを開始しません。保存後にActionsを開き、ビルドするアプリを選択して手動実行します。

## 使い方

1. `Settings` → `Pages` → `Build and deployment`で、`Source`を`GitHub Actions`に設定する
2. GitHubの`Actions`を開く
3. `Build selected SPIKE-RT app and deploy flasher`を選ぶ
4. `Run workflow`を押す
5. `app`からプログラムを1つ選ぶ
6. もう一度`Run workflow`を押す
7. ビルドとPagesデプロイが完了したら、リポジトリの`Settings` → `Pages`に表示される公開先を開く

公開先はGitHubが自動生成します。README内のURLを編集したり、ユーザー名部分を置き換えたりする必要はありません。

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