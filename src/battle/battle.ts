// Turn based battle rules. This file has no drawing code, so it can be tested on its own.
import { Rng } from '../rng';
import type { EnemyStats } from '../entities/enemies';
import { Knight, attackPower, gainXp, guardShare, has, heal, maxHp, potionHeal } from '../entities/knight';

export type BattleAction = 'attack' | 'guard' | 'potion' | 'flee';
export type Outcome = 'ongoing' | 'won' | 'lost' | 'fled';
export type Anim = 'none' | 'knightHit' | 'enemyHit' | 'guard' | 'heal' | 'windup' | 'flee' | 'enemyDown' | 'knightDown' | 'reward' | 'levelUp';

/** One step of the fight to show on screen, with the health values after it. */
export interface BattleEvent {
  text: string;
  anim: Anim;
  knightHp: number;
  enemyHp: number;
  amount?: number;
  /** True on a hit the knight took while guarding. */
  blocked?: boolean;
  /** Set when the damage came from a trinket and not from a blow. */
  source?: 'thorn';
}

/** The optional fields an event can carry beyond its text, animation and amount. */
type EventExtras = Pick<BattleEvent, 'blocked' | 'source'>;

export interface BattleReward {
  xp: number;
  gold: number;
  potion: boolean;
  levels: number;
}

const HEAVY_MULT = 2.2;
const RIPOSTE_MULT = 1.5;
const FLEE_CHANCE = 0.6;
const ENRAGE_MULT = 1.3;

export class Battle {
  outcome: Outcome = 'ongoing';
  enemyHp: number;
  /** True while the enemy is winding up a heavy blow that lands on its next turn. */
  charging = false;
  /** True after Guard. The next Attack hits harder. */
  riposte = false;
  enraged = false;
  reward: BattleReward | null = null;
  /** Potions drunk in this fight. A refused potion does not count. */
  potionsUsed = 0;
  /** Health the knight lost in this fight, after Guard. */
  damageTaken = 0;
  private guarding = false;
  private sinceHeavy = 0;

  constructor(
    readonly knight: Knight,
    readonly enemy: EnemyStats,
    readonly ambush: boolean,
    private readonly rng: Rng,
  ) {
    this.enemyHp = enemy.maxHp;
  }

  /** The enemy's name as it reads inside a sentence. */
  private get foe(): string {
    return this.enemy.boss ? this.enemy.name : `the ${this.enemy.name}`;
  }

  /** The enemy's name as it reads at the start of a sentence. */
  private get Foe(): string {
    return this.enemy.boss ? this.enemy.name : `The ${this.enemy.name}`;
  }

  canFlee(): boolean {
    return !this.enemy.boss;
  }

  private ev(text: string, anim: Anim = 'none', amount?: number, extras: EventExtras = {}): BattleEvent {
    return { text, anim, knightHp: this.knight.hp, enemyHp: this.enemyHp, amount, ...extras };
  }

  /** Opening events. An ambusher gets a free first turn. */
  begin(): BattleEvent[] {
    const events: BattleEvent[] = [];
    const name = this.enemy.name;
    if (this.ambush) {
      events.push(this.ev(`Ambush! A ${name} leaps out at you.`));
      if (has(this.knight, 'bell')) {
        events.push(this.ev('Your Bell of Warning rings. You are ready for it.'));
      } else {
        this.enemyTurn(events);
      }
    } else if (this.enemy.boss) {
      events.push(this.ev(`${name} heaves himself up and blocks the hall.`));
    } else {
      events.push(this.ev(`You face a ${name}.`));
    }
    return events;
  }

  act(action: BattleAction): BattleEvent[] {
    const events: BattleEvent[] = [];
    if (this.outcome !== 'ongoing') return events;
    const k = this.knight;
    // A potion with none left or at full health would be wasted. Nothing changes and no turn passes.
    if (action === 'potion' && (k.potions <= 0 || k.hp >= maxHp(k))) return events;
    this.guarding = false;

    if (action === 'attack') {
      let dmg = attackPower(k) * this.rng.range(0.85, 1.15);
      const crit = this.rng.chance(0.1);
      if (this.riposte) dmg *= RIPOSTE_MULT;
      if (crit) dmg *= 1.5;
      const amount = Math.max(1, Math.round(dmg));
      this.enemyHp = Math.max(0, this.enemyHp - amount);
      const lead = this.riposte ? 'You strike back from your guard' : crit ? 'A clean hit! You strike' : 'You strike';
      this.riposte = false;
      events.push(this.ev(`${lead} ${this.foe} for ${amount}.`, 'enemyHit', amount));
      if (this.enemyHp <= 0) {
        this.win(events);
        return events;
      }
      this.checkEnrage(events);
    } else if (action === 'guard') {
      this.guarding = true;
      this.riposte = true;
      events.push(this.ev('You raise your shield.', 'guard'));
    } else if (action === 'potion') {
      k.potions--;
      this.potionsUsed++;
      const amount = heal(k, potionHeal(k));
      events.push(this.ev(`You drink a potion and heal ${amount}.`, 'heal', amount));
    } else {
      if (!this.canFlee()) {
        events.push(this.ev('There is no way past him. You can not flee.'));
        return events;
      }
      if (has(k, 'buckle') || this.rng.chance(FLEE_CHANCE)) {
        this.outcome = 'fled';
        events.push(this.ev('You slip away from the fight.', 'flee'));
        return events;
      }
      events.push(this.ev(`You try to flee, but ${this.foe} cuts you off.`));
    }

    this.enemyTurn(events);
    return events;
  }

  private enemyTurn(events: BattleEvent[]): void {
    const e = this.enemy;
    if (this.charging) {
      this.charging = false;
      this.sinceHeavy = 0;
      this.hitKnight(events, HEAVY_MULT, `${this.Foe} brings down a heavy blow`);
    } else if (e.trait === 'heavy' && this.sinceHeavy >= e.heavyEvery) {
      this.charging = true;
      events.push(this.ev(`${this.Foe} winds up a heavy blow. Guard now!`, 'windup'));
    } else {
      this.sinceHeavy++;
      if (e.trait === 'double' && this.rng.chance(0.3)) {
        this.hitKnight(events, 0.7, `${this.Foe} snaps at you`);
        if (this.outcome === 'ongoing') this.hitKnight(events, 0.7, 'It bites again');
      } else {
        this.hitKnight(events, 1, `${this.Foe} hits you`);
      }
    }
  }

  private hitKnight(events: BattleEvent[], mult: number, lead: string): void {
    const k = this.knight;
    let dmg = this.enemy.atk * mult * (this.enraged ? ENRAGE_MULT : 1) * this.rng.range(0.85, 1.15);
    if (this.guarding) dmg *= 1 - guardShare(k);
    const amount = Math.max(1, Math.round(dmg));
    const before = k.hp;
    k.hp = Math.max(0, k.hp - amount);
    this.damageTaken += before - k.hp;
    const line = this.guarding ? `${lead}. Your guard holds and you take ${amount}.` : `${lead} for ${amount}.`;
    events.push(this.ev(line, 'knightHit', amount, { blocked: this.guarding }));
    if (k.hp <= 0) {
      this.outcome = 'lost';
      events.push(this.ev('You fall to the cold stone floor.', 'knightDown'));
      return;
    }
    if (has(k, 'thorn')) {
      this.enemyHp = Math.max(0, this.enemyHp - 2);
      events.push(this.ev(`Your Thorn Ring pricks ${this.foe} for 2.`, 'enemyHit', 2, { source: 'thorn' }));
      if (this.enemyHp <= 0) this.win(events);
      else this.checkEnrage(events);
    }
  }

  /** The boss enrages once, the first time his health drops to half or below while he still stands. */
  private checkEnrage(events: BattleEvent[]): void {
    const e = this.enemy;
    if (!e.boss || this.enraged || this.outcome !== 'ongoing' || this.enemyHp <= 0) return;
    if (this.enemyHp > e.maxHp / 2) return;
    this.enraged = true;
    events.push(this.ev(`${e.name} roars with rage. His blows hit harder now.`, 'windup'));
  }

  private win(events: BattleEvent[]): void {
    const k = this.knight;
    const e = this.enemy;
    this.outcome = 'won';
    events.push(this.ev(`${this.Foe} is beaten!`, 'enemyDown'));
    const xp = Math.round(e.xp * (has(k, 'ribbon') ? 1.25 : 1));
    const gold = Math.round(e.gold * (has(k, 'coin') ? 1.25 : 1));
    const potion = !e.boss && this.rng.chance(0.15);
    k.gold += gold;
    events.push(this.ev(`You gain ${xp} XP and ${gold} gold.`, 'reward'));
    const levels = gainXp(k, xp);
    this.reward = { xp, gold, potion, levels };
    if (levels > 0) {
      events.push(this.ev(`Level up! You are now level ${k.level}. Max health is ${maxHp(k)}.`, 'levelUp'));
    }
    if (potion) {
      k.potions++;
      events.push(this.ev('You find a potion.', 'reward'));
    }
    if (has(k, 'leaf')) {
      const amount = heal(k, 3);
      if (amount > 0) events.push(this.ev(`Your Mender's Leaf heals ${amount}.`, 'heal', amount));
    }
  }
}
