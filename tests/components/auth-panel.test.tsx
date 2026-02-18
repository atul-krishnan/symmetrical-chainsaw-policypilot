import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthPanel } from "@/components/product/auth-panel";

describe("AuthPanel", () => {
  it("renders auth actions", () => {
    render(<AuthPanel />);

    expect(screen.getByRole("button", { name: /Continue with Google/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send Magic Link/i })).toBeInTheDocument();
  });
});
