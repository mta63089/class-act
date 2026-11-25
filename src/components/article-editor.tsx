"use client";

import {
  proposeBlockRewrite,
  saveBlockRevision,
  scrapUnpublishedArticle,
} from "@/app/admin/block-actions";
import { ArticleBlockView } from "@/components/article-body";
import type { ArticleBlock } from "@/db/schema";
import { articleWordCount, unfinishedImageIdeas } from "@/lib/article-blocks";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Source = { title: string; url: string };
type BlockKind = ArticleBlock["type"];
const blockKinds: { type: BlockKind; label: string }[] = [
  { type: "paragraph", label: "Paragraph" },
  { type: "heading", label: "Heading" },
  { type: "image", label: "Image" },
  { type: "split", label: "Image + text" },
  { type: "pullquote", label: "Pull quote" },
  { type: "list", label: "Bulleted list" },
  { type: "imageIdea", label: "Image brief" },
];
const field =
  "w-full border-2 border-ink bg-white px-3 py-2 text-sm font-normal outline-offset-2";
const btn =
  "border-2 border-ink px-3 py-2 text-xs font-black hover:bg-lilac disabled:cursor-not-allowed disabled:opacity-50";
const mediaFields = (
  block: ArticleBlock,
): block is Extract<ArticleBlock, { type: "image" | "split" }> =>
  block.type === "image" || block.type === "split";

function blankBlock(type: BlockKind): ArticleBlock {
  switch (type) {
    case "heading":
      return { type: "heading", level: 2, text: "New section heading" };
    case "image":
      return {
        type: "image",
        src: "",
        alt: "",
        caption: "",
        credit: "",
        sourceUrl: "",
      };
    case "split":
      return {
        type: "split",
        src: "",
        alt: "",
        caption: "",
        credit: "",
        sourceUrl: "",
        text: "New text alongside the image.",
        position: "left",
      };
    case "pullquote":
      return {
        type: "pullquote",
        text: "Highlight an excerpt from your story",
      };
    case "quote":
      return { type: "quote", quoteId: "", text: "", attribution: "" };
    case "list":
      return { type: "list", items: ["First item", "Second item"] };
    case "imageIdea":
      return {
        type: "imageIdea",
        prompt: "Describe the image you'd like to add",
        placementNote: "",
      };
    default:
      return { type: "paragraph", text: "New paragraph" };
  }
}

export function ArticleEditor({
  articleId,
  version,
  title: originalTitle,
  dek: originalDek,
  section,
  initialBlocks,
  sources,
  coverImage,
  coverAlt,
  readOnly,
}: {
  articleId: string;
  version: number;
  title: string;
  dek: string;
  section: string;
  initialBlocks: ArticleBlock[];
  sources: Source[];
  coverImage: string;
  coverAlt: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(originalTitle);
  const [dek, setDek] = useState(originalDek);
  const [blocks, setBlocks] = useState<ArticleBlock[]>(initialBlocks);
  const [selected, setSelected] = useState<number | null>(null);
  const [editingHeader, setEditingHeader] = useState<"title" | "dek" | null>(
    null,
  );
  const [insertType, setInsertType] = useState<BlockKind>("paragraph");
  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const [proposed, setProposed] = useState<string | null>(null);
  const [rewriteError, setRewriteError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [rewriteCost, setRewriteCost] = useState<number | null>(null);
  const [working, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);
  const choice = selected === null ? null : blocks[selected] || null;
  const lead = blocks[0];
  const leadIsImage = lead?.type === "image";
  const effectiveCover = leadIsImage ? lead.src : coverImage;
  const effectiveAlt = leadIsImage ? lead.alt : coverAlt;

  function setBlock(index: number, next: ArticleBlock) {
    setBlocks((old) => old.map((b, i) => (i === index ? next : b)));
    setDirty(true);
    setProposed(null);
  }
  function choose(index: number) {
    setSelected(index);
    setProposed(null);
    setRewriteError("");
  }
  function addBlock(type: BlockKind) {
    const index = selected === null ? blocks.length : selected + 1;
    setBlocks((old) => [
      ...old.slice(0, index),
      blankBlock(type),
      ...old.slice(index),
    ]);
    setSelected(index);
    setDirty(true);
    setProposed(null);
  }
  function removeBlock() {
    if (selected === null || blocks.length === 1) return;
    setBlocks((old) => old.filter((_, i) => i !== selected));
    setSelected(null);
    setDirty(true);
  }
  function moveBlock(offset: number) {
    if (selected === null) return;
    const next = selected + offset;
    if (next < 0 || next >= blocks.length) return;
    setBlocks((old) => {
      const copy = [...old];
      [copy[selected], copy[next]] = [copy[next], copy[selected]];
      return copy;
    });
    setSelected(next);
    setDirty(true);
  }
  function duplicateBlock() {
    if (choice) addCopy(choice);
  }
  function addCopy(b: ArticleBlock) {
    const index = selected === null ? blocks.length : selected + 1;
    setBlocks((old) => [
      ...old.slice(0, index),
      structuredClone(b),
      ...old.slice(index),
    ]);
    setSelected(index);
    setDirty(true);
  }
  async function requestRewrite() {
    if (selected === null || !choice || !rewriteInstruction.trim()) return;
    const value =
      choice.type === "paragraph" ||
      choice.type === "heading" ||
      choice.type === "pullquote" ||
      choice.type === "split"
        ? choice.text
        : null;
    if (!value) return;
    setRewriteError("");
    setProposed(null);
    const position = selected;
    startTransition(async () => {
      try {
        const result = await proposeBlockRewrite({
          articleId,
          version,
          blockIndex: position,
          text: value,
          instruction: rewriteInstruction,
        });
        setProposed(result.text);
        setRewriteCost(result.estimatedUsd);
      } catch (e) {
        setRewriteError(
          e instanceof Error
            ? e.message
            : "Rewrite failed. No changes were applied.",
        );
      }
    });
  }
  function acceptRewrite() {
    if (selected === null || !choice || !proposed) return;
    if (
      choice.type === "paragraph" ||
      choice.type === "heading" ||
      choice.type === "pullquote" ||
      choice.type === "split"
    )
      setBlock(selected, { ...choice, text: proposed });
    setProposed(null);
    setRewriteInstruction("");
  }
  function saveChanges() {
    setSaveError("");
    const form = new FormData();
    form.set("id", articleId);
    form.set("title", title);
    form.set("dek", dek);
    form.set("version", String(version));
    form.set("blocks", JSON.stringify(blocks));
    startTransition(async () => {
      try {
        await saveBlockRevision(form);
        setDirty(false);
        router.refresh();
      } catch (e) {
        setSaveError(
          e instanceof Error
            ? e.message
            : "Could not save article. Your changes remain in the editor.",
        );
      }
    });
  }
  const wordCount = articleWordCount(blocks);
  const notes = unfinishedImageIdeas(blocks);
  const sourceLinks = sources.map((s) => (
    <a
      href={s.url}
      target='_blank'
      rel='noopener noreferrer'
      key={s.url}
      className='block wrap-break-word underline'
    >
      {s.title}
    </a>
  ));
  return (
    <div className='grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px]'>
      <section className='min-w-0'>
        <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
          <div>
            <p className='text-xs font-black uppercase tracking-widest'>
              Article preview · Version {version}
            </p>
            <p className='text-sm text-ink/70'>
              Select any content block to edit it. The preview uses the public
              article renderer.
            </p>
          </div>
          {!readOnly && (
            <span className='text-xs font-black text-pop-red' role='status'>
              {dirty ? "UNSAVED CHANGES" : "ALL CHANGES SAVED"}
            </span>
          )}
        </div>
        <div className='border-[3px] border-ink bg-white shadow-[6px_6px_0_#1b1818]'>
          <article className='mx-auto max-w-212.5 px-5 py-8 sm:px-9 sm:py-11'>
            <span className='inline-block border-2 border-ink bg-pop-red px-3 py-1 text-[11px] font-black uppercase tracking-wider'>
              {section}
            </span>
            {editingHeader === "title" && !readOnly ? (
              <textarea
                autoFocus
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDirty(true);
                }}
                onBlur={() => setEditingHeader(null)}
                className='mt-5 w-full border-2 border-pop-red bg-sun/20 p-2 font-display text-5xl font-black leading-none'
                rows={3}
              />
            ) : (
              <h1
                onClick={() => !readOnly && setEditingHeader("title")}
                className={`my-5 font-display text-[clamp(2.75rem,5.5vw,5rem)] font-black uppercase leading-[.95] ${!readOnly ? "cursor-text hover:bg-lilac/40" : ""}`}
              >
                {title}
              </h1>
            )}
            {editingHeader === "dek" && !readOnly ? (
              <textarea
                autoFocus
                value={dek}
                onChange={(e) => {
                  setDek(e.target.value);
                  setDirty(true);
                }}
                onBlur={() => setEditingHeader(null)}
                className='w-full border-2 border-pop-red bg-sun/20 p-3 text-xl'
                rows={3}
              />
            ) : (
              <p
                onClick={() => !readOnly && setEditingHeader("dek")}
                className={`mb-5 text-[22px] leading-[1.45] text-ink/80 ${!readOnly ? "cursor-text hover:bg-lilac/40" : ""}`}
              >
                {dek}
              </p>
            )}
            <div className='mb-6 border-b-2 border-ink/20 pb-4 text-xs font-extrabold uppercase tracking-widest'>
              The Class Act Daily · Editorial preview
            </div>
            {effectiveCover && (
              <figure
                className={`mb-9 ${!readOnly && leadIsImage ? "cursor-pointer hover:outline-4 hover:outline-pop-red" : ""}`}
                onClick={() => !readOnly && leadIsImage && choose(0)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={effectiveCover}
                  alt={effectiveAlt || "Article image"}
                  className='w-full max-h-155 object-cover border-[3px] border-ink'
                />
                {leadIsImage && (
                  <figcaption className='mt-2 text-xs text-ink/70'>
                    {lead.caption} · {lead.credit}
                  </figcaption>
                )}
              </figure>
            )}
            <div className='editorial-article-body'>
              {blocks.map((block, i) => {
                if (leadIsImage && i === 0) return null;
                const chosen = selected === i;
                return (
                  <div
                    key={i}
                    role={readOnly ? undefined : "button"}
                    tabIndex={readOnly ? undefined : 0}
                    aria-label={
                      readOnly
                        ? undefined
                        : `Edit block ${i + 1}: ${block.type}`
                    }
                    onClick={readOnly ? undefined : () => choose(i)}
                    onKeyDown={
                      readOnly
                        ? undefined
                        : (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              choose(i);
                            }
                          }
                    }
                    className={`relative rounded-sm ${!readOnly ? "cursor-pointer transition-[outline,background] hover:bg-lilac/25 hover:outline-2 hover:outline-dashed hover:outline-pop-red/60 " : ""}${chosen ? "bg-lilac/20 outline-3 outline-pop-red" : ""}`}
                  >
                    {!readOnly && (
                      <span
                        className={`absolute -top-3 right-0 z-10 bg-ink px-2 py-0.5 text-[10px] font-black uppercase text-paper ${chosen ? "block" : "hidden"}`}
                      >
                        {block.type} · {i + 1}
                      </span>
                    )}
                    {block.type === "imageIdea" ? (
                      <div className='my-6 border-2 border-dashed border-pop-red bg-sun/15 p-5 text-sm'>
                        <strong className='block uppercase'>
                          Image idea · not public
                        </strong>
                        {block.prompt}
                        <small className='mt-2 block'>
                          {block.placementNote}
                        </small>
                      </div>
                    ) : (
                      <ArticleBlockView block={block} sources={sources} />
                    )}
                  </div>
                );
              })}
            </div>
            {sources.length > 0 && (
              <div className='mt-12 border-t-2 border-ink pt-6'>
                <h2 className='mb-4 font-display text-3xl font-black'>
                  Sources
                </h2>
                <div className='space-y-2 text-sm'>{sourceLinks}</div>
              </div>
            )}
          </article>
        </div>
      </section>

      <aside className='self-start space-y-4 xl:sticky xl:top-4'>
        <div className='border-[3px] border-ink bg-card p-5 shadow-[4px_4px_0_#1b1818]'>
          <h2 className='font-display text-3xl font-black uppercase'>Editor</h2>
          <p className='mt-2 text-xs font-semibold'>
            {wordCount.toLocaleString()} words · {blocks.length} blocks ·{" "}
            {notes} unresolved image briefs
          </p>
          {wordCount < 800 && (
            <p className='mt-2 text-xs text-pop-red'>
              Short-form draft. Consider whether additional sourced context
              would improve it.
            </p>
          )}
          <p className='mt-3 text-xs'>
            SEO preview: headline {title.length} characters, description{" "}
            {dek.length}. These are guidance values, not search-ranking
            requirements.
          </p>
          {!readOnly && (
            <div className='mt-4'>
              <button
                type='button'
                disabled={working}
                onClick={saveChanges}
                className={`${btn} w-full bg-sun text-sm`}
              >
                {working ? "Saving…" : "Save article revision"}
              </button>
              {saveError && (
                <p
                  role='alert'
                  className='mt-3 border-l-4 border-pop-red pl-2 text-xs font-semibold'
                >
                  {saveError} Your unsaved edits are still visible.
                </p>
              )}
            </div>
          )}
          {readOnly && (
            <p className='mt-3 text-sm font-bold'>
              This article is published or archived. Editing is closed.
            </p>
          )}
        </div>
        {!readOnly && (
          <div className='border-[3px] border-ink bg-card p-5 shadow-[4px_4px_0_#1b1818]'>
            <p className='text-xs font-black uppercase tracking-wider'>
              Content blocks
            </p>
            <div className='mt-3 flex gap-2'>
              <select
                value={insertType}
                onChange={(e) => setInsertType(e.target.value as BlockKind)}
                className={field}
              >
                {blockKinds.map((x) => (
                  <option key={x.type} value={x.type}>
                    {x.label}
                  </option>
                ))}
              </select>
              <button
                type='button'
                className={`${btn} bg-sun`}
                onClick={() => addBlock(insertType)}
              >
                Add
              </button>
            </div>
            <p className='mt-2 text-xs text-ink/65'>
              Adds after the selected block, or at the end.
            </p>
            {choice && selected !== null && (
              <div className='mt-5 border-t-2 border-ink pt-4'>
                <div className='flex flex-wrap justify-between gap-2'>
                  <strong className='text-xs uppercase tracking-wide'>
                    Block {selected + 1} · {choice.type}
                  </strong>
                  <button
                    type='button'
                    onClick={() => setSelected(null)}
                    className='text-xs underline'
                  >
                    Close
                  </button>
                </div>
                <div className='mt-3 grid grid-cols-4 gap-1'>
                  <button
                    type='button'
                    className={btn}
                    aria-label='Move block up'
                    onClick={() => moveBlock(-1)}
                    disabled={selected === 0}
                  >
                    ↑
                  </button>
                  <button
                    type='button'
                    className={btn}
                    aria-label='Move block down'
                    onClick={() => moveBlock(1)}
                    disabled={selected >= blocks.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    type='button'
                    className={btn}
                    onClick={duplicateBlock}
                  >
                    Copy
                  </button>
                  <button
                    type='button'
                    className={`${btn} text-pop-red`}
                    onClick={removeBlock}
                    disabled={blocks.length === 1}
                  >
                    Delete
                  </button>
                </div>
                <div className='mt-4 space-y-3'>
                  {(choice.type === "paragraph" ||
                    choice.type === "heading" ||
                    choice.type === "pullquote" ||
                    choice.type === "quote") && (
                    <label className='block text-xs font-black'>
                      Text
                      <textarea
                        value={choice.text}
                        rows={6}
                        onChange={(e) =>
                          setBlock(selected, {
                            ...choice,
                            text: e.target.value,
                          } as ArticleBlock)
                        }
                        className={field}
                      />
                    </label>
                  )}
                  {choice.type === "heading" && (
                    <label className='block text-xs font-black'>
                      Heading level
                      <select
                        value={choice.level}
                        onChange={(e) =>
                          setBlock(selected, {
                            ...choice,
                            level: Number(e.target.value) as 2 | 3,
                          })
                        }
                        className={field}
                      >
                        <option value={2}>H2</option>
                        <option value={3}>H3</option>
                      </select>
                    </label>
                  )}
                  {choice.type === "list" && (
                    <label className='block text-xs font-black'>
                      List items (one per line)
                      <textarea
                        rows={5}
                        value={choice.items.join("\n")}
                        onChange={(e) =>
                          setBlock(selected, {
                            ...choice,
                            items: e.target.value.split("\n"),
                          })
                        }
                        className={field}
                      />
                    </label>
                  )}
                  {mediaFields(choice) && (
                    <>
                      {(
                        [
                          "src",
                          "alt",
                          "caption",
                          "credit",
                          "sourceUrl",
                        ] as const
                      ).map((k) => (
                        <label className='block text-xs font-black' key={k}>
                          {
                            {
                              src: "Image URL (HTTPS or /assets)",
                              alt: "Alt text (required)",
                              caption: "Caption",
                              credit: "Credit / license (required)",
                              sourceUrl: "Original source / license URL",
                            }[k]
                          }
                          <input
                            className={field}
                            value={choice[k] || ""}
                            onChange={(e) =>
                              setBlock(selected, {
                                ...choice,
                                [k]: e.target.value,
                              })
                            }
                          />
                        </label>
                      ))}
                      <p className='text-xs text-ink/70'>
                        Use only images you own or have permission to publish.
                        Credit alone is not permission.
                      </p>
                      {choice.type === "split" && (
                        <>
                          <label className='block text-xs font-black'>
                            Text alongside image
                            <textarea
                              className={field}
                              rows={5}
                              value={choice.text}
                              onChange={(e) =>
                                setBlock(selected, {
                                  ...choice,
                                  text: e.target.value,
                                })
                              }
                            />
                          </label>
                          <label className='block text-xs font-black'>
                            Image position
                            <select
                              className={field}
                              value={choice.position}
                              onChange={(e) =>
                                setBlock(selected, {
                                  ...choice,
                                  position: e.target.value as "left" | "right",
                                })
                              }
                            >
                              <option value='left'>Left</option>
                              <option value='right'>Right</option>
                            </select>
                          </label>
                        </>
                      )}
                    </>
                  )}
                  {choice.type === "imageIdea" && (
                    <>
                      <label className='block text-xs font-black'>
                        Suggested visual
                        <textarea
                          className={field}
                          rows={5}
                          value={choice.prompt}
                          onChange={(e) =>
                            setBlock(selected, {
                              ...choice,
                              prompt: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className='block text-xs font-black'>
                        Placement note
                        <input
                          className={field}
                          value={choice.placementNote || ""}
                          onChange={(e) =>
                            setBlock(selected, {
                              ...choice,
                              placementNote: e.target.value,
                            })
                          }
                        />
                      </label>
                      <button
                        type='button'
                        className={`${btn} w-full bg-sun`}
                        onClick={() => setBlock(selected, blankBlock("image"))}
                      >
                        Replace idea with image
                      </button>
                    </>
                  )}
                </div>
                {(choice.type === "paragraph" ||
                  choice.type === "heading" ||
                  choice.type === "split") && (
                  <div className='mt-5 border-t-2 border-ink pt-4'>
                    <p className='text-sm font-black'>Suggest a rewrite</p>
                    <p className='mt-1 text-xs'>
                      Uses a single paid request to the budget model. Nothing is
                      changed until you accept and save.
                    </p>
                    <textarea
                      className={`${field} mt-3`}
                      rows={3}
                      value={rewriteInstruction}
                      onChange={(e) => setRewriteInstruction(e.target.value)}
                      placeholder='Tighten this paragraph without changing the facts…'
                    />
                    <button
                      type='button'
                      className={`${btn} mt-2 w-full bg-lilac`}
                      disabled={working || !rewriteInstruction.trim()}
                      onClick={requestRewrite}
                    >
                      {working ? "Rewriting…" : "Suggest rewrite"}
                    </button>
                    {rewriteError && (
                      <p role='alert' className='mt-3 text-xs text-pop-red'>
                        {rewriteError}
                      </p>
                    )}
                    {proposed && (
                      <div className='mt-3 border-2 border-ink bg-white p-3 text-sm'>
                        <strong className='text-xs uppercase'>
                          Suggested replacement
                        </strong>
                        <p className='mt-2 whitespace-pre-wrap'>{proposed}</p>
                        <p className='mt-1 text-xs text-ink/70'>
                          {rewriteCost === null
                            ? "Cost not available"
                            : `Estimated API cost $${rewriteCost.toFixed(4)}`}
                        </p>
                        <button
                          type='button'
                          onClick={acceptRewrite}
                          className={`${btn} mt-3 bg-sun`}
                        >
                          Use this suggestion
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {!readOnly && (
          <div className='border-[3px] border-pop-red bg-card p-5'>
            <strong className='text-xs font-black uppercase'>
              Scrap article
            </strong>
            <p className='my-2 text-xs'>
              Archives this unpublished draft and preserves its history. This
              cannot be undone here.
            </p>
            <button
              type='button'
              className={`${btn} bg-white`}
              disabled={working}
              onClick={() => {
                if (
                  !window.confirm(
                    "Archive this entire draft? It will leave the review inbox, and its version history will be retained.",
                  )
                )
                  return;
                startTransition(async () => {
                  try {
                    await scrapUnpublishedArticle(articleId);
                  } catch (e) {
                    setRewriteError(
                      e instanceof Error ? e.message : "Could not archive",
                    );
                  }
                });
              }}
            >
              Archive / scrap draft
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
