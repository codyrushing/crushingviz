import { onCleanup, Show } from "solid-js";
import type { JSX } from "solid-js";
import { isServer } from "solid-js/web";

type ModalProps = {
  /** Text of the trigger link shown in the page. */
  label?: string;
  labelClass?: string;
  /** Heading shown at the top of the modal. */
  title?: string;
  /** Pre-rendered HTML (parsed from markdown at build time) shown in the modal body. */
  html?: string;
  /** JSX content for the modal body; takes precedence over `html`. */
  children?: JSX.Element;
};

/**
 * Minimal link-triggered modal built on the native <dialog> element.
 * showModal() provides top-layer rendering, a ::backdrop, native Escape
 * handling, and a focus trap for free. The body content is markdown parsed
 * to HTML at module load (see the per-viz *SourcesModal.tsx files and
 * utils/string.ts) and passed in via `html`. Content is authored in-repo,
 * so no sanitization is needed.
 */
export function Modal(props: ModalProps) {
  let dialogEl!: HTMLDialogElement | undefined;

  const open = () => {
    dialogEl?.showModal();
    // Lock body scroll while the modal is open.
    document.body.style.overflow = "hidden";
  };
  const close = () => dialogEl?.close();

  // The native `close` event fires for the close button, backdrop clicks,
  // and Escape, so this is the single scroll-restore point.
  const onClose = () => {
    document.body.style.overflow = "";
  };
  onCleanup(() => {
    if (isServer) return;
    document.body.style.overflow = "";
  });

  return (
    <div class="flex justify-end">
      <button
        type="button"
        class={props.labelClass}
        onClick={open}
      >
        {props.label ?? "Sources"}
      </button>
      <dialog
        ref={dialogEl}
        class="modal-dialog font-sans text-foreground open:flex flex-col m-auto bg-background border border-border rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] p-0"
        onClick={(e) => {
          // Clicks on the ::backdrop hit-test to the dialog element itself,
          // so a click whose target is the dialog (not one of its children)
          // is an "outside" click.
          if (e.target === dialogEl) close();
        }}
        onClose={onClose}
      >
        <div class="flex items-start justify-between gap-4 p-5 pb-3">
          <h2 class="font-serif font-bold text-lg md:text-xl">{props.title}</h2>
          <button
            type="button"
            class="text-muted hover:text-foreground cursor-pointer"
            aria-label="Close"
            onClick={close}
          >
            ✕
          </button>
        </div>
        <div class="modal-markdown overflow-y-auto px-5 pb-5">
          <Show when={props.children} fallback={<div innerHTML={props.html} />}>
            {props.children}
          </Show>
        </div>
      </dialog>
    </div>
  );
}
