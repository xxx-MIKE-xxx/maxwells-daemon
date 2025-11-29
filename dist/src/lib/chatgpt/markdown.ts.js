import { toHtml as hastToHtml } from "/vendor/.vite-deps-hast-util-to-html.js__v--cb44d052.js";
import { fromMarkdown as fm } from "/vendor/.vite-deps-mdast-util-from-markdown.js__v--cb44d052.js";
import { gfmFromMarkdown, gfmToMarkdown } from "/vendor/.vite-deps-mdast-util-gfm.js__v--cb44d052.js";
import { toHast } from "/vendor/.vite-deps-mdast-util-to-hast.js__v--cb44d052.js";
import { toMarkdown as tm } from "/vendor/.vite-deps-mdast-util-to-markdown.js__v--cb44d052.js";
import { gfm } from "/vendor/.vite-deps-micromark-extension-gfm.js__v--cb44d052.js";
export function fromMarkdown(content) {
  return fm(content, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()]
  });
}
export function toMarkdown(ast) {
  return tm(ast, {
    bullet: "-",
    bulletOther: "*",
    bulletOrdered: ".",
    emphasis: "*",
    fence: "`",
    fences: true,
    listItemIndent: "one",
    resourceLink: false,
    rule: "-",
    ruleRepetition: 3,
    ruleSpaces: false,
    strong: "*",
    extensions: [gfmToMarkdown()]
  });
}
export function toHtml(node) {
  return hastToHtml(toHast(node));
}
export function flatMap(tree, fn) {
  function transform(node, i, parent) {
    if ("children" in node) {
      const p = node;
      p.children = p.children.flatMap((item, i2) => transform(item, i2, p));
    }
    return fn(node, i, parent);
  }
  return transform(tree, 0, void 0)[0];
}
