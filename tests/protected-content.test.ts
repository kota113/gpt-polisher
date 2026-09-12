import assert from "node:assert/strict";
import test from "node:test";
import { protectSpecialContent, restoreSpecialContent } from "../apps/hono/src/protected-content.ts";

test("writing、一般特殊ブロック、citation を個別に保護して��元する", () => {
  const writing = ':::writing{variant="document" id="123" title="title"} content_text :::';
  const special = ":::artifact{kind=chart}\nchart content\n:::";
  const citation = "\uE200cite\uE202turn320612search0\uE202turn320612search3\uE201";
  const source = `前文 ${writing}\n中間 ${special}\n根拠${citation}。`;

  const protectedContent = protectSpecialContent(source);

  assert.equal(
    protectedContent.text,
    "前文 <TEXTBLOCK_1>\n中間 <SPECIALBLOCK_1>\n根拠<CITATION_1>。",
  );
  assert.equal(
    restoreSpecialContent("整理後 <TEXTBLOCK_1>\n<SPECIALBLOCK_1>\n根拠<CITATION_1>。", protectedContent),
    `整理後 ${writing}\n${special}\n根拠${citation}。`,
  );
});

test("元からあるプレースホルダーとの衝突を避け、保持も検証する", () => {
  const source = "既存 <TEXTBLOCK_1> と :::writing{}本文::: と <KEEP_2>";
  const protectedContent = protectSpecialContent(source);

  assert.equal(protectedContent.text, "既存 <TEXTBLOCK_1> と <TEXTBLOCK_2> と <KEEP_2>");
  assert.throws(
    () => restoreSpecialContent("既存 TEXTBLOCK_1 と <TEXTBLOCK_2> と <KEEP_2>", protectedContent),
    /existing placeholder <TEXTBLOCK_1>/,
  );
});

test("生成したプレースホルダーの欠落や重複を拒否する", () => {
  const protectedContent = protectSpecialContent("前 :::notice{}重要::: 後");

  assert.throws(() => restoreSpecialContent("前 後", protectedContent), /<SPECIALBLOCK_1>/);
  assert.throws(
    () => restoreSpecialContent("<SPECIALBLOCK_1> <SPECIALBLOCK_1>", protectedContent),
    /<SPECIALBLOCK_1>/,
  );
});

test("複数の citation を番号で対応付け、再配置された位置へ復元する", () => {
  const citation1 = "\uE200cite\uE202turn1search0\uE201";
  const citation2 = "\uE200cite\uE202turn2search0\uE202turn2search1\uE201";
  const protectedContent = protectSpecialContent(`一つ目${citation1}\n二つ目${citation2}`);

  assert.equal(protectedContent.text, "一つ目<CITATION_1>\n二つ目<CITATION_2>");
  assert.equal(
    restoreSpecialContent("二つ目<CITATION_2>\n一つ目<CITATION_1>", protectedContent),
    `二つ目${citation2}\n一つ目${citation1}`,
  );
});