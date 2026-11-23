"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { mesos, fullMesos } from "@/lib/format";

export function ValueChart({ data }: { data: { day: string; value: number }[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-sm text-[var(--muted)]">
        Your value history appears here once there are two days of snapshots.
      </div>
    );
  }
  const up = data[data.length - 1].value >= data[0].value;
  const color = up ? "var(--up)" : "var(--down)";
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="day"
            tickFormatter={(d: string) => d.slice(5)}
            stroke="var(--muted)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v: number) => mesos(v)}
            stroke="var(--muted)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
            labelStyle={{ color: "var(--muted)" }}
            formatter={(v) => [fullMesos(Number(v)), "Value"]}
          />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill="url(#valueFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
