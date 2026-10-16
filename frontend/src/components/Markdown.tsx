import ReactMarkdown from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { isAllowedHttpUrl } from "../lib/limits";

const schema = {
  ...defaultSchema,
  tagNames: (defaultSchema.tagNames ?? []).filter(
    (t) =>
      ![
        "img",
        "iframe",
        "script",
        "video",
        "audio",
        "source",
        "object",
        "embed",
      ].includes(t),
  ),
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https"],
  },
};

export function Markdown({ source }: { source: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        rehypePlugins={[[rehypeSanitize, schema]]}
        components={{
          a: ({ href, children }) =>
            href && isAllowedHttpUrl(href) ? (
              <a href={href} rel="noopener noreferrer" target="_blank">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
          img: () => null,
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
