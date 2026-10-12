import { useMemo, useRef, useState } from "react";
import { CAMPAIGN_FONTS } from "../lib/fonts.js";
import { FontFaces } from "./FontFaces.jsx";

export function FontField({ value, disabled, onChange }) {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const selected = CAMPAIGN_FONTS.includes(value) ? value : CAMPAIGN_FONTS[0];
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!searching || !needle) return CAMPAIGN_FONTS;
    return CAMPAIGN_FONTS.filter((font) => font.toLowerCase().includes(needle));
  }, [query, searching]);

  function openList() {
    setOpen(true);
    setSearching(false);
    setQuery("");
    setActive(Math.max(0, CAMPAIGN_FONTS.indexOf(selected)));
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  function closeList() {
    setOpen(false);
    setSearching(false);
    setQuery("");
  }

  function choose(font) {
    onChange(font);
    closeList();
    inputRef.current?.focus();
  }

  function toggleList(event) {
    event.preventDefault();
    if (disabled) return;
    if (open) closeList();
    else openList();
  }

  function onKeyDown(event) {
    if (disabled) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, Math.max(matches.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      if (matches[active]) choose(matches[active]);
    } else if (event.key === "Escape") {
      closeList();
    }
  }

  return (
    <div className="font-field">
      <FontFaces families={CAMPAIGN_FONTS} />
      <label htmlFor="campaign-font">Font</label>
      <div className="font-control">
        <input
          ref={inputRef}
          id="campaign-font"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="campaign-font-list"
          aria-activedescendant={open && matches[active] ? `campaign-font-${active}` : undefined}
          disabled={disabled}
          value={open && searching ? query : selected}
          style={open && searching ? undefined : { fontFamily: `"${selected}"` }}
          onFocus={() => {
            if (disabled || open) return;
            openList();
          }}
          onClick={() => {
            if (disabled || open) return;
            openList();
          }}
          onBlur={() => closeList()}
          onChange={(event) => {
            setSearching(true);
            setQuery(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className={open ? "font-toggle is-open" : "font-toggle"}
          aria-label={open ? "Close font list" : "Open font list"}
          disabled={disabled}
          onMouseDown={toggleList}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5.5 7.5 10 12.5 14.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <ul
        id="campaign-font-list"
        className={open && !disabled ? "font-menu is-open" : "font-menu"}
        role="listbox"
        aria-hidden={!open || disabled}
        inert={!open || disabled ? true : undefined}
      >
        {matches.length === 0 ? (
          <li className="font-empty">No fonts match that search.</li>
        ) : (
          matches.map((font, index) => (
            <li key={font} role="presentation">
              <button
                id={`campaign-font-${index}`}
                type="button"
                role="option"
                aria-selected={font === selected}
                className={index === active ? "font-option is-active" : "font-option"}
                style={{ fontFamily: `"${font}", sans-serif` }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(font);
                }}
                onMouseEnter={() => setActive(index)}
              >
                {font}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
