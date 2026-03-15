---
name: nextjs-patterns
description: Next.js 15 App Router patterns, server components, and data fetching conventions
---

# Next.js 15 Patterns

## App Router Structure
```
src/app/
├── layout.tsx          # Root layout (RTL support, providers, fonts)
├── page.tsx            # Landing page
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (dashboard)/
│   ├── layout.tsx      # Dashboard shell (sidebar, header)
│   ├── page.tsx        # Overview dashboard
│   ├── facebook/page.tsx
│   ├── instagram/page.tsx
│   ├── accounts/[id]/page.tsx
│   └── posts/[id]/page.tsx
└── api/                # API routes (if needed for BFF)
```

## Data Fetching
- Server Components fetch data directly — no `useEffect` for initial data
- Use `fetch()` with Next.js caching in Server Components
- Client Components use SWR or React Query for real-time updates
- All API calls authenticated via `lib/api.ts` centralized client

## API Client Pattern
```typescript
// lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAccessToken(); // from cookie or context
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  });
  if (!res.ok) throw new ApiError(res.status, await res.json());
  return res.json();
}
```

## ECharts Integration
```typescript
// components/charts/EngagementChart.tsx
"use client";
import ReactECharts from "echarts-for-react";

interface EngagementChartProps {
  data: { date: string; value: number }[];
  loading?: boolean;
}

export function EngagementChart({ data, loading }: EngagementChartProps) {
  const option = {
    xAxis: { type: "category", data: data.map(d => d.date) },
    yAxis: { type: "value" },
    series: [{ data: data.map(d => d.value), type: "line", smooth: true }],
    tooltip: { trigger: "axis" },
  };
  return <ReactECharts option={option} showLoading={loading} />;
}
```

## RTL Support
- Root layout sets `dir` attribute based on locale
- Use logical CSS properties: `margin-inline-start` not `margin-left`
- Test every component with `dir="rtl"` applied
- Tailwind: use `rtl:` variant for RTL-specific overrides
