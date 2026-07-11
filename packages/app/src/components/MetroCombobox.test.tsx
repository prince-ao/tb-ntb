import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MetroCombobox } from "./MetroCombobox";
import type { ContractMetro } from "@/lib/contract";

const m = (slug: string, name: string, state: string): ContractMetro => ({
  slug, name, state, regionId: "0", homeValue: 1, monthlyRent: 1, propertyTaxRate: 0,
});
const METROS = [
  m("austin-tx", "Austin, TX", "TX"),
  m("austin-mn", "Austin, MN", "MN"),
  m("dallas-tx", "Dallas, TX", "TX"),
  m("cleveland-oh", "Cleveland, OH", "OH"),
];

function setup(value = "cleveland-oh") {
  const onChange = vi.fn();
  render(<MetroCombobox metros={METROS} value={value} onChange={onChange} />);
  return { onChange, user: userEvent.setup() };
}

describe("MetroCombobox", () => {
  // @spec APP-UI-001
  it("shows the current metro on the trigger", () => {
    setup("austin-tx");
    expect(screen.getByRole("combobox").textContent).toContain("Austin, TX");
  });

  // @spec APP-UI-001
  it("opens, lists metros, and selecting one reports its slug", async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Dallas, TX"));
    expect(onChange).toHaveBeenCalledWith("dallas-tx");
  });

  // @spec APP-UI-008
  it("filters the list as the user types", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText(/search/i), "dallas");
    expect(await screen.findByText("Dallas, TX")).toBeTruthy();
    expect(screen.queryByText("Austin, MN")).toBeNull();
  });

  // @spec APP-UI-011
  it("shows a 'no metro found' message when nothing matches", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText(/search/i), "zzzzz");
    expect(await screen.findByText(/no metro found/i)).toBeTruthy();
  });

  // @spec APP-UI-010
  it("is keyboard operable — type, arrow, Enter selects", async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText(/search/i), "dallas");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("dallas-tx");
  });
});
