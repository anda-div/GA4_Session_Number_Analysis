/*
 * ============================================================================
 * GTM カスタム JavaScript 変数：訪問回数（数値）
 * ============================================================================
 * 変数名（GTMでの登録名）： JS - visit_number
 *   ★ 日本語や全角括弧を含めないこと。GTMの変数参照は完全一致で判定され、
 *      全角「（）」と半角「()」の違いで「不明な変数名」エラーになる。
 * 返り値                  ： 1 以上の整数。取得できない場合は undefined
 *
 * 【この方式を採る理由】
 *   GA4 の ga_session_number はカスタムディメンションに登録できない（予約名のため
 *   「このスコープではパラメータ名を使用できません」となる）。
 *   また GA4 自身の Cookie（_ga_XXXXXXX）を読む方式は、
 *     ・Cookie を書き換えるのが Google タグ自身のため、セッション開始時に
 *       前回の訪問回数を読んでしまい 1 つずれる
 *     ・Cookie の内部形式が非公開で、過去に変更されている（GS1 → GS2）
 *   という欠陥があるため採用しない。
 *   本方式は自前のファーストパーティ Cookie でカウントするため、
 *   同期的に値が確定し（1つずれない）、非公開仕様にも依存しない。
 *
 * 【セッションの判定】
 *   le_session_flag（30分で失効）が無ければ「新しい訪問」とみなして
 *   le_visit_count を +1 する。イベントが発生するたびに 30 分を延長するため、
 *   GA4 の「30分間操作がないとセッション終了」と同じ考え方になる。
 *
 * 【GA4 の集計とのずれ（既知・許容）】
 *   ・GA4 はキャンペーン（utm）の変更でもセッションを分割するが、本方式は分割しない
 *   ・同一ページに長時間滞在した場合、GA4 は分割するが本方式は分割しない
 *     （ページ単位で値をキャッシュし、二重カウントを防いでいるため）
 *   ・Cookie 削除・別ブラウザ・別端末では「初回」に戻る（GA4 本体も同じ）
 *   → 初回／2回目／3〜5回目／6回目以上 の区分には実害のない範囲。
 * ============================================================================
 */
function () {
  var VISIT_KEY = 'le_visit_count';    // 訪問回数（2年保持）
  var SESS_KEY = 'le_session_flag';    // セッション継続フラグ（30分で失効）
  var SESSION_MINUTES = 30;
  var VISIT_DAYS = 730;

  // GTM は変数を「参照するタグごと」に評価するため、同一ページでの
  // 二重カウントを防ぐために window にキャッシュする（必須）
  if (window.__leVisitNumber) {
    return window.__leVisitNumber;
  }

  function readCookie(name) {
    try {
      var m = document.cookie.match(
        new RegExp('(?:^|;\\s*)' + name + '=([^;]*)')
      );
      return m ? decodeURIComponent(m[1]) : null;
    } catch (e) {
      return null;
    }
  }

  function writeCookie(name, value, lifetimeMs) {
    try {
      var expires = new Date(new Date().getTime() + lifetimeMs).toUTCString();
      // www 有無の両方で共有できるようドメインを1段上げる
      var domain = location.hostname.replace(/^www\./, '');
      document.cookie =
        name + '=' + encodeURIComponent(value) +
        ';expires=' + expires +
        ';path=/' +
        ';domain=.' + domain +
        ';SameSite=Lax' +
        (location.protocol === 'https:' ? ';Secure' : '');
    } catch (e) {
      /* Cookie が書けない環境では何もしない */
    }
  }

  try {
    var n = parseInt(readCookie(VISIT_KEY), 10);
    if (!(n > 0)) {
      n = 0;
    }

    if (!readCookie(SESS_KEY)) {
      // セッションが切れている（または初回）→ 訪問回数を1つ進める
      n = n + 1;
      writeCookie(VISIT_KEY, n, VISIT_DAYS * 24 * 60 * 60 * 1000);
    }

    // イベントが起きるたびに 30 分を延長する
    writeCookie(SESS_KEY, '1', SESSION_MINUTES * 60 * 1000);

    if (!(n > 0)) {
      return undefined;
    }

    window.__leVisitNumber = n;
    return n;
  } catch (e) {
    return undefined;
  }
}
