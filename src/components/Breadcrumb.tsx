import React from "react";
import { Box, Text } from "ink";

interface BreadcrumbProps {
  items: string[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Box>
      <Text dimColor>{"  "}</Text>
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <Text dimColor> &gt; </Text>}
          <Text color={idx === items.length - 1 ? "white" : "gray"}>
            {item}
          </Text>
        </React.Fragment>
      ))}
    </Box>
  );
}
