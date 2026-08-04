"use client";

import { notFound } from "next/navigation";
import { use } from "react";
import { HelpArticleScreen } from "@/features/help/help-article-screen";
import { findHelpArticle } from "@/features/help/help-articles";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";

export default function AyudaArticuloPage({
  params,
}: {
  params: Promise<{ tema: string }>;
}) {
  const { tema } = use(params);
  const article = findHelpArticle(tema);
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();

  if (!article) notFound();

  return <HelpArticleScreen article={article} onNavigate={onNavigate} onSignOut={onSignOut} />;
}
