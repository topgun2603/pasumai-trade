"use client";

import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * The three things "history" means to somebody on this platform.
 *
 * They were in three places — an audit trail under the profile, a price chart
 * behind a rail item called Prices, and settled bargains on the logistics
 * page. Somebody asking "what has this crop been worth" had to know which of
 * the three to open, and the answer depended on whether they wanted a number,
 * a shape, or a record of who changed it.
 *
 * One page, three tabs. The tabs are client state and nothing else is: each
 * panel is a server-rendered child handed in, so switching tabs costs no round
 * trip and the whole page still renders without JavaScript running.
 */
export function HistoryTabs({
  actions,
  bargains,
  prices,
  labels,
}: {
  actions: ReactNode;
  bargains: ReactNode;
  prices: ReactNode;
  labels: { actions: string; bargains: string; prices: string };
}) {
  return (
    <Tabs defaultValue="bargains" className="flex flex-col gap-5">
      <TabsList>
        {/*
          Bargains first and selected by default. It is the question actually
          asked — what did I sell and for how much — where the audit trail
          answers a question somebody only has when something looks wrong.
        */}
        <TabsTrigger value="bargains">{labels.bargains}</TabsTrigger>
        <TabsTrigger value="prices">{labels.prices}</TabsTrigger>
        <TabsTrigger value="actions">{labels.actions}</TabsTrigger>
      </TabsList>

      <TabsContent value="bargains">{bargains}</TabsContent>
      <TabsContent value="prices">{prices}</TabsContent>
      <TabsContent value="actions">{actions}</TabsContent>
    </Tabs>
  );
}
