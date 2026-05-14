var e = {
	id: "grim-arithmetic",
	title: "Grim Arithmetic",
	description: "GM-facing PF2e mortality and encounter-risk analysis for Foundry VTT.",
	version: "0.5.0",
	authors: [{ name: "Kyle Travis" }],
	compatibility: {
		minimum: "13",
		verified: "14.361"
	},
	system: ["pf2e"],
	relationships: { systems: [{
		id: "pf2e",
		type: "system"
	}] },
	esmodules: ["dist/grim-arithmetic.js"],
	styles: ["styles/grim-arithmetic.css"],
	templates: ["templates/pair-detail-panel.hbs", "templates/danger-board-panel.hbs"],
	url: "https://github.com/kyletravis/grim-arithmetic",
	manifest: "https://github.com/kyletravis/grim-arithmetic/releases/latest/download/module.json",
	download: "https://github.com/kyletravis/grim-arithmetic/releases/download/v0.5.0/grim-arithmetic-v0.5.0.zip"
}, t = "grim-arithmetic", n = "Grim Arithmetic", r = e.version;
//#endregion
//#region src/debug-capture.ts
function i(e) {
	let t = e.actor, n = d(t?.system);
	return {
		token: {
			id: e.id,
			name: e.name,
			disposition: e.document?.disposition
		},
		actor: t ? {
			id: t.id,
			name: t.name,
			type: t.type,
			system: o(n),
			itemTypes: l(t.itemTypes),
			meleeItems: u(t.items).filter((e) => e.type === "melee").map((e) => ({
				id: e.id,
				name: e.name,
				type: e.type,
				system: {
					bonus: d(e.system).bonus,
					attack: d(e.system).attack,
					damageRolls: d(e.system).damageRolls,
					traits: d(e.system).traits
				}
			}))
		} : null
	};
}
function a(e) {
	let t = i(e);
	return console.log("Grim Arithmetic | Debug capture", t), t;
}
function o(e) {
	let t = c({
		immunities: e.immunities,
		weaknesses: e.weaknesses,
		resistances: e.resistances
	});
	return c({
		attributes: s(e),
		saves: e.saves,
		traits: e.traits,
		legacyDamageAdjustments: Object.keys(t).length > 0 ? t : void 0
	});
}
function s(e) {
	let t = d(e.attributes);
	return c({
		hp: t.hp,
		ac: t.ac,
		immunities: t.immunities,
		weaknesses: t.weaknesses,
		resistances: t.resistances
	});
}
function c(e) {
	return Object.fromEntries(Object.entries(e).filter(([, e]) => e !== void 0));
}
function l(e) {
	return { condition: d(e).condition };
}
function u(e) {
	if (Array.isArray(e)) return e.filter(f);
	let t = d(e).contents;
	if (Array.isArray(t)) return t.filter(f);
	if (f(e) && typeof e.filter == "function") {
		let t = e.filter(f);
		return Array.isArray(t) ? t.filter(f) : [];
	}
	return [];
}
function d(e) {
	return f(e) ? e : {};
}
function f(e) {
	return typeof e == "object" && !!e;
}
//#endregion
//#region src/settings.ts
function p() {
	game.settings.register(t, "defaultStrikes", {
		name: "Default enemy Strike count",
		hint: "Default number of Strikes used for immediate-threat estimates.",
		scope: "world",
		config: !0,
		type: Number,
		default: 2,
		choices: {
			1: "1 Strike",
			2: "2 Strikes",
			3: "3 Strikes"
		}
	}), game.settings.register(t, "debugLogging", {
		name: "Debug logging",
		hint: "Log Grim Arithmetic debug information to the browser console.",
		scope: "client",
		config: !0,
		type: Boolean,
		default: !1
	});
}
//#endregion
//#region src/engine/degree-of-success.ts
var m = [
	"criticalFailure",
	"failure",
	"success",
	"criticalSuccess"
];
function h(e) {
	let { die: t, total: n, dc: r } = e, i;
	return i = n >= r + 10 ? "criticalSuccess" : n >= r ? "success" : n <= r - 10 ? "criticalFailure" : "failure", t === 20 ? g(i, 1) : t === 1 ? g(i, -1) : i;
}
function g(e, t) {
	let n = m.indexOf(e);
	return m[Math.max(0, Math.min(m.length - 1, n + t))];
}
//#endregion
//#region src/engine/attack-probability.ts
function _(e) {
	let t = {
		criticalSuccess: 0,
		success: 0,
		failure: 0,
		criticalFailure: 0
	};
	for (let n = 1; n <= 20; n += 1) {
		let r = h({
			die: n,
			total: n + e.attackBonus,
			dc: e.ac
		});
		t[r] += 1;
	}
	return {
		criticalSuccess: t.criticalSuccess / 20,
		success: t.success / 20,
		failure: t.failure / 20,
		criticalFailure: t.criticalFailure / 20
	};
}
//#endregion
//#region src/engine/dice.ts
function ee(e) {
	let t = te(e).match(/[+-]?[^+-]+/g) ?? [], n = new Map([[0, 1]]);
	for (let e of t) n = v(n, ne(e));
	return re(n, e);
}
function te(e) {
	let t = e.replace(/\s+/g, "");
	if (!/^[+-]?(\d+d\d+|\d+)([+-](\d+d\d+|\d+))*$/.test(t)) throw Error(`Unsupported damage formula: ${e}`);
	return t;
}
function ne(e) {
	let t = e.startsWith("-") ? -1 : 1, n = e.replace(/^[+-]/, ""), r = n.match(/^(\d+)d(\d+)$/);
	if (!r) return new Map([[t * Number(n), 1]]);
	let i = Number(r[1]), a = Number(r[2]);
	if (!Number.isInteger(i) || !Number.isInteger(a) || i < 1 || a < 1) throw Error(`Unsupported damage term: ${e}`);
	let o = new Map([[0, 1]]), s = /* @__PURE__ */ new Map();
	for (let e = 1; e <= a; e += 1) s.set(t * e, 1 / a);
	for (let e = 0; e < i; e += 1) o = v(o, s);
	return o;
}
function v(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let [r, i] of e) for (let [e, a] of t) {
		let t = r + e;
		n.set(t, (n.get(t) ?? 0) + i * a);
	}
	return n;
}
function re(e, t) {
	let n = Array.from(e.entries()).map(([e, t]) => ({
		damage: e,
		probability: t
	})).sort((e, t) => e.damage - t.damage);
	if (n.length === 0 || n.reduce((e, t) => e + t.probability, 0) <= 0) throw Error(`Unsupported damage formula: ${t}`);
	let r = n.reduce((e, t) => e + t.damage * t.probability, 0);
	return {
		min: n[0].damage,
		max: n[n.length - 1].damage,
		mean: r,
		outcomes: n
	};
}
//#endregion
//#region src/engine/mortality.ts
function y(e) {
	let t = ee(e.damageFormula), n = ue(t), r = ie(e.damageType, e.targetAdjustments), i = b(t, r), a = b(n, r), o = ce(e.mapType).slice(0, e.strikes), s = [], c = [], l = 0, u = 0, d = 0, f = new Map([[0, 1]]);
	for (let t of o) {
		let n = _({
			attackBonus: e.attackBonus + t,
			ac: e.ac
		});
		s.push(n.success), c.push(n.criticalSuccess);
		let r = n.failure + n.criticalFailure;
		l += n.success * i.mean + n.criticalSuccess * a.mean, u += n.success * E(i.outcomes, e.hp), d += n.criticalSuccess * E(a.outcomes, e.hp), f = le(f, [
			{
				damage: 0,
				probability: r
			},
			...T(i.outcomes, n.success),
			...T(a.outcomes, n.criticalSuccess)
		]);
	}
	let p = fe(de(f, e.hp)), m = Math.max(0, e.hp - l), h = se({
		wounded: e.wounded ?? 0,
		doomed: e.doomed ?? 0,
		assumeHeroPointAvailable: e.assumeHeroPointAvailable ?? !1
	});
	return {
		downProbability: p,
		expectedHpAfterTurn: m,
		hitChanceByStrike: s,
		critChanceByStrike: c,
		riskLabel: pe(p),
		topRiskDrivers: me({
			downProbability: p,
			hitDownProbability: u,
			critDownProbability: d,
			highestCritChance: Math.max(...c)
		}),
		assumptions: [
			"Uses exact damage distributions for supported formulas.",
			r.note,
			"Critical damage is modeled as simple double damage of the supported formula total.",
			`Enemy turn model: ${e.strikes} Strike${e.strikes === 1 ? "" : "s"}.`,
			`MAP model: ${e.mapType}.`
		],
		notModeled: [
			"Deadly, fatal, precision, splash, and persistent damage.",
			"Reactions such as Shield Block or Champion reactions.",
			"Healing before or during the enemy turn.",
			"Permanent death probability."
		],
		damage: he(i, a),
		dyingSeverity: h,
		damageAdjustment: r
	};
}
function ie(e, t) {
	let n = C(e), r = {
		damageType: n ?? "unknown",
		resistance: 0,
		weakness: 0,
		immune: !1,
		note: "Damage type unknown; no resistance, weakness, or immunity applied."
	};
	if (!n) return r;
	let i = x(t?.resistances ?? [], n), a = x(t?.weaknesses ?? [], n);
	if ((t?.immunities ?? []).some((e) => S(e, n))) return {
		damageType: n,
		resistance: 0,
		weakness: 0,
		immune: !0,
		note: `Applied ${n} immunity; modeled damage is 0.`
	};
	let o = [];
	return i > 0 && o.push(`${n} resistance ${i}`), a > 0 && o.push(`${n} weakness ${a}`), {
		damageType: n,
		resistance: i,
		weakness: a,
		immune: !1,
		note: o.length > 0 ? `Applied ${ae(o)}.` : `No ${n} resistance, weakness, or immunity matched.`
	};
}
function ae(e) {
	return e.length <= 1 ? e[0] ?? "" : `${e.slice(0, -1).join(", ")} and ${e.at(-1)}`;
}
function b(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e.outcomes) {
		let e = oe(r.damage, t);
		n.set(e, (n.get(e) ?? 0) + r.probability);
	}
	let r = Array.from(n.entries()).sort(([e], [t]) => e - t).map(([e, t]) => ({
		damage: e,
		probability: t
	})), i = r.reduce((e, t) => e + t.damage * t.probability, 0);
	return {
		min: r[0]?.damage ?? 0,
		max: r.at(-1)?.damage ?? 0,
		mean: i,
		outcomes: r
	};
}
function oe(e, t) {
	return t.immune ? 0 : Math.max(0, e - t.resistance) + t.weakness;
}
function x(e, t) {
	return e.reduce((e, n) => S(n.type, t) ? Math.max(e, n.value) : e, 0);
}
function S(e, t) {
	let n = C(e), r = C(t);
	return !n || !r ? !1 : n === r || n === "all" ? !0 : n === "physical" ? r === "bludgeoning" || r === "piercing" || r === "slashing" : !1;
}
function C(e) {
	if (e) return e.trim().toLowerCase().replace(/\s+/g, "-");
}
function se({ wounded: e, doomed: t, assumeHeroPointAvailable: n }) {
	let r = Math.max(0, Math.floor(e)), i = Math.max(0, Math.floor(t)), a = Math.max(1, 4 - i), o = 1 + r, s = 2 + r;
	return {
		wounded: r,
		doomed: i,
		deathThreshold: a,
		normalDownDying: o,
		critDownDying: s,
		immediateDeathFlag: w({
			normalDownDying: o,
			critDownDying: s,
			deathThreshold: a
		}),
		heroPointNote: n ? "Hero Point prevention is assumed available; this can prevent death but is not modeled as a survival probability." : "No Hero Point death-prevention assumption is applied."
	};
}
function w({ normalDownDying: e, critDownDying: t, deathThreshold: n }) {
	return e >= n ? `Normal down would reach Dying ${e}, meeting or exceeding the doomed-adjusted death threshold (Dying ${n}).` : t >= n ? `Crit-down would reach Dying ${t}, meeting or exceeding the doomed-adjusted death threshold (Dying ${n}).` : t === n - 1 ? `Crit-down would put this PC at Dying ${t}, one step below the doomed-adjusted death threshold (Dying ${n}).` : `If downed, severity would be Dying ${e} on a normal hit or Dying ${t} on a critical hit.`;
}
function ce(e) {
	return e === "agile" ? [
		0,
		-4,
		-8
	] : e === "none" ? [
		0,
		0,
		0
	] : [
		0,
		-5,
		-10
	];
}
function le(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let [r, i] of e) for (let e of t) {
		if (e.probability === 0) continue;
		let t = r + e.damage, a = i * e.probability;
		n.set(t, (n.get(t) ?? 0) + a);
	}
	return n;
}
function T(e, t) {
	return t === 0 ? [] : e.map((e) => ({
		damage: e.damage,
		probability: e.probability * t
	}));
}
function ue(e) {
	return {
		min: e.min * 2,
		max: e.max * 2,
		mean: e.mean * 2,
		outcomes: e.outcomes.map((e) => ({
			damage: e.damage * 2,
			probability: e.probability
		}))
	};
}
function E(e, t) {
	return e.reduce((e, n) => e + (n.damage >= t ? n.probability : 0), 0);
}
function de(e, t) {
	let n = 0;
	for (let [r, i] of e) r >= t && (n += i);
	return n;
}
function fe(e) {
	return Math.max(0, Math.min(1, e));
}
function pe(e) {
	return e < .05 ? "Low" : e < .15 ? "Guarded" : e < .35 ? "Dangerous" : e < .6 ? "Severe" : "Grim";
}
function me({ downProbability: e, hitDownProbability: t, critDownProbability: n, highestCritChance: r }) {
	return e === 0 ? ["No exact supported hit or crit damage roll in the selected sequence downs the PC."] : t === 0 && n > 0 && n < r ? ["Only some crit damage rolls can down the PC; exact distribution reduces false precision from average damage."] : t === 0 && n > 0 ? [`Down risk is crit-driven; highest strike crit chance is ${Math.round(r * 100)}%.`] : ["Cumulative exact hit and crit damage rolls can down the PC in the modeled sequence."];
}
function he(e, t) {
	let n = e.mean.toFixed(1);
	return {
		min: e.min,
		max: e.max,
		average: n,
		critMin: t.min,
		critMax: t.max,
		swinginess: ge(e, n)
	};
}
function ge(e, t) {
	let n = e.max - e.min + 1;
	return n >= e.mean ? `High swing: damage range is ${n} around an average of ${t}.` : `Moderate swing: damage range is ${n} around an average of ${t}.`;
}
//#endregion
//#region src/engine/encounter-risk.ts
var _e = (e) => `${e} has no supported melee Strike with numeric attack bonus and damage formula.`, ve = "Encounter too large to compute pairwise risk safely. Reduce combatants or use the single-pair detail view.";
function ye(e, t) {
	let { adapter: n, controls: r, pairLimit: i } = t, a = e.hostiles.map((e) => ({
		hostile: e,
		attacks: xe(n, e.token)
	})), o = e.pcs.length * a.reduce((e, t) => e + t.attacks.length, 0);
	if (i !== void 0 && o > i) return {
		pairs: [],
		skipped: !0,
		caveats: [ve]
	};
	let s = [], c = [];
	for (let { hostile: t, attacks: n } of a) {
		if (n.length === 0) {
			c.push(_e(t.snapshot.name));
			continue;
		}
		for (let i of e.pcs) for (let e of n) s.push(be(i.snapshot, t.snapshot, e, r));
	}
	return {
		pairs: s,
		skipped: !1,
		caveats: c
	};
}
function be(e, t, n, r) {
	let i = [];
	try {
		let a = y({
			hp: e.hp.current + (e.hp.temp ?? 0),
			ac: e.defenses.ac + r.shieldBonus,
			attackBonus: n.attackBonus,
			damageFormula: n.damageFormula,
			strikes: r.strikes,
			mapType: D(r.mapMode, n.mapType),
			wounded: O(e, r.woundedOverride),
			doomed: e.deathState?.doomed ?? 0,
			assumeHeroPointAvailable: k(e, r.heroPointMode),
			damageType: n.damageType,
			targetAdjustments: e.damageAdjustments
		});
		return {
			pcId: e.id,
			pcName: e.name,
			enemyId: t.id,
			enemyName: t.name,
			attackId: n.id,
			attackName: n.name,
			downProbability: a.downProbability,
			riskLabel: a.riskLabel,
			caveats: i
		};
	} catch (r) {
		return i.push(`Risk could not be computed for this pair: ${r instanceof Error ? r.message : "unknown error"}.`), {
			pcId: e.id,
			pcName: e.name,
			enemyId: t.id,
			enemyName: t.name,
			attackId: n.id,
			attackName: n.name,
			downProbability: 0,
			riskLabel: "Low",
			caveats: i
		};
	}
}
function xe(e, t) {
	try {
		return e.getAttacksFromToken(t);
	} catch {
		return [];
	}
}
function D(e, t) {
	return e === "auto" ? t === "unknown" ? "normal" : t : e;
}
function O(e, t) {
	return t === "current" ? e.deathState?.wounded ?? 0 : Number(t);
}
function k(e, t) {
	return t === "available" ? !0 : t === "unavailable" ? !1 : (e.deathState?.heroPoints ?? 0) > 0;
}
//#endregion
//#region src/foundry/encounter-participants.ts
var A = "Unknown actor", j = "No active combat encounter — using scene tokens as a best-effort fallback.", M = "No active combat encounter.";
function Se(e, t, n = {}) {
	let r = e.combatants ? Array.from(e.combatants) : [];
	return r.length > 0 ? N(r.map((e) => e.token), t, []) : n.allowSceneFallback && e.sceneTokens ? N(Array.from(e.sceneTokens), t, [j]) : {
		pcs: [],
		hostiles: [],
		unsupported: [],
		caveats: [M]
	};
}
function N(e, t, n) {
	let r = [], i = [], a = [], o = [...n];
	for (let n of e) {
		if (!n) {
			a.push(`${A} (no token)`);
			continue;
		}
		let e;
		try {
			e = t.getCombatantFromToken(n);
		} catch {
			a.push(n.name ?? A);
			continue;
		}
		if (!e) {
			a.push(n.name ?? A);
			continue;
		}
		e.disposition === "pc" ? r.push({
			token: n,
			snapshot: e
		}) : e.disposition === "enemy" ? i.push({
			token: n,
			snapshot: e
		}) : o.push(`${e.name} is ${e.disposition} and was excluded from the danger board.`);
	}
	return {
		pcs: r,
		hostiles: i,
		unsupported: a,
		caveats: o
	};
}
function Ce(e, t = {}) {
	let n = game.combat, r = n?.combatants ? Array.from(n.combatants).map((e) => ({ token: we(e) })) : void 0, i = canvas.tokens?.placeables;
	return Se({
		combatants: r,
		sceneTokens: i
	}, e, t);
}
function we(e) {
	let t = e.token;
	if (t) return t.object ?? t;
}
//#endregion
//#region src/systems/pf2e-adapter.ts
var Te = -1, P = class {
	id = "pf2e";
	label = "Pathfinder Second Edition";
	getCombatantFromToken(e) {
		let t = e.actor;
		if (!t) return null;
		let n = R(t.system), r = R(n.attributes), i = R(r.hp), a = R(r.ac), o = i.value, s = i.max, c = a.value;
		if (!B(o) || !B(s) || !B(c)) return null;
		let l = R(n.saves), u = R(R(n.resources).heroPoints), d = R(n.traits);
		return {
			id: e.id ?? t.id ?? "",
			name: e.name ?? t.name ?? "Unknown Combatant",
			disposition: Ee(e, t),
			hp: {
				current: o,
				max: s,
				temp: V(i.temp)
			},
			defenses: {
				ac: c,
				fort: V(R(l.fortitude).value),
				reflex: V(R(l.reflex).value),
				will: V(R(l.will).value)
			},
			deathState: {
				dying: F(t, "dying"),
				wounded: F(t, "wounded"),
				doomed: F(t, "doomed"),
				heroPoints: V(u.value)
			},
			damageAdjustments: {
				resistances: L(r.resistances ?? n.resistances),
				weaknesses: L(r.weaknesses ?? n.weaknesses),
				immunities: Me(r.immunities ?? n.immunities)
			},
			traits: U(d.value),
			assumptions: []
		};
	}
	getAttacksFromToken(e) {
		let t = e.actor;
		return De(t).filter((e) => e.type === "melee").map((e) => {
			let t = R(e.system), n = Oe(t), r = ke(t), i = Ae(r);
			if (!B(n) || typeof i != "string") return null;
			let a = U(R(t.traits).value);
			return {
				id: e.id ?? "",
				name: e.name ?? "Unknown Strike",
				attackBonus: n,
				damageFormula: i,
				damageType: je(r),
				traits: a,
				mapType: a.includes("agile") ? "agile" : "normal",
				assumptions: ["PF2e Strike extraction is first-pass and may miss conditional modifiers."]
			};
		}).filter((e) => e !== null);
	}
};
function Ee(e, t) {
	return t.type === "character" ? "pc" : e.document?.disposition === Te ? "enemy" : "neutral";
}
function F(e, t) {
	let n = e.itemTypes?.condition?.find((e) => e.slug === t);
	return n ? V(n.value) ?? V(R(R(n.system).value).value) ?? 0 : 0;
}
function De(e) {
	let t = e?.items;
	if (Array.isArray(t)) return t.filter(I);
	let n = R(t).contents;
	if (Array.isArray(n)) return n.filter(I);
	if (z(t) && typeof t.filter == "function") {
		let e = t.filter(I);
		return Array.isArray(e) ? e : [];
	}
	return [];
}
function I(e) {
	return z(e);
}
function Oe(e) {
	return H(R(e.bonus).value) ?? H(R(e.attack).value);
}
function ke(e) {
	let t = R(e.damageRolls);
	return Object.values(t).find(z);
}
function Ae(e) {
	if (!e) return;
	let t = e.damage, n = e.formula;
	if (typeof t == "string") return t;
	if (typeof n == "string") return n;
}
function je(e) {
	if (!e) return;
	let t = e.damageType ?? e.type ?? e.category;
	return typeof t == "string" ? t : void 0;
}
function L(e) {
	return (Array.isArray(e) ? e : Object.values(R(e))).filter(z).map((e) => {
		let t = e.type ?? e.slug ?? e.label, n = H(e.value) ?? H(e.amount);
		return typeof t != "string" || n === void 0 ? null : {
			type: t,
			value: n
		};
	}).filter((e) => e !== null);
}
function Me(e) {
	return (Array.isArray(e) ? e : Object.values(R(e))).map((e) => {
		if (typeof e == "string") return e;
		let t = R(e), n = t.type ?? t.slug ?? t.label;
		return typeof n == "string" ? n : null;
	}).filter((e) => typeof e == "string");
}
function R(e) {
	return z(e) ? e : {};
}
function z(e) {
	return typeof e == "object" && !!e;
}
function B(e) {
	return typeof e == "number" && Number.isFinite(e);
}
function V(e) {
	return B(e) ? e : void 0;
}
function H(e) {
	if (B(e)) return e;
	if (typeof e != "string") return;
	let t = Number(e.trim().replace(/^\+/, ""));
	return B(t) ? t : void 0;
}
function U(e) {
	return Array.isArray(e) ? e.map((e) => {
		if (typeof e == "string") return e;
		let t = R(e).slug;
		return typeof t == "string" ? t : null;
	}).filter((e) => typeof e == "string") : [];
}
//#endregion
//#region src/ui/danger-board.ts
var Ne = 5;
function Pe(e, t = {}) {
	let n = t.topN ?? Ne;
	return {
		topEndangeredPcs: W(e.pairs, (e) => e.pcId).sort((e, t) => t.downProbability - e.downProbability).slice(0, n).map(G),
		topDangerousEnemies: W(e.pairs, (e) => e.enemyId).sort((e, t) => t.downProbability - e.downProbability).slice(0, n).map(G),
		caveats: e.caveats,
		empty: e.pairs.length === 0,
		skipped: e.skipped
	};
}
function W(e, t) {
	let n = /* @__PURE__ */ new Map();
	for (let r of e) {
		let e = t(r), i = n.get(e);
		(!i || r.downProbability > i.downProbability) && n.set(e, r);
	}
	return Array.from(n.values());
}
function G(e) {
	let t = Math.round(e.downProbability * 100);
	return {
		pcId: e.pcId,
		enemyId: e.enemyId,
		attackId: e.attackId,
		pcName: e.pcName,
		enemyName: e.enemyName,
		attackName: e.attackName,
		downPercent: t,
		riskLabel: e.riskLabel,
		label: `${e.pcName} vs ${e.enemyName} ${e.attackName} — ${t}% ${e.riskLabel}`
	};
}
//#endregion
//#region src/ui/panel-data.ts
var K = {
	strikes: 2,
	mapMode: "auto",
	shieldBonus: 0,
	woundedOverride: "current",
	heroPointMode: "actor",
	attackId: ""
}, q = "Permanent death probability is planned for a future milestone and is not modeled in MVP.";
function Fe({ selection: e, adapter: t, controls: n, moduleVersion: r }) {
	if (e.errors.length > 0 || !e.subjectToken || !e.enemyToken) return {
		moduleVersion: r,
		message: "Select one PC token and target one enemy token to estimate immediate down risk.",
		permanentDeath: q,
		errors: e.errors,
		controls: J(n, [])
	};
	let i = t.getCombatantFromToken(e.subjectToken), a = t.getCombatantFromToken(e.enemyToken), o = t.getAttacksFromToken(e.enemyToken), s = Le(o, n.attackId), c = Ie(i, a, s), l = J(n, o, s?.id);
	if (c.length > 0 || !i || !a || !s) return {
		moduleVersion: r,
		message: "Grim Arithmetic could not extract enough PF2e data for this token pair yet.",
		permanentDeath: q,
		errors: c,
		controls: l
	};
	let u = Re(n.mapMode, s.mapType), d = i.defenses.ac + n.shieldBonus, f = i.hp.current + (i.hp.temp ?? 0), p = Be(i, n.woundedOverride), m = i.deathState?.doomed ?? 0, h = Ve(i, n.heroPointMode), g = y({
		hp: f,
		ac: d,
		attackBonus: s.attackBonus,
		damageFormula: s.damageFormula,
		strikes: n.strikes,
		mapType: u,
		wounded: p,
		doomed: m,
		assumeHeroPointAvailable: h,
		damageType: s.damageType,
		targetAdjustments: i.damageAdjustments
	}), _ = [...s.assumptions, ...g.assumptions];
	return n.shieldBonus > 0 && _.push(`Applies a +${n.shieldBonus} shield/status AC adjustment.`), n.woundedOverride !== "current" && _.push(`Uses wounded override ${n.woundedOverride} for dying severity if the PC is downed.`), n.heroPointMode !== "actor" && _.push(`Uses Hero Point override: ${n.heroPointMode}.`), {
		moduleVersion: r,
		message: "Immediate down-risk estimate based on the selected PC and targeted enemy.",
		permanentDeath: q,
		errors: [],
		controls: l,
		subject: i,
		enemy: a,
		attack: s,
		risk: {
			downPercent: Y(g.downProbability),
			expectedHpAfterTurn: g.expectedHpAfterTurn.toFixed(1),
			riskLabel: g.riskLabel,
			effectiveAc: d,
			modeledHp: f,
			woundedNote: ze(i, n.woundedOverride),
			damage: g.damage,
			damageAdjustment: g.damageAdjustment,
			dyingSeverity: g.dyingSeverity,
			strikeChances: g.hitChanceByStrike.map((e, t) => ({
				index: t + 1,
				hitPercent: Y(e),
				critPercent: Y(g.critChanceByStrike[t] ?? 0)
			})),
			assumptions: _,
			notModeled: g.notModeled
		}
	};
}
function J(e, t, n = e.attackId) {
	let r = t.some((e) => e.id === n) ? n : t[0]?.id ?? "";
	return {
		strikes: [
			"1",
			"2",
			"3"
		].map((t) => ({
			value: t,
			label: `${t} Strike${t === "1" ? "" : "s"}`,
			selected: String(e.strikes) === t
		})),
		attacks: t.map((e) => ({
			value: e.id,
			label: `${e.name} — +${e.attackBonus}, ${e.damageFormula}`,
			selected: e.id === r
		})),
		mapMode: [
			["auto", "Auto"],
			["normal", "Normal"],
			["agile", "Agile"],
			["none", "None"]
		].map(([t, n]) => ({
			value: t,
			label: n,
			selected: e.mapMode === t
		})),
		shieldBonus: [
			"0",
			"1",
			"2"
		].map((t) => ({
			value: t,
			label: t === "0" ? "No shield bonus" : `+${t} AC`,
			selected: String(e.shieldBonus) === t
		})),
		woundedOverride: [
			"current",
			"0",
			"1",
			"2",
			"3"
		].map((t) => ({
			value: t,
			label: t === "current" ? "Current actor value" : `Wounded ${t}`,
			selected: e.woundedOverride === t
		})),
		heroPointMode: [
			["actor", "Use actor Hero Points"],
			["available", "Assume Hero Point available"],
			["unavailable", "Assume no Hero Point"]
		].map(([t, n]) => ({
			value: t,
			label: n,
			selected: e.heroPointMode === t
		}))
	};
}
function Ie(e, t, n) {
	let r = [];
	return e || r.push("Could not read selected PC HP/AC from PF2e actor data."), t || r.push("Could not read targeted enemy HP/AC from PF2e actor data."), e && e.disposition !== "pc" && r.push("Selected token is not recognized as a PC/character by the PF2e adapter."), t && t.disposition !== "enemy" && r.push("Targeted token is not recognized as an enemy/NPC by the PF2e adapter."), n || r.push("Targeted enemy has no supported melee Strike with a numeric attack bonus and supported damage formula."), r;
}
function Le(e, t) {
	return e.find((e) => e.id === t) ?? e[0];
}
function Re(e, t) {
	return e === "auto" ? t === "unknown" ? "normal" : t : e;
}
function ze(e, t) {
	return t === "current" ? `Current actor wounded value used for dying severity: ${e.deathState?.wounded ?? 0}` : `Override used for dying severity: Wounded ${t}`;
}
function Be(e, t) {
	return t === "current" ? e.deathState?.wounded ?? 0 : Number(t);
}
function Ve(e, t) {
	return t === "available" ? !0 : t === "unavailable" ? !1 : (e.deathState?.heroPoints ?? 0) > 0;
}
function Y(e) {
	return Math.round(e * 100);
}
//#endregion
//#region src/foundry/selection.ts
function He() {
	return Ue({
		controlled: canvas.tokens?.controlled,
		targets: game.user?.targets
	});
}
function Ue(e) {
	let t = e.controlled ?? [], n = Array.from(e.targets ?? []), r = [], i = t.length === 1 ? t[0] : null, a = n.length === 1 ? n[0] : null;
	return t.length === 0 && r.push("No PC token selected. Select one PC token."), t.length > 1 && r.push("Multiple tokens selected. Select only one PC token."), n.length === 0 && r.push("No target selected. Target one enemy token."), n.length > 1 && r.push("Multiple targets selected. Target only one enemy token."), {
		subjectToken: i,
		enemyToken: a,
		errors: r
	};
}
//#endregion
//#region src/ui/pair-detail-resolver.ts
function We(e, t) {
	let n = [];
	return e || n.push("PC token is no longer on the canvas. The encounter may have changed since the danger board was rendered."), t || n.push("Enemy token is no longer on the canvas. The encounter may have changed since the danger board was rendered."), {
		subjectToken: e,
		enemyToken: t,
		errors: n
	};
}
//#endregion
//#region src/ui/pair-detail-panel.ts
var X = class e extends Application {
	static instance;
	controls = { ...K };
	explicitSelection;
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: `${t}-pair-detail`,
			title: `${n} — Pair Detail`,
			template: `modules/${t}/templates/pair-detail-panel.hbs`,
			width: 500,
			height: "auto",
			resizable: !0,
			classes: ["grim-arithmetic-window"]
		});
	}
	static getInstance() {
		return e.instance ||= new e(), e.instance;
	}
	static openForPair(t, n, r) {
		let i = canvas.tokens?.get(t) ?? null, a = canvas.tokens?.get(n) ?? null, o = e.getInstance();
		o.explicitSelection = We(i, a), r !== void 0 && (o.controls.attackId = r), o.render(!0);
	}
	static openForSelection() {
		let t = e.getInstance();
		t.explicitSelection = void 0, t.render(!0);
	}
	async getData() {
		return Fe({
			selection: this.explicitSelection ?? He(),
			adapter: new P(),
			controls: this.controls,
			moduleVersion: r
		});
	}
	activateListeners(e) {
		super.activateListeners(e), e.find("[data-grim-control]").on("change", (e) => {
			let t = e.currentTarget, n = Ye(t);
			n && (this.updateControl(n, t.value), this.render(!1));
		}), e.find("[data-grim-refresh]").on("click", () => {
			this.render(!1);
		});
	}
	updateControl(e, t) {
		e === "strikes" && (this.controls.strikes = Ge(Number(t))), e === "mapMode" && (this.controls.mapMode = Ke(t)), e === "shieldBonus" && (this.controls.shieldBonus = Z(t)), e === "woundedOverride" && (this.controls.woundedOverride = qe(t)), e === "heroPointMode" && (this.controls.heroPointMode = Je(t)), e === "attackId" && (this.controls.attackId = t);
	}
};
function Ge(e) {
	return e === 1 || e === 2 || e === 3 ? e : 2;
}
function Ke(e) {
	return e === "normal" || e === "agile" || e === "none" ? e : "auto";
}
function Z(e) {
	return e === "1" ? 1 : e === "2" ? 2 : 0;
}
function qe(e) {
	return e === "0" || e === "1" || e === "2" || e === "3" ? e : "current";
}
function Je(e) {
	return e === "available" || e === "unavailable" ? e : "actor";
}
function Ye(e) {
	let t = e.dataset?.grimControl;
	return t === "strikes" || t === "mapMode" || t === "shieldBonus" || t === "woundedOverride" || t === "heroPointMode" || t === "attackId" ? t : null;
}
//#endregion
//#region src/ui/danger-board-panel.ts
var Xe = "Encounter-wide immediate risk. Click a row to see the detail math, or use the selection-target button to model an arbitrary pair.", Q = class extends Application {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: `${t}-danger-board`,
			title: `${n} — Encounter Danger Board`,
			template: `modules/${t}/templates/danger-board-panel.hbs`,
			width: 520,
			height: "auto",
			resizable: !0,
			classes: ["grim-arithmetic-window"]
		});
	}
	async getData() {
		let e = new P();
		return {
			moduleVersion: r,
			message: Xe,
			dangerBoard: Pe(ye(Ce(e), {
				adapter: e,
				controls: K,
				pairLimit: 200
			}))
		};
	}
	activateListeners(e) {
		super.activateListeners(e), e.find("[data-grim-open-detail-pair]").on("click", (e) => {
			let t = e.currentTarget.dataset, n = t?.grimPcId, r = t?.grimEnemyId, i = t?.grimAttackId;
			!n || !r || X.openForPair(n, r, i);
		}), e.find("[data-grim-open-detail-selection]").on("click", () => {
			X.openForSelection();
		}), e.find("[data-grim-refresh]").on("click", () => {
			this.render(!1);
		});
	}
}, $ = `${t}-open-panel`;
function Ze() {
	new Q().render(!0);
}
function Qe() {
	Hooks.on("getSceneControlButtons", (e) => {
		let t = e.tokens;
		t && (t.tools[$] = {
			name: $,
			title: "Grim Arithmetic",
			icon: "fa-solid fa-skull",
			order: Object.keys(t.tools).length,
			button: !0,
			visible: !!game.user?.isGM,
			onChange: Ze
		});
	});
}
Hooks.once("init", () => {
	console.log(`${n} | Initializing`), p(), Qe();
}), Hooks.once("ready", () => {
	if (!game.user?.isGM) return;
	let e = game.modules.get(t);
	e && (e.api = {
		openPanel: () => new Q().render(!0),
		openPairDetail: (e, t, n) => X.openForPair(e, t, n),
		openPairDetailFromSelection: () => X.openForSelection(),
		captureTokenDebug: (e = canvas.tokens?.controlled?.[0]) => a(e)
	});
});
//#endregion

//# sourceMappingURL=grim-arithmetic.js.map