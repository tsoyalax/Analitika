"use client";

import { useState } from "react";
import { Globe, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { mergeTariffs, type Product, type Tariff } from "@/lib/products";
import { productFromSite } from "@/lib/site-client";

const input =
  "h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring";

/** Продукт и тарифы: подтянуть со страницы продаж и/или поправить вручную. */
export function ProductSheet({
  open,
  onOpenChange,
  product,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  onSave: (p: Product) => Promise<void>;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Продукт и тарифы</SheetTitle>
          <SheetDescription>
            Дайте ссылку на сайт продаж — подтяну название и цены тарифов. По ним считаются выручка и средний чек.
          </SheetDescription>
        </SheetHeader>
        {open && <ProductBody product={product} onSave={onSave} />}
      </SheetContent>
    </Sheet>
  );
}

type Row = { id: string; name: string; price: string };

const toRows = (tariffs: Tariff[]): Row[] => tariffs.map((t) => ({ id: t.id, name: t.name, price: String(t.price) }));

function ProductBody({ product, onSave }: { product: Product; onSave: (p: Product) => Promise<void> }) {
  const [url, setUrl] = useState(product.url);
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [rows, setRows] = useState<Row[]>(toRows(product.tariffs));
  const [notes, setNotes] = useState<string | null>(null);
  const [busy, setBusy] = useState<"site" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pull() {
    setBusy("site");
    setError(null);
    setNotes(null);
    try {
      const r = await productFromSite(url);
      setUrl(r.url);
      if (r.name) setName(r.name);
      if (r.description) setDescription(r.description);
      if (r.tariffs.length) setRows(toRows(mergeTariffs(product.tariffs, r.tariffs)));
      setNotes(r.tariffs.length ? r.notes : `Цены не нашёл. ${r.notes}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const tariffs = rows
      .map((r) => ({ id: r.id, name: r.name.trim(), price: Number(r.price.replace(/[\s ]/g, "").replace(",", ".")) }))
      .filter((t) => t.name);
    if (tariffs.some((t) => !Number.isFinite(t.price) || t.price <= 0)) return setError("У каждого тарифа нужна цена.");
    if (!tariffs.length) return setError("Добавьте хотя бы один тариф.");
    setBusy("save");
    setError(null);
    try {
      await onSave({ name: name.trim(), url: url.trim(), description: description.trim(), tariffs });
    } catch (err) {
      setError((err as Error).message || "Не удалось сохранить.");
    } finally {
      setBusy(null);
    }
  }

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <form onSubmit={save} className="space-y-5 px-4 pb-6">
      <div className="space-y-2">
        <span className="text-sm font-medium">Сайт продаж</span>
        <div className="flex gap-2">
          <input
            className={input}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            inputMode="url"
          />
          <Button type="button" variant="outline" size="sm" onClick={pull} disabled={busy !== null || !url.trim()}>
            {busy === "site" ? <Loader2 className="animate-spin" /> : <Globe />} Подтянуть
          </Button>
        </div>
        {notes && (
          <div className="rounded-lg border border-indigo-400/40 bg-indigo-400/5 px-3 py-2 text-xs">
            <div className="font-medium">Подтянуто с сайта — проверьте и сохраните.</div>
            <div className="mt-1 text-muted-foreground">{notes}</div>
          </div>
        )}
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Продукт</span>
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Описание — его учитывает AI-ассистент</span>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-20 text-sm" />
      </label>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Тарифы</legend>
        {rows.map((r, i) => (
          <div key={r.id} className="grid grid-cols-[1fr_7rem_auto] items-center gap-2">
            <input className={input} value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} placeholder="Название" />
            <div className="relative">
              <input
                className={`${input} pr-6 tabular-nums`}
                inputMode="numeric"
                value={r.price}
                onChange={(e) => setRow(i, { price: e.target.value })}
                placeholder="Цена"
              />
              <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">₽</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
              aria-label="Удалить тариф"
            >
              <X />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setRows((rs) => [...rs, { id: `t-${crypto.randomUUID().slice(0, 8)}`, name: "", price: "" }])}
        >
          <Plus /> Тариф
        </Button>
      </fieldset>

      <p className="text-xs text-muted-foreground">
        Продажи в уже введённых периодах сохраняются для тарифов с тем же названием. Если тариф переименовать или удалить,
        его продажи перестанут учитываться.
      </p>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy !== null}>
        {busy === "save" && <Loader2 className="animate-spin" />} Сохранить
      </Button>
    </form>
  );
}
