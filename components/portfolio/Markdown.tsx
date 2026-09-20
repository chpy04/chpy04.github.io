import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

interface MarkdownProps {
  children: string;
  /** Inherit the surrounding font size, line height and spacing, for a
   *  description that sits inside a card rather than being an article of
   *  its own. See `.prose-inherit` in app/globals.css. */
  compact?: boolean;
  className?: string;
}

/**
 * The one place markdown is rendered, so the sanitisation settings are
 * written once.
 *
 * `rehypeSanitize` **without** `rehypeRaw`: raw HTML in the source is
 * escaped, not parsed. The content is the site owner's own and nobody
 * else's, so this is not a defence against an attacker — it is a defence
 * against a half-typed `<` in a write-up silently eating the next
 * paragraph.
 */
export default function Markdown({ children, compact = false, className = '' }: MarkdownProps) {
  const prose = compact
    ? 'prose prose-invert prose-inherit max-w-none'
    : 'prose prose-sm prose-invert max-w-none tablet:prose-base';

  return (
    <div
      className={`${prose} prose-headings:text-ink prose-p:text-ink-dim prose-a:text-accent prose-a:transition-colors hover:prose-a:text-accent-soft prose-strong:text-ink-soft prose-code:text-ink-dim prose-pre:bg-surface-deep prose-img:rounded-lg ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
