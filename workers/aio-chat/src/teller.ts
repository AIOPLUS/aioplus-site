import { DurableObject } from 'cloudflare:workers';

/**
 * Teller van de AIO-chat: één exemplaar voor de hele chat, zodat alle verzoeken dezelfde stand zien.
 * Houdt per dag (UTC) bij hoeveel de chat heeft gekost en hoeveel vragen elke bezoeker stelde.
 * Een bezoeker is een hash van het IP-adres met een willekeurig zout dat elke dag nieuw is: het IP-adres zelf wordt niet
 * bewaard en de hash is na die dag niet meer te herleiden. Bij een nieuwe dag gaat alles van de vorige dag weg.
 */
export type Reservering = { ok: true; over: number } | { ok: false; reden: 'bezoeker' | 'budget' };

export class Teller extends DurableObject {
  /** Reserveert één vraag voor deze bezoeker, als de bezoeker en de chat nog onder hun plafond zitten. */
  async reserveer(ip: string, maxVragen: number, budgetMicro: number): Promise<Reservering> {
    await this.nieuweDag();
    const kosten = (await this.ctx.storage.get<number>('kosten')) ?? 0;
    if (kosten >= budgetMicro) return { ok: false, reden: 'budget' };
    const sleutel = await this.bezoeker(ip);
    const aantal = (await this.ctx.storage.get<number>(sleutel)) ?? 0;
    if (aantal >= maxVragen) return { ok: false, reden: 'bezoeker' };
    await this.ctx.storage.put(sleutel, aantal + 1);
    return { ok: true, over: maxVragen - aantal - 1 };
  }

  /** Geeft een gereserveerde vraag terug als er geen antwoord kwam (storing). */
  async geefTerug(ip: string): Promise<void> {
    const sleutel = await this.bezoeker(ip);
    const aantal = (await this.ctx.storage.get<number>(sleutel)) ?? 0;
    if (aantal > 0) await this.ctx.storage.put(sleutel, aantal - 1);
  }

  /** Telt de kosten van een antwoord op (in miljoenste dollars). */
  async boek(micro: number): Promise<void> {
    await this.nieuweDag();
    const kosten = (await this.ctx.storage.get<number>('kosten')) ?? 0;
    await this.ctx.storage.put('kosten', kosten + micro);
  }

  private async nieuweDag(): Promise<void> {
    const dag = new Date().toISOString().slice(0, 10);
    if ((await this.ctx.storage.get<string>('dag')) === dag) return;
    await this.ctx.storage.deleteAll();
    const zout = crypto.getRandomValues(new Uint8Array(16));
    await this.ctx.storage.put({ dag, zout: [...zout].map((b) => b.toString(16).padStart(2, '0')).join('') });
  }

  private async bezoeker(ip: string): Promise<string> {
    const zout = (await this.ctx.storage.get<string>('zout')) ?? '';
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${zout}:${ip}`));
    return `b:${[...new Uint8Array(hash).slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  }
}
