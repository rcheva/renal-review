import App from "@/App";
import DeckView from "@/app/deck/DeckView";
import NewNotesView from "@/app/editor/NewNotesView";
import NoteExplorerView from "@/app/explorer/NoteExplorerView";
import HomeView from "@/app/home/HomeView";
import ImportView from "@/app/import/ImportView";
import LearnView from "@/app/learn/LearnView/LearnView";
import SettingsView from "@/app/settings/SettingsView";
import StatsView from "@/app/statistics/StatsView";
import PollingDashboard from "@/app/polling/PollingDashboard";
import EditPollView from "@/app/polling/EditPollView";
import LiveResultsView from "@/app/polling/LiveResultsView";
import StudentPollView from "@/app/polling/StudentPollView";
import NotebookLMView from "@/app/ai/NotebookLMView";
import React from "react";
import ReactDOM from "react-dom/client";
import { Navigate, RouterProvider, createHashRouter } from "react-router-dom";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
const router = createHashRouter(
  [
    {
      element: <App />,
      children: [
        {
          index: true,
          element: <Navigate to="/home" replace={true} />,
        },
        {
          path: "/home",
          element: <HomeView />,
        },
        {
          path: "/settings/:section?",
          element: <SettingsView />,
        },
        {
          path: "/deck/:deckId",
          element: <DeckView />,
        },
        {
          path: "/deck/:deckId/:params",
          element: <DeckView />,
        },
        {
          path: "/new/:deckId?",
          element: <NewNotesView />,
        },
        {
          path: "/learn/:deckId/:params?",
          element: <LearnView />,
        },
        {
          path: "/notes",
          element: <NoteExplorerView />,
        },
        {
          path: "/import",
          element: <ImportView />,
        },
        {
          path: "/ai",
          element: <NotebookLMView />,
        },
        {
          path: "/stats/:deckId?",
          element: <StatsView />,
        },
        {
          path: "/polling",
          element: <PollingDashboard />,
        },
        {
          path: "/polling/edit/:pollId",
          element: <EditPollView />,
        },
        {
          path: "/polling/live/:pollId",
          element: <LiveResultsView />,
        },
      ],
    },
    {
      path: "/poll/:pollId",
      element: <StudentPollView />,
    },
  ],
  { basename: "/" }
);

root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js")
    .then((registration) => {
      console.log("Service Worker registered with scope:", registration.scope);
    })
    .catch((error) => {
      console.error("Service Worker registration failed:", error);
    });
}

async function persist() {
  return (
    navigator.storage &&
    navigator.storage.persist &&
    navigator.storage.persist()
  );
}

async function isStoragePersisted() {
  return (
    navigator.storage &&
    navigator.storage.persisted &&
    navigator.storage.persisted()
  );
}

isStoragePersisted().then(async (isPersisted) => {
  if (!isPersisted) {
    console.warn("Storage is not persistant. Trying to make it persistant...");
    if (await persist()) {
      console.log("Successfully made storage persisted");
    } else {
      console.warn("Failed to make storage persisted");
      navigator.userAgent.includes("Safari") &&
        console.info(
          "You are using Safari, storage may be cleared after 7 days of inactivity: https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/"
        );
    }
  }
});
