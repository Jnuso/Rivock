import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Markdown } from "./Markdown";

describe("Markdown safety", () => {
  it("renders safe links and strips disallowed protocols/images", () => {
    render(
      <Markdown
        source={
          "Hello [ok](https://example.com) [bad](javascript:alert(1)) ![x](https://evil.test/a.png) <img src=x onerror=alert(1)>"
        }
      />,
    );
    const ok = screen.getByRole("link", { name: "ok" });
    expect(ok).toHaveAttribute("href", "https://example.com");
    expect(screen.queryByRole("link", { name: "bad" })).toBeNull();
    expect(screen.getByText("bad")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});
