import { AppBreadcrumbs } from "@/components/AppBreadcrumbs";
import { AppHeaderContent } from "../shell/Header/Header";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/logic/db";
import { useMemo } from "react";
import { Rating, State } from "fsrs.js";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { Paper } from "@/components/ui";

function StatsView() {
  const allStats = useLiveQuery(() => db.statistics.toArray());

  const chartData = useMemo(() => {
    if (!allStats) return [];

    const groupedByDay: Record<string, any> = {};

    allStats.forEach((stat) => {
      if (!groupedByDay[stat.day]) {
        groupedByDay[stat.day] = {
          day: stat.day,
          totalNew: 0,
          totalReview: 0,
          totalLearning: 0,
          totalRelearning: 0,
          totalTimeMin: 0,
          retentionNumerator: 0,
          retentionDenominator: 0,
        };
      }
      const g = groupedByDay[stat.day];
      g.totalNew += stat.cards[State.New] || 0;
      g.totalReview += stat.cards[State.Review] || 0;
      g.totalLearning += stat.cards[State.Learning] || 0;
      g.totalRelearning += stat.cards[State.Relearning] || 0;
      g.totalTimeMin += stat.time.total / 1000 / 60; // Total time in minutes

      // Retention: (Good + Easy) / Total
      if (stat.ratingsList && stat.ratingsList.length > 0) {
        g.retentionDenominator += stat.ratingsList.length;
        g.retentionNumerator += stat.ratingsList.filter(
          (r) => r === Rating.Good || r === Rating.Easy
        ).length;
      }
    });

    const dataArray = Object.values(groupedByDay).sort((a, b) =>
      a.day.localeCompare(b.day)
    );

    return dataArray.map((d) => ({
      ...d,
      retentionRate:
        d.retentionDenominator > 0
          ? Math.round((d.retentionNumerator / d.retentionDenominator) * 100)
          : 0,
      totalTimeMin: Math.round(d.totalTimeMin * 10) / 10,
    }));
  }, [allStats]);

  const globalStats = useMemo(() => {
    let totalCardsReviewed = 0;
    let totalTimeMin = 0;
    let retentionNumerator = 0;
    let retentionDenominator = 0;

    chartData.forEach((d) => {
      totalCardsReviewed +=
        d.totalNew + d.totalReview + d.totalLearning + d.totalRelearning;
      totalTimeMin += d.totalTimeMin;
      retentionNumerator += d.retentionNumerator;
      retentionDenominator += d.retentionDenominator;
    });

    return {
      totalCardsReviewed,
      totalTimeMin: Math.round(totalTimeMin),
      averageRetention:
        retentionDenominator > 0
          ? Math.round((retentionNumerator / retentionDenominator) * 100)
          : 0,
    };
  }, [chartData]);

  return (
    <>
      <AppHeaderContent>
        <AppBreadcrumbs segments={[{ label: "Statistics" }]} />
      </AppHeaderContent>
      <div
        style={{
          width: "100%",
          maxWidth: "var(--max-content-width)",
          color: "var(--theme-neutral-700)",
          margin: "0 auto",
          padding: "20px 0",
        }}
      >
        <h1 style={{ fontFamily: "var(--font-serif)", marginBottom: "2rem" }}>
          Your Study Statistics
        </h1>

        {chartData.length === 0 ? (
          <p>No study statistics available yet. Start studying to see data here!</p>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1rem",
                marginBottom: "2rem",
              }}
            >
              <Paper withBorder style={{ padding: "1.5rem" }}>
                <div style={{ fontSize: "0.875rem", color: "var(--theme-neutral-500)" }}>
                  Total Cards Studied
                </div>
                <div style={{ fontSize: "2rem", fontWeight: "bold" }}>
                  {globalStats.totalCardsReviewed}
                </div>
              </Paper>
              <Paper withBorder style={{ padding: "1.5rem" }}>
                <div style={{ fontSize: "0.875rem", color: "var(--theme-neutral-500)" }}>
                  Total Study Time
                </div>
                <div style={{ fontSize: "2rem", fontWeight: "bold" }}>
                  {globalStats.totalTimeMin} min
                </div>
              </Paper>
              <Paper withBorder style={{ padding: "1.5rem" }}>
                <div style={{ fontSize: "0.875rem", color: "var(--theme-neutral-500)" }}>
                  Average Retention
                </div>
                <div style={{ fontSize: "2rem", fontWeight: "bold" }}>
                  {globalStats.averageRetention}%
                </div>
              </Paper>
            </div>

            <h2 style={{ fontFamily: "var(--font-serif)", marginTop: "2rem" }}>
              Cards Studied per Day
            </h2>
            <Paper withBorder style={{ padding: "1rem", height: "300px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="totalNew" stackId="a" name="New" fill="#3b82f6" />
                  <Bar dataKey="totalLearning" stackId="a" name="Learning" fill="#f59e0b" />
                  <Bar dataKey="totalReview" stackId="a" name="Review" fill="#10b981" />
                  <Bar dataKey="totalRelearning" stackId="a" name="Relearning" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>

            <h2 style={{ fontFamily: "var(--font-serif)", marginTop: "2rem" }}>
              Retention Rate (%)
            </h2>
            <Paper withBorder style={{ padding: "1rem", height: "300px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis domain={[0, 100]} />
                  <RechartsTooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="retentionRate"
                    name="Retention (%)"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
            
            <h2 style={{ fontFamily: "var(--font-serif)", marginTop: "2rem" }}>
              Study Time (Minutes)
            </h2>
            <Paper withBorder style={{ padding: "1rem", height: "300px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="totalTimeMin"
                    name="Minutes"
                    stroke="#14b8a6"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </>
        )}
      </div>
    </>
  );
}

export default StatsView;
