// Local copy of ink-text-input with Home/End key support
// Original: https://github.com/vadimdemedes/ink-text-input
import React, { useState, useEffect } from "react";
import { Text, useInput } from "ink";
import chalk from "chalk";

interface TextInputProps {
  value: string;
  placeholder?: string;
  focus?: boolean;
  mask?: string;
  highlightPastedText?: boolean;
  showCursor?: boolean;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
}

function TextInput({
  value: originalValue,
  placeholder = "",
  focus = true,
  mask,
  highlightPastedText = false,
  showCursor = true,
  onChange,
  onSubmit,
}: TextInputProps) {
  const [state, setState] = useState({
    cursorOffset: (originalValue || "").length,
    cursorWidth: 0,
  });

  const { cursorOffset, cursorWidth } = state;

  useEffect(() => {
    setState((previousState) => {
      if (!focus || !showCursor) {
        return previousState;
      }

      const newValue = originalValue || "";

      if (previousState.cursorOffset > newValue.length - 1) {
        return {
          cursorOffset: newValue.length,
          cursorWidth: 0,
        };
      }

      return previousState;
    });
  }, [originalValue, focus, showCursor]);

  const cursorActualWidth = highlightPastedText ? cursorWidth : 0;
  const value = mask ? mask.repeat(originalValue.length) : originalValue;
  let renderedValue = value;
  let renderedPlaceholder = placeholder ? chalk.grey(placeholder) : undefined;

  // Fake mouse cursor
  if (showCursor && focus) {
    renderedPlaceholder =
      placeholder.length > 0
        ? chalk.inverse(placeholder[0]) + chalk.grey(placeholder.slice(1))
        : chalk.inverse(" ");

    renderedValue = value.length > 0 ? "" : chalk.inverse(" ");

    let i = 0;
    for (const char of value) {
      renderedValue +=
        i >= cursorOffset - cursorActualWidth && i <= cursorOffset
          ? chalk.inverse(char)
          : char;
      i++;
    }

    if (value.length > 0 && cursorOffset === value.length) {
      renderedValue += chalk.inverse(" ");
    }
  }

  useInput(
    (input, key) => {
      // Skip navigation keys handled by parent
      if (
        key.upArrow ||
        key.downArrow ||
        (key.ctrl && input === "c") ||
        key.tab ||
        (key.shift && key.tab)
      ) {
        return;
      }

      if (key.return) {
        if (onSubmit) {
          onSubmit(originalValue);
        }
        return;
      }

      let nextCursorOffset = cursorOffset;
      let nextValue = originalValue;
      let nextCursorWidth = 0;

      // Home key detection (various terminal escape sequences)
      // \x1b[H, \x1b[1~, \x1b[7~, or just the raw sequence in input
      if (
        input === "\x1b[H" ||
        input === "\x1b[1~" ||
        input === "\x1b[7~" ||
        input.includes("\x1b[H") ||
        input.includes("\x1b[1~") ||
        input.includes("\x1b[7~")
      ) {
        if (showCursor) {
          nextCursorOffset = 0;
        }
        setState({
          cursorOffset: nextCursorOffset,
          cursorWidth: nextCursorWidth,
        });
        return;
      }

      // End key detection (various terminal escape sequences)
      // \x1b[F, \x1b[4~, \x1b[8~
      if (
        input === "\x1b[F" ||
        input === "\x1b[4~" ||
        input === "\x1b[8~" ||
        input.includes("\x1b[F") ||
        input.includes("\x1b[4~") ||
        input.includes("\x1b[8~")
      ) {
        if (showCursor) {
          nextCursorOffset = originalValue.length;
        }
        setState({
          cursorOffset: nextCursorOffset,
          cursorWidth: nextCursorWidth,
        });
        return;
      }

      if (key.leftArrow) {
        if (showCursor) {
          nextCursorOffset--;
        }
      } else if (key.rightArrow) {
        if (showCursor) {
          nextCursorOffset++;
        }
      } else if (key.backspace || key.delete) {
        if (cursorOffset > 0) {
          nextValue =
            originalValue.slice(0, cursorOffset - 1) +
            originalValue.slice(cursorOffset, originalValue.length);
          nextCursorOffset--;
        }
      } else {
        // Regular text input - filter out any escape sequences
        const filteredInput = input.replace(/\x1b\[[^\x1b]*$/g, "");
        if (filteredInput.length > 0) {
          nextValue =
            originalValue.slice(0, cursorOffset) +
            filteredInput +
            originalValue.slice(cursorOffset, originalValue.length);
          nextCursorOffset += filteredInput.length;

          if (filteredInput.length > 1) {
            nextCursorWidth = filteredInput.length;
          }
        }
      }

      // Clamp cursor position
      if (nextCursorOffset < 0) {
        nextCursorOffset = 0;
      }
      if (nextCursorOffset > nextValue.length) {
        nextCursorOffset = nextValue.length;
      }

      setState({
        cursorOffset: nextCursorOffset,
        cursorWidth: nextCursorWidth,
      });

      if (nextValue !== originalValue) {
        onChange(nextValue);
      }
    },
    { isActive: focus }
  );

  return (
    <Text>
      {placeholder
        ? value.length > 0
          ? renderedValue
          : renderedPlaceholder
        : renderedValue}
    </Text>
  );
}

export default TextInput;
